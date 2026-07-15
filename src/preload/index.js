const { contextBridge, ipcRenderer } = require('electron')

/**
 * 暴露给渲染层的安全 API（通过 contextBridge）
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── 窗口控制 ───────────────────────────────────────────
  minimizeToBall: () => ipcRenderer.send('window:minimize-to-ball'),
  restoreFromBall: () => ipcRenderer.send('window:restore-from-ball'),
  minimizeToTray: () => ipcRenderer.send('window:minimize-to-tray'),
  closeApp: () => ipcRenderer.send('window:close'),
  getWindowPos: () => ipcRenderer.invoke('window:get-pos'),
  dragStart: () => ipcRenderer.send('window:drag-start'),
  dragEnd:   () => ipcRenderer.send('window:drag-end'),
  dragWindow: (x, y) => ipcRenderer.send('window:drag', { x, y }),
  setWindowOpacity: (value) => ipcRenderer.send('window:set-opacity', value),
  openNoteWindow: (dateOrObj) => ipcRenderer.send('window:open-note', dateOrObj),
  closeSelf: () => ipcRenderer.send('window:close-self'),

  // ─── 数据读写 ───────────────────────────────────────────
  getDailyData: (date) => ipcRenderer.invoke('data:get-daily', date),
  saveTodos: (date, todos) => ipcRenderer.invoke('data:save-todos', { date, todos }),
  saveNote: (date, content) => ipcRenderer.invoke('data:save-note', { date, content }),
  migrateNow: () => ipcRenderer.invoke('migrate:now'),

  // ─── 日历标记 ───────────────────────────────────────────
  getAllCalendarMarks: () => ipcRenderer.invoke('calendar:get-all-marks'),
  upsertCalendarMark: (date, color, note) => ipcRenderer.invoke('calendar:upsert-mark', { date, color, note }),
  deleteCalendarMark: (date) => ipcRenderer.invoke('calendar:delete-mark', date),

  // ─── 手动归档 ───────────────────────────────────────────
  manualArchive: (date) => ipcRenderer.invoke('archive:manual', date),

  // ─── 图钉置顶 ─────────────────────────────────────────
  togglePin: () => ipcRenderer.invoke('window:toggle-pin'),
  getPinState: () => ipcRenderer.invoke('window:get-pin'),
  setWindowAlwaysOnTop: (flag) => ipcRenderer.send('preview:set-always-on-top', flag),

  // ─── 图片全屏预览 ─────────────────────────────────────
  previewImageFullscreen: (src) => ipcRenderer.send('image:preview-fullscreen', src),

  // ─── 剪贴板 ─────────────────────────────────────────────
  copyImageToClipboard: (src) => ipcRenderer.invoke('clipboard:write-image', src),

  // ─── 外部链接 ─────────────────────────────────────────
  openExternal: (url) => ipcRenderer.send('shell:open-external', url),
  openFile:     (p)   => ipcRenderer.invoke('shell:open-file', p),

  // ─── 闹钟 ─────────────────────────────────────────────
  saveAlarm:          (data)   => ipcRenderer.invoke('alarm:save', data),
  deleteAlarm:        (todoId) => ipcRenderer.invoke('alarm:delete', todoId),
  getAllPendingAlarms: ()       => ipcRenderer.invoke('alarm:get-all-pending'),
  getTodayAlarms:     ()       => ipcRenderer.invoke('alarm:get-today'),
  updateAlarmTime:    (todoId, newTime) => ipcRenderer.invoke('alarm:update-time', todoId, newTime),
  updateAlarmNote:    (todoId, newNote) => ipcRenderer.invoke('alarm:update-note', todoId, newNote),
  moveAlarm:          (fromId, toId, toText) => ipcRenderer.invoke('alarm:move', fromId, toId, toText),
  syncAlarmText:      (todoId, text) => ipcRenderer.invoke('alarm:sync-text', todoId, text),
  onAlarmFired:       (cb) => ipcRenderer.on('alarm:fired', cb),

  // ─── 全局搜索 ─────────────────────────────────────────
  searchAllNotes: (keyword) => ipcRenderer.invoke('search:all-notes', keyword),
  onFindKeyword: (cb) => ipcRenderer.on('note:find-keyword', (_, kw) => cb(kw)),
  getDatesWithContent: (dates) => ipcRenderer.invoke('data:dates-with-content', dates),
  getTodosRange:       (from, to) => ipcRenderer.invoke('data:todos-range', { from, to }),

  // ─── 主进程推送事件 ─────────────────────────────────────
  onOpacityChanged: (callback) => ipcRenderer.on('opacity-changed', (_, value) => callback(value)),
  onDayChanged: (callback) => ipcRenderer.on('day-changed', () => callback()),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
