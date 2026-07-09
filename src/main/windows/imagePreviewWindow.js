const { BrowserWindow, screen } = require('electron')
const path = require('path')

const openWindows = new Set()
let windowOffset = 0

function openImagePreviewWindow(data) {
  // 兼容旧的字符串调用 (src string) 和新的对象调用 ({ images, currentIndex })
  let images, currentIndex
  if (typeof data === 'string') {
    images = [data]
    currentIndex = 0
  } else {
    images = data.images || []
    currentIndex = data.currentIndex || 0
  }

  const { bounds } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())

  // 每个新窗口错开 30px，最多错开 8 次后归零
  const offset = (windowOffset % 8) * 30
  windowOffset++

  const winW = 720
  const winH = 560
  const x = Math.round(bounds.x + (bounds.width - winW) / 2) + offset
  const y = Math.round(bounds.y + (bounds.height - winH) / 2) + offset

  const win = new BrowserWindow({
    x, y,
    width: winW,
    height: winH,
    minWidth: 320,
    minHeight: 260,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    movable: true,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../../preload/imagePreview.js'),
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadFile(path.join(__dirname, '../../../assets/imagePreview.html'))

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('init-data', { images, currentIndex })
  })

  win.on('closed', () => openWindows.delete(win))
  openWindows.add(win)
}

function closeAllImagePreviewWindows() {
  openWindows.forEach(win => { if (!win.isDestroyed()) win.close() })
  openWindows.clear()
}

module.exports = { openImagePreviewWindow, closeAllImagePreviewWindows }
