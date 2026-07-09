#!/bin/bash
# scripts/dev.sh - 开发模式启动（不用 concurrently，避免 Windows 下 electron 退出后 Vite 被杀死）

cd "$(dirname "$0")/.."
unset ELECTRON_RUN_AS_NODE
export NODE_ENV=development

echo "[sticky-note] 启动 Vite..."
npx vite &
VITE_PID=$!

echo "[sticky-note] 等待 Vite 就绪..."
npx wait-on http://localhost:5173

echo "[sticky-note] 启动 Electron..."
npx electron . &

echo "[sticky-note] 开发模式运行中，Ctrl+C 停止"
trap "kill $VITE_PID 2>/dev/null; exit" SIGINT SIGTERM
wait $VITE_PID
