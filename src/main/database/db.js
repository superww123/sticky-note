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

module.exports = {
  initDatabase,
  getDb,
  getDailyNote,
  saveTodos,
  saveNoteContent,
  getAllCalendarMarks,
  upsertCalendarMark,
  deleteCalendarMark,
}
