// 打包后对 macOS .app 进行 ad-hoc 签名，消除"已损坏"提示
const { execSync } = require('child_process')
const path = require('path')

exports.default = async function (context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productName
  const appPath = path.join(context.appOutDir, `${appName}.app`)

  console.log(`[afterSign] Ad-hoc signing: ${appPath}`)
  execSync(`codesign --deep --force --sign - "${appPath}"`, { stdio: 'inherit' })
  console.log('[afterSign] Done.')
}
