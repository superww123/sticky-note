<template>
  <div class="format-toolbar" ref="rootRef" @mousedown.stop>
    <!-- 加粗 -->
    <button
      class="fmt-btn"
      :class="{ active: editor?.isActive('bold') }"
      @mousedown.prevent="cmd('toggleBold')"
      title="加粗"
    ><b>B</b></button>

    <!-- 斜体 -->
    <button
      class="fmt-btn fmt-italic"
      :class="{ active: editor?.isActive('italic') }"
      @mousedown.prevent="cmd('toggleItalic')"
      title="斜体"
    ><i>I</i></button>

    <!-- 删除线 -->
    <button
      class="fmt-btn fmt-strike"
      :class="{ active: editor?.isActive('strike') }"
      @mousedown.prevent="cmd('toggleStrike')"
      title="删除线"
    >S</button>

    <div class="fmt-sep"></div>

    <!-- 字号 A -->
    <div class="fmt-pop-wrap">
      <button
        class="fmt-btn"
        :class="{ active: openPop === 'size' }"
        @mousedown.prevent.stop="togglePop('size', $event)"
        title="字号"
      ><b>A</b></button>
    </div>

    <div class="fmt-sep"></div>

    <!-- 列表 •≡ -->
    <div class="fmt-pop-wrap">
      <button
        class="fmt-btn"
        :class="{ active: isList || openPop === 'list' }"
        @mousedown.prevent.stop="togglePop('list', $event)"
        title="列表"
      >•≡</button>
    </div>

    <div class="fmt-sep"></div>

    <!-- 颜色 🎨 -->
    <div class="fmt-pop-wrap">
      <button
        class="fmt-btn"
        :class="{ active: openPop === 'color' }"
        @mousedown.prevent.stop="togglePop('color', $event)"
        title="颜色"
      >🎨</button>
    </div>

    <!-- 弹窗通过 Teleport 挂到 body，避免被 overflow:hidden 裁剪 -->
    <!-- 关键：弹窗容器用 @mousedown.prevent.stop，阻止编辑器失焦；按钮用 @click -->
    <Teleport to="body">
      <!-- 字号弹窗 -->
      <div
        v-if="openPop === 'size'"
        class="fmt-popup"
        :style="floatStyle"
        ref="popupRef"
        @mousedown.prevent.stop
      >
        <div class="pop-arrow-up"></div>
        <button class="pop-item" @mousedown.prevent @click="changeFontSize(1)">
          <span class="size-big">A</span>
          <span class="size-op">+</span>
          <span class="pop-label">放大</span>
        </button>
        <button class="pop-item" @mousedown.prevent @click="changeFontSize(-1)">
          <span class="size-small">A</span>
          <span class="size-op">−</span>
          <span class="pop-label">缩小</span>
        </button>
      </div>

      <!-- 列表弹窗 -->
      <div
        v-if="openPop === 'list'"
        class="fmt-popup"
        :style="floatStyle"
        ref="popupRef"
        @mousedown.prevent.stop
      >
        <div class="pop-arrow-up"></div>
        <button
          class="pop-item"
          :class="{ 'item-active': editor?.isActive('bulletList') }"
          @mousedown.prevent
          @click="toggleList('bulletList')"
        >
          <span class="list-icon">•</span>
          <span class="pop-label">圆点列表</span>
        </button>
        <button
          class="pop-item"
          :class="{ 'item-active': editor?.isActive('orderedList') }"
          @mousedown.prevent
          @click="toggleList('orderedList')"
        >
          <span class="list-icon list-num">1.</span>
          <span class="pop-label">数字编号</span>
        </button>
      </div>

      <!-- 颜色弹窗 -->
      <div
        v-if="openPop === 'color'"
        class="fmt-popup fmt-popup-color"
        :style="floatStyle"
        ref="popupRef"
        @mousedown.prevent.stop
      >
        <div class="pop-arrow-up"></div>
        <div class="color-section-lbl">字体颜色</div>
        <div class="color-row">
          <button
            v-for="c in TEXT_COLORS"
            :key="c"
            class="color-dot"
            :style="{ background: c }"
            @mousedown.prevent
            @click="applyColor(c)"
          ></button>
        </div>
        <div class="color-section-lbl" style="margin-top: 8px">荧光高亮</div>
        <div class="color-row">
          <button
            v-for="c in HIGHLIGHT_COLORS"
            :key="c"
            class="color-square"
            :style="{ background: c }"
            @mousedown.prevent
            @click="applyHighlight(c)"
          ></button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({ editor: Object })

const rootRef  = ref(null)
const popupRef = ref(null)
const openPop  = ref(null)
const popX     = ref(0)
const popY     = ref(0)

const DEFAULT_SIZE = 13

// 打开弹窗时保存选区，避免点击弹窗后编辑器失焦导致命令无效
let savedRange = null

function saveSelection() {
  if (props.editor) {
    const { from, to } = props.editor.state.selection
    savedRange = { from, to }
  }
}

function restoreFocus() {
  if (!props.editor) return
  if (savedRange) {
    props.editor.chain().focus().setTextSelection(savedRange).run()
  } else {
    props.editor.chain().focus().run()
  }
}

const TEXT_COLORS      = ['#333333', '#e53935', '#f57c00', '#388e3c', '#1565c0', '#9b8ec4', '#00838f']
const HIGHLIGHT_COLORS = ['#ffe066', '#a5d6a7', '#90caf9', '#ffab91', '#ce93d8']

const isList = computed(() =>
  props.editor?.isActive('bulletList') || props.editor?.isActive('orderedList')
)

const floatStyle = computed(() => ({
  position: 'fixed',
  top:  `${popY.value}px`,
  left: `${popX.value}px`,
  transform: 'translateX(-50%)',
  zIndex: 9999,
}))

function togglePop(name, e) {
  if (openPop.value === name) {
    openPop.value = null
    return
  }
  saveSelection()  // 开弹窗前先存选区
  const rect = e.currentTarget.getBoundingClientRect()
  popX.value = rect.left + rect.width / 2
  popY.value = rect.bottom + 6
  openPop.value = name
}

function cmd(command) {
  props.editor?.chain().focus()[command]().run()
}

function getCurrentFontSize() {
  const attrs = props.editor?.getAttributes('textStyle')
  return parseInt(attrs?.fontSize) || DEFAULT_SIZE
}

function changeFontSize(delta) {
  const newSize = Math.max(10, Math.min(36, getCurrentFontSize() + delta))
  const chain = props.editor?.chain().focus()
  if (savedRange) chain?.setTextSelection(savedRange)
  chain?.setFontSize(newSize).run()
}

function toggleList(type) {
  if (!props.editor) return
  const cmd = type === 'bulletList' ? 'toggleBulletList' : 'toggleOrderedList'
  console.log('[FormatToolbar] toggleList', cmd, 'editor focused:', props.editor.isFocused)
  const result = props.editor.chain().focus()[cmd]().run()
  console.log('[FormatToolbar] run result:', result)
  openPop.value = null
}

function applyColor(color) {
  const chain = props.editor?.chain().focus()
  if (savedRange) chain?.setTextSelection(savedRange)
  chain?.setColor(color).run()
  openPop.value = null
}

function applyHighlight(color) {
  const chain = props.editor?.chain().focus()
  if (savedRange) chain?.setTextSelection(savedRange)
  chain?.toggleHighlight({ color }).run()
  openPop.value = null
}

function onDocMousedown(e) {
  if (rootRef.value?.contains(e.target)) return
  if (popupRef.value?.contains(e.target)) return
  openPop.value = null
}

onMounted(() => document.addEventListener('mousedown', onDocMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onDocMousedown))
</script>

<style scoped>
.format-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
}

.fmt-btn {
  background: none;
  border: none;
  cursor: pointer;
  width: 20px;
  height: 20px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  color: #7a6eaa;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Microsoft YaHei', sans-serif;
  transition: background 0.15s;
  flex-shrink: 0;
}
.fmt-btn:hover { background: rgba(155, 142, 196, 0.2); }
.fmt-btn.active { background: rgba(155, 142, 196, 0.38); color: #5c4fa3; }

.fmt-italic { font-style: italic; }
.fmt-strike { text-decoration: line-through; }

.fmt-sep {
  width: 1px;
  height: 12px;
  background: rgba(155, 142, 196, 0.25);
  margin: 0 1px;
  flex-shrink: 0;
}

.fmt-pop-wrap { position: relative; }
</style>

<!-- 全局样式：弹窗挂到 body，不能用 scoped -->
<style>
.fmt-popup {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(180, 170, 210, 0.35);
  padding: 5px;
  min-width: 96px;
}

.pop-arrow-up {
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 10px;
  height: 5px;
  background: white;
  clip-path: polygon(50% 0%, 0 100%, 100% 100%);
  filter: drop-shadow(0 -1px 1px rgba(180, 170, 210, 0.4));
}

.pop-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 10px;
  border: none;
  background: none;
  border-radius: 5px;
  cursor: pointer;
  font-family: 'Microsoft YaHei', sans-serif;
  text-align: left;
}
.pop-item:hover { background: rgba(155, 142, 196, 0.12); }
.pop-item.item-active { background: rgba(155, 142, 196, 0.2); }

.size-big  { font-size: 17px; font-weight: bold; color: #6358a0; line-height: 1; }
.size-small { font-size: 11px; font-weight: bold; color: #999; line-height: 1; }
.size-op   { font-size: 14px; font-weight: bold; color: #6358a0; }
.pop-label { font-size: 11px; color: #555; }

.list-icon { font-size: 14px; color: #555; line-height: 1; width: 14px; text-align: center; }
.list-num  { font-size: 11px; font-weight: bold; }

.fmt-popup-color { min-width: 148px; padding: 9px 11px; }
.color-section-lbl { font-size: 10px; color: #bbb; margin-bottom: 6px; }
.color-row { display: flex; gap: 5px; flex-wrap: wrap; }

.color-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.1s;
}
.color-dot:hover { transform: scale(1.15); border-color: rgba(0, 0, 0, 0.2); }

.color-square {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.1s;
}
.color-square:hover { transform: scale(1.15); border-color: rgba(0, 0, 0, 0.15); }
</style>
