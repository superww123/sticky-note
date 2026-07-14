<template>
  <div class="alarm-badge" ref="badgeRef">
    <span class="alarm-inline" @click.stop="showPopup = !showPopup" title="点击查看闹钟">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8" cy="9" r="5"/>
        <path d="M8 6v3l2 1"/>
        <path d="M4.5 2.5L2 5M11.5 2.5L14 5"/>
      </svg>
      {{ formatTime(alarm.alarm_time) }}
    </span>

    <div v-if="showPopup" class="alarm-popup" @mousedown.stop @click.stop>

      <!-- 时间行：双击编辑 -->
      <div v-if="editingField !== 'time'" class="popup-time" @dblclick="startEdit('time')" title="双击修改时间">
        ⏰ {{ formatTime(alarm.alarm_time) }}
      </div>
      <div v-else class="edit-row">
        <input
          ref="editInputRef"
          type="datetime-local"
          class="edit-input"
          :value="editingValue"
          @change="editingValue = $event.target.value"
          @keydown.enter.prevent="confirmEdit"
          @keydown.esc.prevent="cancelEdit"
        />
        <button class="confirm-btn" @mousedown.prevent="confirmEdit">✓</button>
      </div>

      <!-- 备注行：双击编辑 -->
      <div
        v-if="editingField !== 'note'"
        class="popup-note"
        :class="{ 'popup-note-empty': !alarm.note }"
        @dblclick="startEdit('note')"
        title="双击修改备注"
      >{{ alarm.note || '双击添加备注…' }}</div>
      <div v-else class="edit-row">
        <input
          ref="editInputRef"
          type="text"
          class="edit-input"
          :value="editingValue"
          placeholder="备注（留空清除）"
          @input="editingValue = $event.target.value"
          @keydown.enter.prevent="confirmEdit"
          @keydown.esc.prevent="cancelEdit"
        />
        <button class="confirm-btn" @mousedown.prevent="confirmEdit">✓</button>
      </div>

      <div class="popup-footer">
        <button class="del-btn" @click="emitDelete">取消闹钟</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
  alarm: { type: Object, required: true },
})
const emit = defineEmits(['updated', 'deleted'])

const badgeRef     = ref(null)
const showPopup    = ref(false)
const editingField = ref(null)   // 'time' | 'note' | null
const editingValue = ref('')
const editInputRef = ref(null)

async function startEdit(field) {
  editingField.value = field
  editingValue.value = field === 'time'
    ? toDatetimeLocal(props.alarm.alarm_time)
    : (props.alarm.note || '')
  await nextTick()
  editInputRef.value?.focus()
}

async function confirmEdit() {
  if (editingField.value === 'time') {
    const newTime = editingValue.value
    if (newTime) {
      await window.electronAPI?.updateAlarmTime(props.alarm.todo_id, newTime)
      emit('updated', { time: newTime, note: props.alarm.note })
    }
  } else if (editingField.value === 'note') {
    const newNote = editingValue.value.trim()
    await window.electronAPI?.updateAlarmNote(props.alarm.todo_id, newNote)
    emit('updated', { time: props.alarm.alarm_time, note: newNote })
  }
  editingField.value = null
}

function cancelEdit() {
  editingField.value = null
}

async function emitDelete() {
  await window.electronAPI?.deleteAlarm(props.alarm.todo_id)
  emit('deleted')
  showPopup.value = false
}

function formatTime(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(5, 16).replace('T', ' ')
}

function toDatetimeLocal(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(0, 16).replace(' ', 'T')
}

function onDocClick(e) {
  if (badgeRef.value && !badgeRef.value.contains(e.target)) {
    showPopup.value    = false
    editingField.value = null
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<style scoped>
.alarm-badge {
  position: relative;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
}

.alarm-inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: rgba(230, 100, 30, 0.9);
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.15s;
}
.alarm-inline:hover { color: rgba(230, 100, 30, 1); }
.alarm-inline svg { width: 10px; height: 10px; flex-shrink: 0; }

.alarm-popup {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  width: 200px;
  background: rgba(252, 251, 248, 0.98);
  border: 1px solid rgba(200, 195, 180, 0.5);
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  padding: 10px 12px;
  z-index: 300;
}

.popup-time {
  font-size: 12px;
  color: #f5a623;
  margin-bottom: 5px;
  cursor: text;
}
.popup-time:hover { text-decoration: underline dotted; }

.popup-note {
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
  word-break: break-all;
  cursor: text;
}
.popup-note:hover { text-decoration: underline dotted; }
.popup-note-empty { color: #ccc; font-style: italic; }

.edit-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 5px;
}

.edit-input {
  flex: 1;
  min-width: 0;
  font-size: 11px;
  color: #555;
  border: 1px solid rgba(230, 100, 30, 0.5);
  border-radius: 5px;
  padding: 2px 5px;
  background: rgba(255, 248, 240, 0.9);
  outline: none;
  box-sizing: border-box;
}
.edit-input:focus {
  border-color: rgba(230, 100, 30, 0.8);
  box-shadow: 0 0 0 2px rgba(230, 100, 30, 0.1);
}

.confirm-btn {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  background: rgba(230, 100, 30, 0.85);
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s;
}
.confirm-btn:hover { background: rgba(230, 100, 30, 1); }

.popup-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

.del-btn {
  font-size: 11px;
  color: #c0534f;
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 0;
  opacity: 0.75;
}
.del-btn:hover { opacity: 1; }
</style>
