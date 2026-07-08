// 检测 ELECTRON_RUN_AS_NODE 环境变量（在某些特殊环境如 Claude Code 中会被设置）
// 此变量会让 Electron 以普通 Node.js 模式运行，导致 require('electron') 失效
if (process.env.ELECTRON_RUN_AS_NODE === '1') {
  console.error('[sticky-note] 检测到 ELECTRON_RUN_AS_NODE=1，请取消该环境变量后重新运行：')
  console.error('  Windows CMD:   set ELECTRON_RUN_AS_NODE=  && npm run dev')
  console.error('  PowerShell:    $env:ELECTRON_RUN_AS_NODE = ""; npm run dev')
  console.error('  bash/sh:       unset ELECTRON_RUN_AS_NODE && npm run dev')
  process.exit(1)
}

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron')
const path = require('path')
const state = require('./state')
const { initDatabase } = require('./database/db')
const { setupScheduler } = require('./scheduler/index')
const { createMainWindow, createBallWindow } = require('./windows/windowManager')
const { setupTray } = require('./windows/trayManager')
const { setupIpc } = require('./ipc')

// 单实例锁，防止多开
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

// 开发环境热重载
if (process.env.NODE_ENV === 'development') {
  try { require('electron-reloader')(module) } catch {}
}

let mainWindow = null
let ballWindow = null
let tray = null

// 以小球模式启动（开机自启 / 快捷方式传入此参数）
const startInBallMode = process.argv.includes('--start-ball')

app.whenReady().then(async () => {
  // 设置 Windows 任务栏 / dock 显示的 App ID 和图标
  app.setAppUserModelId('com.wenya.sticky-note')

  // 初始化数据库（sql.js 异步加载）
  await initDatabase()

  // 创建主窗口
  mainWindow = createMainWindow()

  // 创建小球窗口（默认隐藏）
  ballWindow = createBallWindow()

  // 以小球模式启动：隐藏主窗口、显示小球
  if (startInBallMode) {
    mainWindow.hide()
    ballWindow.show()
  }

  // 创建系统托盘
  tray = setupTray(mainWindow, ballWindow)

  // 设置定时任务（6点归档 + 截止提醒）
  setupScheduler(mainWindow)

  // 注册 IPC 通信
  setupIpc(mainWindow, ballWindow)

  // 失焦自动变小球：焦点转到 app 外部时隐藏主窗口、显示小球
  // 钉住模式或焦点在 app 内部窗口间切换时不触发
  mainWindow.on('blur', () => {
    if (state.isPinned) return  // 钉住时始终保持可见
    if (mainWindow.isDestroyed() || !mainWindow.isVisible()) return
    const focused = BrowserWindow.getFocusedWindow()
    const isAppWindow = focused && BrowserWindow.getAllWindows().includes(focused)
    if (!isAppWindow) {
      mainWindow.hide()
      if (ballWindow && !ballWindow.isDestroyed()) {
        ballWindow.setAlwaysOnTop(true, 'floating')
        ballWindow.showInactive()
      }
    }
  })

  // 开发模式：全局 F12 打开 DevTools
  if (process.env.NODE_ENV === 'development') {
    const { globalShortcut } = require('electron')
    globalShortcut.register('F12', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.toggleDevTools()
      }
    })
  }
})

app.on('window-all-closed', () => {
  // 不退出，保持托盘运行
})

app.on('before-quit', () => {
  app.isQuiting = true
})

module.exports = { getMainWindow: () => mainWindow, getBallWindow: () => ballWindow }
