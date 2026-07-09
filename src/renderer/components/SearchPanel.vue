<template>
  <!-- 点击遮罩关闭 -->
  <div class="search-overlay" @mousedown.self="$emit('close')">
    <div class="search-panel" @mousedown.stop>
      <!-- 输入框 -->
      <div class="search-input-row">
        <span class="search-icon">🔍</span>
        <input
          ref="inputRef"
          v-model="keyword"
          class="search-input"
          placeholder="搜索待办和随心记…"
          @keydown="onKeydown"
        />
        <button class="search-close" @mousedown.prevent @click="$emit('close')">✕</button>
      </div>

      <!-- 结果区 -->
      <div v-if="keyword.length >= 2" class="search-results">
        <!-- 加载中 -->
        <div v-if="loading" class="search-status">搜索中…</div>

        <!-- 无结果 -->
        <div v-else-if="!loading && normalResults.length === 0" class="search-status">未找到相关内容</div>

        <!-- 结果列表 -->
        <template v-else>
          <div
            v-for="(item, idx) in normalResults"
            :key="idx"
            class="search-result-item"
            :class="{ selected: selectedIndex === idx }"
            @mousedown.prevent
            @click="openResult(item)"
          >
            <div class="result-meta">
              <span class="result-date">{{ item.date }}</span>
              <span class="result-badge" :class="item.source === 'todo' ? 'badge-todo' : 'badge-note'">
                {{ item.source === 'todo' ? '待办' : '随心记' }}
              </span>
            </div>
            <div class="result-snippet" v-html="highlightSnippet(item.snippet, item.keyword)"></div>
          </div>

          <!-- overflow 提示 -->
          <div v-if="hasOverflow" class="search-overflow">
            结果过多，请输入更精确的关键词
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'

const emit = defineEmits(['close'])

const inputRef = ref(null)
const keyword = ref('')
const results = ref([])
const loading = ref(false)
const selectedIndex = ref(-1)

const normalResults = computed(() => results.value.filter(r => r.type !== 'overflow'))
const hasOverflow = computed(() => results.value.some(r => r.type === 'overflow'))

// 自动聚焦
onMounted(() => nextTick(() => inputRef.value?.focus()))

// debounce 搜索
let searchTimer = null
watch(keyword, (kw) => {
  clearTimeout(searchTimer)
  selectedIndex.value = -1
  if (kw.length < 2) { results.value = []; loading.value = false; return }
  loading.value = true
  searchTimer = setTimeout(() => doSearch(kw), 300)
})

async function doSearch(kw) {
  try {
    const res = await window.electronAPI.searchAllNotes(kw)
    results.value = res || []
  } catch (e) {
    console.error('[Search] 搜索失败:', e)
    results.value = []
  } finally {
    loading.value = false
  }
}

function highlightSnippet(snippet, kw) {
  if (!snippet || !kw) return snippet || ''
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return snippet.replace(new RegExp(escaped, 'gi'), '<mark>$&</mark>')
}

function openResult(item) {
  window.electronAPI.openNoteWindow({ date: item.date, keyword: item.keyword })
  emit('close')
}

function onKeydown(e) {
  const len = normalResults.value.length
  if (e.key === 'Escape') { emit('close'); return }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, len - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
  } else if (e.key === 'Enter') {
    const target = selectedIndex.value >= 0 ? normalResults.value[selectedIndex.value] : normalResults.value[0]
    if (target) openResult(target)
  }
}
</script>

<style scoped>
.search-overlay {
  position: absolute;
  inset: 0;
  z-index: 2000;
  background: transparent;
}

.search-panel {
  position: absolute;
  top: 36px;
  left: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  border: 1px solid rgba(180, 170, 210, 0.3);
  overflow: hidden;
}

/* ── 输入框行 ── */
.search-input-row {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  gap: 6px;
  border-bottom: 1px solid rgba(180, 170, 210, 0.2);
}

.search-icon { font-size: 13px; flex-shrink: 0; }

.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #3c3250;
  font-family: 'Microsoft YaHei', sans-serif;
}
.search-input::placeholder { color: rgba(60, 50, 80, 0.35); }

.search-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  color: rgba(60, 50, 80, 0.4);
  padding: 2px 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.search-close:hover { color: rgba(60, 50, 80, 0.8); background: rgba(155, 142, 196, 0.15); }

/* ── 结果区 ── */
.search-results {
  max-height: 340px;
  overflow-y: auto;
  padding: 4px 0;
}

.search-status {
  padding: 12px 14px;
  font-size: 12px;
  color: rgba(60, 50, 80, 0.45);
  text-align: center;
}

.search-result-item {
  padding: 7px 12px;
  cursor: pointer;
  transition: background 0.12s;
}
.search-result-item:hover,
.search-result-item.selected {
  background: rgba(155, 142, 196, 0.12);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.result-date {
  font-size: 11px;
  color: rgba(60, 50, 80, 0.45);
}

.result-badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  font-weight: 500;
}
.badge-todo  { background: rgba(155, 142, 196, 0.2); color: #6c5faa; }
.badge-note  { background: rgba(46, 158, 91, 0.15);  color: #2e7d50; }

.result-snippet {
  font-size: 12px;
  color: #3c3250;
  line-height: 1.5;
  word-break: break-all;
}

.search-overflow {
  padding: 8px 14px;
  font-size: 11px;
  color: rgba(60, 50, 80, 0.4);
  text-align: center;
  border-top: 1px solid rgba(180, 170, 210, 0.15);
}
</style>

<!-- 全局：mark 高亮样式 -->
<style>
.result-snippet mark {
  background: #ffeb3b;
  border-radius: 2px;
  padding: 0 1px;
  color: inherit;
  font-style: normal;
}
</style>
