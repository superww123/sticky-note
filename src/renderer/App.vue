<template>
  <div class="sticky-note">
    <!-- 标题栏 -->
    <div class="title-bar" @mousedown="onDrag">
      <DateBar />

      <!-- 透明度滑块 -->
      <div
        class="opacity-slider-wrap"
        ref="sliderWrapRef"
        @mousedown.stop="onSliderMousedown"
      >
        <div class="opacity-track">
          <div class="opacity-fill" :style="{ width: fillPct + '%' }"></div>
          <div class="opacity-thumb" :style="{ left: fillPct + '%' }"></div>
        </div>
      </div>

      <div class="window-controls" @mousedown.stop>
        <button class="ctrl-btn tray-btn" title="最小化到托盘" @click="minimizeToTray">－</button>
        <button class="ctrl-btn ball-btn" title="收起为小球"   @click="minimizeToBall">●</button>
        <button class="ctrl-btn close-btn" title="关闭"        @click="closeApp">✕</button>
      </div>
    </div>

    <div class="content">
      <TodoList />
      <NoteEditor />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DateBar from './components/DateBar/DateBar.vue'
import TodoList from './components/TodoList/TodoList.vue'
import NoteEditor from './components/NoteEditor/NoteEditor.vue'

// ── 透明度滑块 ────────────────────────────────────────────
const STORAGE_KEY = 'sticky-note-opacity'
const opacityPct = ref(parseInt(localStorage.getItem(STORAGE_KEY) ?? '95', 10))
const sliderWrapRef = ref(null)

// fillPct: 0~100 对应滑块从左到右的视觉百分比
// opacityPct 范围 15~100，映射到 0~100%
const fillPct = computed(() => ((opacityPct.value - 15) / 85) * 100)

function applyOpacity(pct) {
  opacityPct.value = Math.max(10, Math.min(100, Math.round(pct)))
  localStorage.setItem(STORAGE_KEY, String(opacityPct.value))
  const alpha = opacityPct.value / 100
  document.documentElement.style.opacity = String(alpha)
  window.electronAPI?.setWindowOpacity(alpha)
}

function getPctFromMouseX(clientX) {
  const rect = sliderWrapRef.value?.getBoundingClientRect()
  if (!rect) return opacityPct.value
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return 10 + ratio * 90
}

function onSliderMousedown(e) {
  if (e.button !== 0) return
  e.stopPropagation()
  applyOpacity(getPctFromMouseX(e.clientX))

  const onMove = (me) => {
    applyOpacity(getPctFromMouseX(me.clientX))
  }
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

onMounted(() => {
  document.documentElement.style.opacity = String(opacityPct.value / 100)
})

// ── 窗口控制 ──────────────────────────────────────────────
function minimizeToBall()  { window.electronAPI?.minimizeToBall() }
function minimizeToTray()  { window.electronAPI?.minimizeToTray() }
function closeApp()        { window.electronAPI?.closeApp() }

// ── 标题栏拖拽 ────────────────────────────────────────────
function onDrag(e) {
  if (e.button !== 0) return
  window.electronAPI?.dragStart()
  let prevX = e.screenX
  let prevY = e.screenY
  const onMove = (me) => {
    const dx = me.screenX - prevX
    const dy = me.screenY - prevY
    prevX = me.screenX
    prevY = me.screenY
    if (dx !== 0 || dy !== 0) window.electronAPI?.dragWindow(dx, dy)
  }
  const onUp = () => {
    window.electronAPI?.dragEnd()
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}
</script>
