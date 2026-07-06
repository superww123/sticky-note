const { Tray, Menu, nativeImage, app } = require('electron')
const path = require('path')

/**
 * 创建系统托盘
 */
function setupTray(mainWindow, ballWindow) {
  // 用 16x16 的内嵌 PNG（紫色便签图标），保证跨环境显示
  // 如需替换自定义图标，把 assets/tray-icon.png 换成 16x16 或 32x32 的 PNG
  const iconPath = path.join(__dirname, '../../../assets/tray-icon.png')
  const fs = require('fs')

  let icon
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath)
  } else {
    // 内嵌一个最小可见的 16x16 紫色方块 PNG（base64）
    const BASE64_ICON = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAALEwAACxMBAJqcGAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABOSURBVDiNY/z//z8DJYCJgUIwasCoAaMGjBowasCoAaMGjBowasCoAaMGjBowasCoAaMGjBowasCoAaMGjBowasCoAaMGUAoAAP//AwAI9AX/TkRScgAAAABJRU5ErkJggg=='
    const buf = Buffer.from(BASE64_ICON, 'base64')
    icon = nativeImage.createFromBuffer(buf)
  }

  // Windows 托盘图标需要是 16x16 才清晰
  const trayIcon = icon.resize({ width: 16, height: 16 })
  const tray = new Tray(trayIcon)
  tray.setToolTip('随心记便签')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '📝 显示便签',
      click: () => {
        ballWindow.hide()
        mainWindow.show()
        mainWindow.setAlwaysOnTop(true, 'floating')
        mainWindow.moveTop()
        mainWindow.focus()
      },
    },
    {
      label: '⚽ 收起为小球',
      click: () => {
        mainWindow.hide()
        ballWindow.show()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuiting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 单击托盘图标显示主窗口
  tray.on('click', () => {
    ballWindow.hide()
    mainWindow.show()
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.moveTop()
    mainWindow.focus()
  })

  tray.on('double-click', () => {
    ballWindow.hide()
    mainWindow.show()
    mainWindow.setAlwaysOnTop(true, 'floating')
    mainWindow.moveTop()
    mainWindow.focus()
  })

  return tray
}

module.exports = { setupTray }
