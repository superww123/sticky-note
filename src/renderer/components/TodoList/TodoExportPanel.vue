<template>
  <div class="export-panel" @mousedown.stop>
    <div class="panel-title">导出待办</div>

    <div class="range-row">
      <button class="range-btn" :class="{ active: mode === 'today' }" @click="mode = 'today'">当天</button>
      <button class="range-btn" :class="{ active: mode === 'range' }" @click="mode = 'range'">自定义范围</button>
      <button class="range-btn dedup-btn" :class="{ active: dedupEnabled }" @click="dedupEnabled = !dedupEnabled" title="去除重复待办，只保留第一次出现">去重</button>
    </div>

    <div v-if="mode === 'range'" class="date-row">
      <input type="date" class="date-input" v-model="fromDate" />
      <span class="date-sep">→</span>
      <input type="date" class="date-input" v-model="toDate" />
    </div>

    <div class="preview-box">{{ previewText }}</div>

    <button class="copy-btn" @click="copyText">
      {{ copied ? '✓ 已复制' : '复制文本' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({ currentDate: String, currentTodos: Array })
const emit = defineEmits(['close'])

const mode     = ref('today')
const fromDate = ref(props.currentDate)
const toDate   = ref(props.currentDate)
const copied   = ref(false)
const rangeData = ref([])  // [{ date, todos }]
const dedupEnabled = ref(false)

// 切换到自定义范围时加载数据
watch([mode, fromDate, toDate], async () => {
  if (mode.value === 'range' && fromDate.value && toDate.value && fromDate.value <= toDate.value) {
    rangeData.value = await window.electronAPI?.getTodosRange(fromDate.value, toDate.value) ?? []
  }
}, { immediate: false })

const previewText = computed(() => {
  let days
  if (mode.value === 'today') {
    days = [{ date: props.currentDate, todos: props.currentTodos ?? [] }]
  } else {
    if (!rangeData.value.length) return '（该范围内没有待办）'
    days = rangeData.value
  }

  if (dedupEnabled.value) {
    const seen = new Set()
    days = days.map(d => ({
      date: d.date,
      todos: d.todos.filter(t => {
        const key = t.text.trim()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    })).filter(d => d.todos.length > 0)
  }

  if (!days.length) return '（去重后没有待办）'
  return days.map(d => formatDay(d.date, d.todos)).join('\n\n')
})

function formatDay(date, todos) {
  const label = date.replace(/-/g, '/').replace(/^20/, '')  // 26/7/13
  const lines = [`【${label}】`]
  for (const t of todos) {
    const check = t.completed ? '■' : '□'
    let line = `${check} ${t.text}`
    if (t.completed) {
      line += '（已完成）'
    } else if (t.deadline) {
      const dl = t.deadline.slice(5, 16).replace('T', ' ')  // MM-DD HH:mm
      const isOverdue = new Date(t.deadline) < new Date()
      line += isOverdue ? `  截止：${dl} ⚠逾期` : `  截止：${dl}`
    }
    lines.push(line)
  }
  return lines.join('\n')
}

async function copyText() {
  if (!previewText.value) return
  await navigator.clipboard.writeText(previewText.value)
  copied.value = true
  setTimeout(() => { copied.value = false; emit('close') }, 800)
}
</script>

<style scoped>
.export-panel {
  position: absolute;
  top: 38px;
  right: 8px;
  width: 264px;
  background: rgba(252, 251, 248, 0.97);
  border: 1px solid rgba(200, 195, 180, 0.4);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 14px;
  z-index: 200;
}

.panel-title {
  font-size: 11.5px;
  color: #aaa;
  margin-bottom: 10px;
  letter-spacing: 0.4px;
}

.range-row {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}

.range-btn {
  flex: 1;
  padding: 5px 0;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 7px;
  color: #999;
  font-size: 12px;
  cursor: pointer;
}
.range-btn.active {
  background: rgba(40, 160, 80, 0.1);
  border-color: rgba(40, 160, 80, 0.25);
  color: #2a9050;
  font-weight: 500;
}
.dedup-btn {
  flex: 1;
  padding: 5px 0;
}

.date-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
}

.date-input {
  flex: 1;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 7px;
  color: #666;
  font-size: 11px;
  padding: 5px 6px;
  text-align: center;
  color-scheme: light;
}

.date-sep {
  font-size: 11px;
  color: #bbb;
  flex-shrink: 0;
}

.preview-box {
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 10px;
  font-size: 11.5px;
  color: #666;
  line-height: 1.85;
  max-height: 150px;
  overflow-y: auto;
  margin-bottom: 10px;
  white-space: pre-wrap;
  font-family: 'Consolas', 'Microsoft YaHei', monospace;
  word-break: break-all;
}

.preview-box::-webkit-scrollbar { width: 4px; }
.preview-box::-webkit-scrollbar-track { background: transparent; }
.preview-box::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 3px;
  transition: background 0.3s;
}
.preview-box:hover::-webkit-scrollbar-thumb { background: rgba(155, 142, 196, 0.5); }
.preview-box::-webkit-scrollbar-thumb:hover { background: rgba(155, 142, 196, 0.8); }

.copy-btn {
  width: 100%;
  padding: 7px 0;
  background: linear-gradient(135deg, #38b865, #2a9e78);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 12.5px;
  cursor: pointer;
  letter-spacing: 0.4px;
  transition: filter 0.15s;
}
.copy-btn:hover { filter: brightness(1.1); }
</style>
