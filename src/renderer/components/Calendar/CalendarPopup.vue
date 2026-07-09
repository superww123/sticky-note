<template>
  <div class="calendar-overlay" @click.self="$emit('close')">
    <div class="calendar-popup">
      <!-- 头部：月份导航 -->
      <div class="cal-header">
        <button @click="prevMonth">‹</button>
        <div class="cal-title">
          <select class="title-select" :value="year" @change="onYearChange">
            <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
          </select>
          <select class="title-select" :value="month" @change="onMonthChange">
            <option v-for="(_, i) in 12" :key="i" :value="i">{{ i + 1 }}月</option>
          </select>
        </div>
        <button @click="nextMonth">›</button>
        <button class="close-cal" @click="$emit('close')">✕</button>
      </div>

      <!-- 批量打开行（V4 样式：步进器 + 渐变按钮） -->
      <div class="batch-row">
        <span class="batch-lbl">打开前</span>
        <div class="batch-stepper">
          <button @mousedown.prevent @click="batchDays = Math.max(1, batchDays - 1)">−</button>
          <input
            v-if="batchEditing"
            ref="batchInputRef"
            class="batch-days-input"
            type="number"
            :value="batchDays"
            min="1"
            max="14"
            @blur="confirmBatchEdit"
            @keydown.enter="confirmBatchEdit"
            @keydown.esc="batchEditing = false"
          />
          <span v-else class="batch-days-display" @dblclick="startBatchEdit">{{ batchDays }}</span>
          <button @mousedown.prevent @click="batchDays = Math.min(14, batchDays + 1)">＋</button>
        </div>
        <span class="batch-lbl">天</span>
        <button class="batch-btn" @click="batchOpen" :disabled="batchLoading">
          {{ batchLoading ? '打开中…' : '一键打开' }}
        </button>
      </div>

      <!-- 星期标题 -->
      <div class="cal-weekdays">
        <span v-for="d in weekdays" :key="d">{{ d }}</span>
      </div>

      <!-- 日期格子 -->
      <div class="cal-days">
        <div
          v-for="cell in cells"
          :key="cell.key"
          class="cal-cell"
          :class="{
            'other-month': !cell.inMonth,
            'today': cell.isToday,
            'selected': cell.date === selectedDate,
            'has-mark': calStore.getMark(cell.date),
          }"
          :style="cell.inMonth && calStore.getMark(cell.date)
            ? { '--mark-color': calStore.getMark(cell.date).color }
            : {}"
          @click="onCellClick(cell)"
          @contextmenu.prevent="onCellRightClick(cell)"
        >
          <span class="day-num">{{ cell.day }}</span>
          <span v-if="cell.inMonth && calStore.getMark(cell.date)" class="mark-dot" />
        </div>
      </div>

      <!-- 选择打开方式弹窗 -->
      <div v-if="showOpenDialog" class="open-dialog">
        <p>打开 {{ selectedDate }} 的便签：</p>
        <button @click="openInMain">当前窗口</button>
        <button @click="openInNew">新窗口</button>
        <button @click="showOpenDialog = false">取消</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useDailyStore } from '../../stores/dailyStore'
import { useCalendarStore } from '../../stores/calendarStore'

const emit = defineEmits(['close'])
const store = useDailyStore()
const calStore = useCalendarStore()

// ── 批量打开 ──────────────────────────────────────────────
const batchDays = ref(3)
const batchLoading = ref(false)
const batchEditing = ref(false)
const batchInputRef = ref(null)

function startBatchEdit() {
  batchEditing.value = true
  nextTick(() => {
    batchInputRef.value?.select()
  })
}

function confirmBatchEdit(e) {
  const val = parseInt(e.target.value)
  if (!isNaN(val)) batchDays.value = Math.max(1, Math.min(14, val))
  batchEditing.value = false
}

async function batchOpen() {
  const n = Math.max(1, Math.min(14, batchDays.value || 3))
  batchDays.value = n
  batchLoading.value = true

  // 生成候选日期（今天往前 n 天，不含今天）
  const candidates = []
  const base = new Date()
  for (let i = 1; i <= n; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() - i)
    const str = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    candidates.push(str)
  }

  // 过滤出有内容的日期
  let toOpen = candidates
  try {
    const withContent = await window.electronAPI?.getDatesWithContent(candidates)
    if (withContent && withContent.length > 0) toOpen = withContent
  } catch (e) {
    console.error('[Calendar] getDatesWithContent 失败:', e)
  }

  // 逐个打开，间隔 150ms 避免同时创建过多进程
  for (let i = 0; i < toOpen.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 150))
    window.electronAPI?.openNoteWindow(toOpen[i])
  }

  batchLoading.value = false
  emit('close')
}

const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth())
const selectedDate = ref('')
const showOpenDialog = ref(false)

// 年份选项：前5年到后2年
const yearOptions = computed(() => {
  const arr = []
  for (let y = today.getFullYear() - 5; y <= today.getFullYear() + 2; y++) arr.push(y)
  return arr
})

function onYearChange(e) { year.value = parseInt(e.target.value) }
function onMonthChange(e) { month.value = parseInt(e.target.value) }

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const cells = computed(() => {
  const firstDay = new Date(year.value, month.value, 1).getDay()
  const daysInMonth = new Date(year.value, month.value + 1, 0).getDate()
  const daysInPrev = new Date(year.value, month.value, 0).getDate()
  const result = []

  // 上月填充
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i
    const prevMonth = month.value === 0 ? 11 : month.value - 1
    const prevYear = month.value === 0 ? year.value - 1 : year.value
    result.push({ key: `prev-${d}`, day: d, inMonth: false, date: toDateStr(prevYear, prevMonth, d), isToday: false })
  }

  // 本月
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(year.value, month.value, d)
    result.push({ key: `cur-${d}`, day: d, inMonth: true, date: dateStr, isToday: dateStr === todayStr })
  }

  // 下月填充（补满6行）
  const remaining = 42 - result.length
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month.value === 11 ? 0 : month.value + 1
    const nextYear = month.value === 11 ? year.value + 1 : year.value
    result.push({ key: `next-${d}`, day: d, inMonth: false, date: toDateStr(nextYear, nextMonth, d), isToday: false })
  }

  return result
})

function prevMonth() {
  if (month.value === 0) { year.value--; month.value = 11 }
  else month.value--
}

function nextMonth() {
  if (month.value === 11) { year.value++; month.value = 0 }
  else month.value++
}

function onCellClick(cell) {
  if (!cell.inMonth) return
  selectedDate.value = cell.date
  showOpenDialog.value = true
}

function onCellRightClick(cell) {
  if (!cell.inMonth) return
  // 右键标记/取消标记
  const existing = calStore.getMark(cell.date)
  if (existing) {
    calStore.removeMark(cell.date)
  } else {
    calStore.setMark(cell.date, '#9b8ec4', '')
  }
}

function openInMain() {
  store.loadDate(selectedDate.value)
  showOpenDialog.value = false
  emit('close')
}

function openInNew() {
  window.electronAPI?.openNoteWindow(selectedDate.value)
  showOpenDialog.value = false
  emit('close')
}

onMounted(() => calStore.loadAllMarks())
</script>

<style scoped>
/* ── 批量打开行 ── */
.batch-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 2px 7px;
  border-bottom: 1px solid rgba(180, 170, 210, 0.2);
  margin-bottom: 6px;
}

.batch-lbl {
  font-size: 11px;
  color: rgba(74, 64, 96, 0.55);
  flex-shrink: 0;
}

/* 步进器 */
.batch-stepper {
  display: flex;
  align-items: center;
  border: 1px solid rgba(155, 142, 196, 0.4);
  border-radius: 6px;
  overflow: hidden;
  background: white;
  flex-shrink: 0;
}

.batch-stepper > button {
  width: 18px;
  height: 22px;
  background: rgba(155, 142, 196, 0.1);
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: #7a6eaa;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}
.batch-stepper > button:hover { background: rgba(155, 142, 196, 0.28); }

.batch-days-display {
  width: 24px;
  text-align: center;
  font-size: 12px;
  color: #4a4060;
  font-weight: 500;
  user-select: none;
  cursor: text;
}

.batch-days-input {
  width: 24px;
  height: 22px;
  border: none;
  background: transparent;
  text-align: center;
  font-size: 12px;
  color: #4a4060;
  font-weight: 500;
  font-family: 'Microsoft YaHei', sans-serif;
  outline: none;
  padding: 0;
}
.batch-days-input::-webkit-inner-spin-button,
.batch-days-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }

/* 一键打开按钮 */
.batch-btn {
  flex: 1;
  height: 24px;
  background: linear-gradient(135deg, #9b8ec4, #7a6eaa);
  border: none;
  border-radius: 7px;
  font-size: 11px;
  color: white;
  cursor: pointer;
  font-family: 'Microsoft YaHei', sans-serif;
  font-weight: 500;
  letter-spacing: 0.3px;
  transition: filter 0.15s;
}
.batch-btn:hover { filter: brightness(1.1); }
.batch-btn:disabled { opacity: 0.6; cursor: not-allowed; filter: none; }

/* ── 年月下拉 ── */
.cal-title {
  display: flex;
  align-items: center;
  gap: 1px;
}

.title-select {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: #4a4060;
  font-family: 'Microsoft YaHei', sans-serif;
  padding: 2px 3px;
  border-radius: 5px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}
.title-select:hover { background: rgba(155, 142, 196, 0.15); }
</style>
