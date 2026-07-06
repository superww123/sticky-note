<template>
  <!-- data-drag-handle 放在整个 wrapper 上，长按自动触发 ProseMirror 拖拽 -->
  <node-view-wrapper
    as="div"
    class="image-wrapper"
    :class="{ selected }"
    data-drag-handle
  >
    <!-- 图片：长按触发拖拽，短按（<300ms）打开预览 -->
    <img
      :src="node.attrs.src"
      :alt="node.attrs.alt || ''"
      :style="{ width: currentWidth + 'px' }"
      draggable="false"
      @mousedown="onImgMousedown"
      @mouseup="onImgMouseup"
    />

    <!-- 右下角尺寸调整把手 -->
    <div class="resize-handle" @mousedown.prevent.stop="startResize" title="拖拽调整大小" />
  </node-view-wrapper>

  <!-- ── 放大预览（支持拖拽平移 + 缩放） ── -->
  <teleport to="body">
    <div
      v-if="previewVisible"
      class="image-preview-overlay"
      @click.self="closePreview"
      @wheel.prevent="onWheel"
    >
      <img
        ref="previewImgRef"
        :src="node.attrs.src"
        class="preview-img"
        :style="{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          cursor: isPanning ? 'grabbing' : 'grab',
        }"
        draggable="false"
        @mousedown.prevent="startPan"
      />

      <!-- 底部工具栏 -->
      <div class="preview-toolbar" @mousedown.stop>
        <button @click="zoomOut" title="缩小">－</button>
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <button @click="zoomIn"  title="放大">＋</button>
        <button @click="resetView" title="重置">⊙</button>
        <button @click="closePreview" title="关闭">✕</button>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref } from 'vue'
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
let pressTimer = null
let pressMoved = false

function onImgMousedown(e) {
  if (e.button !== 0) return
  pressMoved = false
  const onMove = () => { pressMoved = true }
  pressTimer = setTimeout(() => {
    // 超过 300ms 视为拖拽，不打开预览（ProseMirror 接管拖拽）
    window.removeEventListener('mousemove', onMove)
  }, 300)
  window.addEventListener('mousemove', onMove, { once: true })
}

function onImgMouseup(e) {
  clearTimeout(pressTimer)
  if (!pressMoved) openPreview()  // 短按 = 打开预览
}

// ─── 预览状态 ─────────────────────────────────────────
const previewVisible = ref(false)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const isPanning = ref(false)

function openPreview() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
  previewVisible.value = true
}
function closePreview() {
  previewVisible.value = false
}

// ─── 缩放 ─────────────────────────────────────────────
const STEP = 0.2
function zoomIn()    { zoom.value = +(Math.min(8, zoom.value + STEP)).toFixed(1) }
function zoomOut()   { zoom.value = +(Math.max(0.1, zoom.value - STEP)).toFixed(1) }
function resetView() { zoom.value = 1; panX.value = 0; panY.value = 0 }
function onWheel(e)  { e.deltaY < 0 ? zoomIn() : zoomOut() }

// ─── 预览图拖拽平移 ───────────────────────────────────
function startPan(e) {
  isPanning.value = true
  const startX = e.clientX - panX.value
  const startY = e.clientY - panY.value

  const onMove = (e) => {
    panX.value = e.clientX - startX
    panY.value = e.clientY - startY
  }
  const onUp = () => {
    isPanning.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.image-wrapper {
  display: inline-flex;
  position: relative;
  margin: 6px 2px;
  line-height: 0;
  cursor: grab;          /* 整块可拖拽排序 */
}
.image-wrapper:active {
  cursor: grabbing;
}

.image-wrapper img {
  display: block;
  border-radius: 6px;
  max-width: 100%;
  height: auto;
  pointer-events: none;  /* 交给 wrapper 的 drag-handle 接管 */
  transition: outline 0.15s;
  user-select: none;
}
.image-wrapper.selected img,
.image-wrapper:hover img {
  outline: 2px solid #9b8ec4;
  border-radius: 6px;
}

/* 让图片本身也能响应 mousedown（用于短按预览） */
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

/* ── 预览遮罩 ───────────────────────────────────────── */
.image-preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-img {
  max-width: 88vw;
  max-height: 82vh;
  border-radius: 8px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6);
  transform-origin: center;
  transition: transform 0.1s ease;
  user-select: none;
}

/* 底部工具栏 */
.preview-toolbar {
  position: fixed;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(30,30,30,0.88);
  backdrop-filter: blur(8px);
  border-radius: 24px;
  padding: 6px 16px;
}
.preview-toolbar button {
  background: none;
  border: none;
  color: white;
  font-size: 16px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.preview-toolbar button:hover { background: rgba(255,255,255,0.2); }
.zoom-label {
  color: rgba(255,255,255,0.85);
  font-size: 13px;
  min-width: 44px;
  text-align: center;
}
</style>
