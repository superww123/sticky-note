const cron = require('node-cron')
const { Notification } = require('electron')
const { archiveDailyNote } = require('../word/archiver')
const { getDailyNote, saveTodos, getPendingAlarms, markAlarmTriggered, getDeletedOriginalIds, moveAlarm } = require('../database/db')
const { openAlarmAlertWindow } = require('../windows/alarmAlertWindow')

let schedulerWindow = null

/**
 * 设置所有定时任务
 */
function setupScheduler(mainWindow) {
  schedulerWindow = mainWindow

  // 启动时补迁缺失的跨天迁移（app 关机期间 cron 没有运行的情况）
  migrateOnStartup()

  // 每天 18:00 归档随心记
  cron.schedule('0 18 * * *', async () => {
    const today = getTodayStr()
    console.log('[Scheduler] 开始归档随心记:', today)
    try {
      await archiveDailyNote(today)
      console.log('[Scheduler] 归档成功:', today)
      new Notification({
        title: '📝 随心记已归档',
        body: `${today} 的随心记已保存到文档`,
      }).show()
    } catch (e) {
      console.error('[Scheduler] 归档失败:', e.message)
    }
  })

  // 每天 00:01 迁移未完成待办到今天，并通知渲染层刷新
  cron.schedule('1 0 * * *', () => {
    migratePendingTodos()
    if (schedulerWindow && !schedulerWindow.isDestroyed()) {
      schedulerWindow.webContents.send('day-changed')
    }
  })

  // 每分钟检查一次截止时间提醒和闹钟
  cron.schedule('* * * * *', () => {
    checkDeadlineReminders()
    checkAlarms()
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
  const deletedIds = getDeletedOriginalIds()

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
      const origId = String(todo.originalId || todo.id)
      if (deletedIds.has(origId)) continue  // 用户已手动删除，不再迁移
      if (todo.completed) {
        existingOriginalIds.add(origId)  // 已完成的也占位，防止同 origId 的旧版本被重新迁移
        continue
      }
      if (existingOriginalIds.has(origId)) continue

      existingOriginalIds.add(origId)
      const newTodo = {
        ...todo,
        id: Date.now() + Math.random(),
        originalId: origId,
        migratedFrom: date,
      }
      moveAlarm(String(todo.id), String(newTodo.id), newTodo.text)
      toAdd.push(newTodo)
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

  const deletedIds = getDeletedOriginalIds()
  const pending = yesterdayData.todos.filter(t => !t.completed && !deletedIds.has(String(t.originalId || t.id)))
  if (pending.length === 0) return

  const todayData = getDailyNote(today)
  const todayTodos = todayData ? todayData.todos : []
  const existingOriginalIds = new Set(
    todayTodos.map(t => String(t.originalId || t.id))
  )

  const toMigrate = pending
    .filter(t => !existingOriginalIds.has(String(t.originalId || t.id)))
    .map(t => {
      const newTodo = {
        ...t,
        id: Date.now() + Math.random(),
        originalId: String(t.originalId || t.id),
        migratedFrom: yesterday,
      }
      moveAlarm(String(t.id), String(newTodo.id), newTodo.text)
      return newTodo
    })

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

/**
 * 检查到期闹钟并弹出提醒窗口
 */
function checkAlarms() {
  try {
    const alarms = getPendingAlarms()
    for (const alarm of alarms) {
      markAlarmTriggered(alarm.id)
      openAlarmAlertWindow({
        todoText: alarm.todo_text,
        note: alarm.note,
        time: alarm.alarm_time,
      })
    }
    if (alarms.length > 0 && schedulerWindow && !schedulerWindow.isDestroyed()) {
      schedulerWindow.webContents.send('alarm:fired')
    }
  } catch (e) {
    console.error('[Scheduler] checkAlarms 失败:', e.message)
  }
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

module.exports = { setupScheduler, migrateOnStartup }
