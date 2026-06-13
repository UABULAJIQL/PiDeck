# pi-desktop UI 布局与视觉审计

> 目的：为下一版 UI 统一优化提供现状盘点、设计问题定位和可执行改版建议。本文基于当前 `src/renderer/src/App.tsx`、`src/renderer/src/components/app/AppParts.tsx`、`src/renderer/src/ConfigModal.tsx`、`src/renderer/src/components/terminal/TerminalDock.tsx` 与 `src/renderer/src/styles.css` 梳理。

## 1. 当前整体信息架构

pi-desktop 当前是典型桌面工作台结构，核心体验围绕“项目 / Agent / 对话 / 文件与会话 / 终端”展开。

```text
┌──────────────────────────────────────────────────────────────┐
│ 左侧项目与 Agent 列表 │          中央对话工作区          │ 右侧抽屉 │
│ chat-list-pane        │ chat-pane                         │ drawer   │
│                       │ ┌──────── chat-header ────────┐   │         │
│                       │ │ 标题 / 分支 / 会话 / 操作区   │   │         │
│                       │ ├────── message-timeline ─────┤   │         │
│                       │ │ 消息流 / 工具调用 / Markdown   │   │         │
│                       │ ├──────── composer ───────────┤   │         │
│                       │ │ 输入框 / 工具栏 / 发送策略     │   │         │
│                       │ └──────── terminal-dock ──────┘   │         │
└──────────────────────────────────────────────────────────────┘
```

### 主要页面与模块

| 页面 / 模块 | 当前职责 | 主要组件 / class | 当前布局特点 |
| --- | --- | --- | --- |
| 主工作台 | 项目、Agent、对话、抽屉、终端的总容器 | `App`、`chat-list-pane`、`chat-pane`、`detail-drawer`、`terminal-dock` | 三栏布局 + 底部终端 Dock，中央对话用 grid 分为 Header / Timeline / Composer / Terminal |
| 左侧项目列表 | 展示项目、Agent、搜索、新建、折叠 | `conversation-list`、`project-group`、`agent-node` | 背景偏青蓝，模块密度较高，支持折叠和项目级操作 |
| 中央对话区 | 消息展示、工具调用、Markdown、图片预览 | `message-timeline`、`message-list`、`chat-message`、`msg-content` | 消息内容最大宽度约 `780px`，整体居中，留白较舒适 |
| 顶部会话栏 | 标题、分支、会话、文件/历史/终端等入口 | `chat-header`、`header-action-group` | `78px` 高度，操作较多，信息优先级需要进一步分层 |
| 输入区 | prompt 输入、模型/思考级别/命令、发送策略 | `composer`、`composer-box`、`composer-footer`、`composer-toolbar` | 底部固定，textarea 可调整高度，有图片预览和发送行为菜单 |
| 右侧抽屉 | 文件、会话、运行日志、历史等辅助面板 | `detail-drawer`、`FilesPanel`、`SessionsPanel`、`ConversationOutline` | 背景白灰，阴影轻，属于辅助信息层 |
| 终端 Dock | Agent 绑定终端、多 tab、主题、复制、关闭确认 | `TerminalDock`、`terminal-dock`、`terminal-tab` | 嵌入主对话底部，支持折叠、高度拖拽和多主题 |
| 配置管理 | provider、model、auth、skills、extensions 等配置 | `ConfigModal`、`config-modal`、`config-primary-tabs`、`config-tabs` | `900px` 宽弹窗，一级胶囊 tab + 二级线性 tab |
| 设置弹窗 | UI、输入、代理、开发者设置 | `SettingsModal`、`settings-layout`、`setting-row` | `900px` 宽，左侧分类 + 右侧表单的设置页结构 |
| 环境检测弹窗 | pi 路径、安装状态、目录检测 | `EnvironmentDialog`、`environment-modal`、`env-card` | 卡片式状态分组，信息完整但视觉层级略散 |
| 反馈 / 更新 / 确认弹窗 | 问题反馈、版本更新、删除确认 | `feedback-modal`、`update-modal`、`session-delete-confirm` | 使用通用 modal backdrop 和圆角白色容器 |

## 2. 当前布局参数

### 主框架

- `body`：无外边距，禁止窗口滚动，应用内部自行控制滚动区域。
- `chat-list-pane`：左侧栏，`flex column`，背景 `#eaf7fb`，右边框 `#d6e9ef`，带内侧白色高光。
- `chat-pane`：中央区域，`grid-template-rows: 78px minmax(0, 1fr) auto auto`，依次承载顶部栏、消息流、输入区、终端 Dock。
- `chat-header`：`78px` 高度所在行，左右两列布局，左侧标题最小 `180px`，右侧操作自适应；背景为 `#fcfcfc → #f8f9fa` 轻渐变。
- `message-timeline`：消息区内边距 `18px clamp(16px, 3vw, 36px) 24px`，用于根据窗口宽度动态控制左右留白。
- `msg-content`：消息内容宽度 `min(780px, calc(100% - 54px))`，保证头像与消息内容同屏稳定。
- `detail-drawer`：右侧辅助抽屉，背景 `#fbfbfb`，左侧使用 `-8px 0 24px rgba(31, 35, 41, 0.04)` 轻阴影。

### 弹窗与面板

- `config-modal`：宽 `900px`，最大高度 `85vh`，圆角 `16px`，阴影 `0 24px 80px rgba(0, 0, 0, 0.22)`。
- `settings-modal`：宽 `900px`，最小高度 `560px`，最大高度 `85vh`，与配置弹窗视觉接近。
- `config-content`：内容区 `padding: 18px`，最小高度 `320px`，内部滚动。
- `files-panel` / `sessions-panel`：`padding: 14px`，内部滚动。
- `terminal-dock`：位于中央对话底部，拥有独立主题变量、tab 栏、内容壳和关闭确认层。

## 3. 当前文字系统

### 字体

当前全局字体栈：

```css
-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif
```

这套字体兼容 macOS、Windows 与中文显示，适合作为桌面端基础字体。

### 字号分布

当前 CSS 中字号分布较细，主要集中在：

| 字号 | 使用频率倾向 | 适用区域 |
| --- | --- | --- |
| `10px` / `10.5px` / `11px` / `11.5px` | 偏多 | 徽标、状态、次级说明、工具调用细节 |
| `12px` / `12.5px` | 最高频 | 按钮、表单说明、列表次级信息、设置项 |
| `13px` | 高频 | tab、列表标题、普通控件、正文辅助信息 |
| `14px` | 中频 | 常规正文、输入框、消息内容局部 |
| `15px` / `16px` | 少量 | 标题、重要按钮、空状态 |
| `18px` / `22px` / `26px` / `36px` | 少量 | Logo、一级标题、空状态视觉中心 |

### 当前问题

- 字号阶梯过细，`10px`、`10.5px`、`11px`、`11.5px`、`12px`、`12.5px`、`13px` 同时存在，导致视觉规范难以维护。
- 说明文字、徽标、列表元信息都集中在小字号，长时间使用时可读性偏弱。
- 消息正文与控制区字号没有明确区分，工作台的“阅读区域”和“操作区域”层级可再拉开。

### 建议字号体系

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--font-xs` | `11px` | 徽标、极短状态，不用于长文本 |
| `--font-sm` | `12px` | 表单提示、列表 meta、按钮辅助文案 |
| `--font-md` | `13px` | 控件、tab、侧栏列表主文本 |
| `--font-body` | `14px` | 消息正文、输入框、主要说明 |
| `--font-title` | `16px` | 面板标题、会话标题 |
| `--font-heading` | `20px` | 空状态、弹窗主标题 |

建议逐步减少半像素字号，优先把 `10.5px`、`11.5px`、`12.5px` 收敛到 `11px`、`12px`、`13px`。

## 4. 当前配色系统

### 现有主色倾向

| 类型 | 当前代表色 | 观察 |
| --- | --- | --- |
| 应用背景 | `#eef0f3` | 偏冷灰，适合作为窗口底色 |
| 中央工作区 | `#f7f7f7` | 中性浅灰，阅读压力较小 |
| 左侧栏背景 | `#eaf7fb` | 青蓝倾向明显，与中区中性灰风格不完全统一 |
| Header 背景 | `#fcfcfc`、`#f8f9fa` | 接近系统面板，比较干净 |
| 分割线 | `#eef0f3`、`#d6e9ef`、`#d4d9e1` | 灰与青蓝混用，边界风格不统一 |
| 成功 / 主行动 | `#14a514`、`#15803d`、`#ecfdf5` | 绿色为主品牌动作色 |
| 危险 | `#b91c1c` 等红色系 | 用于删除、错误、特殊输入状态 |
| 文字主色 | `#1f2329`、`#3b424c` | 清晰度充足 |
| 文字次色 | `#65707d`、`#7d8794`、`#8a9099` | 层级较多，可收敛 |

### 当前问题

- 左侧栏使用偏青蓝背景，中央区和弹窗使用中性灰白，整体有“局部主题色过重”的割裂感。
- 绿色作为主行动色已经形成识别，但部分蓝色、青色、绿色并存，缺少明确的 token 角色定义。
- 分割线、阴影、hover 背景色较多，视觉层级依赖具体颜色值，不利于统一换肤。
- 终端主题拥有独立变量，是好设计，但主应用尚未形成同等清晰的语义色变量。

### 建议配色方向

推荐转向“暖中性灰 + 克制绿色强调 + 低饱和状态色”的桌面工作台风格。

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--bg-window` | `#f3f4f1` | 应用最外层背景，略暖灰 |
| `--bg-sidebar` | `#f7f7f3` | 左侧栏背景，弱化当前青蓝割裂 |
| `--bg-panel` | `#ffffff` | 弹窗、卡片、输入框、消息卡片 |
| `--bg-panel-muted` | `#f8f8f5` | Header、列表 hover、次级区块 |
| `--border-subtle` | `#e5e5df` | 常规分割线 |
| `--border-strong` | `#d7d7cf` | 可拖拽分割线、激活边界 |
| `--text-primary` | `#202124` | 主文本 |
| `--text-secondary` | `#5f6368` | 次级文本 |
| `--text-tertiary` | `#8b8f94` | 弱提示、时间、meta |
| `--accent` | `#238636` | 主行动、激活态，保留绿色识别 |
| `--accent-soft` | `#e9f6ed` | 激活背景、轻提示 |
| `--danger` | `#c2410c` 或 `#b42318` | 删除、错误 |
| `--warning` | `#b7791f` | 环境警告、配置提示 |
| `--info` | `#2563eb` | 链接、外部跳转、信息提示 |

## 5. 当前圆角、阴影与间距

### 圆角

当前圆角最常见：

- `8px`：大量按钮、输入、卡片子元素。
- `999px`：胶囊按钮、状态 badge、圆形操作。
- `10px` / `12px` / `14px`：卡片、消息、列表项。
- `16px`：大型弹窗。
- `50%`：头像、圆形 icon。

### 建议圆角体系

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | `6px` | 小按钮、inline badge |
| `--radius-sm` | `8px` | 输入框、普通按钮 |
| `--radius-md` | `10px` | 列表项、轻卡片 |
| `--radius-lg` | `14px` | 消息卡片、设置卡片 |
| `--radius-xl` | `18px` | 弹窗、主容器 |
| `--radius-pill` | `999px` | 胶囊控件 |

### 间距

当前常见间距：`5px`、`6px`、`8px`、`9px`、`10px`、`12px`、`14px`、`16px`、`18px`、`20px`、`24px`、`28px`、`36px`。

建议采用 4px 栅格收敛：

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--space-1` | `4px` | 图标与文字之间 |
| `--space-2` | `8px` | 小控件间距 |
| `--space-3` | `12px` | 列表项内距、控件组间距 |
| `--space-4` | `16px` | 卡片内距、面板内距 |
| `--space-5` | `20px` | Header 横向内距 |
| `--space-6` | `24px` | 页面块间距 |
| `--space-8` | `32px` | 大区域留白 |

## 6. 分页面优化建议

### 6.1 主工作台

当前优点：

- 三栏结构清晰，符合开发工作台模型。
- 中央消息宽度有限制，阅读体验比全宽消息更好。
- 右侧抽屉和底部终端满足开发流中的上下文切换。

建议优化：

- 左侧栏从青蓝背景改为暖灰或中性灰，让绿色只承担激活和主行动角色。
- Header 中的分支、会话、文件、历史、终端等操作建议按“上下文信息 / 视图切换 / 主要动作”分组，而不是都呈现为同一权重按钮。
- 右侧抽屉打开时，中央消息区可适当降低最大宽度或保持居中，避免视觉重心偏左。
- 左侧折叠态建议保留窄 rail，展示项目/Agent 图标和状态点，减少完全隐藏后的空间跳变。

### 6.2 左侧项目与 Agent 列表

当前优点：

- 项目、Agent、更多分支、关闭等能力完整。
- 支持搜索和快速新建，符合多项目使用场景。

建议优化：

- 建议分为三层：Workspace / Project / Agent，使用更明显的缩进、图标和状态点区分。
- 当前列表信息密度偏高，hover 后出现的操作按钮容易造成跳动；建议操作按钮固定占位或统一放到右键菜单。
- 活跃 Agent 建议采用“左侧 3px accent bar + soft background + 状态点”，避免仅靠背景色判断。
- 项目折叠、删除、信息等低频操作建议收进 `...`，减少常驻按钮数量。

### 6.3 中央消息流

当前优点：

- 消息最大宽度约 `780px`，适合长文本阅读。
- 工具调用、代码块、Markdown、图片预览都已模块化。

建议优化：

- 用户消息与 assistant 消息可使用更明确的对齐和色块差异：用户消息轻强调，assistant 保持白底或透明。
- 工具调用建议统一为 collapsible card：默认显示工具名、状态、耗时、摘要，展开后显示参数和输出。
- Thinking、Tool、Error、System 类型消息建议建立统一状态色与图标规范。
- 代码块可参考 Codex 风格：顶部语言 / 文件名 / 复制按钮，主体使用轻边框和更稳定的 monospace 背景。

### 6.4 输入区 Composer

当前优点：

- 支持多模式、图片、命令、发送行为菜单，能力完整。
- 位于底部，符合对话式工具常见布局。

建议优化：

- 输入框应成为视觉焦点，建议使用白色卡片 + 更柔和阴影，而不是与背景完全融在一起。
- 工具栏建议拆分为左侧“上下文与能力”（模型、思考、命令、附件）和右侧“执行动作”（发送、停止、发送策略）。
- 发送行为菜单属于高级功能，可默认收敛为下拉，降低对普通输入的干扰。
- 输入区高度拖拽可以保留，但 resize handle 视觉应更克制，只在 hover/focus 时显著。

### 6.5 右侧抽屉

当前优点：

- 文件、会话、历史、日志等辅助信息有独立空间，不打断主对话。
- 与中央区之间通过阴影做了层级区分。

建议优化：

- 抽屉顶部建议统一为“标题 + 搜索/过滤 + 关闭/固定”结构。
- 文件和会话列表建议共享同一列表规范：行高、图标尺寸、meta 字号、选中态一致。
- 对话大纲可以更像 Codex 的右侧 outline：只保留层级标题、当前定位和跳转，不承载过多操作。
- 抽屉可增加 pinned 状态，避免用户在频繁查看文件/历史时反复开关。

### 6.6 终端 Dock

当前优点：

- 终端作为底部 Dock 与 Agent 绑定，符合开发者工作流。
- 主题变量独立，说明已经具备局部 theme token 思路。

建议优化：

- 终端 tab 栏建议与主应用 tab 样式统一，仅终端内容区保留强主题。
- 终端 Dock 折叠态可展示一行摘要：当前 shell、tab 数、最近命令状态。
- 与 Composer 同处底部时，应明确上下边界，避免两个底部操作区竞争注意力。
- 终端主题选择属于低频操作，可移入更多菜单，减少常驻 Header 控件。

### 6.7 配置与设置弹窗

当前优点：

- 配置管理和设置已经拆分，功能边界清晰。
- `config-primary-tabs` + `config-tabs` 能承载复杂配置结构。

建议优化：

- `ConfigModal` 和 `SettingsModal` 都是 `900px` 宽，可统一为同一 modal shell：Header、Tabs、Content、Footer。
- 一级 tab 建议放左侧 sidebar，二级内容在右侧，这比顶部双 tab 更适合配置项较多的桌面端。
- 表单控件、按钮、提示、错误状态需要统一尺寸：输入框高 `36px`，按钮高 `32px/36px`，说明文字 `12px`。
- 危险操作区应独立成 danger zone，避免与常规设置混排。

### 6.8 环境检测与空状态

当前优点：

- 环境检测流程信息充分，对用户定位问题有帮助。
- 空状态已有 Logo 和提示，具备引导基础。

建议优化：

- 环境检测建议改为 stepper：检测 pi → 检测路径 → 检测权限 → 完成 / 修复。
- 成功、警告、错误卡片使用统一状态图标和语义色，不再依赖不同卡片样式。
- 空状态建议提供更明确的首要行动：选择项目、新建 Agent、导入 Codex 会话、打开设置。

## 7. 借鉴 Codex 桌面端的布局方向

可借鉴的不是单纯“长得像”，而是 Codex 类桌面 Agent 工具的工作流组织方式：

1. **左侧轻导航，中央强阅读**：侧栏只保留项目、会话、状态；中央消息流和输入区是绝对主角。
2. **底部 Composer 卡片化**：输入区像命令中心，视觉上独立于消息流，承载模型、上下文、附件、发送等动作。
3. **工具调用卡片统一**：工具输出不要散落为多种视觉样式，而是统一为状态卡片，可折叠、可复制、可展开。
4. **右侧上下文面板**：文件、会话、大纲、运行日志作为可切换 Inspector，而不是多个相互独立的抽屉体验。
5. **少色彩，多层级**：主界面以中性灰白为主，通过边框、留白、阴影和一枚 accent 色表达层级。
6. **命令入口统一**：命令、模型、思考级别、分支、会话切换都可以使用一致的 command palette / picker 交互语言。

### 推荐新版布局草案

```text
┌──────────────────────────────────────────────────────────────┐
│  Project Rail  │ Conversation                         │ Inspector │
│                │ ┌─ Header: title / branch / status ─┐│           │
│ Projects       │ ├─ Timeline: centered 760-820px ────┤│ Files     │
│ Agents         │ │ Messages / tool cards / code       ││ Sessions  │
│ Sessions       │ ├─ Composer Card ───────────────────┤│ Outline   │
│                │ │ Context chips + prompt + actions   ││ Logs      │
│                │ └─ Terminal Dock / collapsible ─────┘│           │
└──────────────────────────────────────────────────────────────┘
```

### 推荐视觉语气

- **整体**：安静、专业、偏暖的开发者工具，不做强品牌大色块。
- **信息层级**：通过字号、字重、留白和边框表达；颜色只做状态与强调。
- **交互反馈**：hover 轻微背景，active 使用 accent bar，focus 使用低透明度 accent ring。
- **卡片风格**：少阴影、多边框；大型弹窗使用轻阴影建立层级。

## 8. 可执行改版路线

### 第一阶段：建立设计 token

- 在 `styles.css` 顶部补充语义变量：背景、文本、边框、accent、状态色、字号、间距、圆角、阴影。
- 将高频硬编码颜色替换为 token，优先处理 `chat-list-pane`、`chat-pane`、`chat-header`、`composer`、`config-modal`。
- 收敛字号：先统一 `10.5px/11.5px/12.5px`，再统一按钮、tab、meta 的字号。

### 第二阶段：统一主工作台视觉

- 左侧栏改中性背景，active 状态改为 accent bar + soft background。
- Header 操作区重新分组，减少同级按钮数量。
- Composer 改为卡片化命令中心，提高输入焦点。
- 工具调用和代码块统一卡片样式。

### 第三阶段：统一弹窗与抽屉

- 抽象 modal shell 的视觉规范，不一定要先抽组件，但 CSS class 应一致。
- 配置和设置改为统一的“左侧导航 + 右侧内容”结构。
- 文件、会话、历史、大纲共享列表行规范。

### 第四阶段：打磨流程

- 环境检测改 stepper，降低首次启动焦虑。
- 空状态提供明确行动按钮。
- 终端 Dock 默认更克制，减少与 Composer 的视觉竞争。

## 9. 建议优先级

| 优先级 | 任务 | 收益 | 风险 |
| --- | --- | --- | --- |
| P0 | 建立 CSS token 并替换主色、文本色、边框色 | 后续统一设计的基础 | 低 |
| P0 | 收敛字号和圆角体系 | 立即提升一致性 | 低 |
| P1 | 左侧栏改中性背景 + active bar | 统一整体风格 | 中 |
| P1 | Composer 卡片化 | 明显提升核心输入体验 | 中 |
| P1 | 工具调用卡片统一 | 提升 Agent 工作流可读性 | 中 |
| P2 | 设置 / 配置弹窗布局统一 | 管理复杂配置更清晰 | 中 |
| P2 | 右侧 Inspector 统一 | 提升文件/会话/大纲使用效率 | 中 |
| P3 | 环境检测 stepper | 改善首次启动体验 | 中 |

## 10. 建议先落地的 token 示例

```css
:root {
  --bg-window: #f3f4f1;
  --bg-sidebar: #f7f7f3;
  --bg-panel: #ffffff;
  --bg-panel-muted: #f8f8f5;
  --border-subtle: #e5e5df;
  --border-strong: #d7d7cf;

  --text-primary: #202124;
  --text-secondary: #5f6368;
  --text-tertiary: #8b8f94;

  --accent: #238636;
  --accent-soft: #e9f6ed;
  --danger: #b42318;
  --warning: #b7791f;
  --info: #2563eb;

  --font-xs: 11px;
  --font-sm: 12px;
  --font-md: 13px;
  --font-body: 14px;
  --font-title: 16px;
  --font-heading: 20px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-pill: 999px;

  --shadow-popover: 0 12px 32px rgba(20, 24, 31, 0.12);
  --shadow-modal: 0 24px 80px rgba(20, 24, 31, 0.22);
}
```

## 11. 公共设计系统标准

这一章建议作为后续 UI 重构的公共标准。目标是先统一“基础 token + 组件规格 + 状态表达”，再逐步替换各页面中的散落样式，避免每个区域单独定义字号、颜色、按钮和表单尺寸。

### 11.1 文字层级

建议全局只保留 6 个文字层级，避免当前 `10px`、`10.5px`、`11px`、`11.5px`、`12px`、`12.5px`、`13px` 混用。

| 层级 | Token | 字号 / 行高 | 字重 | 使用场景 |
| --- | --- | --- | --- | --- |
| 页面标题 | `--text-page-title` | `20px / 28px` | `650` | 设置页标题、空状态主标题、重要弹窗标题 |
| 区块标题 | `--text-section-title` | `16px / 24px` | `650` | Header 标题、右侧抽屉标题、配置分组标题 |
| 卡片标题 | `--text-card-title` | `14px / 22px` | `600` | 项目名、Agent 名、设置项标题、工具调用标题 |
| 正文 | `--text-body` | `14px / 22px` | `400` | 消息正文、说明段落、输入框内容 |
| 控件文字 | `--text-control` | `13px / 20px` | `500` | 按钮、tab、下拉项、列表主文本 |
| 辅助文字 | `--text-caption` | `12px / 18px` | `400` | 时间、状态、提示、表单说明、列表 meta |
| 微型标记 | `--text-micro` | `11px / 16px` | `600` | badge、短状态、计数，不承载长句 |

文字使用规则：

- 消息正文和输入框统一使用 `14px`，保证长时间阅读舒适。
- 按钮、tab、列表项统一使用 `13px`，避免操作区显得过重。
- 说明、提示、错误原因统一使用 `12px`，但不要低于 `12px` 写长文本。
- `11px` 只用于 badge、状态点旁短标签、数量提示。
- 标题字重建议使用 `600/650`，避免大面积 `700` 带来的粗重感。

### 11.2 颜色与主题色

建议建立语义色，而不是继续在组件中直接写具体色值。这样后续做暗色主题、暖灰主题或品牌色替换时成本更低。

| 类型 | Token | 建议值 | 使用场景 |
| --- | --- | --- | --- |
| 窗口背景 | `--color-bg-app` | `#f3f4f1` | 应用最底层背景 |
| 侧栏背景 | `--color-bg-sidebar` | `#f7f7f3` | 左侧项目 / Agent 列表 |
| 面板背景 | `--color-bg-panel` | `#ffffff` | 卡片、弹窗、输入框、抽屉 |
| 次级背景 | `--color-bg-muted` | `#f8f8f5` | Header、hover、弱分组区域 |
| 悬停背景 | `--color-bg-hover` | `#f0f1ed` | 列表行、按钮 hover |
| 激活背景 | `--color-bg-active` | `#e9f6ed` | 选中 Agent、active tab、轻提示 |
| 主文本 | `--color-text-primary` | `#202124` | 标题、正文 |
| 次文本 | `--color-text-secondary` | `#5f6368` | 列表 meta、说明、弱标题 |
| 弱文本 | `--color-text-tertiary` | `#8b8f94` | placeholder、时间、禁用说明 |
| 反色文本 | `--color-text-inverse` | `#ffffff` | 主按钮、深色状态标签 |
| 弱边框 | `--color-border-subtle` | `#e5e5df` | 卡片、输入框、分割线 |
| 强边框 | `--color-border-strong` | `#d7d7cf` | 拖拽分割线、激活边界 |
| 主题色 | `--color-accent` | `#238636` | 主按钮、active、链接强调 |
| 主题浅色 | `--color-accent-soft` | `#e9f6ed` | active 背景、成功轻提示 |
| 危险色 | `--color-danger` | `#b42318` | 删除、错误、停止 |
| 危险浅色 | `--color-danger-soft` | `#fdecea` | 错误背景、危险提示 |
| 警告色 | `--color-warning` | `#b7791f` | 环境警告、配置缺失 |
| 信息色 | `--color-info` | `#2563eb` | 链接、外部跳转、信息提示 |

主题色使用规则：

- 主界面不要大面积铺主题色，主题色只用于“选中、主行动、关键状态”。
- 左侧栏建议从当前青蓝改为中性暖灰，避免和绿色主题色冲突。
- 成功状态可以使用主题绿色，但“主按钮”和“成功提示”需要通过背景深浅区分。
- 删除、停止、错误统一使用危险色，不再混用多套红色。
- 链接和外部跳转可以保留蓝色，但不参与主品牌表达。

### 11.3 间距与栅格

建议采用 4px 栅格，所有组件尺寸和间距尽量落在 4 的倍数上。

| Token | 值 | 使用场景 |
| --- | --- | --- |
| `--space-1` | `4px` | 图标与文字、紧凑元素 |
| `--space-2` | `8px` | 小按钮间距、badge 内距、列表内部 gap |
| `--space-3` | `12px` | 控件组间距、列表项横向 padding |
| `--space-4` | `16px` | 卡片内距、面板默认 padding |
| `--space-5` | `20px` | Header 左右 padding、弹窗小节间距 |
| `--space-6` | `24px` | 页面级区域间距、弹窗内容 padding |
| `--space-8` | `32px` | 大空状态、页面主分区间距 |

区域建议：

- 左侧列表行高：`36px` 常规，`44px` 带描述信息。
- Header 高度：保持 `72px-78px`，内部操作组间距使用 `8px/12px`。
- 消息流左右 padding：`clamp(16px, 3vw, 36px)` 可保留。
- 弹窗内容 padding：统一 `24px`，复杂配置页可内部使用 `16px` 卡片 padding。
- 表单项纵向间距：同组 `12px`，不同组 `20px/24px`。

### 11.4 圆角、边框与阴影

| Token | 值 | 使用场景 |
| --- | --- | --- |
| `--radius-xs` | `6px` | 小 badge、微型按钮 |
| `--radius-sm` | `8px` | 输入框、普通按钮、下拉触发器 |
| `--radius-md` | `10px` | 列表项、工具调用行、轻卡片 |
| `--radius-lg` | `14px` | 消息卡片、设置卡片、popover |
| `--radius-xl` | `18px` | 弹窗、Composer 大卡片 |
| `--radius-pill` | `999px` | 胶囊按钮、状态标签 |

阴影建议：

| Token | 值 | 使用场景 |
| --- | --- | --- |
| `--shadow-border` | `0 0 0 1px var(--color-border-subtle)` | 替代部分实体 border，保持轻盈 |
| `--shadow-popover` | `0 12px 32px rgba(20, 24, 31, 0.12)` | 下拉、菜单、picker |
| `--shadow-modal` | `0 24px 80px rgba(20, 24, 31, 0.22)` | 大弹窗 |
| `--shadow-composer` | `0 8px 28px rgba(20, 24, 31, 0.08)` | 输入区卡片 |

规则：

- 常规卡片优先用边框，不用重阴影。
- Popover 和 Modal 才使用明显阴影。
- 同一层级不要同时使用强边框和强阴影。

### 11.5 按钮标准

建议定义 4 种尺寸、5 种语义。

#### 按钮尺寸

| 尺寸 | 高度 | 横向 padding | 字号 | 图标 |
| --- | --- | --- | --- | --- |
| `button-xs` | `24px` | `8px` | `12px` | `14px` |
| `button-sm` | `28px` | `10px` | `12px` | `14px` |
| `button-md` | `32px` | `12px` | `13px` | `16px` |
| `button-lg` | `36px` | `16px` | `14px` | `18px` |

#### 按钮语义

| 类型 | 样式 | 使用场景 |
| --- | --- | --- |
| `primary` | 主题色背景 + 白字 | 发送、新建 Agent、保存配置、确认主动作 |
| `secondary` | 白底 + 边框 + 主文本 | 普通操作、打开面板、次级确认 |
| `ghost` | 透明背景 + 次文本，hover 有背景 | Header 图标按钮、列表内低频操作 |
| `danger` | 危险色或危险浅背景 | 删除、停止、清空、关闭终端 |
| `link` | 无边框，信息色文本 | 外部链接、文档、辅助跳转 |

按钮规则：

- 一个区域只保留一个 `primary` 主按钮。
- Header 工具按钮默认用 `ghost`，避免顶部过重。
- 列表行内操作建议用 `ghost button-xs`，并在 hover 时显示。
- 弹窗底部主按钮使用 `button-md` 或 `button-lg`，危险确认必须使用 `danger`。

### 11.6 输入框、文本域与选择器

#### 输入框

| 组件 | 高度 | 字号 | 圆角 | padding | 使用场景 |
| --- | --- | --- | --- | --- | --- |
| 普通输入框 | `36px` | `14px` | `8px` | `0 12px` | 设置、搜索、路径输入 |
| 紧凑输入框 | `32px` | `13px` | `8px` | `0 10px` | 工具栏、筛选、小表单 |
| 搜索框 | `34px` | `13px` | `999px` | `0 12px` | 左侧搜索、面板搜索 |
| Composer 文本域 | `min 92px` | `14px` | `14px/18px` | `14px 16px` | 主 prompt 输入 |

状态规则：

- 默认：白底 + `--color-border-subtle`。
- Hover：边框加深到 `--color-border-strong`。
- Focus：`0 0 0 3px rgba(35, 134, 54, 0.14)`，边框主题色。
- Error：危险色边框 + 危险浅背景，可附 `12px` 错误说明。
- Disabled：弱背景 + 弱文本，鼠标不可交互。

#### 下拉 / Picker

| 组件 | 建议规格 |
| --- | --- |
| Trigger 高度 | `32px` 常规，`28px` 紧凑 |
| Trigger 字号 | `13px` |
| Trigger 圆角 | `8px` 或 `999px`，按使用场景决定 |
| Menu 宽度 | 不小于 trigger，常规 `220px-320px` |
| Menu padding | `6px` |
| Option 高度 | `32px` 单行，`44px` 带描述 |
| Option 字号 | 主文本 `13px`，描述 `12px` |
| 阴影 | `--shadow-popover` |

下拉规则：

- 模型、思考级别、分支、发送行为都应使用同一 picker 结构。
- 选中项使用左侧 check 或右侧 check，整套应用保持一致。
- 带搜索的 picker 使用统一头部：搜索框 + 关闭按钮 + 列表。
- 长列表需要固定最大高度并内部滚动，避免撑高弹窗。

### 11.7 Tab、Badge 与列表项

#### Tab

| 类型 | 高度 | 字号 | 使用场景 |
| --- | --- | --- | --- |
| `tabs-line` | `40px` | `13px` | 配置二级 tab、设置页横向 tab |
| `tabs-pill` | `32px` | `13px` | 小范围视图切换、过滤器 |
| `tabs-sidebar` | `36px` | `13px` | 设置 / 配置左侧导航 |

Tab 规则：

- 顶部双层 tab 不宜过多使用；复杂配置建议改成左侧 `tabs-sidebar`。
- Active tab 使用主题色文字或左侧 accent bar，不建议同时使用强背景和强下划线。

#### Badge

| 类型 | 字号 | 高度 | 用途 |
| --- | --- | --- | --- |
| `badge-neutral` | `11px` | `20px` | 普通状态、数量 |
| `badge-success` | `11px` | `20px` | 已连接、完成 |
| `badge-warning` | `11px` | `20px` | 需要配置、待处理 |
| `badge-danger` | `11px` | `20px` | 错误、失败 |
| `badge-info` | `11px` | `20px` | beta、导入、外部信息 |

#### 列表项

| 类型 | 高度 | padding | 用途 |
| --- | --- | --- | --- |
| `list-item-compact` | `32px` | `0 8px` | 命令、短选项 |
| `list-item-default` | `36px` | `0 10px` | Agent、文件、会话单行 |
| `list-item-rich` | `48px` | `8px 10px` | 带标题、描述、状态的项目 |

列表规则：

- Active：左侧 `3px` accent bar + `--color-bg-active`。
- Hover：`--color-bg-hover`，不改变布局尺寸。
- 行内操作按钮固定占位或进入更多菜单，避免 hover 后文本跳动。

### 11.8 卡片、消息与工具调用

#### 卡片标准

| 类型 | 背景 | 边框 | 圆角 | padding |
| --- | --- | --- | --- | --- |
| 普通卡片 | `--color-bg-panel` | `--color-border-subtle` | `14px` | `16px` |
| 轻卡片 | `--color-bg-muted` | transparent | `10px` | `12px` |
| 状态卡片 | 状态浅色 | 状态边框 | `12px` | `12px/16px` |

#### 消息标准

- Assistant 消息：白底或透明，正文 `14px / 22px`，最大宽度 `780px-820px`。
- User 消息：可右对齐或轻强调背景，避免过深主题色影响阅读。
- System / Error 消息：使用状态卡片，不混入普通正文样式。
- Thinking 消息：默认折叠摘要，展开后使用弱背景。

#### 工具调用标准

工具调用建议统一为 `ToolCard`：

```text
┌────────────────────────────────────┐
│ icon  tool name        status time  │
│ summary / file / command preview    │
│ expanded detail / output / actions  │
└────────────────────────────────────┘
```

规格：

- Header 高度：`36px`。
- 标题字号：`13px / 20px`，字重 `600`。
- 摘要字号：`12px / 18px`。
- 状态 badge：`20px` 高。
- 默认折叠，错误状态自动展开或突出错误摘要。

### 11.9 公共组件建议

建议逐步沉淀以下公共组件，先统一 class 和 token，再决定是否抽 React 组件。

| 组件 | 建议名称 | 用途 |
| --- | --- | --- |
| 按钮 | `Button` | primary / secondary / ghost / danger / link |
| 图标按钮 | `IconButton` | Header、列表、卡片动作 |
| 输入框 | `TextInput` | 设置、搜索、路径、过滤 |
| 文本域 | `TextArea` | Composer、反馈、长文本配置 |
| 下拉 | `Select` / `Dropdown` | 发送策略、主题、简单枚举 |
| Picker | `CommandPicker` | 模型、分支、思考级别、命令选择 |
| Tab | `Tabs` | line / pill / sidebar |
| Badge | `Badge` | 状态、计数、类型 |
| 卡片 | `Card` | 设置区块、环境检测、工具调用 |
| 弹窗壳 | `ModalShell` | 配置、设置、反馈、更新 |
| 抽屉壳 | `InspectorPanel` | 文件、会话、大纲、日志 |
| 列表行 | `ListItem` | 项目、Agent、文件、会话、命令 |
| 工具卡片 | `ToolCard` | tool call 展示和展开 |
| 空状态 | `EmptyState` | 无项目、无会话、无文件、无结果 |

组件落地顺序建议：

1. `Button`、`IconButton`、`TextInput`、`Badge`：覆盖面最大，最容易提升统一性。
2. `ModalShell`、`Tabs`、`Card`：统一配置、设置、环境检测弹窗。
3. `ListItem`、`InspectorPanel`：统一侧栏、文件、会话、历史。
4. `Picker`、`ToolCard`、`EmptyState`：提升核心 Agent 工作流体验。

### 11.10 多语言与文案适配

多语言需要在设计阶段就作为硬约束，而不是翻译完成后再修补布局。中文、英文、日文、韩文、德文、俄文等语言在文本长度、换行、字重观感和控件宽度上差异很大，公共组件必须默认支持文本扩展。

#### 文本长度预留

| 场景 | 设计规则 | 原因 |
| --- | --- | --- |
| 按钮 | 按中文长度预留 `1.6x-2x` 宽度，不固定死宽 | 英文、德文、俄文常比中文长很多 |
| Tab | 优先允许自适应宽度；空间不足时改为横向滚动或 sidebar | 顶部 tab 最容易因翻译变长挤压 |
| 表单 label | 不把 label 和 input 强绑定在同一窄行；窄屏改为上下布局 | 多语言 label 容易换行导致输入框不齐 |
| 列表项标题 | 单行省略，但必须提供 tooltip 或 title | 项目名、模型名、命令名不可被完全隐藏 |
| 描述说明 | 允许自然换行，行高使用 `18px/20px/22px` | 说明文字比按钮更需要完整可读 |
| 弹窗标题 | 允许最多两行，Header 高度自适应 | 某些语言标题会显著变长 |

#### 组件宽度策略

| 组件 | 建议最小宽度 | 多语言策略 |
| --- | --- | --- |
| 普通按钮 | `min-width: 72px` | 文案变长时横向增长，不压缩文字 |
| 主按钮 | `min-width: 88px` | 保证主要动作稳定可见 |
| 图标按钮 | `32px` 正方形 | 仅图标按钮必须有 `aria-label` 和 tooltip |
| Select trigger | `min-width: 140px` | 长值使用中间或尾部省略 |
| Picker menu | `min-width: 260px` | 选项描述允许换行，主标题单行省略 |
| Sidebar tab | `min-width: 160px` | 长文案使用两列布局或 tooltip |
| Modal | `min(94vw, 900px)` | 小屏和长语言下避免溢出窗口 |

#### 换行与省略规则

- 操作按钮：默认不换行，空间不足时使用 `min-width` + 横向增长；极窄区域改为图标按钮。
- Tab 文案：不建议省略核心 tab；如果必须省略，需要 tooltip 展示完整翻译。
- 表单说明、错误信息、环境检测提示：必须允许换行，不能只用省略号。
- 模型名、分支名、文件路径：允许中间省略或尾部省略，并提供完整 title。
- 空状态说明：允许多行，最大宽度控制在 `420px-520px`，保证阅读舒适。

#### 字体与语言兼容

当前字体栈对中英文和 Windows/macOS 兼容较好，建议进一步明确语言 fallback：

```css
--font-family-base:
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  "Inter",
  "Microsoft YaHei",
  "PingFang SC",
  "Hiragino Sans GB",
  "Noto Sans CJK SC",
  sans-serif;
```

规则：

- 不同语言不要单独调整字号，优先用统一字号体系保证一致性。
- CJK 字体在 `13px` 以下容易发糊，长说明不要低于 `12px`。
- 英文全大写标签应谨慎使用，翻译到其他语言后长度和语气都不稳定。
- 图标不能单独表达含义，必须搭配可翻译的 tooltip 或 `aria-label`。

#### 文案设计规则

- 所有可见文案都应通过 i18n key 管理，不在 JSX 中散落硬编码。
- i18n key 使用语义命名，例如 `settings.proxy.title`，不要使用中文或英文原文当 key。
- 避免拼接句子，例如 `"删除 " + name`；不同语言语序不同，应使用插值：`t("agent.deleteConfirm", { name })`。
- 复数、数量、时间、日期、相对时间必须走国际化格式化，不手写字符串。
- 按钮文案尽量短：中文 2-5 字，英文 1-3 个词；复杂解释放到说明文本或 tooltip。
- 错误提示要能独立理解，不依赖上下文位置。

#### 布局实现规则

- 组件容器默认使用 `min-width: 0`，文本节点使用 `overflow-wrap: anywhere` 或指定省略策略，避免 flex/grid 撑破布局。
- Header、工具栏、按钮组使用 `flex-wrap` 或 responsive overflow，不要假设所有语言都能单行放下。
- 弹窗 Footer 的按钮组在空间不足时可换行或纵向排列，主按钮仍放在视觉末尾。
- 左侧栏宽度建议允许用户调整，并设置合理范围，例如 `260px-360px`，以适配长项目名和多语言。
- 配置页建议优先使用左侧 sidebar 导航，因为它比顶部多 tab 更能承载长翻译。

#### 推荐支持语言

建议按阶段支持多语言，不要一次性铺太多语言导致维护压力过高。

| 阶段 | 语言 | 原因 |
| --- | --- | --- |
| 第一阶段 | `zh-CN`、`en-US` | 当前主要文案为中文，英文是开源项目和开发者工具的基础语言 |
| 第二阶段 | `ja-JP`、`ko-KR` | 与中文同属 CJK 场景，可验证字体、行高、紧凑布局适配 |
| 第三阶段 | `de-DE`、`fr-FR`、`ru-RU` | 文案更长，可验证按钮、tab、弹窗和表单布局的弹性 |

语言选择建议放在设置页“界面”分组中：

- 默认跟随系统语言。
- 支持手动选择语言。
- 切换后即时生效，必要时提示重启仅用于主进程菜单或系统级文案。
- 语言名称使用本地语言显示，例如 `简体中文`、`English`、`日本語`。

#### i18n 文件结构建议

建议在 renderer 层建立独立语言资源目录，先覆盖 UI 文案，再逐步扩展到主进程菜单、通知和错误提示。

```text
src/renderer/src/i18n/
├─ index.ts
├─ types.ts
├─ locales/
│  ├─ zh-CN.ts
│  ├─ en-US.ts
│  ├─ ja-JP.ts
│  └─ pseudo.ts
└─ namespaces/
   ├─ common.ts
   ├─ app.ts
   ├─ settings.ts
   ├─ config.ts
   ├─ terminal.ts
   └─ errors.ts
```

命名空间建议：

| namespace | 覆盖范围 |
| --- | --- |
| `common` | 通用按钮、状态、确认、取消、保存、删除、加载中 |
| `app` | 主工作台、侧栏、会话、Agent、Composer |
| `settings` | 设置弹窗、界面、代理、开发者选项 |
| `config` | provider、model、auth、skills、extensions |
| `terminal` | 终端 Dock、tab、主题、关闭确认 |
| `errors` | 环境检测、IPC、文件、Git、Agent 错误 |

#### 文案 key 规范

| 类型 | 示例 | 说明 |
| --- | --- | --- |
| 页面标题 | `settings.title` | 页面或弹窗主标题 |
| 区块标题 | `settings.proxy.title` | 设置分组、卡片标题 |
| 操作按钮 | `common.actions.save` | 可复用动作 |
| 状态 | `agent.status.running` | 状态枚举 |
| 确认文案 | `agent.confirmDelete.message` | 允许插值，不拼接字符串 |
| 错误 | `errors.piNotFound.title` | 错误标题和说明拆分 |

规则：

- 不使用中文或英文原文作为 key，避免文案修改导致 key 失效。
- 同一含义使用同一个 key，例如所有“取消”都用 `common.actions.cancel`。
- 带变量的文案使用完整句子插值：`t("agent.confirmDelete.message", { name })`。
- 不在组件中拼接单位、数量、标点和后缀，全部交给翻译资源。

#### 组件 API 对多语言的要求

公共组件设计时应默认接收 ReactNode 或翻译 key，不能把固定中文写死在组件内部。

| 组件 | 多语言 API 建议 |
| --- | --- |
| `Button` | `children` 接收翻译结果；支持长文案自动扩展 |
| `IconButton` | 必须传 `ariaLabel` 和可选 `tooltip` |
| `TextInput` | `label`、`placeholder`、`description`、`error` 都从外部传入 |
| `Select` | option 使用 `{ label, description?, value }`，label 不等于 value |
| `ModalShell` | `title` 允许两行，`description` 可选且可换行 |
| `Tabs` | 支持长 label、tooltip、sidebar 模式 |
| `EmptyState` | `title`、`description`、`primaryAction` 全部可翻译 |
| `ToolCard` | 工具名可保留原始命令，状态和说明必须可翻译 |

#### 伪翻译测试

建议新增 `pseudo` 语言用于 UI 压力测试，不需要真实翻译也能提前发现布局问题。

伪翻译规则：

- 文案长度扩展 `30%-50%`。
- 给文本加边界标记，例如 `[!! Save settings expanded !!]`。
- 保留变量占位符，确保插值不丢失。
- 不处理文件路径、模型名、命令名等用户数据。

验收方式：

- 在开发环境设置语言为 `pseudo`。
- 检查主工作台、配置弹窗、设置弹窗、环境检测、终端 Dock。
- 所有按钮可点击，Tab 不遮挡，表单不溢出，弹窗不超出窗口。

#### 多语言落地路线

| 阶段 | 任务 | 验收标准 |
| --- | --- | --- |
| P0 | 建立 i18n 基础设施和语言设置项 | 可在 `zh-CN` / `en-US` / `pseudo` 间切换 |
| P0 | 抽离 common、app、settings 高频文案 | 主工作台和设置页无硬编码主要中文 |
| P1 | 抽离 config、terminal、errors 文案 | 配置弹窗、终端、环境错误可翻译 |
| P1 | 公共组件支持长文案和 tooltip | 伪翻译下无布局破裂 |
| P2 | 补充 `ja-JP` / `ko-KR` | CJK 字体、行高、换行通过验收 |
| P3 | 补充欧洲语言 | 长文案语言下核心流程可用 |

#### 多语言验收清单

| 检查项 | 通过标准 |
| --- | --- |
| 中文 | 默认语言下无拥挤、无截断关键信息 |
| 英文 | 按钮、tab、表单 label 不溢出 |
| 伪翻译 | 文案扩展 `30%-50%` 后核心流程仍可操作 |
| 德文 / 俄文 | 长文案下 Header、弹窗、设置页不撑破 |
| 日文 / 韩文 | 字体渲染清晰，行高不拥挤 |
| 文件路径 / 模型名 | 长字符串可省略且能查看完整内容 |
| 小窗口 | `1280px` 宽度下核心流程仍可完成 |
| 缩放 | 系统 `125%/150%` 缩放下文字和按钮不重叠 |

### 11.11 推荐 CSS token 结构

建议把 token 放在 `styles.css` 顶部，并按语义分组。后续所有组件优先引用 token，不再直接写硬编码颜色和字号。

```css
:root {
  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
  --font-size-micro: 11px;
  --font-size-caption: 12px;
  --font-size-control: 13px;
  --font-size-body: 14px;
  --font-size-title: 16px;
  --font-size-heading: 20px;
  --line-height-micro: 16px;
  --line-height-caption: 18px;
  --line-height-control: 20px;
  --line-height-body: 22px;
  --line-height-title: 24px;
  --line-height-heading: 28px;

  /* Color */
  --color-bg-app: #f3f4f1;
  --color-bg-sidebar: #f7f7f3;
  --color-bg-panel: #ffffff;
  --color-bg-muted: #f8f8f5;
  --color-bg-hover: #f0f1ed;
  --color-bg-active: #e9f6ed;
  --color-text-primary: #202124;
  --color-text-secondary: #5f6368;
  --color-text-tertiary: #8b8f94;
  --color-text-inverse: #ffffff;
  --color-border-subtle: #e5e5df;
  --color-border-strong: #d7d7cf;
  --color-accent: #238636;
  --color-accent-soft: #e9f6ed;
  --color-danger: #b42318;
  --color-danger-soft: #fdecea;
  --color-warning: #b7791f;
  --color-info: #2563eb;

  /* Layout */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Shape */
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 18px;
  --radius-pill: 999px;

  /* Component size */
  --control-height-xs: 24px;
  --control-height-sm: 28px;
  --control-height-md: 32px;
  --control-height-lg: 36px;
  --list-item-compact: 32px;
  --list-item-default: 36px;
  --list-item-rich: 48px;

  /* Shadow */
  --shadow-popover: 0 12px 32px rgba(20, 24, 31, 0.12);
  --shadow-modal: 0 24px 80px rgba(20, 24, 31, 0.22);
  --shadow-composer: 0 8px 28px rgba(20, 24, 31, 0.08);
}
```

## 12. 总结

当前 pi-desktop 的功能布局已经具备成熟桌面 Agent 工作台雏形：左侧多项目管理、中央对话、右侧上下文抽屉、底部终端 Dock 都是合理方向。下一版 UI 优化的关键不是大改信息架构，而是先建立公共设计系统：统一字体层级、语义配色、间距栅格、按钮尺寸、输入与下拉规范、卡片与列表标准，再把这些标准沉淀为可复用 class 或组件。这样后续无论优化主工作台、配置页、设置页还是终端 Dock，都能保持一致的视觉语言和交互节奏。
