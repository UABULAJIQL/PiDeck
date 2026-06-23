import { app, ipcMain, shell, type BrowserWindow } from "electron";
import { resolve } from "node:path";
import { readFile, stat, writeFile } from "node:fs/promises";
import { ipcChannels } from "../../shared/ipc";
import type {
	AppSettings,
	CreateAgentInput,
	CreatePiSkillInput,
	QuickPromptPreset,
	SendPromptInput,
} from "../../shared/types";
import { testPiProxy } from "../pi/PiProxyTester";
import { applyDesktopProxy } from "../settings/DesktopProxy";

type RegisterIpcHandlersDeps = {
	projectStore: any;
	fileSystemService: any;
	sessionScanner: any;
	sessionPinStore: any;
	codexSessionImporter: any;
	claudeSessionImporter: any;
	settingsStore: any;
	quickPromptStore: any;
	gitService: any;
	piLocator: any;
	agentManager: any;
	configManager: any;
	skillManager: any;
	extensionManager: any;
	remarkStore: any;
	webServiceManager: any;
	terminalManager: any;
	imageAssetStore: any;
	getMainWindow: () => BrowserWindow | null;
	setIsQuitting: (value: boolean) => void;
	openExternalUrl: (url: string) => Promise<void> | void;
	openDirectoryInVSCode: (projectPath: string) => Promise<void>;
};

export function registerIpcHandlers({
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
	getMainWindow,
	setIsQuitting,
	openExternalUrl,
	openDirectoryInVSCode,
}: RegisterIpcHandlersDeps) {
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
				if (projectId && !project) return [];
				const projectPath = projectId ? project!.path : undefined;
				const sessions = await sessionScanner.list(projectPath);
				return projectId ? await sessionPinStore.decorate(projectId, sessions) : sessions;
			},
		);
		ipcMain.handle(ipcChannels.imagesCreateAsset, async (_event, image) => {
			return imageAssetStore.createFromBase64(image);
		});
		ipcMain.handle(ipcChannels.imagesDeleteAsset, async (_event, image) => {
			await imageAssetStore.remove(image);
		});
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
		ipcMain.handle(ipcChannels.appInfo, () => ({
			version: app.getVersion(),
		}));
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
			setIsQuitting(true);
			// 停止所有 Agent 和服务
			await webServiceManager?.stop();
			terminalManager?.closeAll();
			agentManager?.stopAll();
			// 重启应用
			app.relaunch();
			app.quit();
		});
		ipcMain.handle(ipcChannels.appWindowMinimize, () => {
		const window = getMainWindow();
		if (!window || window.isDestroyed()) return;
		window.minimize();
	});
		ipcMain.handle(ipcChannels.appWindowToggleMaximize, () => {
		const window = getMainWindow();
		if (!window || window.isDestroyed()) return;
		if (window.isMaximized()) window.unmaximize();
		else window.maximize();
	});
		ipcMain.handle(ipcChannels.appWindowGetMaximized, () => {
		return getMainWindow()?.isMaximized() ?? false;
	});
	
		ipcMain.handle(ipcChannels.appWindowToggleAlwaysOnTop, () => {
		const window = getMainWindow();
		if (!window || window.isDestroyed()) return false;
		const next = !window.isAlwaysOnTop();
		// floating 适合工具型桌面窗口；跨平台由 Electron 映射到各系统的置顶层级。
		window.setAlwaysOnTop(next, "floating");
		return next;
	});
		ipcMain.handle(ipcChannels.appWindowClose, () => {
		const window = getMainWindow();
		if (!window || window.isDestroyed()) return;
		window.close();
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
					settingsStore.notifyTitleBarChange(getMainWindow());
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
		const window = getMainWindow();
		if (!window || window.isDestroyed()) return false;
		if (window.webContents.isDevToolsOpened()) {
			window.webContents.closeDevTools();
			return false;
		}
		window.webContents.openDevTools({ mode: "detach" });
		return true;
	});
}
