#!/bin/bash
# scripts/install.sh - 安装依赖（含 native 模块 rebuild）

set -e
cd "$(dirname "$0")/.."

echo "[sticky-note] 安装 npm 依赖..."
npm install

echo "[sticky-note] Rebuild native 模块 (better-sqlite3)..."
npx electron-rebuild -f -w better-sqlite3

echo "[sticky-note] 完成！运行 scripts/dev.sh 启动"
