// 新窗口循环使用的浅色主题（index 0 = 默认，主窗口不改变）
export const NOTE_THEMES = [
  null, // 0: 默认紫蓝（主窗口）
  {     // 1: 天空蓝
    '--bg':          'rgba(232, 244, 255, 0.95)',
    '--bg-section':  'rgba(210, 232, 255, 0.60)',
    '--border':      'rgba(140, 185, 230, 0.40)',
    '--purple':      '#5b9fd4',
    '--purple-light':'#99c3e8',
  },
  {     // 2: 鼠尾草绿
    '--bg':          'rgba(232, 248, 238, 0.95)',
    '--bg-section':  'rgba(210, 240, 220, 0.60)',
    '--border':      'rgba(130, 190, 150, 0.40)',
    '--purple':      '#4caa6e',
    '--purple-light':'#85c99c',
  },
  {     // 3: 暖杏色
    '--bg':          'rgba(255, 248, 232, 0.95)',
    '--bg-section':  'rgba(255, 238, 205, 0.60)',
    '--border':      'rgba(210, 170, 110, 0.40)',
    '--purple':      '#c4883a',
    '--purple-light':'#ddb878',
  },
  {     // 4: 玫瑰粉
    '--bg':          'rgba(255, 238, 244, 0.95)',
    '--bg-section':  'rgba(255, 218, 232, 0.60)',
    '--border':      'rgba(215, 150, 175, 0.40)',
    '--purple':      '#c45878',
    '--purple-light':'#de95a8',
  },
  {     // 5: 薄荷青
    '--bg':          'rgba(232, 252, 250, 0.95)',
    '--bg-section':  'rgba(205, 245, 242, 0.60)',
    '--border':      'rgba(110, 195, 190, 0.40)',
    '--purple':      '#3aabaa',
    '--purple-light':'#78cbc8',
  },
]

export const THEME_COUNT = NOTE_THEMES.length - 1  // 5 种，不含默认
