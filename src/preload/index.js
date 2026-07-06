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

  // ─── 数据读写 ───────────────────────────────────────────
  getDailyData: (date) => ipcRenderer.invoke('data:get-daily', date),
  saveTodos: (date, todos) => ipcRenderer.invoke('data:save-todos', { date, todos }),
  saveNote: (date, content) => ipcRenderer.invoke('data:save-note', { date, content }),

  // ─── 日历标记 ───────────────────────────────────────────
  getAllCalendarMarks: () => ipcRenderer.invoke('calendar:get-all-marks'),
  upsertCalendarMark: (date, color, note) => ipcRenderer.invoke('calendar:upsert-mark', { date, color, note }),
  deleteCalendarMark: (date) => ipcRenderer.invoke('calendar:delete-mark', date),

  // ─── 手动归档 ───────────────────────────────────────────
  manualArchive: (date) => ipcRenderer.invoke('archive:manual', date),

  // ─── 主进程推送事件 ─────────────────────────────────────
  onOpacityChanged: (callback) => ipcRenderer.on('opacity-changed', (_, value) => callback(value)),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
