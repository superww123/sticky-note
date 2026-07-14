<template>
  <div class="alarm-panel" @mousedown.stop>
    <div class="panel-title">闹钟提醒</div>

    <div v-if="alarms.length === 0" class="empty-state">
      <span class="empty-icon">⏰</span>
      暂无待触发的闹钟
    </div>

    <div v-else class="alarm-list">
      <div
        v-for="alarm in alarms"
        :key="alarm.id"
        class="alarm-item"
      >
        <div class="alarm-item-left">
          <div class="alarm-todo-text">{{ alarm.todo_text }}</div>

          <!-- 时间行 -->
          <div
            v-if="editingId !== alarm.todo_id || editingField !== 'time'"
            class="alarm-time"
            @dblclick="startEdit(alarm, 'time')"
            title="双击修改时间"
          >⏰ {{ formatTime(alarm.alarm_time) }}</div>
          <div v-else class="edit-row">
            <input
              ref="editInputRef"
              class="alarm-time-input"
              type="datetime-local"
              :value="editingValue"
              @change="editingValue = $event.target.value"
              @keydown.enter.prevent="confirmEdit(alarm)"
              @keydown.esc.prevent="cancelEdit"
            />
            <button class="confirm-btn" @mousedown.prevent="confirmEdit(alarm)">✓</button>
          </div>

          <!-- 备注行 -->
          <div
            v-if="editingId !== alarm.todo_id || editingField !== 'note'"
            class="alarm-note"
            :class="{ 'alarm-note-empty': !alarm.note }"
            @dblclick="startEdit(alarm, 'note')"
            title="双击修改备注"
          >{{ alarm.note || '双击添加备注…' }}</div>
          <div v-else class="edit-row">
            <input
              ref="editInputRef"
              class="alarm-note-input"
              type="text"
              :value="editingValue"
              placeholder="备注（留空则清除）"
              @input="editingValue = $event.target.value"
              @keydown.enter.prevent="confirmEdit(alarm)"
              @keydown.esc.prevent="cancelEdit"
            />
            <button class="confirm-btn" @mousedown.prevent="confirmEdit(alarm)">✓</button>
          </div>
        </div>

        <button class="alarm-cancel-btn" title="取消闹钟" @click.stop="cancel(alarm.todo_id)">✕</button>
      </div>
    </div>

    <div class="panel-hint">双击时间或备注可修改</div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  alarms: { type: Array, required: true },
})
const emit = defineEmits(['close', 'changed'])

const editingId    = ref(null)
const editingField = ref(null)
const editingValue = ref('')
const editInputRef = ref(null)

function formatTime(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(5, 16).replace('T', ' ')
}

function toDatetimeLocal(isoStr) {
  if (!isoStr) return ''
  return isoStr.slice(0, 16).replace(' ', 'T')
}

async function startEdit(alarm, field) {
  editingId.value    = alarm.todo_id
  editingField.value = field
  editingValue.value = field === 'time' ? toDatetimeLocal(alarm.alarm_time) : (alarm.note || '')
  await nextTick()
  editInputRef.value?.focus()
}

async function confirmEdit(alarm) {
  if (editingId.value !== alarm.todo_id) return
  if (editingField.value === 'time') {
    const newTime = editingValue.value
    if (newTime && newTime !== toDatetimeLocal(alarm.alarm_time)) {
      await window.electronAPI?.updateAlarmTime(alarm.todo_id, newTime)
      emit('changed')
    }
  } else if (editingField.value === 'note') {
    const newNote = editingValue.value.trim()
    if (newNote !== (alarm.note || '')) {
      await window.electronAPI?.updateAlarmNote(alarm.todo_id, newNote)
      emit('changed')
    }
  }
  editingId.value    = null
  editingField.value = null
}

function cancelEdit() {
  editingId.value    = null
  editingField.value = null
}

async function cancel(todoId) {
  await window.electronAPI?.deleteAlarm(todoId)
  emit('changed')
}
</script>

<style scoped>
.alarm-panel {
  position: absolute;
  top: 38px;
  right: 8px;
  width: 248px;
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

.panel-hint {
  font-size: 10.5px;
  color: #ccc;
  text-align: center;
  margin-top: 10px;
}

.empty-state {
  text-align: center;
  padding: 18px 0;
  color: #ccc;
  font-size: 12px;
  line-height: 2;
}
.empty-icon {
  font-size: 22px;
  display: block;
  margin-bottom: 2px;
}

.alarm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alarm-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 9px;
  padding: 9px 10px;
  cursor: default;
  transition: background 0.12s;
}
.alarm-item:hover { background: rgba(0, 0, 0, 0.055); }

.alarm-item-left {
  flex: 1;
  min-width: 0;
}

.alarm-todo-text {
  font-size: 12.5px;
  color: #444;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.alarm-time {
  font-size: 11px;
  color: #f5a623;
  cursor: text;
  display: inline-block;
}
.alarm-time:hover { text-decoration: underline dotted; }

.alarm-note {
  font-size: 11px;
  color: #999;
  margin-top: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
}
.alarm-note:hover { text-decoration: underline dotted; }
.alarm-note-empty { color: #ccc; font-style: italic; }

.edit-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.alarm-time-input,
.alarm-note-input {
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
.alarm-time-input:focus,
.alarm-note-input:focus {
  border-color: rgba(230, 100, 30, 0.8);
  box-shadow: 0 0 0 2px rgba(230, 100, 30, 0.12);
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

.alarm-cancel-btn {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #ccc;
  font-size: 13px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.15s, background 0.15s;
  margin-top: 1px;
  padding: 0;
}
.alarm-cancel-btn:hover {
  color: #e06060;
  background: rgba(220, 80, 80, 0.08);
}
</style>
