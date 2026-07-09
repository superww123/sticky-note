<template>
  <div class="sticky-note" :class="{ 'is-resizing': isResizing }">
    <!-- 标题栏 -->
    <div class="title-bar" @mousedown="onDrag">
      <DateBar />

      <!-- 搜索按钮（主窗口专用） -->
      <button
        v-if="!isNoteWindow"
        class="ctrl-btn search-btn"
        title="搜索"
        @mousedown.stop
        @click="showSearch = true"
      >🔍</button>

      <!-- 搜索浮层 -->
      <SearchPanel v-if="showSearch && !isNoteWindow" @close="showSearch = false" />

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
        <button
          v-if="!isNoteWindow"
          class="ctrl-btn pin-btn"
          :class="{ pinned: isPinned }"
          :title="isPinned ? '取消固定（点击后失焦会变小球）' : '固定在最上层（可同时查看其他窗口）'"
          @click="togglePin"
        >↑</button>
        <button v-if="!isNoteWindow" class="ctrl-btn tray-btn" title="最小化到托盘" @click="minimizeToTray">－</button>
        <button v-if="!isNoteWindow" class="ctrl-btn ball-btn" title="收起为小球"   @click="minimizeToBall">●</button>
        <button v-if="isNoteWindow"  class="ctrl-btn tray-btn" title="最小化到任务栏" @click="minimizeToTray">－</button>
        <button class="ctrl-btn close-btn" title="关闭"        @click="closeApp">✕</button>
      </div>
    </div>

    <div class="content" ref="contentRef">
      <!-- 待办面板 -->
      <div class="panel" :style="{ flex: splitPct }">
        <TodoList />
      </div>

      <!-- 拖拽分隔线 -->
      <div class="split-handle" @mousedown.stop="onResizeStart">
        <span class="split-dots"></span>
      </div>

      <!-- 随心记面板 -->
      <div class="panel" :style="{ flex: 100 - splitPct }">
        <NoteEditor />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import { useRoute } from 'vue-router'
import DateBar from './components/DateBar/DateBar.vue'
import TodoList from './components/TodoList/TodoList.vue'
import NoteEditor from './components/NoteEditor/NoteEditor.vue'
import SearchPanel from './components/SearchPanel.vue'
import { NOTE_THEMES } from './themes.js'
import { useDailyStore } from './stores/dailyStore'

const route = useRoute()
const store = useDailyStore()
const isNoteWindow = computed(() => route.path.startsWith('/note/'))
const isPinned = ref(false)
const contentRef = ref(null)

// ── 搜索 ──────────────────────────────────────────────────
const showSearch = ref(false)
const findKeyword = ref('')
provide('findKeyword', findKeyword)

// ── 上下分割比例 ──────────────────────────────────────────
const SPLIT_KEY = 'sticky-note-split'
const splitPct = ref(parseInt(localStorage.getItem(SPLIT_KEY) ?? '50', 10))
const isResizing = ref(false)

function onResizeStart(e) {
  e.preventDefault()
  isResizing.value = true
  const onMove = (me) => {
    const rect = contentRef.value?.getBoundingClientRect()
    if (!rect) return
    const pct = Math.round(((me.clientY - rect.top) / rect.height) * 100)
    splitPct.value = Math.max(15, Math.min(85, pct))
    localStorage.setItem(SPLIT_KEY, String(splitPct.value))
  }
  const onUp = () => {
    isResizing.value = false
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

async function togglePin() {
  isPinned.value = await window.electronAPI?.togglePin()
}

// ── 透明度滑块 ────────────────────────────────────────────
const STORAGE_KEY = 'sticky-note-opacity'
const opacityPct = ref(parseInt(localStorage.getItem(STORAGE_KEY) ?? '95', 10))
const sliderWrapRef = ref(null)
let dayCheckTimer = null

onUnmounted(() => {
  if (dayCheckTimer) clearInterval(dayCheckTimer)
  window.electronAPI?.removeAllListeners('day-changed')
})

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

onMounted(async () => {
  document.documentElement.style.opacity = String(opacityPct.value / 100)

  // 同步主进程的钉住状态（重新加载页面时保持一致）
  if (!isNoteWindow.value) {
    isPinned.value = await window.electronAPI?.getPinState() ?? false
  }

  // 注窗口：应用对应的浅色主题
  const colorIdx = parseInt(route.params.colorIdx)
  const theme = NOTE_THEMES[colorIdx]
  if (theme) {
    for (const [key, value] of Object.entries(theme)) {
      document.documentElement.style.setProperty(key, value)
    }
  }

  // 主窗口：跨天自动刷新
  if (!isNoteWindow.value) {
    const getTodayStr = () => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    }
    const checkDayChange = () => {
      if (store.currentDate !== getTodayStr()) store.loadToday()
    }
    dayCheckTimer = setInterval(checkDayChange, 60_000)
    window.electronAPI?.onDayChanged(checkDayChange)
  }

  // note 子窗口：接收主进程推送的搜索关键词，触发高亮
  if (isNoteWindow.value) {
    window.electronAPI?.onFindKeyword((kw) => {
      findKeyword.value = kw
    })
  }
})

// ── 窗口控制 ──────────────────────────────────────────────
function minimizeToBall()  { window.electronAPI?.minimizeToBall() }
function minimizeToTray()  { window.electronAPI?.minimizeToTray() }
function closeApp() {
  if (isNoteWindow.value) {
    window.electronAPI?.closeSelf()
  } else {
    window.electronAPI?.closeApp()
  }
}

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
