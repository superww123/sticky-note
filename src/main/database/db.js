const initSqlJs = require('sql.js')
const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let db = null
let SQL = null

function getDbPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'sticky-note.db')
}

/**
 * 持久化：将内存数据库写入磁盘
 */
function persist() {
  if (!db) return
  try {
    const data = db.export()
    fs.writeFileSync(getDbPath(), Buffer.from(data))
    console.log(`[DB] persist OK: ${data.byteLength} bytes → ${getDbPath()}`)
  } catch (e) {
    console.error('[DB] persist 失败:', e)
    throw e
  }
}

/**
 * 初始化数据库，创建表
 */
async function initDatabase() {
  SQL = await initSqlJs({
    locateFile: (file) => {
      if (app.isPackaged) {
        // 打包后 wasm 在 asar.unpacked 中
        return path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'sql.js', 'dist', file)
      }
      // 开发模式
      return path.join(__dirname, '../../../node_modules/sql.js/dist', file)
    },
  })

  const dbPath = getDbPath()
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 每日数据表
  db.run(`
    CREATE TABLE IF NOT EXISTS daily_notes (
      date TEXT PRIMARY KEY,
      todos TEXT NOT NULL DEFAULT '[]',
      note_content TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)

  // 日历重点标记表
  db.run(`
    CREATE TABLE IF NOT EXISTS calendar_marks (
      date TEXT PRIMARY KEY,
      color TEXT NOT NULL DEFAULT '#ff6b6b',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    )
  `)

  // 闹钟表
  db.run(`
    CREATE TABLE IF NOT EXISTS alarms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      todo_id TEXT NOT NULL,
      todo_text TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      alarm_time TEXT NOT NULL,
      triggered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  persist()
  console.log('[DB] 数据库初始化完成:', dbPath)
  return db
}

function getDb() {
  if (!db) throw new Error('数据库未初始化')
  return db
}

// ─── 工具函数 ────────────────────────────────────────────────────

function queryOne(sql, params = []) {
  const stmt = getDb().prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject()
    stmt.free()
    return row
  }
  stmt.free()
  return null
}

function queryAll(sql, params = []) {
  const results = []
  const stmt = getDb().prepare(sql)
  stmt.bind(params)
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

function run(sql, params = []) {
  try {
    getDb().run(sql, params)
    persist()
  } catch (e) {
    console.error('[DB] SQL执行失败:', sql.slice(0, 60), '\n  params:', JSON.stringify(params).slice(0, 100), '\n  error:', e.message)
    throw e
  }
}

// ─── daily_notes CRUD ────────────────────────────────────────────

function getDailyNote(date) {
  const row = queryOne('SELECT * FROM daily_notes WHERE date = ?', [date])
  if (!row) return null
  return {
    date: row.date,
    todos: JSON.parse(row.todos),
    noteContent: JSON.parse(row.note_content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function saveTodos(date, todos) {
  console.log(`[DB] saveTodos: date="${date}" len=${date?.length}, count=${todos?.length}`)
  const now = new Date().toISOString()
  run(
    `INSERT INTO daily_notes (date, todos, note_content, created_at, updated_at)
     VALUES (?, ?, '{}', ?, ?)
     ON CONFLICT(date) DO UPDATE SET todos = excluded.todos, updated_at = excluded.updated_at`,
    [date, JSON.stringify(todos), now, now]
  )
  console.log('[DB] saveTodos: done')
}

function saveNoteContent(date, content) {
  const now = new Date().toISOString()
  run(
    `INSERT INTO daily_notes (date, todos, note_content, created_at, updated_at)
     VALUES (?, '[]', ?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET note_content = excluded.note_content, updated_at = excluded.updated_at`,
    [date, JSON.stringify(content), now, now]
  )
}

// ─── calendar_marks CRUD ─────────────────────────────────────────

function getAllCalendarMarks() {
  return queryAll('SELECT * FROM calendar_marks')
}

function upsertCalendarMark(date, { color, note }) {
  const now = new Date().toISOString()
  run(`INSERT INTO calendar_marks (date, color, note, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET color = excluded.color, note = excluded.note`,
    [date, color, note || '', now])
}

function deleteCalendarMark(date) {
  run('DELETE FROM calendar_marks WHERE date = ?', [date])
}

// ─── 全局搜索 ────────────────────────────────────────────────────

/**
 * 递归提取 Tiptap ProseMirror JSON 中的纯文本
 */
function extractTextFromTiptapJson(jsonStr) {
  if (!jsonStr || jsonStr === '{}') return ''
  let doc
  try { doc = JSON.parse(jsonStr) } catch { return '' }
  if (!doc || !doc.content) return ''

  function traverse(node) {
    if (!node) return ''
    if (node.type === 'text') return node.text || ''
    if (Array.isArray(node.content)) return node.content.map(traverse).join('')
    return ''
  }
  return traverse(doc)
}

/**
 * 从文本中提取关键词周边片段（前15字、后40字）
 */
function buildSnippet(text, keyword) {
  const lowerText = text.toLowerCase()
  const lowerKw = keyword.toLowerCase()
  const idx = lowerText.indexOf(lowerKw)
  if (idx === -1) return { snippet: '', found: false }

  const start = Math.max(0, idx - 15)
  const end = Math.min(text.length, idx + keyword.length + 40)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return { snippet: prefix + text.slice(start, end) + suffix, found: true }
}

/**
 * 搜索所有历史日期的待办和随心记
 * @param {string} keyword
 * @returns {Array} 结果数组，每项 { date, source, snippet, keyword }
 *                  超出 50 条时末尾追加 { type:'overflow', total:N }
 */
function searchAllNotes(keyword) {
  if (!keyword || keyword.trim().length < 2) return []
  const kw = keyword.trim()

  const rows = queryAll(
    `SELECT date, todos, note_content FROM daily_notes
     WHERE todos LIKE '%' || ? || '%'
        OR note_content LIKE '%' || ? || '%'
     ORDER BY date DESC`,
    [kw, kw]
  )

  const results = []
  const MAX = 50

  for (const row of rows) {
    if (results.length >= MAX) break

    // ── 待办匹配 ──
    let todos = []
    try { todos = JSON.parse(row.todos) } catch { /* ignore */ }
    for (const todo of todos) {
      if (results.length >= MAX) break
      const text = todo.text || ''
      if (!text.toLowerCase().includes(kw.toLowerCase())) continue
      const { snippet } = buildSnippet(text, kw)
      results.push({ date: row.date, source: 'todo', snippet: snippet || text, keyword: kw })
    }

    // ── 随心记匹配（同日期最多 5 条 snippet）──
    const noteText = extractTextFromTiptapJson(row.note_content)
    if (!noteText.toLowerCase().includes(kw.toLowerCase())) continue

    let noteCount = 0
    let searchFrom = 0
    const lowerNote = noteText.toLowerCase()
    const lowerKw = kw.toLowerCase()
    while (noteCount < 5 && results.length < MAX) {
      const idx = lowerNote.indexOf(lowerKw, searchFrom)
      if (idx === -1) break
      const { snippet } = buildSnippet(noteText.slice(Math.max(0, idx - 15)), kw)
      results.push({ date: row.date, source: 'note', snippet: snippet || noteText.slice(idx, idx + 55), keyword: kw })
      searchFrom = idx + kw.length
      noteCount++
    }
  }

  const total = results.length
  if (total >= MAX) {
    // 统计真实总量（粗估，不精确）
    results.push({ type: 'overflow', total })
  }

  return results
}

/**
 * 查询指定日期列表中哪些有记录（todos 非空或 note 非空）
 * @param {string[]} dates  格式 'YYYY-MM-DD'
 * @returns {string[]}  有内容的日期子集
 */
function getDatesWithContent(dates) {
  if (!dates || dates.length === 0) return []
  const placeholders = dates.map(() => '?').join(',')
  const rows = queryAll(
    `SELECT date FROM daily_notes
     WHERE date IN (${placeholders})
       AND (todos != '[]' OR (note_content != '{}' AND note_content != '{"type":"doc","content":[]}'))`,
    dates
  )
  return rows.map(r => r.date)
}

// ─── alarms CRUD ────────────────────────────────────────────────

function saveAlarm({ todoId, todoText, note, alarmTime }) {
  const now = new Date().toISOString()
  // 同一待办只保留最新一条（先删旧的再插入）
  run('DELETE FROM alarms WHERE todo_id = ?', [String(todoId)])
  run(
    `INSERT INTO alarms (todo_id, todo_text, note, alarm_time, triggered, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`,
    [String(todoId), todoText, note || '', alarmTime, now]
  )
}

function getPendingAlarms() {
  return queryAll(
    `SELECT * FROM alarms
     WHERE triggered = 0
       AND alarm_time <= strftime('%Y-%m-%dT%H:%M', 'now', 'localtime')`
  )
}

function markAlarmTriggered(id) {
  run('UPDATE alarms SET triggered = 1 WHERE id = ?', [id])
}

function deleteAlarm(todoId) {
  run('DELETE FROM alarms WHERE todo_id = ?', [String(todoId)])
}

module.exports = {
  initDatabase,
  getDb,
  getDailyNote,
  saveTodos,
  saveNoteContent,
  getAllCalendarMarks,
  upsertCalendarMark,
  deleteCalendarMark,
  searchAllNotes,
  getDatesWithContent,
  saveAlarm,
  getPendingAlarms,
  markAlarmTriggered,
  deleteAlarm,
}
