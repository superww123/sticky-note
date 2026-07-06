<template>
  <div class="ball-widget">
    <div class="ball" @click="restore" @mousedown="onDragStart" title="点击展开便签">
      <div class="ball-inner">
        <span class="ball-icon">📝</span>
        <span v-if="pendingCount > 0" class="ball-badge">{{ pendingCount }}</span>
      </div>
    </div>

    <!-- 透明度滑块 -->
    <div class="ball-slider-wrap" ref="sliderWrapRef" @mousedown.stop="onSliderMousedown">
      <div class="opacity-track">
        <div class="opacity-fill" :style="{ width: fillPct + '%' }"></div>
        <div class="opacity-thumb" :style="{ left: fillPct + '%' }"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'sticky-note-ball-opacity'
const pendingCount = ref(0)
const opacityPct = ref(parseInt(localStorage.getItem(STORAGE_KEY) ?? '95', 10))
const sliderWrapRef = ref(null)

const fillPct = computed(() => ((opacityPct.value - 30) / 70) * 100)

function applyOpacity(pct) {
  opacityPct.value = Math.max(30, Math.min(100, Math.round(pct)))
  localStorage.setItem(STORAGE_KEY, String(opacityPct.value))
  document.documentElement.style.opacity = String(opacityPct.value / 100)
}

function getPctFromMouseX(clientX) {
  const rect = sliderWrapRef.value?.getBoundingClientRect()
  if (!rect) return opacityPct.value
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  return 30 + ratio * 70
}

function onSliderMousedown(e) {
  if (e.button !== 0) return
  e.stopPropagation()
  applyOpacity(getPctFromMouseX(e.clientX))
  const onMove = (me) => applyOpacity(getPctFromMouseX(me.clientX))
  const onUp = () => {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
  }
  window.addEventListener('mousemove', onMove)
  window.addEventListener('mouseup', onUp)
}

function restore() {
  window.electronAPI?.restoreFromBall()
}

function onDragStart(e) {
  if (e.button !== 0) return
  e.preventDefault()
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

onMounted(() => {
  const clamped = Math.max(30, opacityPct.value)
  opacityPct.value = clamped
  localStorage.setItem(STORAGE_KEY, String(clamped))
  document.documentElement.style.opacity = String(clamped / 100)
  window.electronAPI?.onTodosUpdated((todos) => {
    pendingCount.value = todos.filter(t => !t.completed).length
  })
})

onUnmounted(() => {
  window.electronAPI?.removeAllListeners('todos-updated')
})
</script>
