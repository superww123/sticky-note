const { app } = require('electron')
const path = require('path')
const fs = require('fs')

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json')
}

function readConfig() {
  const p = getConfigPath()
  if (!fs.existsSync(p)) return {}
  try { return JSON.parse(fs.readFileSync(p, 'utf-8')) } catch { return {} }
}

function writeConfig(updates) {
  const p = getConfigPath()
  const config = { ...readConfig(), ...updates }
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(config, null, 2), 'utf-8')
}

function getArchiveDir() {
  return readConfig().archiveDir || null
}

function setArchiveDir(dir) {
  writeConfig({ archiveDir: dir })
}

module.exports = { getArchiveDir, setArchiveDir }
