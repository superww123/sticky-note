import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useCalendarStore = defineStore('calendar', () => {
  const marks = ref({})  // { 'YYYY-MM-DD': { color, note } }

  async function loadAllMarks() {
    const all = await window.electronAPI?.getAllCalendarMarks() || []
    marks.value = {}
    for (const m of all) {
      marks.value[m.date] = { color: m.color, note: m.note }
    }
  }

  async function setMark(date, color = '#ff6b6b', note = '') {
    await window.electronAPI?.upsertCalendarMark(date, color, note)
    marks.value[date] = { color, note }
  }

  async function removeMark(date) {
    await window.electronAPI?.deleteCalendarMark(date)
    delete marks.value[date]
  }

  function getMark(date) {
    return marks.value[date] || null
  }

  return { marks, loadAllMarks, setMark, removeMark, getMark }
})
