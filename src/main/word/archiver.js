const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } = require('docx')
const { dialog, BrowserWindow, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { getDailyNote, getAllArchivedDates } = require('../database/db')
const { getArchiveDir: getConfiguredDir, setArchiveDir } = require('../config')

async function resolveArchiveDir() {
  const saved = getConfiguredDir()
  if (saved) return saved

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

/**
 * 归档指定日期的随心记
 * 逻辑：从数据库读取所有有内容的日期，重新生成整个 docx（当天内容已是最新）
 */
async function archiveDailyNote(date) {
  const data = getDailyNote(date)
  if (!data || !data.noteContent || !data.noteContent.content) {
    console.log(`[Archiver] ${date} 无随心记内容，跳过归档`)
    return
  }

  const archiveDir = await resolveArchiveDir()
  fs.mkdirSync(archiveDir, { recursive: true })

  // 从数据库读所有有内容的日期（包含今天最新数据）
  const allDates = getAllArchivedDates()
  if (!allDates.includes(date)) allDates.push(date)
  allDates.sort()

  await generateDocx(allDates, archiveDir)
  const filePath = getArchiveFile(archiveDir)
  console.log(`[Archiver] ${date} 随心记归档完成 → ${filePath}`)
  return filePath
}

async function generateDocx(dates, archiveDir) {
  const allSections = []

  for (const date of dates) {
    const data = getDailyNote(date)
    if (!data?.noteContent?.content) continue
    const paragraphs = await tiptapToDocxParagraphs(date, data.noteContent)
    allSections.push(
      new Paragraph({
        text: `${date} 随心记`,
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
  try {
    fs.writeFileSync(getArchiveFile(archiveDir), buffer)
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      throw new Error('请先关闭 Word 中已打开的归档文件，再重试归档')
    }
    throw e
  }
}

async function tiptapToDocxParagraphs(date, tiptapJson) {
  const paragraphs = []
  if (!tiptapJson || !tiptapJson.content) return paragraphs

  async function processNode(node, listLevel = 0) {
    if (node.type === 'paragraph') {
      const runs = nodeToTextRuns(node)
      const opts = runs.length ? { children: runs } : { text: '' }
      if (listLevel > 0) opts.bullet = { level: listLevel - 1 }
      paragraphs.push(new Paragraph(opts))

    } else if (node.type === 'orderedList' || node.type === 'bulletList') {
      for (const item of (node.content || [])) {
        await processNode(item, listLevel + 1)
      }

    } else if (node.type === 'listItem') {
      // listItem 可以包含多个 paragraph 和嵌套列表，全部递归处理
      for (const child of (node.content || [])) {
        await processNode(child, listLevel)
      }

    } else if (node.type === 'image') {
      try {
        const imgPara = await imageNodeToDocx(node)
        if (imgPara) paragraphs.push(imgPara)
      } catch (e) {
        console.error('[Archiver] 图片处理失败:', e.message)
        paragraphs.push(new Paragraph({ text: '[图片]' }))
      }

    } else if (node.type === 'horizontalRule') {
      paragraphs.push(new Paragraph({
        children: [new TextRun({ text: '─'.repeat(30), color: 'AAAAAA' })],
      }))

    } else if (node.content) {
      // 未知容器节点，递归子节点
      for (const child of node.content) {
        await processNode(child, listLevel)
      }
    }
  }

  for (const node of tiptapJson.content) {
    await processNode(node)
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
      const rawColor  = colorMark?.attrs?.color
      const rawHL     = hlMark?.attrs?.color
      const color     = rawColor && rawColor.startsWith('#') ? rawColor.replace('#', '') : undefined
      const highlight = rawHL    && !rawHL.startsWith('var(')    ? 'yellow'                  : undefined
      const fontSize  = sizeMark?.attrs?.fontSize
        ? parseInt(sizeMark.attrs.fontSize) * 2
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
