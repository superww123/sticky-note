const { BrowserWindow, screen } = require('electron')
const path = require('path')

function openAlarmAlertWindow({ todoText, note, time }) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const W = 300, H = note ? 220 : 185

  const win = new BrowserWindow({
    width: W,
    height: H,
    x: Math.round((width - W) / 2),
    y: Math.round((height - H) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../../preload/alarmAlert.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.loadFile(path.join(__dirname, '../../../assets/alarmAlert.html'))

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('alarm-init', { todoText, note, time })
  })
}

module.exports = { openAlarmAlertWindow }
