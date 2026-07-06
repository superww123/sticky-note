const { Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel } = require('docx')
const fs = require('fs')
const path = require('path')
const { getDailyNote } = require('../database/db')

const ARCHIVE_DIR = 'D:\\wenya\\随心记'
const ARCHIVE_FILE = path.join(ARCHIVE_DIR, '随心记归档.docx')

/**
 * 将指定日期的随心记归档到 Word 文档
 */
async function archiveDailyNote(date) {
  const data = getDailyNote(date)
  if (!data || !data.noteContent || !data.noteContent.content) {
    console.log(`[Archiver] ${date} 无随心记内容，跳过归档`)
    return
  }

  // 确保目录存在
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true })

  // 解析 Tiptap JSON 为 docx 段落
  const paragraphs = await tiptapToDocxParagraphs(date, data.noteContent)

  // 读取已有文档或新建
  const newSections = [
    new Paragraph({
      text: `${date} 随心记`,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 400, after: 200 },
    }),
    ...paragraphs,
    new Paragraph({ text: '', spacing: { after: 400 } }), // 空行分隔
  ]

  let existingChildren = []
  if (fs.existsSync(ARCHIVE_FILE)) {
    // 已有文件：追加内容（重新生成，保留历史）
    // 注意：docx 库不支持直接修改已有文件，采用追加存储策略：
    // 将历史内容记录在单独的 JSON 中，每次重新生成完整 docx
    existingChildren = loadArchivedHistory()
  }

  // 保存本次归档到历史记录
  const historyEntry = { date, content: data.noteContent }
  saveArchivedHistory(historyEntry, existingChildren)

  // 重新生成完整 docx
  await generateDocx(existingChildren.concat([historyEntry]))
  console.log(`[Archiver] ${date} 随心记归档完成`)
}

/**
 * 从历史记录文件加载已归档内容
 */
function loadArchivedHistory() {
  const historyFile = path.join(ARCHIVE_DIR, '.archive-history.json')
  if (!fs.existsSync(historyFile)) return []
  try {
    return JSON.parse(fs.readFileSync(historyFile, 'utf-8'))
  } catch {
    return []
  }
}

/**
 * 保存归档历史记录
 */
function saveArchivedHistory(newEntry, existing) {
  const historyFile = path.join(ARCHIVE_DIR, '.archive-history.json')
  const all = [...existing, newEntry]
  fs.writeFileSync(historyFile, JSON.stringify(all, null, 2), 'utf-8')
}

/**
 * 生成完整 docx 文件
 */
async function generateDocx(historyEntries) {
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
        new Paragraph({
          text: '随心记归档',
          heading: HeadingLevel.HEADING_1,
        }),
        ...allSections,
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(ARCHIVE_FILE, buffer)
}

/**
 * 将 Tiptap JSON 转换为 docx Paragraph 数组
 */
async function tiptapToDocxParagraphs(date, tiptapJson) {
  const paragraphs = []
  if (!tiptapJson || !tiptapJson.content) return paragraphs

  for (const node of tiptapJson.content) {
    if (node.type === 'paragraph') {
      const runs = nodeToTextRuns(node)
      paragraphs.push(new Paragraph({ children: runs }))
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

/**
 * 从节点提取 TextRun 数组
 */
function nodeToTextRuns(node) {
  const runs = []
  if (!node.content) return [new TextRun({ text: '' })]
  for (const child of node.content) {
    if (child.type === 'text') {
      runs.push(new TextRun({
        text: child.text || '',
        bold: child.marks?.some(m => m.type === 'bold'),
        italics: child.marks?.some(m => m.type === 'italic'),
      }))
    }
  }
  return runs.length ? runs : [new TextRun({ text: '' })]
}

/**
 * 将图片节点转换为 docx ImageRun
 */
async function imageNodeToDocx(node) {
  const src = node.attrs?.src
  if (!src) return null

  let imageData
  if (src.startsWith('data:')) {
    // Base64 图片
    const base64 = src.split(',')[1]
    imageData = Buffer.from(base64, 'base64')
  } else if (src.startsWith('file://')) {
    imageData = fs.readFileSync(src.replace('file://', ''))
  } else {
    return null
  }

  return new Paragraph({
    children: [
      new ImageRun({
        data: imageData,
        transformation: { width: 400, height: 300 },
      }),
    ],
  })
}

module.exports = { archiveDailyNote }
