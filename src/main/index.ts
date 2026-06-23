import {
	app,
	BrowserWindow,
	ipcMain,
	Menu,
	nativeImage,
	net,
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
import { TelemetryService } from "./telemetry/TelemetryService";
import { SkillManager } from "./skills/SkillManager";
import { ExtensionManager } from "./extensions/ExtensionManager";
import { RemarkStore } from "./metadata/RemarkStore";
import { PiUpdateChecker } from "./pi/PiUpdateChecker";
import { checkForAppUpdate, RELEASES_URL } from "./update/AppUpdateChecker";
import { WebServiceManager } from "./web/WebServiceManager";

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
let piUpdateChecker: PiUpdateChecker;
let webServiceManager: WebServiceManager;
let terminalManager: TerminalSessionManager;

const POSTHOG_PROJECT_KEY =
	process.env.POSTHOG_PROJECT_KEY ??
	"phc_xgJ8gFUMgExZEEPzZ7VRa7698ENcaDRquWZVGYb2dCFK";
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? "https://us.i.posthog.com";

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
	const installationType = settings.installationType || "unknown";
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
		console.log("%c  Installation:    %c${installationType}", "color: #6b7280;", "color: #f59e0b; font-weight: bold;");
		console.log("%c  Platform:        %c${platform} (${arch})", "color: #6b7280;", "color: #8b5cf6;");
		console.log("");
		console.log("%c⚡ Runtime Info", "color: #3b82f6; font-weight: bold; font-size: 14px;");
		console.log("%c  Electron:        %c${electronVersion}", "color: #6b7280;", "color: #06b6d4;");
		console.log("%c  Chrome:          %c${chromeVersion}", "color: #6b7280;", "color: #06b6d4;");
		console.log("%c  Node:            %c${nodeVersion}", "color: #6b7280;", "color: #06b6d4;");
		console.log("");
		console.log("%c🔧 Debug Info", "color: #3b82f6; font-weight: bold; font-size: 14px;");
		console.log("%c  PORTABLE_EXECUTABLE_DIR: %c${isPortableEnv ? '✅ Set' : '❌ Not set'}", "color: #6b7280;", "color: ${isPortableEnv ? '#10b981' : '#ef4444'};");
		console.log("%c  Persistent installationType: %c${installationType}", "color: #6b7280;", "color: #8b5cf6; font-weight: bold;");
		console.log("");
		console.log("%c🐛 Found a bug? Report at:", "color: #6b7280;");
		console.log("%c  https://github.com/ayuayue/PiDeck/issues", "color: #3b82f6; text-decoration: underline;");
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


function registerIpc() {
	ipcMain.handle(ipcChannels.projectsList, () => projectStore.list());
	ipcMain.handle(ipcChannels.projectsAdd, async () =>
		projectStore.chooseAndAdd(),
	);
	ipcMain.handle(ipcChannels.projectsRemove, async (_event, id: string) => {
		const removed = await projectStore.remove(id);
		if (removed) await sessionPinStore.removeProject(id);
		return projectStore.list();
	});
	ipcMain.handle(
		ipcChannels.projectsReorder,
		(_event, projectIds: string[]) => projectStore.reorder(projectIds),
	);
	ipcMain.handle(
		ipcChannels.projectsTogglePinned,
		async (_event, projectId: string) => {
			await projectStore.togglePinned(projectId);
			return projectStore.list();
		},
	);

	ipcMain.handle(ipcChannels.filesList, async (_event, projectId: string) => {
		const project = projectStore.get(projectId);
		if (!project) throw new Error(`Project not found: ${projectId}`);
		return fileSystemService.listTree(project.path);
	});

	ipcMain.handle(ipcChannels.filesOpen, async (_event, path: string) => {
		const error = await shell.openPath(path);
		// Electron 通过返回字符串报告打开失败；显式抛出后前端才能提示路径不存在或系统无法打开。
		if (error) throw new Error(error);
	});

	ipcMain.handle(ipcChannels.filesReadContent, async (_event, path: string) => {
		try {
			return await readFile(path, "utf8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") {
				return "";
			}
			throw error;
		}
	});

	ipcMain.handle(ipcChannels.filesWriteContent, async (_event, path: string, content: string) => {
		await writeFile(path, content, "utf8");
	});

	ipcMain.handle(ipcChannels.filesDelete, async (_event, path: string, recursive?: boolean) => {
		await fileSystemService.delete(path, recursive);
	});

	ipcMain.handle(ipcChannels.filesRename, async (_event, path: string, newName: string) => {
		return fileSystemService.rename(path, newName);
	});

	ipcMain.handle(
		ipcChannels.filesShowInFolder,
		async (_event, path: string) => {
			shell.showItemInFolder(path);
		},
	);

	ipcMain.handle(
		ipcChannels.sessionsList,
		async (_event, projectId?: string) => {
			const project = projectId ? projectStore.get(projectId) : undefined;
			const sessions = await sessionScanner.list(project?.path);
			return projectId ? await sessionPinStore.decorate(projectId, sessions) : sessions;
		},
	);
	ipcMain.handle(
		ipcChannels.sessionsTogglePinned,
		async (_event, projectId: string, filePath: string) => {
			await sessionPinStore.toggle(projectId, filePath);
		},
	);
	ipcMain.handle(
		ipcChannels.sessionsRename,
		async (_event, filePath: string, newName: string) => {
			await sessionScanner.rename(filePath, newName);
		},
	);
	ipcMain.handle(
		ipcChannels.sessionsCopy,
		(_event, projectId: string, filePath: string) =>
			agentManager.cloneSessionFile(projectId, filePath),
	);
	ipcMain.handle(
		ipcChannels.sessionsExportHtml,
		(_event, projectId: string, filePath: string) =>
			agentManager.exportSessionHtml(projectId, filePath),
	);
	ipcMain.handle(ipcChannels.sessionsDelete, (_event, filePath: string) =>
		sessionScanner.delete(filePath),
	);
	ipcMain.handle(
		ipcChannels.codexSessionsScan,
		async (_event, projectId: string) => {
			const project = projectStore.get(projectId);
			if (!project) throw new Error(`Project not found: ${projectId}`);
			return codexSessionImporter.scan(project.path);
		},
	);
	ipcMain.handle(
		ipcChannels.codexSessionsImport,
		async (_event, projectId: string, sourcePaths: string[]) => {
			const project = projectStore.get(projectId);
			if (!project) throw new Error(`Project not found: ${projectId}`);
			return codexSessionImporter.import(project.path, sourcePaths);
		},
	);
	ipcMain.handle(
		ipcChannels.claudeSessionsScan,
		async (_event, projectId: string) => {
			const project = projectStore.get(projectId);
			if (!project) throw new Error(`Project not found: ${projectId}`);
			return claudeSessionImporter.scan(project.path);
		},
	);
	ipcMain.handle(
		ipcChannels.claudeSessionsImport,
		async (_event, projectId: string, sourcePaths: string[]) => {
			const project = projectStore.get(projectId);
			if (!project) throw new Error(`Project not found: ${projectId}`);
			return claudeSessionImporter.import(project.path, sourcePaths);
		},
	);

	ipcMain.handle(ipcChannels.gitBranches, async (_event, projectId: string) => {
		const project = projectStore.get(projectId);
		if (!project) throw new Error(`Project not found: ${projectId}`);
		return gitService.getBranches(project.path);
	});

	ipcMain.handle(
		ipcChannels.gitCheckout,
		async (_event, projectId: string, branch: string) => {
			const project = projectStore.get(projectId);
			if (!project) throw new Error(`Project not found: ${projectId}`);
			return gitService.checkout(project.path, branch);
		},
	);

	ipcMain.handle(
		ipcChannels.gitCreateBranch,
		async (_event, projectId: string, branchName: string) => {
			const project = projectStore.get(projectId);
			if (!project) throw new Error(`Project not found: ${projectId}`);
			return gitService.createBranch(project.path, branchName);
		},
	);

	// 差异查看需要文件的 Git HEAD 原始内容作为对比基准；参数是绝对文件路径，后端自行定位仓库根。
	ipcMain.handle(
		ipcChannels.gitOriginalContent,
		async (_event, filePath: string) => {
			return gitService.getOriginalContent(filePath);
		},
	);

	// 获取工作区中被 Git 跟踪的变更文件列表（对比 HEAD），返回到前端用于右侧文件面板。
	ipcMain.handle(
		ipcChannels.gitChangedFiles,
		async (_event, projectId: string) => {
			const project = projectStore.get(projectId);
			if (!project) return [];
			return gitService.getChangedFiles(project.path);
		},
	);

	ipcMain.handle(ipcChannels.piCheck, () => {
		// 用户手动指定的路径优先于自动检测
		const settings = settingsStore.get();
		return piLocator.check(settings.customPiPath);
	});
	ipcMain.handle(
		ipcChannels.piCheckCustom,
		async (_event, customPath: string) => {
			const status = await piLocator.validateCustomPath(customPath);
			// 校验通过后持久化归一化后的路径，后续启动 agent 时 PiProcess 会从 settings 读取。
			// 例如用户粘贴 "D:\\foo\\pi" 时，PiLocator 会返回可执行的 D:\foo\pi.cmd。
			if (status.installed && status.command) {
				await settingsStore.update({ customPiPath: status.command });
			}
			return status;
		},
	);
	ipcMain.handle(ipcChannels.piCheckUpdates, () => piUpdateChecker.check());
	ipcMain.handle(ipcChannels.appInfo, () => ({
		version: app.getVersion(),
		releasesUrl: RELEASES_URL,
	}));
	ipcMain.handle(ipcChannels.appCheckUpdate, () => {
		const settings = settingsStore.get();
		return checkForAppUpdate(
			settings.installationType,
			settings.appUpdateSkippedVersion,
		);
	});
	ipcMain.handle(ipcChannels.appFeedbackEnvironment, async () => {
		// 反馈报告只包含诊断必需的运行时版本与 pi 检测结果，不读取配置密钥或会话内容。
		const pi = await piLocator.check();
		return {
			appVersion: app.getVersion(),
			platform: process.platform,
			arch: process.arch,
			electronVersion: process.versions.electron ?? "",
			chromeVersion: process.versions.chrome ?? "",
			nodeVersion: process.versions.node,
			pi,
		};
	});
	ipcMain.handle(ipcChannels.appOpenExternal, async (_event, url: string) => {
		// 外部链接统一经主进程打开，避免 renderer 直接依赖 shell 权限，并遵守用户设置的打开方式。
		await openExternalUrl(url);
	});
	ipcMain.handle(ipcChannels.appOpenInVSCode, async (_event, projectPath: string) => {
		if (typeof projectPath !== "string" || !projectPath.trim()) {
			throw new Error("项目路径为空");
		}
		const resolvedPath = resolve(projectPath);
		const info = await stat(resolvedPath).catch((error) => {
			console.error("[VSCode] IPC stat failed", error);
			return null;
		});
		if (!info?.isDirectory()) {
			throw new Error(`项目目录不存在：${resolvedPath}`);
		}
		// 优先通过 PATH 上的 code 命令打开目录，避免 vscode:// 协议弹窗确认；
		// 协议入口只作为兜底，确保用户仍能打开项目。
		await openDirectoryInVSCode(resolvedPath);
	});
	ipcMain.handle(ipcChannels.appRestart, async () => {
		// 标记为退出状态，避免 closeToTray 阻止重启
		isQuitting = true;
		// 停止所有 Agent 和服务
		await webServiceManager?.stop();
		terminalManager?.closeAll();
		agentManager?.stopAll();
		// 重启应用
		app.relaunch();
		app.quit();
	});
	ipcMain.handle(ipcChannels.appWindowMinimize, () => {
		if (!mainWindow || mainWindow.isDestroyed()) return;
		mainWindow.minimize();
	});
	ipcMain.handle(ipcChannels.appWindowToggleMaximize, () => {
		if (!mainWindow || mainWindow.isDestroyed()) return;
		if (mainWindow.isMaximized()) mainWindow.unmaximize();
		else mainWindow.maximize();
	});
	ipcMain.handle(ipcChannels.appWindowGetMaximized, () => {
		return mainWindow?.isMaximized() ?? false;
	});

	ipcMain.handle(ipcChannels.appWindowToggleAlwaysOnTop, () => {
		if (!mainWindow || mainWindow.isDestroyed()) return false;
		const next = !mainWindow.isAlwaysOnTop();
		// floating 适合工具型桌面窗口；跨平台由 Electron 映射到各系统的置顶层级。
		mainWindow.setAlwaysOnTop(next, "floating");
		return next;
	});
	ipcMain.handle(ipcChannels.appWindowClose, () => {
		if (!mainWindow || mainWindow.isDestroyed()) return;
		mainWindow.close();
	});

	ipcMain.handle(ipcChannels.settingsGet, () => settingsStore.get());
	ipcMain.handle(
		ipcChannels.settingsUpdate,
		async (_event, patch: Partial<AppSettings>) => {
			const settings = await settingsStore.update(patch);
			if (
				"desktopProxyEnabled" in patch ||
				"desktopProxyUrl" in patch ||
				"desktopProxyBypass" in patch
			) {
				await applyDesktopProxy(settings);
			}
			if ("useNativeTitleBar" in patch) {
				settingsStore.notifyTitleBarChange(mainWindow);
			}
			if (
				"customPiPath" in patch ||
				"piProxyEnabled" in patch ||
				"piProxyUrl" in patch ||
				"piProxyBypass" in patch
			) {
				// pi 路径或代理变更后，预热池中的旧进程配置已过期，需清空让新 agent 重新 spawn
				agentManager.clearWarmPool();
			}
			if (
				"webServiceEnabled" in patch ||
				"webServiceHost" in patch ||
				"webServicePort" in patch
			) {
				try {
					await webServiceManager.applySettings(settings);
				} catch (error) {
					if (settings.webServiceEnabled) {
						await settingsStore.update({ webServiceEnabled: false });
					}
					throw error;
				}
			}
			return settings;
		},
	);
	ipcMain.handle(
		ipcChannels.settingsTestPiProxy,
		() => testPiProxy(settingsStore.get()),
	);
	ipcMain.handle(ipcChannels.quickPromptsGet, () => quickPromptStore.get());
	ipcMain.handle(
		ipcChannels.quickPromptsUpdate,
		async (_event, state: { presets: QuickPromptPreset[]; draft: string }) => {
			return quickPromptStore.update(state);
		},
	);

	ipcMain.handle(ipcChannels.skillsList, async () => {
		const result = await skillManager.list();
		return { ...result, skills: remarkStore.applySkills(result.skills) };
	});
	ipcMain.handle(ipcChannels.skillsCreate, async (_event, input: CreatePiSkillInput) => {
		const skill = await skillManager.create(input);
		return { ...skill, remark: remarkStore.getSkillRemark(skill.id) };
	});
	ipcMain.handle(ipcChannels.skillsToggle, async (_event, path: string, enabled: boolean) => {
		const skill = await skillManager.toggle(path, enabled);
		return { ...skill, remark: remarkStore.getSkillRemark(skill.id) };
	});
	ipcMain.handle(ipcChannels.skillsDelete, (_event, path: string) =>
		skillManager.delete(path),
	);
	ipcMain.handle(ipcChannels.skillsOpenFolder, (_event, path?: string) =>
		skillManager.openFolder(path),
	);
	ipcMain.handle(ipcChannels.skillsEditRemark, async (_event, skillId: string, remark: string) => {
		await remarkStore.setSkillRemark(skillId, remark);
	});
	ipcMain.handle(ipcChannels.extensionsList, async (_event, projectPath?: string) => {
		const result = await extensionManager.list(projectPath);
		return { ...result, extensions: remarkStore.applyExtensions(result.extensions) };
	});
	ipcMain.handle(
		ipcChannels.extensionsToggle,
		async (_event, source: string, enabled: boolean, scope?: "user" | "project" | "unknown", projectPath?: string) => {
			await extensionManager.setEnabled(source, scope, enabled, projectPath);
		},
	);
	ipcMain.handle(
		ipcChannels.extensionsUninstall,
		async (_event, source: string, scope?: "user" | "project" | "unknown", projectPath?: string) => {
			await extensionManager.uninstall(source, scope, projectPath);
		},
	);
	ipcMain.handle(ipcChannels.extensionsInstall, async (_event, source: string) =>
		extensionManager.install(source),
	);
	ipcMain.handle(ipcChannels.extensionsEditRemark, async (_event, extensionId: string, remark: string) => {
		await remarkStore.setExtensionRemark(extensionId, remark);
	});

	ipcMain.handle(ipcChannels.agentsList, () => agentManager.list());
	ipcMain.handle(ipcChannels.agentsCreate, async (_event, input: CreateAgentInput) => {
		return agentManager.create(input);
	});
	ipcMain.handle(ipcChannels.agentsUndoMessage, async (_event, agentId: string, messageId: string) => {
		const removed = await agentManager.undoUserMessage(agentId, messageId);
		return removed ? { text: removed.text, images: removed.images } : null;
	});
	ipcMain.handle(
		ipcChannels.agentsRename,
		(_event, agentId: string, name: string) =>
			agentManager.rename(agentId, name),
	);
	ipcMain.handle(ipcChannels.agentsStop, async (_event, agentId: string) => {
		terminalManager.closeAgent(agentId);
		await agentManager.stop(agentId);
	});
	ipcMain.handle(ipcChannels.agentsPrompt, async (_event, input: SendPromptInput) => {
		return agentManager.sendPrompt(input);
	});
	ipcMain.handle(ipcChannels.agentsAbort, async (_event, agentId: string) => {
		return agentManager.abort(agentId);
	});
	ipcMain.handle(
		ipcChannels.agentsRespondServerRequest,
		(_event, agentId: string, requestId: string | number, decision: unknown) =>
			agentManager.respondServerRequest(agentId, requestId, decision),
	);
	ipcMain.handle(ipcChannels.agentsExportHtml, (_event, agentId: string) =>
		agentManager.exportHtml(agentId),
	);
	ipcMain.handle(ipcChannels.agentsForkMessages, (_event, agentId: string) =>
		agentManager.getForkMessages(agentId),
	);
	ipcMain.handle(
		ipcChannels.agentsForkSession,
		(_event, agentId: string, entryId: string) =>
			agentManager.forkSession(agentId, entryId),
	);
	ipcMain.handle(ipcChannels.agentsCloneSession, (_event, agentId: string) =>
		agentManager.cloneSession(agentId),
	);
	ipcMain.handle(
		ipcChannels.agentsSwitchSession,
		(_event, agentId: string, sessionPath: string) =>
			agentManager.switchSession(agentId, sessionPath),
	);
	ipcMain.handle(ipcChannels.agentsRestart, async (_event, agentId: string) => {
		terminalManager.closeAgent(agentId);
		return agentManager.restart(agentId);
	});
	ipcMain.handle(ipcChannels.agentsCompact, (_event, agentId: string) =>
		agentManager.compact(agentId),
	);
	ipcMain.handle(ipcChannels.agentsRuntimeState, (_event, agentId: string) =>
		agentManager.getRuntimeState(agentId),
	);
	ipcMain.handle(ipcChannels.agentsCycleModel, (_event, agentId: string) =>
		agentManager.cycleModel(agentId),
	);
	ipcMain.handle(ipcChannels.agentsAvailableModels, (_event, agentId: string) =>
		agentManager.getAvailableModels(agentId),
	);
	ipcMain.handle(
		ipcChannels.agentsSetModel,
		(_event, agentId: string, provider: string, modelId: string) =>
			agentManager.setModel(agentId, provider, modelId),
	);
	ipcMain.handle(ipcChannels.agentsCycleThinking, (_event, agentId: string) =>
		agentManager.cycleThinking(agentId),
	);
	ipcMain.handle(
		ipcChannels.agentsSetThinking,
		(_event, agentId: string, level: string) =>
			agentManager.setThinking(agentId, level),
	);
	ipcMain.handle("agents:commands", async (_event, agentId: string) => {
		try {
			return await agentManager.getCommands(agentId);
		} catch {
			// agent 不存在或 RPC 超时时返回空列表，避免控制台报未处理异常
			return [];
		}
	});

	ipcMain.handle(ipcChannels.terminalList, (_event, agentId: string) =>
		terminalManager.list(agentId),
	);
	ipcMain.handle(ipcChannels.terminalEnsure, (_event, agentId: string) =>
		terminalManager.ensure(agentId),
	);
	ipcMain.handle(ipcChannels.terminalCreate, (_event, agentId: string) =>
		terminalManager.create(agentId),
	);
	ipcMain.handle(
		ipcChannels.terminalInput,
		(_event, tabId: string, data: string) => {
			terminalManager.input(tabId, data);
		},
	);
	ipcMain.handle(
		ipcChannels.terminalResize,
		(_event, tabId: string, cols: number, rows: number) => {
			terminalManager.resize(tabId, cols, rows);
		},
	);
	ipcMain.handle(ipcChannels.terminalClose, (_event, tabId: string) => {
		terminalManager.close(tabId);
	});

	// ── 配置管理 ──────────────────────────────────────
	ipcMain.handle(ipcChannels.configGetModels, () =>
		configManager.getModelsConfig(),
	);
	ipcMain.handle(ipcChannels.configGetAuth, () =>
		configManager.getAuthConfig(),
	);
	ipcMain.handle(ipcChannels.configGetSettings, () =>
		configManager.getSettingsConfig(),
	);
	ipcMain.handle(ipcChannels.configSaveModels, (_event, data) =>
		configManager.saveModelsConfig(data),
	);
	ipcMain.handle(ipcChannels.configSaveAuth, (_event, data) =>
		configManager.saveAuthConfig(data),
	);
	ipcMain.handle(ipcChannels.configSaveSettings, (_event, settings) =>
		configManager.saveSettingsConfig(settings),
	);
	ipcMain.handle(ipcChannels.configSaveRaw, (_event, fileName, rawJson) =>
		configManager.saveRawConfig(fileName, rawJson),
	);
	ipcMain.handle(ipcChannels.configExport, () =>
		configManager.exportConfig(),
	);
	ipcMain.handle(ipcChannels.configImport, (_event, packageJson: string) =>
		configManager.importConfig(packageJson),
	);
	// 远程拉取 provider 模型列表
	ipcMain.handle(
		ipcChannels.configFetchModels,
		(
			_event,
			payload: { baseUrl: string; apiKey: string; apiType?: string },
		) =>
			configManager.fetchProviderModels(
				payload.baseUrl,
				payload.apiKey,
				payload.apiType,
			),
	);
	// 快速测试 provider 连接
	ipcMain.handle(
		ipcChannels.configTestProvider,
		(
			_event,
			payload: {
				baseUrl: string;
				apiKey: string;
				modelId: string;
				apiType?: string;
				headers?: Record<string, string>;
			},
		) =>
			configManager.testProviderConnection(
				payload.baseUrl,
				payload.apiKey,
				payload.modelId,
				payload.apiType,
				payload.headers,
			),
	);

	// 切换开发者控制台
	ipcMain.handle(ipcChannels.appToggleDevTools, () => {
		if (!mainWindow || mainWindow.isDestroyed()) return false;
		if (mainWindow.webContents.isDevToolsOpened()) {
			mainWindow.webContents.closeDevTools();
			return false;
		}
		mainWindow.webContents.openDevTools({ mode: "detach" });
		return true;
	});
}

function sendTelemetryHeartbeat() {
	const telemetry = new TelemetryService({
		settingsStore,
		config: {
			projectKey: POSTHOG_PROJECT_KEY,
			host: POSTHOG_HOST,
		},
		metadata: {
			appVersion: app.getVersion(),
			platform: process.platform,
			arch: process.arch,
			packaged: app.isPackaged,
		},
		capture: async (request) => {
			const response = await net.fetch(request.url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(request.body),
			});
			if (!response.ok) {
				throw new Error(`Telemetry request failed: ${response.status}`);
			}
		},
	});

	void telemetry.sendHeartbeat().catch(() => undefined);
}

app.whenReady().then(async () => {
	projectStore = new ProjectStore();
	fileSystemService = new FileSystemService();
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
	piUpdateChecker = new PiUpdateChecker(
		piLocator,
		extensionManager,
		() => settingsStore.get(),
	);
	agentManager = new AgentManager(
		(id) => projectStore.get(id),
		() => mainWindow,
		settingsStore,
	);
	webServiceManager = new WebServiceManager({
		listProjects: () => projectStore.list(),
		listAgents: () => agentManager.list(),
		listSessions: (projectId) => {
			const project = projectStore.get(projectId);
			return sessionScanner.list(project?.path);
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
	registerIpc();

	sendTelemetryHeartbeat();
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
			mainWindow.show();
			mainWindow.focus();
		} else {
			createWindow();
		}
	});
});

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
