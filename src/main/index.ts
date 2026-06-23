import {
	app,
	BrowserWindow,
	ipcMain,
	Menu,
	nativeImage,
	screen,
	shell,
	Tray,
} from "electron";
import { join, resolve } from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { is } from "@electron-toolkit/utils";
// 使用 ?asset 后缀导入图标，electron-vite 会在构建时将其复制到输出目录并提供正确的运行时路径
// 这解决了打包后 build/ 目录不在 asar 中导致托盘图标丢失的问题
import iconPath from "../../build/icon.png?asset";

// 开发模式下 stdout 管道可能断开导致 EPIPE 崩溃，全局静默处理
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
	if (err.code === "EPIPE") return;
	throw err;
});
process.stderr.on("error", (err: NodeJS.ErrnoException) => {
	if (err.code === "EPIPE") return;
	throw err;
});
import { ipcChannels } from "../shared/ipc";
import type {
	AppSettings,
	AppWindowBounds,
	CreateAgentInput,
	CreatePiSkillInput,
	QuickPromptPreset,
	SendPromptInput,
} from "../shared/types";
import { ProjectStore } from "./projects/ProjectStore";
import { FileSystemService } from "./fs/FileSystemService";
import { AgentManager } from "./pi/AgentManager";
import { PiLocator } from "./pi/PiLocator";
import { testPiProxy } from "./pi/PiProxyTester";
import { SessionScanner } from "./sessions/SessionScanner";
import { SessionPinStore } from "./sessions/SessionPinStore";
import { CodexSessionImporter } from "./sessions/CodexSessionImporter";
import { ClaudeSessionImporter } from "./sessions/ClaudeSessionImporter";
import { SettingsStore } from "./settings/SettingsStore";
import { QuickPromptStore } from "./quickPrompts/QuickPromptStore";
import { applyDesktopProxy } from "./settings/DesktopProxy";
import { GitService } from "./git/GitService";
import { ConfigManager } from "./config/ConfigManager";
import { TerminalSessionManager } from "./terminal/TerminalSessionManager";
import { SkillManager } from "./skills/SkillManager";
import { ExtensionManager } from "./extensions/ExtensionManager";
import { RemarkStore } from "./metadata/RemarkStore";
import { WebServiceManager } from "./web/WebServiceManager";
import { ImageAssetStore } from "./images/ImageAssetStore";
import { registerIpcHandlers } from "./ipc/registerIpc";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let internalLinkWindow: BrowserWindow | null = null;
/** 标记是否由用户主动退出（托盘菜单「退出」），区别于窗口关闭隐藏到托盘 */
let isQuitting = false;
let projectStore: ProjectStore;
let fileSystemService: FileSystemService;
let sessionScanner: SessionScanner;
let sessionPinStore: SessionPinStore;
let codexSessionImporter: CodexSessionImporter;
let claudeSessionImporter: ClaudeSessionImporter;
let settingsStore: SettingsStore;
let quickPromptStore: QuickPromptStore;
let gitService: GitService;
let piLocator: PiLocator;
let agentManager: AgentManager;
let configManager: ConfigManager;
let skillManager: SkillManager;
let extensionManager: ExtensionManager;
let remarkStore: RemarkStore;
let webServiceManager: WebServiceManager;
let terminalManager: TerminalSessionManager;
let imageAssetStore: ImageAssetStore;

function setupTray() {
	// iconPath 由 electron-vite 的 ?asset 后缀自动解析，打包后也能正确定位
	const icon = nativeImage.createFromPath(iconPath);
	tray = new Tray(icon.resize({ width: 16, height: 16 }));
	tray.setToolTip("PiDeck");

	// 双击托盘图标恢复窗口（Windows 常见交互）
	tray.on("double-click", () => {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.show();
			mainWindow.focus();
		}
	});

	const contextMenu = Menu.buildFromTemplate([
		{
			label: "显示窗口",
			click: () => {
				if (mainWindow && !mainWindow.isDestroyed()) {
					mainWindow.show();
					mainWindow.focus();
				}
			},
		},
		{ type: "separator" },
		{
			label: "退出 PiDeck",
			click: () => {
				isQuitting = true;
				app.quit();
			},
		},
	]);
	tray.setContextMenu(contextMenu);
}

async function openExternalUrl(url: string) {
	if (!url.startsWith("http:") && !url.startsWith("https:")) return;
	const settings = settingsStore.get();
	if (settings.linkOpenMode === "internal") {
		openInternalLinkWindow(url);
		return;
	}
	await shell.openExternal(url);
}

function openInternalLinkWindow(url: string) {
	// 内部打开使用独立 BrowserWindow，避免外部网页导航污染主工作台，同时保留系统浏览器作为默认选项。
	if (!internalLinkWindow || internalLinkWindow.isDestroyed()) {
		internalLinkWindow = new BrowserWindow({
			width: 1180,
			height: 820,
			minWidth: 760,
			minHeight: 520,
			title: "PiDeck",
			parent: mainWindow ?? undefined,
			webPreferences: {
				nodeIntegration: false,
				contextIsolation: true,
				sandbox: true,
			},
		});
		internalLinkWindow.on("closed", () => {
			internalLinkWindow = null;
		});
		internalLinkWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
			void openExternalUrl(nextUrl);
			return { action: "deny" };
		});
	}
	internalLinkWindow.loadURL(url).catch((error) => {
		void shell.openExternal(url);
		console.warn("Failed to load internal link window, falling back to browser:", error);
	});
	internalLinkWindow.show();
	internalLinkWindow.focus();
}

/** 将本地目录转换为 VS Code 自定义协议 URI。
 *  VS Code 使用 vscode://file 打开目录时，目录 URI 需要结尾斜杠；
 *  同时逐段编码空格、中文、# 等字符，避免新目录路径在协议回退中被截断。 */
function toVSCodeFolderUri(targetPath: string): string {
	const normalized = targetPath.replace(/\\/g, "/").replace(/\/+$/, "");
	const encoded = normalized
		.split("/")
		.map((segment, index) => {
			const encodedSegment = encodeURIComponent(segment);
			return index === 0 ? encodedSegment.replace(/%3A$/i, ":") : encodedSegment;
		})
		.join("/");
	return `vscode://file/${encoded}/`;
}

/** 清理 Electron 注入的环境变量，避免 spawn 子进程继承后误判上下文。 */
function sanitizeSpawnEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	delete env.ELECTRON_RUN_AS_NODE;
	delete env.NODE_OPTIONS;
	delete env.NODE_PATH;
	return env;
}

/** 调用 PATH 上的 VS Code CLI 打开目录。
 *  Windows 下 Scoop/VS Code 会同时放置 extensionless shell shim 和 code.cmd；
 *  显式调用 code.cmd 可避开 shim 歧义，并且不要隐藏启动窗口，避免 VS Code GUI 继承隐藏状态后 CLI 返回 0 但窗口不可见。 */
function spawnCodeViaCmd(targetPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		let settled = false;
		let stderr = "";
		const child = process.platform === "win32"
			? spawn(
				"cmd.exe",
				["/d", "/c", "code.cmd", targetPath],
				{
					env: sanitizeSpawnEnv(),
					windowsHide: false,
					stdio: ["ignore", "ignore", "pipe"],
				},
			)
			: spawn("code", [targetPath], {
				env: sanitizeSpawnEnv(),
				stdio: ["ignore", "ignore", "pipe"],
			});

		child.stderr?.on("data", chunk => {
			stderr += chunk.toString("utf8");
		});

		const timeout = setTimeout(() => {
			if (!settled) {
				settled = true;
				child.kill();
				console.error("[VSCode] spawnCodeViaCmd timeout", { targetPath, stderr });
				reject(new Error("VS Code 启动超时"));
			}
		}, 8000);

		child.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			console.error("[VSCode] spawnCodeViaCmd error", err);
			reject(new Error(`无法启动 VS Code：${err.message}`));
		});

		child.on("close", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			if (code === 0 || code === null) {
				resolve();
			} else {
				reject(new Error(`VS Code 启动失败，退出码：${code}${stderr ? `，stderr：${stderr}` : ""}`));
			}
		});
	});
}

/** 启动 VS Code 打开目录。
 *  Windows：cmd → code.cmd 命令 → vscode:// 协议回退。
 *  macOS/Linux：code 命令 → vscode:// 协议回退。 */
async function openDirectoryInVSCode(targetPath: string): Promise<void> {
	let lastError: Error | undefined;
	// 1) 通过 cmd.exe 调用 code 命令
	try {
		await spawnCodeViaCmd(targetPath);
		return;
	} catch (err) {
		lastError = err instanceof Error ? err : new Error(String(err));
		console.error("[VSCode] openDirectoryInVSCode spawnCodeViaCmd failed", lastError);
	}

	// 2) 回退：vscode:// 自定义协议
	try {
		const folderUri = toVSCodeFolderUri(targetPath);
		await shell.openExternal(folderUri);
	} catch (err) {
		const protocolError = err instanceof Error ? err.message : String(err);
		throw new Error(
			lastError
				? `VS Code 启动失败：${lastError.message}；协议回退也失败：${protocolError}`
				: `VS Code 启动失败：${protocolError}`,
		);
	}
}

function printStartupInfo() {
	if (!mainWindow || mainWindow.isDestroyed()) return;

	const settings = settingsStore.get();
	const appVersion = app.getVersion();
	const electronVersion = process.versions.electron;
	const chromeVersion = process.versions.chrome;
	const nodeVersion = process.versions.node;
	const platform = process.platform;
	const arch = process.arch;
	const isPortableEnv = process.env.PORTABLE_EXECUTABLE_DIR !== undefined;

	// 执行 console.log 输出到开发者工具
	mainWindow.webContents.executeJavaScript(`
		console.log(
			"%c╭──────────────────────────────────────────────────────────╮",
			"color: #8b5cf6; font-weight: bold;"
		);
		console.log(
			"%c│                      PiDeck Desktop                      │",
			"color: #8b5cf6; font-weight: bold; font-size: 16px;"
		);
		console.log(
			"%c╰──────────────────────────────────────────────────────────╯",
			"color: #8b5cf6; font-weight: bold;"
		);
		console.log("");
		console.log("%c📦 Application Info", "color: #3b82f6; font-weight: bold; font-size: 14px;");
		console.log("%c  Version:         %c${appVersion}", "color: #6b7280;", "color: #10b981; font-weight: bold;");
		console.log("%c  Platform:        %c${platform} (${arch})", "color: #6b7280;", "color: #8b5cf6;");
		console.log("");
		console.log("%c⚡ Runtime Info", "color: #3b82f6; font-weight: bold; font-size: 14px;");
		console.log("%c  Electron:        %c${electronVersion}", "color: #6b7280;", "color: #06b6d4;");
		console.log("%c  Chrome:          %c${chromeVersion}", "color: #6b7280;", "color: #06b6d4;");
		console.log("%c  Node:            %c${nodeVersion}", "color: #6b7280;", "color: #06b6d4;");
		console.log("");
		console.log("%c🔧 Debug Info", "color: #3b82f6; font-weight: bold; font-size: 14px;");
		console.log("%c  PORTABLE_EXECUTABLE_DIR: %c${isPortableEnv ? '✅ Set' : '❌ Not set'}", "color: #6b7280;", "color: ${isPortableEnv ? '#10b981' : '#ef4444'};");
		console.log("");
		console.log("%c🎉 Easter egg: You found it! Thanks for exploring.", "color: #ec4899; font-weight: bold;");
		console.log("");
	`);
}

/**
 * 验证保存的窗口边界是否合法且至少部分可见。
 * 如果边界无效或完全位于所有显示器之外，返回 null 让调用方使用默认值。
 */
function validateWindowBounds(
	bounds: AppWindowBounds | undefined,
): AppWindowBounds | null {
	if (!bounds) return null;
	const { x, y, width, height } = bounds;
	// 基础合法性检查：正有限数且不小于 100px（具体 minWidth/minHeight 在构造函数中保障）
	if (
		!Number.isFinite(x) ||
		!Number.isFinite(y) ||
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		width < 100 ||
		height < 100
	) {
		return null;
	}
	// 检查是否有至少 50px 落在任意显示器的工作区内，避免显示器移除后窗口在屏幕外恢复
	const displays = screen.getAllDisplays();
	const testRect = { x, y, width: Math.min(width, 50), height: Math.min(height, 50) };
	const onScreen = displays.some((display) => {
		const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
		return (
			testRect.x < dx + dw &&
			testRect.x + testRect.width > dx &&
			testRect.y < dy + dh &&
			testRect.y + testRect.height > dy
		);
	});
	if (!onScreen) return null;
	return { x, y, width, height };
}

/** 窗口状态保存防抖（ms），避免频繁 resize/move 触发大量磁盘写入 */
const WINDOW_STATE_SAVE_DEBOUNCE_MS = 500;
let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null;

/** 立即保存当前窗口状态到持久化存储 */
async function saveMainWindowStateNow(): Promise<void> {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	if (mainWindow.isMinimized()) return;
	if (windowStateSaveTimer) {
		clearTimeout(windowStateSaveTimer);
		windowStateSaveTimer = null;
	}
	try {
		const bounds = mainWindow.getNormalBounds();
		await settingsStore.updateWindowState({
			bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
			maximized: mainWindow.isMaximized(),
		});
	} catch (error) {
		console.warn("[窗口] 保存状态失败:", error);
	}
}

function scheduleSaveMainWindowState() {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	if (mainWindow.isMinimized()) return;
	if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer);
	windowStateSaveTimer = setTimeout(() => {
		windowStateSaveTimer = null;
		void saveMainWindowStateNow();
	}, WINDOW_STATE_SAVE_DEBOUNCE_MS);
}

function showMainWindow() {
	if (!mainWindow || mainWindow.isDestroyed()) return;
	if (mainWindow.isMinimized()) {
		mainWindow.restore();
	}
	if (!mainWindow.isVisible()) {
		mainWindow.show();
	}
	mainWindow.focus();
}

function createWindow() {
	const windowOptions = settingsStore.createWindowOptions();
	const savedWindowState = settingsStore.get().windowState;
	const defaultWidth = 1480;
	const defaultHeight = 960;
	const minWidth = 1180;
	const minHeight = 840;

	// 从已保存的窗口状态恢复位置和尺寸，回退到默认值
	const savedBounds = validateWindowBounds(savedWindowState?.bounds);
	const initialWidth = Math.max(minWidth, savedBounds?.width ?? defaultWidth);
	const initialHeight = Math.max(minHeight, savedBounds?.height ?? defaultHeight);
	const windowX = savedBounds?.x;
	const windowY = savedBounds?.y;

	mainWindow = new BrowserWindow({
		show: false,
		backgroundColor: "#eef0f3",
		x: windowX,
		y: windowY,
		width: initialWidth,
		height: initialHeight,
		minWidth,
		minHeight,
		title: "",
		icon: iconPath,
		frame: windowOptions.frame,
		titleBarStyle: windowOptions.titleBarStyle,
		trafficLightPosition: windowOptions.trafficLightPosition,
		webPreferences: {
			preload: join(__dirname, "../preload/index.js"),
			sandbox: false,
			contextIsolation: true,
			nodeIntegration: false,
		},
	});

	// 所有 target="_blank" 或 window.open 的链接统一经同一入口处理，遵守用户设置的打开方式。
	mainWindow.webContents.setWindowOpenHandler(({ url }) => {
		void openExternalUrl(url);
		return { action: "deny" };
	});

	mainWindow.once("ready-to-show", () => {
		// 有已保存的最大化状态则恢复；首次启动（无保存状态）也默认最大化
		const shouldMaximize = savedWindowState?.maximized ?? !savedBounds;
		if (shouldMaximize) {
			mainWindow?.maximize();
		}
		mainWindow?.show();
		// 向开发者工具输出启动信息
		printStartupInfo();
	});

	// 窗口尺寸/位置变化时持久化状态（包含最大化/恢复）
	mainWindow.on("resize", scheduleSaveMainWindowState);
	mainWindow.on("move", scheduleSaveMainWindowState);

	// 监听窗口最大化/恢复事件，通知渲染进程更新图标并保存状态
	mainWindow.on("maximize", () => {
		mainWindow?.webContents.send(ipcChannels.appWindowMaximizeChanged, true);
		scheduleSaveMainWindowState();
	});
	mainWindow.on("unmaximize", () => {
		mainWindow?.webContents.send(ipcChannels.appWindowMaximizeChanged, false);
		scheduleSaveMainWindowState();
	});

	// 关闭窗口前保存最新状态，然后根据设置决定：隐藏到托盘还是正常退出
	mainWindow.on("close", (event) => {
		// 关闭前立即刷一次状态，确保最后的位置被保存（跳过防抖）
		void saveMainWindowStateNow();

		if (!isQuitting && settingsStore.get().closeToTray) {
			event.preventDefault();
			mainWindow?.hide();
		} else if (!isQuitting) {
			// 如果没有启用托盘，关闭窗口时直接退出应用
			isQuitting = true;
			app.quit();
		}
	});

	// 监听浏览器标准快捷键打开开发者工具
	mainWindow.webContents.on("before-input-event", (event, input) => {
		if (!mainWindow || mainWindow.isDestroyed()) return;

		// F12
		if (input.key === "F12" && input.type === "keyDown") {
			event.preventDefault();
			if (mainWindow.webContents.isDevToolsOpened()) {
				mainWindow.webContents.closeDevTools();
			} else {
				mainWindow.webContents.openDevTools({ mode: "detach" });
			}
		}

		// Ctrl+Shift+I (Windows/Linux) 或 Cmd+Option+I (macOS)
		const isMac = process.platform === "darwin";
		const ctrlOrCmd = isMac ? input.meta : input.control;
		const shiftOrOption = input.shift || (isMac && input.alt);

		if (
			ctrlOrCmd &&
			shiftOrOption &&
			input.key.toLowerCase() === "i" &&
			input.type === "keyDown"
		) {
			event.preventDefault();
			if (mainWindow.webContents.isDevToolsOpened()) {
				mainWindow.webContents.closeDevTools();
			} else {
				mainWindow.webContents.openDevTools({ mode: "detach" });
			}
		}

		// Ctrl+Shift+J (Windows/Linux) 或 Cmd+Option+J (macOS) - 直接打开 Console
		if (
			ctrlOrCmd &&
			shiftOrOption &&
			input.key.toLowerCase() === "j" &&
			input.type === "keyDown"
		) {
			event.preventDefault();
			if (mainWindow.webContents.isDevToolsOpened()) {
				mainWindow.webContents.closeDevTools();
			} else {
				mainWindow.webContents.openDevTools({ mode: "detach", activate: true });
			}
		}
	});

	if (is.dev && process.env.ELECTRON_RENDERER_URL) {
		mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
	} else {
		mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
	}
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
	app.quit();
} else {
	app.on("second-instance", () => {
		showMainWindow();
	});

	app.whenReady().then(async () => {
		projectStore = new ProjectStore();
		fileSystemService = new FileSystemService();
		imageAssetStore = new ImageAssetStore();
		sessionScanner = new SessionScanner();
		remarkStore = new RemarkStore();
		sessionPinStore = new SessionPinStore();
		codexSessionImporter = new CodexSessionImporter();
		claudeSessionImporter = new ClaudeSessionImporter();
		settingsStore = new SettingsStore();
		quickPromptStore = new QuickPromptStore();
		gitService = new GitService();
		piLocator = new PiLocator();
		configManager = new ConfigManager();
		skillManager = new SkillManager();
		extensionManager = new ExtensionManager(
			piLocator,
			() => settingsStore.get(),
			async (projectPath?: string) =>
				projectPath
					? (await configManager.getProjectSettingsConfig(projectPath)).parsed
					: (await configManager.getSettingsConfig()).parsed,
			async (settings, projectPath?: string) => {
				if (projectPath) {
					await configManager.saveProjectSettingsConfig(projectPath, settings);
					return;
				}
				await configManager.saveSettingsConfig(settings);
			},
		);
		agentManager = new AgentManager(
			(id) => projectStore.get(id),
			() => mainWindow,
			settingsStore,
			imageAssetStore,
		);
		webServiceManager = new WebServiceManager({
			listProjects: () => projectStore.list(),
			listAgents: () => agentManager.list(),
			listSessions: (projectId) => {
				const project = projectStore.get(projectId);
				if (!project) return Promise.resolve([]);
				return sessionScanner.list(project.path);
			},
			getMessages: (agentId) => agentManager.getMessages(agentId),
			createAgent: (input) => agentManager.create(input),
			sendPrompt: (input) => agentManager.sendPrompt(input),
			stopAgent: (agentId) => agentManager.stop(agentId),
			runtimeState: (agentId) => agentManager.getRuntimeState(agentId),
			cycleModel: (agentId) => agentManager.cycleModel(agentId),
			availableModels: (agentId) => agentManager.getAvailableModels(agentId),
			setModel: (agentId, provider, modelId) => agentManager.setModel(agentId, provider, modelId),
			cycleThinking: (agentId) => agentManager.cycleThinking(agentId),
			setThinking: (agentId, level) => agentManager.setThinking(agentId, level),
		});
		terminalManager = new TerminalSessionManager(
			(agentId) => agentManager.getCwd(agentId),
			(channel, payload) => mainWindow?.webContents.send(channel, payload),
		);

		await settingsStore.load();
		await quickPromptStore.load();
		await sessionPinStore.load();
		await remarkStore.load();
		await applyDesktopProxy(settingsStore.get());
		await webServiceManager.applySettings(settingsStore.get()).catch((error) => {
			console.error("Failed to start web service:", error);
			void settingsStore.update({ webServiceEnabled: false });
		});
		registerIpcHandlers({
					projectStore,
					fileSystemService,
					sessionScanner,
					sessionPinStore,
					codexSessionImporter,
					claudeSessionImporter,
					settingsStore,
					quickPromptStore,
					gitService,
					piLocator,
					agentManager,
					configManager,
					skillManager,
					extensionManager,
					remarkStore,
					webServiceManager,
					terminalManager,
					imageAssetStore,
					getMainWindow: () => mainWindow,
					setIsQuitting: (value: boolean) => {
						isQuitting = value;
					},
					openExternalUrl,
					openDirectoryInVSCode,
				});

		createWindow();
		setupTray();

		// 项目列表可能位于杀软/同步盘较慢的 userData；窗口先显示，随后异步加载，避免 packaged app 打开时白屏等待。
		void projectStore
			.load()
			.then(() =>
				mainWindow?.webContents.send("projects:changed", projectStore.list()),
			)
			.catch(() => undefined);

		// macOS dock 点击或任务栏点击时恢复窗口
		app.on("activate", () => {
			if (mainWindow) {
				showMainWindow();
			} else {
				createWindow();
			}
		});
	});
}

app.on("before-quit", () => {
	isQuitting = true;
	tray?.destroy();
	tray = null;
	void webServiceManager?.stop();
	terminalManager?.closeAll();
	agentManager?.stopAll();
});

app.on("window-all-closed", () => {
	// macOS 关闭所有窗口不退出；其他平台如果启用 closeToTray 也不退出
	if (process.platform === "darwin") return;
	if (!isQuitting) return;
	app.quit();
});
