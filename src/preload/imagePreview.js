const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('previewAPI', {
  onInitImage: (cb) => ipcRenderer.on('init-image', (_, src) => cb(src)),
  close: () => ipcRenderer.send('preview:close'),
})
