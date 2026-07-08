#!/bin/bash
# 随心记 - 一键设置桌面快捷方式 + 开机自启
# 在 Git Bash 中运行：bash scripts/setup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== 随心记 安装脚本 ==="
echo "项目目录: $PROJECT_DIR"

# 将路径转为 Windows 格式供 PowerShell 使用
WIN_PROJECT_DIR="$(cygpath -w "$PROJECT_DIR" 2>/dev/null || echo "$PROJECT_DIR")"

powershell -ExecutionPolicy Bypass -File "$SCRIPT_DIR/setup.ps1"
