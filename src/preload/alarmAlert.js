const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('alarmAPI', {
  onInit: (cb) => ipcRenderer.on('alarm-init', (_, data) => cb(data)),
  dismiss: () => ipcRenderer.send('alarm:dismiss'),
  openExternal: (url) => ipcRenderer.send('shell:open-external', url),
})
