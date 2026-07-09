<template>
  <!-- 透明遮罩，点击空白关闭 -->
  <div class="alarm-mask" @mousedown.self="$emit('cancel')" @contextmenu.prevent="$emit('cancel')" @keydown.esc="$emit('cancel')" tabindex="-1" ref="maskRef">
    <div class="alarm-popup" :style="popupStyle">
      <div class="alarm-popup-title">⏰ 设置闹钟</div>
      <div class="alarm-popup-fields">
        <input
          v-model="alarmTime"
          class="alarm-datetime-input"
          type="datetime-local"
          :min="minTime"
          @mousedown.stop
        />
        <input
          v-model="alarmNote"
          class="alarm-note-input"
          type="text"
          placeholder="附加说明（留空则使用待办文本）"
          maxlength="500"
          @mousedown.stop
        />
      </div>
      <div class="alarm-popup-actions">
        <button class="alarm-confirm-btn" @mousedown.stop @click="confirm" :disabled="!alarmTime">确认</button>
        <button class="alarm-cancel-btn" @mousedown.stop @click="$emit('cancel')">取消</button>
      </div>
      <Transition name="toast">
        <div v-if="toast.visible" class="alarm-toast" :class="toast.type">{{ toast.message }}</div>
      </Transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  todo: { type: Object, required: true },
  x: { type: Number, default: 100 },
  y: { type: Number, default: 100 },
})
const emit = defineEmits(['saved', 'cancel'])
const maskRef = ref(null)

onMounted(() => maskRef.value?.focus())

// 全局 Esc 兜底关闭
function onKeydown(e) { if (e.key === 'Escape') emit('cancel') }
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))

const alarmTime = ref('')
const alarmNote = ref('')

const minTime = computed(() => {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString().slice(0, 16)
})

// 防止超出屏幕右侧和底部
const popupStyle = computed(() => {
  const W = 220, H = 145
  const x = Math.min(props.x, window.innerWidth - W - 8)
  const y = Math.min(props.y, window.innerHeight - H - 8)
  return { position: 'fixed', left: `${x}px`, top: `${y}px` }
})

async function confirm() {
  if (!alarmTime.value) return
  // 直接存本地时间字符串（datetime-local 的值已是本地时间），不转 UTC
  const alarmTimeLocal = alarmTime.value  // 格式：2026-07-09T16:05
  try {
    await window.electronAPI?.saveAlarm({
      todoId: String(props.todo.id),
      todoText: props.todo.text,
      note: alarmNote.value.trim(),
      alarmTime: alarmTimeLocal,
    })
    showToast('⏰ 闹钟已设置', 'success')
    setTimeout(() => emit('saved'), 1200)
  } catch (e) {
    console.error('[AlarmSetRow] 保存闹钟失败:', e)
    showToast('设置失败，请重试', 'error')
  }
}

const toast = ref({ visible: false, message: '', type: 'success' })
let toastTimer = null

function showToast(message, type) {
  clearTimeout(toastTimer)
  toast.value = { visible: true, message, type }
  toastTimer = setTimeout(() => { toast.value.visible = false }, 2000)
}
</script>

<style scoped>
.alarm-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  background: transparent;
}

.alarm-popup {
  width: 220px;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 10px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(180, 170, 210, 0.35);
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.alarm-popup-title {
  font-size: 11px;
  font-weight: 600;
  color: #7a6eaa;
}

.alarm-popup-fields {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.alarm-datetime-input,
.alarm-note-input {
  width: 100%;
  height: 26px;
  border: 1px solid rgba(155, 142, 196, 0.4);
  border-radius: 6px;
  background: white;
  font-size: 11px;
  color: #4a4060;
  padding: 0 8px;
  outline: none;
  font-family: 'Microsoft YaHei', sans-serif;
  box-sizing: border-box;
}
.alarm-datetime-input:focus,
.alarm-note-input:focus { border-color: #9b8ec4; }
.alarm-note-input::placeholder { color: rgba(74, 64, 96, 0.3); }

.alarm-popup-actions {
  display: flex;
  gap: 6px;
}

.alarm-confirm-btn {
  flex: 1;
  height: 26px;
  background: linear-gradient(135deg, #9b8ec4, #7a6eaa);
  border: none;
  border-radius: 6px;
  font-size: 11px;
  color: white;
  cursor: pointer;
  font-family: 'Microsoft YaHei', sans-serif;
  font-weight: 500;
}
.alarm-confirm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.alarm-confirm-btn:not(:disabled):hover { filter: brightness(1.08); }

.alarm-cancel-btn {
  height: 26px;
  padding: 0 10px;
  background: rgba(155, 142, 196, 0.12);
  border: 1px solid rgba(155, 142, 196, 0.3);
  border-radius: 6px;
  font-size: 11px;
  color: rgba(74, 64, 96, 0.55);
  cursor: pointer;
  font-family: 'Microsoft YaHei', sans-serif;
}
.alarm-cancel-btn:hover { background: rgba(155, 142, 196, 0.22); }

.alarm-toast {
  text-align: center;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 5px;
  font-weight: 500;
}
.alarm-toast.success { background: rgba(46, 158, 91, 0.12); color: #2e7d50; }
.alarm-toast.error   { background: rgba(210, 70, 70, 0.12);  color: #c0392b; }

.toast-enter-active, .toast-leave-active { transition: opacity 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; }
</style>
