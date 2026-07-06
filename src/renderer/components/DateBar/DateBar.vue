<template>
  <div class="date-bar">
    <button class="calendar-btn" @click="toggleCalendar" title="打开日历">
      <span class="icon">📅</span>
    </button>
    <span class="date-text">{{ displayDate }}</span>

    <!-- 日历弹窗 -->
    <CalendarPopup v-if="showCalendar" @close="showCalendar = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useDailyStore } from '../../stores/dailyStore'
import CalendarPopup from '../Calendar/CalendarPopup.vue'

const store = useDailyStore()
const showCalendar = ref(false)

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
}

const displayDate = computed(() => {
  // 加 T00:00:00 避免 UTC 解析导致日期偏移
  const d = new Date(store.currentDate + 'T00:00:00')
  const year = d.getFullYear()
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekDay = weekDays[d.getDay()]
  return `${year}/${month}/${day} ${weekDay}`
})
</script>
