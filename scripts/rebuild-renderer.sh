#!/bin/bash
# 重新编译渲染层（用于开机自启动场景更新代码后同步到 dist/）
set -e
cd "$(dirname "$0")/.."
echo "[sticky-note] 重新构建渲染层..."
npx vite build
echo "[sticky-note] 构建完成！请重启随心记 app（右键托盘退出后重新打开）"
