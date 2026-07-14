// 新窗口循环使用的浅色主题（index 0 = 默认，主窗口不改变）
export const NOTE_THEMES = [
  null, // 0: 默认紫蓝（主窗口）
  {     // 1: 天空蓝（调淡）
    '--bg':          'rgba(228, 242, 255, 0.95)',
    '--bg-section':  'rgba(205, 228, 250, 0.60)',
    '--border':      'rgba(140, 185, 230, 0.40)',
    '--purple':      '#3a7ab8',
    '--purple-light':'#85b8e0',
  },
  {     // 2: 鼠尾草绿（保留）
    '--bg':          'rgba(232, 248, 238, 0.95)',
    '--bg-section':  'rgba(210, 240, 220, 0.60)',
    '--border':      'rgba(130, 190, 150, 0.40)',
    '--purple':      '#4caa6e',
    '--purple-light':'#85c99c',
  },
  {     // 3: 暖杏色
    '--bg':          'rgba(252, 246, 230, 0.95)',
    '--bg-section':  'rgba(248, 234, 195, 0.60)',
    '--border':      'rgba(210, 170, 110, 0.40)',
    '--purple':      '#a06828',
    '--purple-light':'#ccaa70',
  },
  {     // 4: 玫瑰粉（调淡）
    '--bg':          'rgba(252, 240, 247, 0.95)',
    '--bg-section':  'rgba(248, 222, 236, 0.60)',
    '--border':      'rgba(215, 150, 175, 0.40)',
    '--purple':      '#a8406a',
    '--purple-light':'#d090a8',
  },
  {     // 5: 薄荷青
    '--bg':          'rgba(232, 248, 245, 0.95)',
    '--bg-section':  'rgba(205, 238, 232, 0.60)',
    '--border':      'rgba(110, 195, 190, 0.40)',
    '--purple':      '#155858',
    '--purple-light':'#60a8a0',
  },
]

export const THEME_COUNT = NOTE_THEMES.length - 1  // 5 种，不含默认
