const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } = require('docx')
const { dialog, BrowserWindow } = require('electron')
const fs = require('fs')
const path = require('path')
const { getDailyNote } = require('../database/db')
const { getArchiveDir: getConfiguredDir, setArchiveDir } = require('../config')

async function resolveArchiveDir() {
  const saved = getConfiguredDir()
  if (saved) return saved

  // 首次使用：弹出文件夹选择框
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
  const result = await dialog.showOpenDialog(win, {
    title: '选择随心记归档文件夹',
    message: '请选择保存随心记归档文档的文件夹',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: '选择此文件夹',
  })
  if (result.canceled || !result.filePaths[0]) {
    throw new Error('未选择归档文件夹，归档已取消')
  }
  const dir = result.filePaths[0]
  setArchiveDir(dir)
  return dir
}

function getArchiveFile(archiveDir) {
  return path.join(archiveDir, '随心记归档.docx')
}

function getHistoryFile(archiveDir) {
  return path.join(archiveDir, '.archive-history.json')
}

/**
 * 将指定日期的随心记归档到 Word 文档
 */
async function archiveDailyNote(date) {
  const data = getDailyNote(date)
  if (!data || !data.noteContent || !data.noteContent.content) {
    console.log(`[Archiver] ${date} 无随心记内容，跳过归档`)
    return
  }

  const archiveDir = await resolveArchiveDir()
  fs.mkdirSync(archiveDir, { recursive: true })

  const paragraphs = await tiptapToDocxParagraphs(date, data.noteContent)
  let existingChildren = []
  if (fs.existsSync(getArchiveFile(archiveDir))) {
    existingChildren = loadArchivedHistory(archiveDir)
  }

  const historyEntry = { date, content: data.noteContent }
  saveArchivedHistory(historyEntry, existingChildren, archiveDir)
  await generateDocx(existingChildren.concat([historyEntry]), archiveDir)
  console.log(`[Archiver] ${date} 随心记归档完成 → ${archiveDir}`)
}

function loadArchivedHistory(archiveDir) {
  const historyFile = getHistoryFile(archiveDir)
  if (!fs.existsSync(historyFile)) return []
  try { return JSON.parse(fs.readFileSync(historyFile, 'utf-8')) } catch { return [] }
}

function saveArchivedHistory(newEntry, existing, archiveDir) {
  const historyFile = getHistoryFile(archiveDir)
  fs.writeFileSync(historyFile, JSON.stringify([...existing, newEntry], null, 2), 'utf-8')
}

async function generateDocx(historyEntries, archiveDir) {
  const allSections = []

  for (const entry of historyEntries) {
    const paragraphs = await tiptapToDocxParagraphs(entry.date, entry.content)
    allSections.push(
      new Paragraph({
        text: `${entry.date} 随心记`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
      }),
      ...paragraphs,
      new Paragraph({ text: '' }),
    )
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        new Paragraph({ text: '随心记归档', heading: HeadingLevel.HEADING_1 }),
        ...allSections,
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(getArchiveFile(archiveDir), buffer)
}

async function tiptapToDocxParagraphs(date, tiptapJson) {
  const paragraphs = []
  if (!tiptapJson || !tiptapJson.content) return paragraphs

  for (const node of tiptapJson.content) {
    if (node.type === 'paragraph') {
      paragraphs.push(new Paragraph({ children: nodeToTextRuns(node) }))
    } else if (node.type === 'image') {
      try {
        const imgParagraph = await imageNodeToDocx(node)
        if (imgParagraph) paragraphs.push(imgParagraph)
      } catch (e) {
        console.error('[Archiver] 图片处理失败:', e.message)
        paragraphs.push(new Paragraph({ text: '[图片]' }))
      }
    } else if (node.type === 'bulletList' || node.type === 'orderedList') {
      for (const item of (node.content || [])) {
        const runs = nodeToTextRuns(item.content?.[0] || {})
        paragraphs.push(new Paragraph({ children: runs, bullet: { level: 0 } }))
      }
    }
  }

  return paragraphs
}

function nodeToTextRuns(node) {
  const runs = []
  if (!node.content) return [new TextRun({ text: '' })]
  for (const child of node.content) {
    if (child.type === 'text') {
      const marks = child.marks || []
      const bold      = marks.some(m => m.type === 'bold')
      const italics   = marks.some(m => m.type === 'italic')
      const strike    = marks.some(m => m.type === 'strike')
      const colorMark = marks.find(m => m.type === 'textStyle')
      const hlMark    = marks.find(m => m.type === 'highlight')
      const sizeMark  = marks.find(m => m.type === 'textStyle')
      const color     = colorMark?.attrs?.color?.replace('#', '') || undefined
      const highlight = hlMark?.attrs?.color?.replace('#', '') || undefined
      const fontSize  = sizeMark?.attrs?.fontSize
        ? parseInt(sizeMark.attrs.fontSize) * 2  // docx 单位是半点，px*2 近似
        : undefined

      runs.push(new TextRun({
        text: child.text || '',
        bold,
        italics,
        strike,
        ...(color    ? { color }                       : {}),
        ...(highlight ? { highlight: 'yellow' }        : {}),  // docx highlight 只支持固定色名
        ...(fontSize  ? { size: fontSize }             : {}),
      }))
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })]
}

async function imageNodeToDocx(node) {
  const src = node.attrs?.src
  if (!src) return null

  let imageData, mimeType
  if (src.startsWith('data:')) {
    const match = src.match(/^data:(image\/\w+);base64,(.+)/)
    if (!match) return null
    mimeType = match[1]
    imageData = Buffer.from(match[2], 'base64')
  } else if (src.startsWith('file://')) {
    const filePath = src.replace(/^file:\/\/\/?/, '')
    imageData = fs.readFileSync(filePath)
    mimeType = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg'
  } else {
    return null
  }

  // 从二进制数据解析真实宽高
  const { width: origW, height: origH } = getImageDimensions(imageData, mimeType)
  const MAX_W = 450
  const ratio = origW > MAX_W ? MAX_W / origW : 1
  const width  = Math.round(origW * ratio)
  const height = Math.round(origH * ratio)

  const typeMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'png' }
  const imgType = typeMap[mimeType] || 'png'

  return new Paragraph({
    children: [
      new ImageRun({ data: imageData, transformation: { width, height }, type: imgType }),
    ],
  })
}

/**
 * 从 buffer 读取图片真实宽高（支持 PNG / JPEG）
 */
function getImageDimensions(buf, mimeType) {
  try {
    if (mimeType === 'image/png') {
      // PNG: 宽高在第 16-24 字节
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    } else {
      // JPEG: 扫描 SOF0/SOF2 标记
      let i = 2
      while (i < buf.length) {
        if (buf[i] !== 0xFF) break
        const marker = buf[i + 1]
        const segLen = buf.readUInt16BE(i + 2)
        if ((marker >= 0xC0 && marker <= 0xC3) || (marker >= 0xC5 && marker <= 0xC7)) {
          return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
        }
        i += 2 + segLen
      }
    }
  } catch {}
  return { width: 400, height: 300 }  // 解析失败时的兜底值
}

module.exports = { archiveDailyNote }
