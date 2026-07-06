const { ipcMain } = require('electron')
const {
  getDailyNote,
  saveTodos,
  saveNoteContent,
  getAllCalendarMarks,
  upsertCalendarMark,
  deleteCalendarMark,
} = require('./database/db')
const { archiveDailyNote } = require('./word/archiver')

/**
 * 注册所有 IPC 通信处理器
 */
function setupIpc(mainWindow, ballWindow) {
  // ─── 窗口控制 ───────────────────────────────────────────

  ipcMain.on('window:minimize-to-ball', () => {
    mainWindow.hide()
    ballWindow.show()
  })

  ipcMain.on('window:restore-from-ball', () => {
    ballWindow.hide()
    mainWindow.show()
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.focus()
  })

  ipcMain.on('window:minimize-to-tray', () => {
    mainWindow.hide()
  })

  ipcMain.on('window:set-opacity', (event, value) => {
    if (ballWindow && !ballWindow.isDestroyed()) {
      ballWindow.webContents.send('opacity-changed', value)
    }
  })

  ipcMain.on('window:close', () => {
    const { app } = require('electron')
    app.isQuiting = true
    app.quit()
  })

  ipcMain.handle('window:get-pos', () => {
    return mainWindow.getPosition()
  })

  ipcMain.on('window:drag-start', (event) => {
    const { BrowserWindow } = require('electron')
    const sender = BrowserWindow.fromWebContents(event.sender)
    if (sender && !sender.isDestroyed()) {
      const [w, h] = sender.getSize()
      sender._dragW = w
      sender._dragH = h
      sender._origResizable = sender.isResizable()
      sender._origMinSize = sender.getMinimumSize()
      sender._origMaxSize = sender.getMaximumSize()
      sender._isDragging = true
      sender.setResizable(false)
      sender.setMinimumSize(w, h)
      sender.setMaximumSize(w, h)
    }
  })

  ipcMain.on('window:drag-end', (event) => {
    const { BrowserWindow } = require('electron')
    const sender = BrowserWindow.fromWebContents(event.sender)
    if (sender && !sender.isDestroyed()) {
      sender._isDragging = false
      sender._dragW = null
      sender._dragH = null
      sender.setResizable(sender._origResizable ?? true)
      const [minW, minH] = sender._origMinSize ?? [0, 0]
      const [maxW, maxH] = sender._origMaxSize ?? [0, 0]
      sender.setMinimumSize(minW, minH)
      sender.setMaximumSize(maxW, maxH)
      sender._origResizable = null
      sender._origMinSize = null
      sender._origMaxSize = null
    }
  })

  ipcMain.on('window:drag', (event, { x, y }) => {
    const { BrowserWindow } = require('electron')
    const sender = BrowserWindow.fromWebContents(event.sender)
    if (sender && !sender.isDestroyed()) {
      const [wx, wy] = sender.getPosition()
      const w = sender._dragW ?? sender.getSize()[0]
      const h = sender._dragH ?? sender.getSize()[1]
      sender.setBounds({ x: Math.round(wx + x), y: Math.round(wy + y), width: w, height: h })
    }
  })

  // ─── 数据读写 ───────────────────────────────────────────

  ipcMain.handle('data:get-daily', (event, date) => {
    return getDailyNote(date)
  })

  ipcMain.handle('data:save-todos', (event, { date, todos }) => {
    try {
      saveTodos(date, todos)
      return { ok: true }
    } catch (e) {
      console.error('[IPC] save-todos 失败: date=', date, 'count=', todos?.length, '\n', e)
      throw e  // 传回 renderer，让 addTodo 的 await 抛出，触发 finally 清理
    }
  })

  ipcMain.handle('data:save-note', (event, { date, content }) => {
    saveNoteContent(date, content)
    return { ok: true }
  })

  // ─── 日历标记 ───────────────────────────────────────────

  ipcMain.handle('calendar:get-all-marks', () => {
    return getAllCalendarMarks()
  })

  ipcMain.handle('calendar:upsert-mark', (event, { date, color, note }) => {
    upsertCalendarMark(date, { color, note })
    return { ok: true }
  })

  ipcMain.handle('calendar:delete-mark', (event, date) => {
    deleteCalendarMark(date)
    return { ok: true }
  })

  // ─── 手动归档 ───────────────────────────────────────────

  ipcMain.handle('archive:manual', async (event, date) => {
    await archiveDailyNote(date)
    return { ok: true }
  })

  console.log('[IPC] 通信处理器已注册')
}

module.exports = { setupIpc }
