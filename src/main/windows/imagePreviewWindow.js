const { BrowserWindow, screen } = require('electron')
const path = require('path')

let previewWin = null

function openImagePreviewWindow(src) {
  // 若已有预览窗口，直接更新图片并聚焦
  if (previewWin && !previewWin.isDestroyed()) {
    previewWin.webContents.send('init-image', src)
    previewWin.focus()
    return
  }

  // 在鼠标所在显示器全屏显示
  const { bounds } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())

  previewWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload/imagePreview.js'),
    },
  })

  previewWin.setAlwaysOnTop(true, 'screen-saver')
  previewWin.loadFile(path.join(__dirname, '../../../assets/imagePreview.html'))

  previewWin.webContents.once('did-finish-load', () => {
    previewWin.webContents.send('init-image', src)
  })

  previewWin.on('closed', () => { previewWin = null })
}

module.exports = { openImagePreviewWindow }
