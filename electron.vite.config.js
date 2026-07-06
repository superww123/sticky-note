import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // 所有主进程文件作为多入口，保留目录结构
        input: {
          index: resolve(__dirname, 'src/main/index.js'),
          ipc: resolve(__dirname, 'src/main/ipc.js'),
          db: resolve(__dirname, 'src/main/database/db.js'),
          scheduler: resolve(__dirname, 'src/main/scheduler/index.js'),
          windowManager: resolve(__dirname, 'src/main/windows/windowManager.js'),
          trayManager: resolve(__dirname, 'src/main/windows/trayManager.js'),
          archiver: resolve(__dirname, 'src/main/word/archiver.js'),
        },
        output: {
          // 保留原来的目录结构
          entryFileNames: (chunkInfo) => {
            const src = chunkInfo.facadeModuleId
            if (!src) return '[name].js'
            // 去掉 src/main/ 前缀
            const rel = src.replace(/.*src\/main\//, '')
            return rel || '[name].js'
          },
          format: 'cjs',
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.js'),
        },
      },
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
      },
    },
    plugins: [vue()],
  },
})
