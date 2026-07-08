<template>
  <div class="note-section">
    <div class="section-header">
      <span class="section-icon">📝</span>
      <span class="section-title">随心记</span>
      <FormatToolbar v-if="editor" :editor="editor" />
      <button
        class="archive-btn"
        @click="manualArchive"
        :disabled="archiving"
        title="立即归档到Word"
      >{{ archiving ? '归档中…' : '💾' }}</button>
    </div>

    <div class="editor-wrapper">
      <EditorContent :editor="editor" class="note-editor" />
    </div>

    <Transition name="toast">
      <div v-if="toast.visible" class="archive-toast" :class="toast.type">
        {{ toast.message }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onBeforeUnmount, watch, ref } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import ResizableImage from './ResizableImage.js'
import { FontSize } from './fontSizeExtension.js'
import FormatToolbar from './FormatToolbar.vue'
import { useDailyStore } from '../../stores/dailyStore'

const store = useDailyStore()

const editor = useEditor({
  content: store.noteContent,
  extensions: [
    StarterKit,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontSize,
    ResizableImage.configure({ inline: false, allowBase64: true }),
    Link.configure({ openOnClick: false }),
  ],
  editorProps: {
    handlePaste(view, event) {
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
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      store.saveNote(editor.getJSON())
    }, 800)
  },
})

let saveTimer = null
let toastTimer = null
const archiving = ref(false)
const toast = ref({ visible: false, message: '', type: 'success' })

watch(() => store.noteContent, (newContent) => {
  if (editor.value && JSON.stringify(editor.value.getJSON()) !== JSON.stringify(newContent)) {
    editor.value.commands.setContent(newContent || { type: 'doc', content: [] })
  }
}, { deep: true })

function showToast(message, type = 'success') {
  clearTimeout(toastTimer)
  toast.value = { visible: true, message, type }
  toastTimer = setTimeout(() => { toast.value.visible = false }, 2500)
}

async function manualArchive() {
  if (archiving.value) return
  archiving.value = true
  try {
    await window.electronAPI?.manualArchive(store.currentDate)
    showToast('✓ 已保存到随心记归档')
  } catch (e) {
    showToast('归档失败：' + (e?.message || '未知错误'), 'error')
  } finally {
    archiving.value = false
  }
}

onBeforeUnmount(() => {
  clearTimeout(saveTimer)
  clearTimeout(toastTimer)
  editor.value?.destroy()
})
</script>

<style scoped>
.archive-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.archive-toast {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(60, 170, 110, 0.93);
  color: #fff;
  padding: 6px 16px;
  border-radius: 10px;
  font-size: 13px;
  pointer-events: none;
  backdrop-filter: blur(6px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.archive-toast.error {
  background: rgba(210, 70, 70, 0.93);
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s, transform 0.25s;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
