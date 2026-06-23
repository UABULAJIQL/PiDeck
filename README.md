# PiDeck

[English](README.en.md) · [LinuxDO 友链](https://linux.do)

**基于原版 `PiDeck` fork，并按个人工作流持续调整的桌面版 pi Agent 工具。**

![Status](https://img.shields.io/badge/status-experimental-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Electron](https://img.shields.io/badge/Electron-38-47848f)
![React](https://img.shields.io/badge/React-19-61dafb)
![Version](https://img.shields.io/badge/version-0.6.0-green)

这个仓库主要是我自己的桌面工作台，围绕日常使用对原版 `PiDeck` 做功能取舍和定制调整。
目前主要在 Windows 环境下正常使用，其他系统暂时没有认真测试，兼容性不保证。

## 主要用途

- 多项目工作区：管理多个项目目录，按项目隔离运行 `pi` Agent。
- 会话与终端：统一查看会话、历史、文件摘要和 Agent 终端。
- 配置与扩展：管理 `models.json`、`auth.json`、`settings.json`，以及 Skills / Extensions。
- Git 与网络：查看分支、切换分支，必要时启动局域网 Web 服务。
- 快速输入：支持 `@` 文件引用、`/` 斜线命令和 `!` Shell。

## 运行要求

- Node.js 20+
- npm
- 系统 `PATH` 中可访问 `pi` 命令
- 已完成 pi 的 Provider / 登录 / API Key 配置

验证 `pi` 是否可用：

```bash
pi --version
pi --mode rpc
```

## 快速开始

```bash
git clone <当前仓库地址>
cd pi-desktop
npm install
npm run make-icon
npm run dev
```

## 开发命令

- `npm run dev`：启动开发模式
- `npm run typecheck`：运行 TypeScript 类型检查
- `npm run build`：构建 Renderer + Main 产物
- `npm run dist:win`：打包 Windows

## 版本说明

详细更新请查看 [CHANGELOG.zh-CN.md](CHANGELOG.zh-CN.md)。
