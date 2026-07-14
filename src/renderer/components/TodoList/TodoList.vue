<template>
  <div class="todo-section">
    <div class="section-header">
      <span class="section-icon">✉️</span>
      <span class="section-title">今日待办：</span>

      <!-- 闹钟按钮 -->
      <div class="btn-wrap" style="margin-left: auto">
        <button
          class="icon-btn alarm-btn"
          :class="{ 'has-alarm': hasPendingAlarm }"
          @click.stop="toggleAlarmPanel"
          title="查看/取消闹钟"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="8" cy="9" r="5"/>
            <path d="M8 6v3l2 1"/>
            <path d="M4.5 2.5L2 5M11.5 2.5L14 5"/>
          </svg>
        </button>
        <span v-if="hasTodayAlarm" class="alarm-dot" />
      </div>
      <Teleport to="body">
        <div v-if="showAlarm" class="panel-mask" @click="showAlarm = false" />
      </Teleport>
      <AlarmListPanel v-if="showAlarm" :alarms="alarmList" @close="showAlarm = false" @changed="refreshAlarmState" />

      <!-- 导出按钮 -->
      <button class="icon-btn export-btn" :class="{ active: showExport }" @click.stop="showExport = !showExport" title="导出待办">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 10V3M5 6l3-3 3 3"/>
          <path d="M3 10v3a1 1 0 001 1h8a1 1 0 001-1v-3"/>
        </svg>
      </button>
      <Teleport to="body">
        <div v-if="showExport" class="panel-mask" @click="showExport = false" />
      </Teleport>
      <TodoExportPanel
        v-if="showExport"
        :current-date="store.currentDate"
        :current-todos="store.todos"
        @close="showExport = false"
      />
    </div>

    <!-- 待办列表（支持拖拽排序） -->
    <div class="todo-list" ref="listRef">
      <TodoItem
        v-for="(todo, index) in store.todos"
        :key="todo.id"
        :todo="todo"
        :index="index"
        :highlight-keyword="findKeyword"
        :alarm="alarmMap[String(todo.id)] ?? null"
        @toggle="store.toggleTodo(todo.id)"
        @delete="store.deleteTodo(todo.id)"
        @update-deadline="updateDeadline(todo.id, $event)"
        @migrate-request="openMigrateMenu(todo.id, $event)"
        @update-text="updateText(todo.id, $event)"
        @alarm-updated="onItemAlarmUpdated(todo.id, $event)"
        @alarm-deleted="onItemAlarmDeleted(todo.id)"
        @dragstart="onDragStart(index, $event)"
        @dragover.prevent="onDragOver(index)"
        @drop="onDrop"
      />
    </div>

    <!-- 添加待办输入框 -->
    <div class="add-todo" v-if="isAdding">
      <input
        ref="inputRef"
        v-model="newTodoText"
        class="add-todo-input"
        placeholder="输入待办内容..."
        @keydown.enter="confirmAdd"
        @keydown.esc="cancelAdd"
        @blur="cancelAdd"
        @compositionstart="isComposing = true"
        @compositionend="isComposing = false"
      />
    </div>
    <button class="add-todo-btn" @click="startAdd" v-else>＋ 添加待办</button>

    <!-- 右键迁移菜单 -->
    <MigrateMenu
      v-if="migrateMenu.visible"
      :x="migrateMenu.x"
      :y="migrateMenu.y"
      @close="closeMigrateMenu"
      @select="onMigrateSelect"
      @set-alarm="onSetAlarm"
    />

    <!-- 闹钟设置浮层 -->
    <Teleport to="body">
      <AlarmSetRow
        v-if="alarmMenu.visible && alarmMenu.todo"
        :todo="alarmMenu.todo"
        :x="alarmMenu.x"
        :y="alarmMenu.y"
        @saved="onAlarmSaved"
        @cancel="alarmMenu.visible = false"
      />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, inject, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useDailyStore } from '../../stores/dailyStore'
import TodoItem from './TodoItem.vue'
import MigrateMenu from './MigrateMenu.vue'
import AlarmSetRow from './AlarmSetRow.vue'
import AlarmListPanel from './AlarmListPanel.vue'
import TodoExportPanel from './TodoExportPanel.vue'

const store = useDailyStore()
const showExport = ref(false)
const showAlarm  = ref(false)
const findKeyword = inject('findKeyword', ref(''))

// 闹钟图标状态
const hasPendingAlarm = ref(false)  // 任意未触发闹钟 → 橙色图标
const hasTodayAlarm   = ref(false)  // 今日有闹钟 → 加小圆点
const alarmMap        = ref({})     // todoId → alarm 对象，供 TodoItem 显示小徽标
const alarmList       = computed(() => Object.values(alarmMap.value))  // 供 AlarmListPanel 用

async function refreshAlarmState() {
  const [all, today] = await Promise.all([
    window.electronAPI?.getAllPendingAlarms() ?? [],
    window.electronAPI?.getTodayAlarms() ?? [],
  ])
  hasPendingAlarm.value = all.length > 0
  hasTodayAlarm.value   = today.length > 0
  alarmMap.value = Object.fromEntries(all.map(a => [String(a.todo_id), a]))
}


async function toggleAlarmPanel() {
  showAlarm.value = !showAlarm.value
  if (showAlarm.value) await refreshAlarmState()
}

// 右键迁移菜单状态
const migrateMenu = reactive({ visible: false, x: 0, y: 0, todoId: null })
// 闹钟设置浮层状态
const alarmMenu = reactive({ visible: false, x: 0, y: 0, todo: null })
const isAdding = ref(false)
const newTodoText = ref('')
const inputRef = ref(null)
let isComposing = false
let confirming = false

function openMigrateMenu(todoId, { x, y }) {
  migrateMenu.visible = true
  migrateMenu.x = x
  migrateMenu.y = y
  migrateMenu.todoId = todoId
}

function closeMigrateMenu() {
  migrateMenu.visible = false
  migrateMenu.todoId = null
}

function onSetAlarm() {
  const id = migrateMenu.todoId
  const x = migrateMenu.x
  const y = migrateMenu.y
  closeMigrateMenu()
  const todo = store.todos.find(t => t.id === id)
  if (!todo) return
  alarmMenu.todo = todo
  alarmMenu.x = x
  alarmMenu.y = y
  alarmMenu.visible = true
}

async function onAlarmSaved() {
  alarmMenu.visible = false
  await refreshAlarmState()
}

function onItemAlarmUpdated(todoId, { time, note }) {
  const key = String(todoId)
  if (alarmMap.value[key]) {
    alarmMap.value[key] = { ...alarmMap.value[key], alarm_time: time, note }
  }
  refreshAlarmState()
}

function onItemAlarmDeleted(todoId) {
  delete alarmMap.value[String(todoId)]
  refreshAlarmState()
}

async function onMigrateSelect(targetDate) {
  const id = migrateMenu.todoId
  closeMigrateMenu()
  if (id != null) {
    try {
      await store.migrateTodo(id, targetDate)
    } catch (e) {
      console.error('[TodoList] 迁移失败:', e)
    }
  }
}

// 拖拽排序
let dragFromIndex = -1

function onDragStart(index, e) {
  dragFromIndex = index
  e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index) {}

function onDrop(e) {
  const toIndex = parseInt(e.currentTarget?.dataset?.index ?? -1)
  if (dragFromIndex < 0 || toIndex < 0 || dragFromIndex === toIndex) return

  const newOrder = [...store.todos]
  const [moved] = newOrder.splice(dragFromIndex, 1)
  newOrder.splice(toIndex, 0, moved)
  store.reorderTodos(newOrder)
  dragFromIndex = -1
}

function startAdd() {
  isAdding.value = true
  nextTick(() => inputRef.value?.focus())
}

async function confirmAdd() {
  if (isComposing) return
  const text = newTodoText.value.trim()
  if (!text) return cancelAdd()
  confirming = true
  try {
    await store.addTodo(text)
    newTodoText.value = ''
    isAdding.value = false
  } catch (e) {
    console.error('[TodoList] 添加待办失败:', e)
    newTodoText.value = ''
    isAdding.value = false
  } finally {
    confirming = false
  }
}

function cancelAdd() {
  if (confirming) return
  newTodoText.value = ''
  isAdding.value = false
}

async function updateDeadline(id, deadline) {
  const updated = store.todos.map(t =>
    t.id === id ? { ...t, deadline } : t
  )
  await store.saveTodos(updated)
}

async function updateText(id, text) {
  const updated = store.todos.map(t =>
    t.id === id ? { ...t, text } : t
  )
  await store.saveTodos(updated)
  window.electronAPI?.syncAlarmText(String(id), text)
}

const route = useRoute()

onMounted(async () => {
  const dateParam = route.params?.date
  dateParam ? store.loadDate(dateParam) : store.loadToday()
  await refreshAlarmState()
  window.electronAPI?.onAlarmFired(() => refreshAlarmState())
})
</script>

<style scoped>
.btn-wrap {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
}

.icon-btn {
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: color 0.15s;
  padding: 0;
}
.icon-btn svg {
  width: 13px;
  height: 13px;
}

.alarm-btn {
  color: rgba(100, 100, 100, 0.4);
}
.alarm-btn.has-alarm {
  color: rgba(230, 100, 30, 1);
}
.alarm-btn:hover,
.alarm-btn.has-alarm:hover {
  color: rgba(245, 120, 40, 1);
}

.alarm-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #e06420;
  pointer-events: none;
}

.export-btn {
  color: rgba(40, 160, 80, 0.85);
}
.export-btn:hover,
.export-btn.active {
  color: rgba(50, 190, 100, 1);
}

.panel-mask {
  position: fixed;
  inset: 0;
  z-index: 199;
}
</style>
