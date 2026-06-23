export type Project = {
	id: string;
	name: string;
	path: string;
	lastOpenedAt: number;
	pinned?: boolean;
	sortOrder: number;
	kind?: "chat";
};

export type AgentStatus = "starting" | "idle" | "running" | "error" | "closed";

export type AgentTab = {
	id: string;
	projectId: string;
	cwd: string;
	title: string;
	status: AgentStatus;
	sessionId?: string;
	sessionPath?: string;
	createdAt: number;
};

export type TerminalShell = "pwsh" | "powershell" | "cmd" | "zsh" | "bash" | "fish" | "sh";

export type TerminalTab = {
	id: string;
	agentId: string;
	title: string;
	cwd: string;
	shell: TerminalShell;
	createdAt: number;
	exited?: boolean;
	exitCode?: number;
	buffer?: string;
};

export type TerminalDataEvent = {
	tabId: string;
	data: string;
};

export type TerminalExitEvent = {
	tabId: string;
	exitCode?: number;
};

export type ChatRole = "user" | "assistant" | "tool" | "system" | "error";

export type ChatMessage = {
	id: string;
	agentId: string;
	role: ChatRole;
	text: string;
	timestamp: number;
	meta?: Record<string, unknown>;
	images?: ComposerImage[]; // 用户消息中附加的图片
	/** 思考内容：来自 thinking 内容块，用于展示模型推理过程 */
	thinking?: string;
};

/**
 * 高频消息流只推送单条 upsert patch，避免每个 delta 都复制整份消息数组到 renderer。
 * renderer 仍保留全量 agents:message 作为初始同步/整会话替换的兜底通道。
 */
export type AgentMessagePatch = {
	agentId: string;
	message: ChatMessage;
	op?: "upsert" | "remove";
};

export type FileTreeNode = {
	name: string;
	path: string;
	relativePath: string;
	type: "file" | "directory";
	children?: FileTreeNode[];
};

export type SessionSummary = {
	id: string;
	filePath: string;
	projectPath?: string;
	name?: string;
	preview: string;
	updatedAt: number;
	messageCount: number;
	pinned?: boolean;
	pinnedAt?: number;
};

export type CodexImportStatus = "new" | "current" | "outdated";

export type CodexSessionSummary = {
	id: string;
	sourcePath: string;
	targetPath: string;
	cwd: string;
	title: string;
	preview: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	status: CodexImportStatus;
	sourceSize: number;
	importedSourceMtime?: number;
};

export type CodexImportResult = {
	id: string;
	sourcePath: string;
	targetPath?: string;
	title?: string;
	success: boolean;
	overwritten?: boolean;
	messageCount?: number;
	error?: string;
};

export type CodexImportReport = {
	results: CodexImportResult[];
	imported: number;
	failed: number;
};

export type ClaudeImportStatus = "new" | "current" | "outdated";

export type ClaudeSessionSummary = {
	id: string;
	sourcePath: string;
	targetPath: string;
	cwd: string;
	title: string;
	preview: string;
	createdAt: number;
	updatedAt: number;
	messageCount: number;
	status: ClaudeImportStatus;
	sourceSize: number;
	importedSourceMtime?: number;
};

export type ClaudeImportResult = {
	id: string;
	sourcePath: string;
	targetPath?: string;
	title?: string;
	success: boolean;
	overwritten?: boolean;
	messageCount?: number;
	error?: string;
};

export type ClaudeImportReport = {
	results: ClaudeImportResult[];
	imported: number;
	failed: number;
};

export type PiCommand = {
	name: string;
	description?: string;
	source?: string;
};

export type AgentRuntimeState = {
	modelName?: string;
	provider?: string;
	modelId?: string;
	thinkingLevel?: string;
	isStreaming?: boolean;
	isCompacting?: boolean;
	contextTokens?: number | null;
	contextWindow?: number | null;
	contextPercent?: number | null;
	cacheRead?: number;
	cacheWrite?: number;
	cacheTotal?: number;
	cost?: number;
};

export type AvailableModel = {
	id: string;
	name?: string;
	provider: string;
	contextWindow?: number;
	reasoning?: boolean;
};

export type SendShortcutMode =
	| "enter-send"
	| "ctrl-enter-send"
	| "shift-enter-send";

/** 可持久化的窗口位置和尺寸（非最大化状态下的常规边界） */
export type AppWindowBounds = {
	x: number;
	y: number;
	width: number;
	height: number;
};

/** 可持久化的窗口状态，用于启动时恢复位置、尺寸和最大化状态 */
export type AppWindowState = {
	bounds?: AppWindowBounds;
	maximized?: boolean;
};

export type AppThemeMode = "system" | "light" | "dark";
export type AppLanguageMode = "system" | "zh-CN" | "en-US" | "pseudo";
export type LinkOpenMode = "external" | "internal";

export type QuickPromptPreset = {
	id: string;
	content: string;
};

export type AppSettings = {
	useNativeTitleBar: boolean;
	showNativeMenu: boolean;
	sendShortcut: SendShortcutMode;
	/** 界面主题，system 跟随系统浅色/暗色偏好 */
	theme: AppThemeMode;
	/** 界面语言，system 跟随系统语言；pseudo 用于长文案布局压力测试 */
	language: AppLanguageMode;
	piEnvironmentChecked: boolean;
	/** 关闭窗口时隐藏到系统托盘而不是退出 */
	closeToTray: boolean;
	/** 会话结束时发送系统通知 */
	enableNotifications: boolean;
	/** 是否在会话中显示模型思考过程，默认开启 */
	showThinking: boolean;
	/** 是否开启开发者控制台（DevTools） */
	showDevTools: boolean;
	/** 是否给 pi agent 子进程注入代理环境变量，不影响 desktop 自身网络请求 */
	piProxyEnabled: boolean;
	/** pi agent 使用的代理地址，例如 http://127.0.0.1:7890 */
	piProxyUrl: string;
	/** pi agent 代理绕过列表，对应 NO_PROXY 环境变量 */
	piProxyBypass: string;
	/** 是否给桌面端自身网络请求启用代理，不影响已启动的 pi agent 子进程 */
	desktopProxyEnabled: boolean;
	/** 桌面端自身网络请求使用的代理地址，例如 http://127.0.0.1:7890 */
	desktopProxyUrl: string;
	/** 桌面端代理绕过列表，对应 Electron proxyBypassRules */
	desktopProxyBypass: string;
	/** 用户手动指定的 pi CLI 命令路径，自动检测不到时用于兜底 */
	customPiPath: string;
	/** 是否发送匿名、低频、最小字段的使用统计 */
	telemetryEnabled: boolean;
	/** 是否开启局域网 Web 服务 */
	webServiceEnabled: boolean;
	/** Web 服务监听地址，默认 0.0.0.0 允许局域网访问 */
	webServiceHost: string;
	/** Web 服务监听端口 */
	webServicePort: number;
	/** 本地生成的匿名安装标识，不包含账号、路径或机器名 */
	telemetryInstallId?: string;
	/** 最近一次发送 app_heartbeat 的本地日期，格式 YYYY-MM-DD */
	telemetryLastHeartbeatDate?: string;
	/** 应用安装类型：portable（便携版）或 installed（安装版），启动时自动检测并持久化 */
	installationType?: "portable" | "installed";
	/** 用户选择跳过的桌面端版本号；仅忽略这一版的更新提示，新版本仍会继续提醒 */
	appUpdateSkippedVersion?: string;
	/** RPC 调用超时时间（毫秒），默认 600000（10 分钟），用于长时间运行的命令 */
	rpcTimeout: number;
	/** 外部链接打开方式：external 使用系统默认浏览器，internal 使用应用内独立窗口 */
	linkOpenMode: LinkOpenMode;
	/** 编辑器最大文件大小（MB），超过此大小的文件不加载编辑器。默认 5MB。 */
	maxEditorFileSizeMB: number;
	/** 上次退出时的窗口位置、尺寸和最大化状态，用于启动时恢复 */
	windowState?: AppWindowState;
};

export type PiInstallStatus = {
	installed: boolean;
	command?: string;
	version?: string;
	searchedDirs: string[];
	error?: string;
};

export type ConfigFileDiagnostic = {
	fileName: string;
	message: string;
	line?: number;
	column?: number;
	snippet?: string;
	docsUrl: string;
};

export type ConfigFileReadResult<T> = {
	raw: string;
	parsed: T;
	diagnostic?: ConfigFileDiagnostic;
};

export type PiSkillLocation = {
	id: "pi-global" | "agents-global";
	label: string;
	path: string;
	rootMarkdownEnabled: boolean;
};

export type PiSkillSummary = {
	id: string;
	name: string;
	description: string;
	remark?: string;
	path: string;
	dir: string;
	sourceId: PiSkillLocation["id"];
	sourceLabel: string;
	type: "directory" | "markdown";
	enabled: boolean;
	valid: boolean;
	warnings: string[];
};

export type PiSkillListResult = {
	locations: PiSkillLocation[];
	skills: PiSkillSummary[];
};

export type CreatePiSkillInput = {
	name: string;
	description: string;
	locationId: PiSkillLocation["id"];
};

export type PiExtensionSummary = {
	id: string;
	source: string;
	remark?: string;
	path?: string;
	scope: "user" | "project" | "unknown";
	enabled: boolean;
};

export type PiPackageInfo = {
	name: string;
	description: string;
	installCmd: string;
	tags: string[];
	downloads: string;
	updated: string;
	npmUrl: string;
	repoUrl?: string;
};

export type PiExtensionListResult = {
	extensions: PiExtensionSummary[];
	raw: string;
};

export type PiPackageUpdateInfo = {
	source: string;
	displayName: string;
	currentVersion?: string;
	latestVersion?: string;
	scope: PiExtensionSummary["scope"];
};

export type PiUpdateNoticeInfo = {
	currentVersion?: string;
	latestVersion?: string;
	hasCoreUpdate: boolean;
	changelogUrl: string;
	packageUpdates: PiPackageUpdateInfo[];
	checkedAt: number;
};

export type PiProxyTestResult = {
	success: boolean;
	url: string;
	elapsedMs: number;
	statusCode?: number;
	message?: string;
	error?: string;
	bypassed?: boolean;
};

export type AppInfo = {
	version: string;
	releasesUrl: string;
};

export type FeedbackEnvironment = {
	appVersion: string;
	platform: NodeJS.Platform;
	arch: string;
	electronVersion: string;
	chromeVersion: string;
	nodeVersion: string;
	pi: PiInstallStatus;
};

export type AppUpdateAsset = {
	name: string;
	url: string;
	size: number;
};

export type AppUpdateInfo = {
	currentVersion: string;
	latestVersion: string;
	hasUpdate: boolean;
	releaseName: string;
	releaseNotes: string;
	releaseUrl: string;
	publishedAt?: string;
	assets: AppUpdateAsset[];
	recommendedAsset?: AppUpdateAsset;
};

export type PiRuntimeEvent = {
	agentId: string;
	event: unknown;
};

export type GitBranchInfo = {
	current: string | null;
	branches: string[];
};

export type CreateAgentInput = {
	projectId: string;
	title?: string;
	sessionPath?: string;
};

export type ForkMessage = {
	entryId: string;
	text: string;
};

/** 图片内容格式，与 pi RPC 的 ImageContent 一致 */
export type ImageContent = {
	type: "image";
	data: string; // base64 编码的图片数据
	mimeType: string; // 如 "image/png", "image/jpeg", "image/gif", "image/webp"
};

/**
 * renderer 侧持久引用的图片资产。
 * 使用本地磁盘资产引用替代 React state 中的大块 base64，发送给 pi 时再由主进程回填原始数据。
 */
export type ImageAssetRef = {
	type: "image-asset";
	assetId: string;
	assetPath: string;
	mimeType: string;
	size?: number;
	previewUrl?: string;
};

export type ComposerImage = ImageContent | ImageAssetRef;

export type SendPromptInput = {
	agentId: string;
	message: string;
	images?: ComposerImage[]; // 可选的图片列表
	streamingBehavior?: "steer" | "followUp";
	/** 标记由桌面端触发的扩展 UI slash 命令；这类命令只打开本地选择器，不应显示成聊天消息。 */
	uiSlashCommand?: boolean;
};

/** 实时思考内容更新，用于流式展示模型推理过程 */
export type ThinkingUpdate = {
	agentId: string;
	/** 累积的思考文本 */
	thinking: string;
};

export type AgentServerRequest = {
	agentId: string;
	requestId: string | number;
	type?: string;
	method: string;
	params?: unknown;
	title?: string;
	message?: string;
	options?: string[];
	timeout?: number;
	/** 请求来源于桌面端扩展 UI slash 命令时用于抑制聊天气泡/响应占位。 */
	origin?: "uiSlashCommand";
};

