# PiDeck

[中文文档](README.md) · [English](README.en.md) · [LinuxDO 友链](https://linux.do)

**A fork of the original `PiDeck`, adjusted around my own workflow as a desktop pi Agent tool.**

![Status](https://img.shields.io/badge/status-experimental-orange)
![License](https://img.shields.io/badge/license-MIT-blue)
![Electron](https://img.shields.io/badge/Electron-38-47848f)
![React](https://img.shields.io/badge/React-19-61dafb)
![Version](https://img.shields.io/badge/version-0.6.0-green)

This repository is mainly my own desktop workbench, where I trim and extend the original `PiDeck` around my day-to-day workflow needs.
It is currently used and verified mainly on Windows. Other operating systems have not been seriously tested yet, so compatibility is not guaranteed.

## What it is for

- Multi-project workspace: manage multiple project folders and run isolated `pi` agents per project.
- Sessions and terminal: view sessions, history, file summaries, and agent terminals in one place.
- Config and extensions: manage `models.json`, `auth.json`, `settings.json`, plus Skills / Extensions.
- Git and networking: inspect branches, switch branches, and start the LAN web service when needed.
- Quick input: support for `@` file references, `/` slash commands, and `!` shell commands.

## Requirements

- Node.js 20+
- npm
- `pi` available in your system `PATH`
- pi provider / login / API key configured

Verify `pi` is available:

```bash
pi --version
pi --mode rpc
```

## Quick Start

```bash
git clone <current-repository-url>
cd pi-desktop
npm install
npm run make-icon
npm run dev
```

## Development

- `npm run dev` — start development mode
- `npm run typecheck` — run TypeScript type checking
- `npm run build` — build renderer + main bundles
- `npm run dist:win` — package for Windows

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed version history.
