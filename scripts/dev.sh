#!/bin/bash
# scripts/dev.sh - 开发模式启动

set -e
cd "$(dirname "$0")/.."

echo "[sticky-note] 启动开发服务器..."
# 清除 ELECTRON_RUN_AS_NODE（在 Claude Code 等特殊环境中可能被设置）
unset ELECTRON_RUN_AS_NODE
npm run dev
