const cron = require('node-cron')
const { Notification } = require('electron')
const { archiveDailyNote } = require('../word/archiver')
const { getDailyNote, saveTodos } = require('../database/db')

let schedulerWindow = null

/**
 * 设置所有定时任务
 */
function setupScheduler(mainWindow) {
  schedulerWindow = mainWindow

  // 启动时补迁缺失的跨天迁移（app 关机期间 cron 没有运行的情况）
  migrateOnStartup()

  // 每天 18:00 归档随心记
  cron.schedule('0 18 * * *', () => {
    const today = getTodayStr()
    console.log('[Scheduler] 开始归档随心记:', today)
    archiveDailyNote(today)
  })

  // 每天 00:01 迁移未完成待办到今天
  cron.schedule('1 0 * * *', () => {
    migratePendingTodos()
  })

  // 每分钟检查一次截止时间提醒
  cron.schedule('* * * * *', () => {
    checkDeadlineReminders()
  })

  console.log('[Scheduler] 定时任务已启动')
}

/**
 * 启动时补迁：扫描过去 30 天，把漏迁的未完成待办补到今天
 * 用 originalId 去重，防止已经迁移过的条目重复出现
 */
function migrateOnStartup() {
  const today = getTodayStr()
  const todayData = getDailyNote(today)
  const todayTodos = todayData ? todayData.todos : []

  // 收集今天已有的 originalId（含今天自己新建的条目，其 originalId = id）
  const existingOriginalIds = new Set(
    todayTodos.map(t => String(t.originalId || t.id))
  )

  const toAdd = []

  for (let offset = 1; offset <= 30; offset++) {
    const date = getDateStr(-offset)
    const data = getDailyNote(date)
    if (!data) continue

    for (const todo of data.todos) {
      if (todo.completed) continue
      const origId = String(todo.originalId || todo.id)
      if (existingOriginalIds.has(origId)) continue

      existingOriginalIds.add(origId)
      toAdd.push({
        ...todo,
        id: Date.now() + Math.random(),
        originalId: origId,
        migratedFrom: date,
      })
    }
  }

  if (toAdd.length === 0) return

  saveTodos(today, [...toAdd, ...todayTodos])
  console.log(`[Scheduler] 启动补迁: ${toAdd.length} 条待办 → ${today}`)
}

/**
 * 每日 00:01：迁移昨天未完成的待办到今天
 */
function migratePendingTodos() {
  const yesterday = getDateStr(-1)
  const today = getTodayStr()

  const yesterdayData = getDailyNote(yesterday)
  if (!yesterdayData) return

  const pending = yesterdayData.todos.filter(t => !t.completed)
  if (pending.length === 0) return

  const todayData = getDailyNote(today)
  const todayTodos = todayData ? todayData.todos : []
  const existingOriginalIds = new Set(
    todayTodos.map(t => String(t.originalId || t.id))
  )

  const toMigrate = pending
    .filter(t => !existingOriginalIds.has(String(t.originalId || t.id)))
    .map(t => ({
      ...t,
      id: Date.now() + Math.random(),
      originalId: String(t.originalId || t.id),
      migratedFrom: yesterday,
    }))

  if (toMigrate.length === 0) return

  saveTodos(today, [...toMigrate, ...todayTodos])
  console.log(`[Scheduler] 迁移 ${toMigrate.length} 条待办从 ${yesterday} 到 ${today}`)
}

/**
 * 检查截止时间提醒（提前3小时）
 */
function checkDeadlineReminders() {
  const today = getTodayStr()
  const data = getDailyNote(today)
  if (!data) return

  const now = Date.now()
  const THREE_HOURS = 3 * 60 * 60 * 1000

  data.todos.forEach(todo => {
    if (todo.completed || !todo.deadline) return

    const deadline = new Date(todo.deadline).getTime()
    const timeToDeadline = deadline - now

    if (timeToDeadline > 0 && timeToDeadline <= THREE_HOURS && !todo.notifiedAt) {
      sendDeadlineNotification(todo)

      const updatedTodos = data.todos.map(t =>
        t.id === todo.id ? { ...t, notifiedAt: now } : t
      )
      saveTodos(today, updatedTodos)

      if (schedulerWindow && !schedulerWindow.isDestroyed()) {
        schedulerWindow.webContents.send('todos-updated', updatedTodos)
      }
    }
  })
}

/**
 * 发送系统通知
 */
function sendDeadlineNotification(todo) {
  const deadline = new Date(todo.deadline)
  const hours = Math.round((deadline.getTime() - Date.now()) / 3600000)

  new Notification({
    title: '⏰ 待办截止提醒',
    body: `「${todo.text}」将在约 ${hours} 小时后截止`,
    urgency: 'critical',
  }).show()

  console.log(`[Scheduler] 发送提醒: ${todo.text}`)
}

function getTodayStr() {
  return getDateStr(0)
}

function getDateStr(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

module.exports = { setupScheduler }
