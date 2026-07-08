<template>
  <div class="calendar-overlay" @click.self="$emit('close')">
    <div class="calendar-popup">
      <!-- 头部：月份导航 -->
      <div class="cal-header">
        <button @click="prevMonth">‹</button>
        <span>{{ year }}年{{ month + 1 }}月</span>
        <button @click="nextMonth">›</button>
        <button class="close-cal" @click="$emit('close')">✕</button>
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
import { ref, computed, onMounted } from 'vue'
import { useDailyStore } from '../../stores/dailyStore'
import { useCalendarStore } from '../../stores/calendarStore'

const emit = defineEmits(['close'])
const store = useDailyStore()
const calStore = useCalendarStore()

const today = new Date()
const year = ref(today.getFullYear())
const month = ref(today.getMonth())
const selectedDate = ref('')
const showOpenDialog = ref(false)

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
