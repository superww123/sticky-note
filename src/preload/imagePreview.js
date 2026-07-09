const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('previewAPI', {
  onInitData:  (cb) => ipcRenderer.on('init-data', (_, data) => cb(data)),
  close:       () => ipcRenderer.send('preview:close'),
  closeAll:    () => ipcRenderer.send('preview:close-all'),
  copyImage:   (src) => ipcRenderer.invoke('clipboard:write-image', src),
})
