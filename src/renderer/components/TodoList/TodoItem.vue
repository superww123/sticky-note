<template>
  <div
    class="todo-item"
    :class="{ completed: todo.completed, overdue: isOverdue }"
    draggable="true"
    :data-index="index"
    @dragstart="$emit('dragstart', $event)"
    @dragover.prevent="$emit('dragover', $event)"
    @drop="$emit('drop', $event)"
    @contextmenu.prevent="$emit('migrate-request', { x: $event.clientX, y: $event.clientY })"
  >
    <!-- 拖拽把手 -->
    <span class="drag-handle" title="拖拽排序">⠿</span>

    <!-- 完成复选框 -->
    <button class="checkbox" @click="$emit('toggle')" :title="todo.completed ? '标记未完成' : '标记完成'">
      <span v-if="todo.completed">■</span>
      <span v-else>□</span>
    </button>

    <!-- 待办文本：双击进入编辑模式 -->
    <input
      v-if="isEditing"
      ref="editInputRef"
      v-model="editText"
      class="todo-edit-input"
      @keydown.enter.prevent="confirmEdit"
      @keydown.esc="cancelEdit"
      @blur="confirmEdit"
      @compositionstart="isComposing = true"
      @compositionend="isComposing = false"
      @click.stop
      @dblclick.stop
    />
    <span
      v-else
      class="todo-text"
      :class="{ 'line-through': todo.completed }"
      @dblclick.stop="startEdit"
      v-html="highlightedText"
    ></span>
    <span v-if="todo.migratedFrom" class="migrated-tag" title="从昨日迁移">↑</span>

    <!-- 右侧列：有闹钟时用「⏰ 时间」替代截止时间 -->
    <div class="right-col">
      <TodoAlarmBadge
        v-if="alarm"
        :alarm="alarm"
        @updated="$emit('alarm-updated', todo.id, $event)"
        @deleted="$emit('alarm-deleted', todo.id)"
      />
      <div v-else class="deadline-area">
        <span
          v-if="todo.deadline"
          class="deadline-text"
          :class="{ overdue: isOverdue, 'near-deadline': isNearDeadline }"
          @click="showDatePicker = true"
        >
          {{ formatDeadline(todo.deadline) }}
        </span>
        <button v-else class="set-deadline-btn" @click="showDatePicker = true" title="设置截止时间">
          截止时间
        </button>

        <!-- 日期时间选择器 -->
        <input
          v-if="showDatePicker"
          ref="datePickerRef"
          type="datetime-local"
          class="deadline-picker"
          :value="todo.deadline ? todo.deadline.slice(0, 16) : ''"
          @change="onDeadlineChange"
          @blur="showDatePicker = false"
        />
      </div>
    </div>

    <!-- 删除按钮 -->
    <button class="delete-btn" @click="$emit('delete')" title="删除">✕</button>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import TodoAlarmBadge from './TodoAlarmBadge.vue'

const props = defineProps({
  todo: { type: Object, required: true },
  index: { type: Number, required: true },
  highlightKeyword: { type: String, default: '' },
  alarm: { type: Object, default: null },
})

const emit = defineEmits(['toggle', 'delete', 'update-deadline', 'update-text', 'migrate-request', 'dragstart', 'dragover', 'drop', 'alarm-updated', 'alarm-deleted'])

// 搜索高亮
const highlightedText = computed(() => {
  const text = props.todo.text || ''
  const kw = props.highlightKeyword
  if (!kw) return text
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return text.replace(new RegExp(escaped, 'gi'), '<mark>$&</mark>')
})

const showDatePicker = ref(false)
const datePickerRef = ref(null)
const isEditing = ref(false)
const editText = ref('')
const editInputRef = ref(null)
let isComposing = false

function startEdit() {
  editText.value = props.todo.text
  isEditing.value = true
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function confirmEdit() {
  if (isComposing) return
  const text = editText.value.trim()
  if (text && text !== props.todo.text) emit('update-text', text)
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

const isOverdue = computed(() => {
  if (!props.todo.deadline || props.todo.completed) return false
  return new Date(props.todo.deadline).getTime() < Date.now()
})

const isNearDeadline = computed(() => {
  if (!props.todo.deadline || props.todo.completed) return false
  const diff = new Date(props.todo.deadline).getTime() - Date.now()
  return diff > 0 && diff <= 3 * 60 * 60 * 1000
})

watch(showDatePicker, async (val) => {
  if (val) {
    await nextTick()
    datePickerRef.value?.focus()
    datePickerRef.value?.showPicker?.()
  }
})

function onDeadlineChange(e) {
  const val = e.target.value
  emit('update-deadline', val ? new Date(val).toISOString() : null)
  showDatePicker.value = false
}

function formatDeadline(deadline) {
  const d = new Date(deadline)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>
