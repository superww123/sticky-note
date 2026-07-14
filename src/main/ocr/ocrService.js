const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const os = require('os')
const { nativeImage } = require('electron')

const TESSERACT_EXE = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'
const TESSDATA_DIR  = path.join(os.homedir(), '.tessdata')

/**
 * 对图片进行 OCR 识别，返回 { imageWidth, imageHeight, lines }
 * lines[i] = { text, words: [{ text, x, y, width, height }] }
 * @param {string} src  file:// 路径 或 data: URL
 */
async function recognizeImage(src) {
  let imagePath
  let tempFile = null

  if (src.startsWith('data:')) {
    const base64 = src.split(',')[1]
    const buf = Buffer.from(base64, 'base64')
    tempFile = path.join(os.tmpdir(), `sn-ocr-${Date.now()}.png`)
    fs.writeFileSync(tempFile, buf)
    imagePath = tempFile
  } else {
    imagePath = decodeURIComponent(src.replace(/^file:\/\/\/?/, ''))
    if (imagePath.startsWith('/')) imagePath = imagePath.slice(1)
  }

  try {
    const img = nativeImage.createFromPath(imagePath)
    const { width: imageWidth, height: imageHeight } = img.getSize()

    const tsv = await runTesseract(imagePath)
    const lines = parseTsv(tsv)

    return { imageWidth, imageHeight, lines }
  } finally {
    if (tempFile) { try { fs.unlinkSync(tempFile) } catch {} }
  }
}

function runTesseract(imagePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(TESSERACT_EXE, [
      imagePath, 'stdout',
      '--tessdata-dir', TESSDATA_DIR,
      '-l', 'chi_sim+eng',
      '--oem', '3',
      '--psm', '11',
      'tsv',
    ], { timeout: 30000 })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Tesseract 失败: ${stderr.trim() || `exit ${code}`}`))
        return
      }
      resolve(stdout)
    })

    proc.on('error', err => reject(new Error(`Tesseract 启动失败: ${err.message}`)))
  })
}

/**
 * 解析 Tesseract TSV 输出，按行分组
 * TSV 列: level page block par line word left top width height conf text
 */
function parseTsv(tsv) {
  const rows = tsv.trim().split('\n').slice(1) // 跳过 header

  // 按 block-par-line 分组收集单词
  const lineMap = new Map()

  for (const row of rows) {
    const cols = row.split('\t')
    if (cols.length < 12) continue

    const level  = parseInt(cols[0])
    const block  = cols[2]
    const par    = cols[3]
    const lineN  = cols[4]
    const left   = parseInt(cols[6])
    const top    = parseInt(cols[7])
    const width  = parseInt(cols[8])
    const height = parseInt(cols[9])
    const conf   = parseInt(cols[10])
    const text   = cols.slice(11).join('\t').trim()

    if (level !== 5) continue       // 只要 word 级别
    if (!text)       continue
    if (conf < 0)    continue       // 非文字行

    const key = `${block}-${par}-${lineN}`
    if (!lineMap.has(key)) lineMap.set(key, [])
    lineMap.get(key).push({ text, x: left, y: top, width, height })
  }

  // 组装 lines，按 Y 排序
  const lines = []
  for (const words of lineMap.values()) {
    if (words.length === 0) continue
    words.sort((a, b) => a.x - b.x)
    lines.push({ text: words.map(w => w.text).join(' '), words })
  }

  lines.sort((a, b) => {
    const ay = Math.min(...a.words.map(w => w.y))
    const by = Math.min(...b.words.map(w => w.y))
    return ay - by
  })

  return lines
}

module.exports = { recognizeImage }
