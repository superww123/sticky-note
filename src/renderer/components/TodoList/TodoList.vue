<template>
  <div class="todo-section">
    <div class="section-header">
      <span class="section-icon">✉️</span>
      <span class="section-title">今日待办：</span>
    </div>

    <!-- 待办列表（支持拖拽排序） -->
    <div class="todo-list" ref="listRef">
      <TodoItem
        v-for="(todo, index) in store.todos"
        :key="todo.id"
        :todo="todo"
        :index="index"
        :highlight-keyword="findKeyword"
        @toggle="store.toggleTodo(todo.id)"
        @delete="store.deleteTodo(todo.id)"
        @update-deadline="updateDeadline(todo.id, $event)"
        @migrate-request="openMigrateMenu(todo.id, $event)"
        @update-text="updateText(todo.id, $event)"
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
    />
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, onMounted, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useDailyStore } from '../../stores/dailyStore'
import TodoItem from './TodoItem.vue'
import MigrateMenu from './MigrateMenu.vue'

const store = useDailyStore()
const findKeyword = inject('findKeyword', ref(''))
const isAdding = ref(false)
const newTodoText = ref('')
const inputRef = ref(null)
let isComposing = false
let confirming = false

// 右键迁移菜单状态
const migrateMenu = reactive({ visible: false, x: 0, y: 0, todoId: null })

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
}

const route = useRoute()

onMounted(() => {
  const dateParam = route.params?.date
  dateParam ? store.loadDate(dateParam) : store.loadToday()
})
</script>
