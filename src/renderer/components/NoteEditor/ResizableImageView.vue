<template>
  <!-- data-drag-handle 放在整个 wrapper 上，长按自动触发 ProseMirror 拖拽 -->
  <node-view-wrapper
    as="div"
    class="image-wrapper"
    :class="{ selected }"
    data-drag-handle
  >
    <!-- 图片：单击选中，双击打开全屏预览，右键显示菜单 -->
    <img
      :src="node.attrs.src"
      :alt="node.attrs.alt || ''"
      :style="{ width: currentWidth + 'px' }"
      draggable="false"
      @dblclick.prevent="openPreview"
      @contextmenu.prevent="onContextMenu"
    />

    <!-- 右下角尺寸调整把手 -->
    <div class="resize-handle" @mousedown.prevent.stop="startResize" title="拖拽调整大小" />
  </node-view-wrapper>

  <!-- ── 右键上下文菜单 ── -->
  <teleport to="body">
    <div
      v-if="contextMenuVisible"
      class="img-context-menu"
      :style="{ left: contextMenuX + 'px', top: contextMenuY + 'px' }"
      @mousedown.stop
    >
      <button @click="copyImage">复制图片</button>
    </div>
  </teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { NodeViewWrapper } from '@tiptap/vue-3'

const props = defineProps({
  node: Object,
  updateAttributes: Function,
  selected: Boolean,
})

// ─── 图片宽度调整 ──────────────────────────────────────
const currentWidth = ref(props.node.attrs.width || 180)

function startResize(e) {
  const startX = e.clientX
  const startWidth = currentWidth.value
  const onMove = (e) => {
    currentWidth.value = Math.max(60, Math.min(560, startWidth + (e.clientX - startX)))
  }
  const onUp = () => {
    props.updateAttributes({ width: currentWidth.value })
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

// ─── 长按 vs 短按区分 ─────────────────────────────────

function openPreview() {
  window.electronAPI?.previewImageFullscreen(props.node.attrs.src)
}

// ─── 右键菜单 & 复制 ─────────────────────────────────
const contextMenuVisible = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

function onContextMenu(e) {
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  contextMenuVisible.value = true
}

function closeContextMenu() {
  contextMenuVisible.value = false
}

async function copyImage() {
  closeContextMenu()
  try {
    await window.electronAPI?.copyImageToClipboard(props.node.attrs.src)
  } catch (e) {
    console.error('[ResizableImage] 复制图片失败:', e)
  }
}

// Ctrl+C 复制（仅当该图片节点被 ProseMirror 选中时触发）
function onKeyDown(e) {
  if (props.selected && (e.ctrlKey || e.metaKey) && e.key === 'c') {
    e.preventDefault()
    copyImage()
  }
}

onMounted(() => {
  window.addEventListener('mousedown', closeContextMenu)
  window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', closeContextMenu)
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.image-wrapper {
  display: inline-flex;
  position: relative;
  margin: 6px 2px;
  line-height: 0;
  cursor: grab;
}
.image-wrapper:active {
  cursor: grabbing;
}

.image-wrapper img {
  display: block;
  border-radius: 6px;
  max-width: 100%;
  height: auto;
  pointer-events: none;
  transition: outline 0.15s;
  user-select: none;
}
.image-wrapper.selected img,
.image-wrapper:hover img {
  outline: 2px solid #9b8ec4;
  border-radius: 6px;
}

/* 让图片本身也能响应 mousedown */
.image-wrapper img {
  pointer-events: auto;
}

/* 右下角尺寸调整把手 */
.resize-handle {
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 12px;
  height: 12px;
  background: #9b8ec4;
  border-radius: 3px;
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity 0.2s;
}
.image-wrapper:hover .resize-handle {
  opacity: 0.85;
}

/* ── 右键菜单 ───────────────────────────────────────── */
.img-context-menu {
  position: fixed;
  z-index: 10000;
  background: rgba(40, 40, 44, 0.96);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  min-width: 120px;
}
.img-context-menu button {
  display: block;
  width: 100%;
  padding: 8px 14px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.12s;
}
.img-context-menu button:hover {
  background: rgba(155, 142, 196, 0.35);
}
</style>
