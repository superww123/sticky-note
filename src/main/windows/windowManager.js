const { BrowserWindow, screen, Menu, MenuItem } = require('electron')
const path = require('path')
const fs = require('fs')

// 判断是否开发模式
const isDev = process.env.NODE_ENV === 'development'
  || !fs.existsSync(path.join(__dirname, '../../../dist/renderer/index.html'))

// 开发时渲染层地址
const RENDERER_URL = process.env['ELECTRON_RENDERER_URL'] || 'http://localhost:5173'

// 应用图标（ICO 文件，用于窗口标题栏 / 任务栏 / dock）
const APP_ICON = path.join(__dirname, '../../../assets/icon.ico')

// note 子窗口错位计数器（每次创建递增，循环 8 次后归零）
let noteWindowOffset = 0

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
    resizable: true,
    maximizable: false,
    skipTaskbar: false,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // 拖动期间拦截所有 OS 发起的 resize
  win.on('will-resize', (e) => {
    if (win._isDragging) e.preventDefault()
  })

  // 加载页面
  if (isDev) {
    win.loadURL(RENDERER_URL)
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

  setupSpellCheckContextMenu(win)
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

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  const ballHeartbeat = setInterval(() => {
    if (win.isDestroyed()) { clearInterval(ballHeartbeat); return }
    if (win.isVisible()) {
      win.setAlwaysOnTop(true, 'screen-saver')
      win.moveTop()
    }
  }, 300)

  win.on('closed', () => clearInterval(ballHeartbeat))

  if (isDev) {
    win.loadURL(`${RENDERER_URL}/#/ball`)
  } else {
    win.loadFile(path.join(__dirname, '../../../dist/renderer/index.html'), { hash: 'ball' })
  }

  return win
}

/**
 * 创建指定日期的便签窗口（从日历"新窗口"打开）
 */
function createNoteWindow(date, colorIdx = 1) {
  const { height: sh } = screen.getPrimaryDisplay().workAreaSize
  const winW = 360, winH = 600
  const step = 30
  const offset = (noteWindowOffset % 8) * step
  noteWindowOffset++

  // 左侧垂直居中，依次向右下错开
  const x = 20 + offset
  const y = Math.max(20, Math.floor((sh - winH) / 2) - 60 + offset)

  const win = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
    minWidth: 280,
    minHeight: 400,
    frame: false,
    transparent: true,
    resizable: true,
    maximizable: false,
    skipTaskbar: false,
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  win.on('will-resize', (e) => {
    if (win._isDragging) e.preventDefault()
  })

  if (isDev) {
    win.loadURL(`${RENDERER_URL}/#/note/${date}/${colorIdx}`)
  } else {
    win.loadFile(path.join(__dirname, '../../../dist/renderer/index.html'), { hash: `/note/${date}/${colorIdx}` })
  }

  setupSpellCheckContextMenu(win)
  return win
}

module.exports = { createMainWindow, createBallWindow, createNoteWindow }

/**
 * 为窗口绑定拼写检查右键菜单（仅当右键点击拼错的单词时弹出）
 */
function setupSpellCheckContextMenu(win) {
  win.webContents.on('context-menu', (event, params) => {
    if (!params.misspelledWord) return

    const menu = new Menu()
    for (const suggestion of params.dictionarySuggestions) {
      menu.append(new MenuItem({
        label: suggestion,
        click: () => win.webContents.replaceMisspelling(suggestion),
      }))
    }
    if (params.dictionarySuggestions.length > 0) {
      menu.append(new MenuItem({ type: 'separator' }))
    }
    menu.append(new MenuItem({
      label: '添加到词典',
      click: () => win.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord),
    }))
    menu.popup()
  })
}
