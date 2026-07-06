<template>
  <div class="note-section">
    <div class="section-header">
      <span class="section-icon">📋</span>
      <span class="section-title">随心记：</span>
      <button class="archive-btn" @click="manualArchive" title="立即归档到Word">💾</button>
    </div>

    <div class="editor-wrapper">
      <EditorContent :editor="editor" class="note-editor" />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import ResizableImage from './ResizableImage.js'
import Link from '@tiptap/extension-link'
import { useDailyStore } from '../../stores/dailyStore'

const store = useDailyStore()

// 初始化 Tiptap 编辑器
const editor = useEditor({
  content: store.noteContent,
  extensions: [
    StarterKit,
    ResizableImage.configure({ inline: false, allowBase64: true }),
    Link.configure({ openOnClick: false }),
  ],
  editorProps: {
    handlePaste(view, event) {
      // 处理图片粘贴
      const items = Array.from(event.clipboardData?.items || [])
      const imageItem = items.find(item => item.type.startsWith('image/'))
      if (imageItem) {
        event.preventDefault()
        const file = imageItem.getAsFile()
        const reader = new FileReader()
        reader.onload = (e) => {
          editor.value?.chain().focus().setImage({ src: e.target.result }).run()
        }
        reader.readAsDataURL(file)
        return true
      }
      return false
    },
  },
  onUpdate: ({ editor }) => {
    // 防抖保存
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      store.saveNote(editor.getJSON())
    }, 800)
  },
})

let saveTimer = null

// 切换日期时同步内容
watch(() => store.noteContent, (newContent) => {
  if (editor.value && JSON.stringify(editor.value.getJSON()) !== JSON.stringify(newContent)) {
    editor.value.commands.setContent(newContent || { type: 'doc', content: [] })
  }
}, { deep: true })

async function manualArchive() {
  await window.electronAPI?.manualArchive(store.currentDate)
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  editor.value?.destroy()
})
</script>
