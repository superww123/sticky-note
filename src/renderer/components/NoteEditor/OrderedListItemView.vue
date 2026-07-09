<template>
  <NodeViewWrapper as="li" :class="isOrdered ? 'ol-item' : 'bl-item'">
    <span
      v-if="isOrdered"
      ref="counterRef"
      class="ol-num"
      :class="{ 'ol-num--open': showPopup }"
      @mousedown.prevent.stop="openPopup"
    >{{ counterNum }}.</span>
    <NodeViewContent as="div" class="list-item-body" />

    <Teleport to="body">
      <div
        v-if="showPopup"
        class="ol-popup"
        :style="popupStyle"
        @mousedown.prevent.stop
      >
        <button
          class="ol-pop-item"
          :class="{ 'ol-pop-item--dim': !prevListInfo && props.node.attrs.value == null }"
          @mousedown.prevent
          @click="continueNumbering"
        >
          <span class="ol-pop-icon">↩</span>继续之前的编号
        </button>
        <div class="ol-pop-divider"></div>
        <button class="ol-pop-item" @mousedown.prevent @click="startNewList">
          <span class="ol-pop-icon">≡</span>开始新列表
        </button>
        <template v-if="!editMode">
          <button class="ol-pop-item" @mousedown.prevent @click="enterEditMode">
            <span class="ol-pop-icon">✏️</span>修改编号值
          </button>
        </template>
        <template v-else>
          <div class="ol-pop-edit">
            <input
              ref="numInputRef"
              v-model.number="inputNum"
              type="number"
              min="1"
              max="9999"
              class="ol-num-input"
              @keydown.enter="applyNumber"
              @keydown.escape="closePopup"
              @mousedown.stop
            />
            <button class="ol-pop-confirm" @mousedown.prevent @click="applyNumber">✓</button>
          </div>
        </template>
      </div>
    </Teleport>
  </NodeViewWrapper>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/vue-3'

const props = defineProps({
  editor: Object,
  node: Object,
  getPos: Function,
  updateAttributes: Function,
})

const showPopup = ref(false)
const editMode = ref(false)
const inputNum = ref(1)
const popX = ref(0)
const popY = ref(0)
const counterRef = ref(null)
const numInputRef = ref(null)

// 每次 editor 更新时递增，让依赖它的 computed 强制重新计算
const tick = ref(0)
let _tickHandler = null
onMounted(() => {
  _tickHandler = () => { tick.value++ }
  props.editor.on('update', _tickHandler)
})
onUnmounted(() => {
  if (_tickHandler) props.editor.off('update', _tickHandler)
  _tickHandler = null
})

// 解析列表上下文：找到父级 list 节点及其位置
function getListContext() {
  try {
    const pos = props.getPos()
    if (pos === undefined) return null
    const $pos = props.editor.state.doc.resolve(pos + 1)
    for (let d = $pos.depth; d >= 0; d--) {
      const node = $pos.node(d)
      if (node.type.name === 'orderedList' || node.type.name === 'bulletList') {
        return { listNode: node, listPos: $pos.before(d), type: node.type.name }
      }
    }
  } catch { /* ignore */ }
  return null
}

const isOrdered = computed(() => {
  tick.value  // 依赖 editor update，保证每次文档变化后重新计算
  return getListContext()?.type === 'orderedList'
})

const counterNum = computed(() => {
  tick.value  // 依赖 editor update
  if (!isOrdered.value) return 0
  // 如果本条目设置了自定义编号，直接显示
  if (props.node.attrs.value != null) return props.node.attrs.value
  // 否则根据列表位置自动计算
  const ctx = getListContext()
  if (!ctx) return 1
  const { listNode, listPos } = ctx
  const start = listNode.attrs.start || 1
  const myPos = props.getPos()
  let index = 0
  listNode.forEach((child, offset) => {
    if (listPos + 1 + offset < myPos) index++
  })
  return start + index
})

// 查找本列表之前最近的有序列表，用于"继续之前的编号"
const prevListInfo = computed(() => {
  tick.value  // 依赖 editor update
  const ctx = getListContext()
  if (!ctx) return null
  let found = null
  props.editor.state.doc.nodesBetween(0, ctx.listPos, (node) => {
    if (node.type.name === 'orderedList') {
      found = { nextStart: (node.attrs.start || 1) + node.childCount }
    }
  })
  return found
})

const popupStyle = computed(() => ({
  position: 'fixed',
  left: `${popX.value}px`,
  top: `${popY.value}px`,
  zIndex: 9999,
}))

function openPopup(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  popX.value = rect.left
  popY.value = rect.bottom + 4
  inputNum.value = counterNum.value
  editMode.value = false
  showPopup.value = true
}

function closePopup() {
  showPopup.value = false
  editMode.value = false
}

function setItemStart(newStart) {
  props.editor.chain().focus().command(({ tr, state }) => {
    const myPos = props.getPos()
    if (myPos === undefined) return false

    // 直接解析 myPos（listItem 开始 token 之前的位置）
    // 此时 $myPos.parent = orderedList，$myPos.index() = 本条目的 0-based 索引
    const $myPos = state.doc.resolve(myPos)
    if ($myPos.parent.type.name !== 'orderedList') return false

    const listNode = $myPos.parent
    const itemIndex = $myPos.index()          // 0-based，如第2条 = 1
    const listContentStart = $myPos.start($myPos.depth)  // OL 内容起始位置 = listPos + 1
    const listPos = listContentStart - 1      // OL 自身位置（开始 token 前）

    const OL = state.schema.nodes.orderedList

    if (itemIndex === 0) {
      // 第一条：直接改列表的 start 属性
      tr.setNodeMarkup(listPos, undefined, { start: newStart })
      return true
    }

    // 非第一条：拆分列表
    // 第二段：从本条目开始到列表末尾
    const secondItems = []
    for (let i = itemIndex; i < listNode.childCount; i++) secondItems.push(listNode.child(i))
    const secondList = OL.create({ start: newStart }, secondItems)

    // 先在当前 OL 末尾之后插入第二段列表（此位置在删除范围之后，不影响下一步删除的位置）
    const afterListPos = listPos + listNode.nodeSize
    tr.insert(afterListPos, secondList)

    // 再删除当前 OL 中从本条目开始的所有条目
    // 计算前段保留内容的总字节数
    let keepSize = 0
    for (let i = 0; i < itemIndex; i++) keepSize += listNode.child(i).nodeSize
    const deleteFrom = listContentStart + keepSize
    const deleteTo = listContentStart + (listNode.nodeSize - 2)  // OL 内容末尾（关闭 token 之前）
    tr.delete(deleteFrom, deleteTo)

    return true
  }).run()
  closePopup()
}

function continueNumbering() {
  // 如果本条目有自定义值，直接清除 → 回到自动计算位置编号
  if (props.node.attrs.value != null) {
    props.updateAttributes({ value: null })
    closePopup()
    return
  }
  // 否则，尝试接续前面那个列表的末尾编号
  if (!prevListInfo.value) return
  setItemStart(prevListInfo.value.nextStart)
}

function startNewList() { setItemStart(1) }

function enterEditMode() {
  editMode.value = true
  nextTick(() => numInputRef.value?.focus())
}

function applyNumber() {
  const n = Math.max(1, Math.min(9999, inputNum.value || 1))
  // 只修改本条目的 value 属性，不影响其他条目
  props.updateAttributes({ value: n })
  closePopup()
}

function onDocMousedown(e) {
  if (counterRef.value?.contains(e.target)) return
  closePopup()
}

onMounted(() => document.addEventListener('mousedown', onDocMousedown))
onUnmounted(() => document.removeEventListener('mousedown', onDocMousedown))
</script>
