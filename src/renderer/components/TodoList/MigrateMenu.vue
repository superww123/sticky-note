<template>
  <!-- 透明遮罩：点击任意空白处关闭菜单 -->
  <div class="migrate-mask" @mousedown.self="$emit('close')" @contextmenu.prevent="$emit('close')">
    <div class="migrate-menu" :style="menuStyle">
      <div class="migrate-header">迁移至：</div>

      <button class="migrate-opt" @click="$emit('select', tomorrowStr)">
        明天（{{ fmtShort(tomorrowStr) }}）
      </button>
      <button class="migrate-opt" @click="$emit('select', dayAfterStr)">
        后天（{{ fmtShort(dayAfterStr) }}）
      </button>
      <button class="migrate-opt" :class="{ active: showCal }" @click="showCal = !showCal">
        指定日 {{ showCal ? '▲' : '▼' }}
      </button>

      <!-- 内嵌迷你日历 -->
      <div v-if="showCal" class="mini-cal">
        <div class="mini-cal-nav">
          <button @click.stop="prevMonth">‹</button>
          <span>{{ calYear }}年{{ calMonth + 1 }}月</span>
          <button @click.stop="nextMonth">›</button>
        </div>
        <div class="mini-cal-grid">
          <span v-for="d in weekdays" :key="d" class="mini-cal-wd">{{ d }}</span>
          <div
            v-for="cell in cells"
            :key="cell.key"
            class="mini-cal-cell"
            :class="{
              out: !cell.inMonth,
              today: cell.isToday,
            }"
            @click="cell.inMonth && $emit('select', cell.date)"
          >{{ cell.day }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

defineEmits(['close', 'select'])

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
})

const showCal = ref(false)

// ── 快捷日期 ──────────────────────────────────────────────

function offsetDateStr(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const todayStr  = offsetDateStr(0)
const tomorrowStr = offsetDateStr(1)
const dayAfterStr = offsetDateStr(2)

function fmtShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ── 菜单定位（不超出窗口右/下边界） ─────────────────────

const menuStyle = computed(() => ({
  top:  `${Math.min(props.y, window.innerHeight - (showCal.value ? 310 : 130))}px`,
  left: `${Math.min(props.x, window.innerWidth  - 185)}px`,
}))

// ── 迷你日历 ─────────────────────────────────────────────

const weekdays = ['日', '一', '二', '三', '四', '五', '六']
const initDate = new Date()
const calYear  = ref(initDate.getFullYear())
const calMonth = ref(initDate.getMonth())

function prevMonth() {
  if (calMonth.value === 0) { calYear.value--; calMonth.value = 11 }
  else calMonth.value--
}
function nextMonth() {
  if (calMonth.value === 11) { calYear.value++; calMonth.value = 0 }
  else calMonth.value++
}

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

const cells = computed(() => {
  const firstDay     = new Date(calYear.value, calMonth.value, 1).getDay()
  const daysInMonth  = new Date(calYear.value, calMonth.value + 1, 0).getDate()
  const daysInPrev   = new Date(calYear.value, calMonth.value, 0).getDate()
  const result = []

  for (let i = firstDay - 1; i >= 0; i--) {
    const d  = daysInPrev - i
    const pm = calMonth.value === 0 ? 11 : calMonth.value - 1
    const py = calMonth.value === 0 ? calYear.value - 1 : calYear.value
    result.push({ key: `p${d}`, day: d, inMonth: false, date: toDateStr(py, pm, d), isToday: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(calYear.value, calMonth.value, d)
    result.push({ key: `c${d}`, day: d, inMonth: true, date: dateStr, isToday: dateStr === todayStr })
  }
  const remaining = 42 - result.length
  for (let d = 1; d <= remaining; d++) {
    const nm = calMonth.value === 11 ? 0 : calMonth.value + 1
    const ny = calMonth.value === 11 ? calYear.value + 1 : calYear.value
    result.push({ key: `n${d}`, day: d, inMonth: false, date: toDateStr(ny, nm, d), isToday: false })
  }
  return result
})
</script>

<style scoped>
.migrate-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
}

.migrate-menu {
  position: absolute;
  background: white;
  border: 1px solid #e0d8f0;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 6px;
  min-width: 178px;
  font-size: 13px;
}

.migrate-header {
  font-size: 11px;
  color: #aaa;
  padding: 2px 8px 6px;
  border-bottom: 1px solid #f0eaf8;
  margin-bottom: 4px;
}

.migrate-opt {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 10px;
  border: none;
  background: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  transition: background 0.15s;
}
.migrate-opt:hover,
.migrate-opt.active { background: #f3eeff; color: #9b8ec4; }

/* 迷你日历 */
.mini-cal {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #f0eaf8;
}

.mini-cal-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
  color: #444;
}
.mini-cal-nav button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 15px;
  padding: 0 5px;
  color: #666;
  border-radius: 3px;
  line-height: 1;
}
.mini-cal-nav button:hover { background: #f3eeff; color: #9b8ec4; }

.mini-cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}
.mini-cal-wd {
  text-align: center;
  font-size: 10px;
  color: #bbb;
  padding: 2px 0;
}
.mini-cal-cell {
  text-align: center;
  font-size: 11px;
  padding: 3px 1px;
  border-radius: 3px;
  cursor: pointer;
  color: #333;
  transition: background 0.12s;
}
.mini-cal-cell:hover        { background: #f3eeff; color: #9b8ec4; }
.mini-cal-cell.out          { color: #ddd; cursor: default; }
.mini-cal-cell.out:hover    { background: none; color: #ddd; }
.mini-cal-cell.today        { background: #9b8ec4; color: white; font-weight: bold; }
.mini-cal-cell.today:hover  { background: #8a7db8; }
</style>
