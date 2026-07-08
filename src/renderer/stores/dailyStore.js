import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'

function getTodayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export const useDailyStore = defineStore('daily', () => {
  const currentDate = ref(getTodayStr())
  const todos = ref([])
  const noteContent = ref({ type: 'doc', content: [] })
  const isLoading = ref(false)
  let loadSeq = 0   // 防止并发 loadDate 用旧数据覆盖新数据

  // 未完成待办数量
  const pendingCount = computed(() => todos.value.filter(t => !t.completed).length)

  // 超期待办
  const overdueTodos = computed(() => {
    const now = Date.now()
    return todos.value.filter(t => !t.completed && t.deadline && new Date(t.deadline).getTime() < now)
  })

  /**
   * 加载指定日期数据
   */
  async function loadDate(date) {
    const seq = ++loadSeq
    isLoading.value = true
    currentDate.value = date
    try {
      const data = await window.electronAPI?.getDailyData(date)
      if (seq !== loadSeq) return   // 已被更新的加载请求覆盖，丢弃旧结果
      if (data) {
        todos.value = data.todos || []
        noteContent.value = data.noteContent || { type: 'doc', content: [] }
      } else {
        todos.value = []
        noteContent.value = { type: 'doc', content: [] }
      }
    } catch (e) {
      console.error('[Store] 加载数据失败:', e)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 加载今天的数据（先触发一次迁移，确保昨天未完成的待办已补入）
   */
  async function loadToday() {
    await window.electronAPI?.migrateNow?.()
    await loadDate(getTodayStr())
  }

  /**
   * 保存待办
   */
  async function saveTodos(newTodos) {
    todos.value = newTodos
    // toRaw 剥离 Vue 响应式 Proxy，Electron IPC structured clone 无法序列化 Proxy 对象
    const plainTodos = newTodos.map(t => ({ ...toRaw(t) }))
    console.log('[Store] saveTodos:', plainTodos.length, 'items, date:', currentDate.value)
    try {
      await window.electronAPI?.saveTodos(currentDate.value, plainTodos)
      console.log('[Store] saveTodos: IPC OK')
    } catch (e) {
      console.error('[Store] saveTodos: IPC 失败!', e)
      throw e
    }
  }

  /**
   * 添加待办
   */
  async function addTodo(text, deadline = null) {
    const newTodo = {
      id: Date.now(),
      text,
      completed: false,
      deadline,
      notifiedAt: null,
      order: todos.value.length,
    }
    await saveTodos([...todos.value, newTodo])
    return newTodo
  }

  /**
   * 切换待办完成状态
   */
  async function toggleTodo(id) {
    const updated = todos.value.map(t =>
      t.id === id ? { ...t, completed: !t.completed } : t
    )
    await saveTodos(updated)
  }

  /**
   * 删除待办
   */
  async function deleteTodo(id) {
    await saveTodos(todos.value.filter(t => t.id !== id))
  }

  /**
   * 更新待办顺序（拖拽后调用）
   */
  async function reorderTodos(newOrder) {
    await saveTodos(newOrder)
  }

  /**
   * 保存随心记内容
   */
  async function saveNote(content) {
    noteContent.value = content
    await window.electronAPI?.saveNote(currentDate.value, toRaw(content))
  }

  /**
   * 将某条待办迁移到指定日期
   */
  async function migrateTodo(todoId, targetDate) {
    const todo = todos.value.find(t => t.id === todoId)
    if (!todo) {
      console.warn('[Store] migrateTodo: 未找到 id=', todoId, '  当前 ids:', todos.value.map(t => t.id))
      return
    }

    // 在任何 await 之前就捞出原始数据，防止 await 后 Vue Proxy 指向的数组已被替换
    const rawTodo = { ...toRaw(todo) }
    const fromDate = currentDate.value
    console.log('[Store] migrateTodo:', rawTodo.text, '  from:', fromDate, '→', targetDate)

    try {
      // 1. 读取目标日期的现有待办
      const targetData = await window.electronAPI?.getDailyData(targetDate)
      const targetTodos = targetData?.todos || []
      console.log('[Store] migrateTodo: 目标', targetDate, '当前', targetTodos.length, '条')

      // 3. 构造迁移条目并写入目标日期
      const migratedTodo = {
        ...rawTodo,
        id: Date.now() + Math.random(),
        originalId: String(rawTodo.originalId || rawTodo.id),
        migratedFrom: fromDate,
      }
      const plain = [migratedTodo, ...targetTodos].map(t => ({ ...toRaw(t) }))
      await window.electronAPI?.saveTodos(targetDate, plain)
      console.log('[Store] migrateTodo: 写入', targetDate, '成功，共', plain.length, '条')
    } catch (e) {
      console.error('[Store] migrateTodo 失败:', e)
      throw e
    }
  }

  return {
    currentDate,
    todos,
    noteContent,
    isLoading,
    pendingCount,
    overdueTodos,
    loadDate,
    loadToday,
    saveTodos,
    addTodo,
    toggleTodo,
    deleteTodo,
    reorderTodos,
    saveNote,
    migrateTodo,
  }
})
