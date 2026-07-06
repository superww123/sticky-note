const { BrowserWindow, screen } = require('electron')
const path = require('path')
const fs = require('fs')

// 判断是否开发模式
const isDev = process.env.NODE_ENV === 'development'
  || !fs.existsSync(path.join(__dirname, '../../../dist/renderer/index.html'))

// 开发时渲染层地址
const RENDERER_URL = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'

/**
 * 创建主便签窗口
 */
function createMainWindow() {
  const win = new BrowserWindow({
    width: 360,
    height: 600,
    minWidth: 280,
    minHeight: 400,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    maximizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 获得焦点时关闭置顶，让搜狗等输入法候选框能正常显示在窗口上方
  win.on('focus', () => {
    if (!win.isDestroyed()) win.setAlwaysOnTop(false)
  })
  // 失去焦点时恢复置顶，保持便签在其他窗口上方可见
  win.on('blur', () => {
    if (!win.isDestroyed() && !win.isMinimized() && win.isVisible()) {
      win.setAlwaysOnTop(true, 'floating')
    }
  })

  // 拖动期间拦截所有 OS 发起的 resize
  win.on('will-resize', (e) => {
    if (win._isDragging) e.preventDefault()
  })

  // 心跳：每 3s 刷新置顶标记，仅在失焦可见时操作
  const topHeartbeat = setInterval(() => {
    if (win.isDestroyed()) { clearInterval(topHeartbeat); return }
    if (win.isVisible() && !win.isMinimized() && !win.isFocused()) {
      win.setAlwaysOnTop(true, 'floating')
    }
  }, 3000)

  win.on('closed', () => clearInterval(topHeartbeat))

  // 加载页面
  if (isDev) {
    win.loadURL(RENDERER_URL)
    // F12 开关 DevTools，比 openDevTools 自动弹出更不干扰
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        win.webContents.toggleDevTools()
      }
    })
  } else {
    win.loadFile(path.join(__dirname, '../../../dist/renderer/index.html'))
  }

  // 阻止关闭，改为隐藏到托盘
  win.on('close', (e) => {
    if (!require('electron').app.isQuiting) {
      e.preventDefault()
      win.hide()
    }
  })

  return win
}

/**
 * 创建小球窗口（收起状态）
 */
function createBallWindow() {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 64,
    height: 92,
    x: screenW - 80,
    y: screenH - 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const ballHeartbeat = setInterval(() => {
    if (win.isDestroyed()) { clearInterval(ballHeartbeat); return }
    if (win.isVisible()) { win.setAlwaysOnTop(true, 'floating') }
  }, 3000)

  win.on('closed', () => clearInterval(ballHeartbeat))

  if (isDev) {
    win.loadURL(`${RENDERER_URL}/#/ball`)
  } else {
    win.loadFile(path.join(__dirname, '../../../dist/renderer/index.html'), { hash: 'ball' })
  }

  return win
}

module.exports = { createMainWindow, createBallWindow }
