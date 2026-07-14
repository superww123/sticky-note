# 随心记

[![Build and Release](https://github.com/superww123/sticky-note/actions/workflows/build.yml/badge.svg)](https://github.com/superww123/sticky-note/actions/workflows/build.yml)
[![GitHub release](https://img.shields.io/github/v/release/superww123/sticky-note)](https://github.com/superww123/sticky-note/releases/latest)
[![Windows](https://img.shields.io/badge/platform-Windows-blue?logo=windows)](https://github.com/superww123/sticky-note/releases/latest)
[![macOS](https://img.shields.io/badge/platform-macOS-lightgrey?logo=apple)](https://github.com/superww123/sticky-note/releases/latest)

一款轻量级桌面便签应用，待办 + 随心记笔记，常驻桌面不打扰。

## 下载安装

前往 [Releases](https://github.com/superww123/sticky-note/releases/latest) 页面下载：

- **Windows**：下载 `sticky-note-setup-*.exe`，双击安装
- **macOS**：下载 `sticky-note-*.dmg`，拖入应用程序文件夹

## 主要功能

- 📋 **每日待办**：支持截止时间、一键迁移、批量操作、导出文本
- 📝 **随心记笔记**：富文本编辑，支持图片、链接、高亮、格式刷
- 📅 **历史日历**：按日期回顾往日待办与笔记
- 📌 **窗口置顶**：钉住后始终浮在最上层
- ⚽ **小球模式**：失焦自动缩成小球，不占桌面空间
- 🔔 **截止提醒**：临近截止自动弹出提醒

## 技术栈

- Electron 29 + Vue 3 + Pinia
- Tiptap v2（富文本编辑器）
- sql.js（SQLite，无需编译）
- node-cron（定时任务）

## 开发启动

```bash
bash scripts/dev.sh
```
