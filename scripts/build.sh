#!/bin/bash
# 随心记 - 打包成 Windows 安装包
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=== 随心记 打包脚本 ==="

echo "[1/2] 构建渲染层..."
npx vite build

echo "[2/2] 打包 Electron 安装包..."
npx electron-builder

echo ""
echo "=== 打包完成 ==="
echo "安装包位于: $PROJECT_DIR/release/"
ls -lh "$PROJECT_DIR/release/"*.exe 2>/dev/null || ls -lh "$PROJECT_DIR/release/"
