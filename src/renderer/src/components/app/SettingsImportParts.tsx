import {
	isValidElement,
	memo,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
	type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import {
	Check,
	ChevronDown,
	ChevronRight,
	GitBranch,
	Brain,
	Folder,
	Globe2,
	MessageCircle,
	Network,
	Pin,
	Plus,
	RefreshCw,
	Settings2,
	UploadCloud,
	Wrench,
	X,
} from "lucide-react";
import { t, type TranslationKey } from "../../i18n";
import { Button } from "../ui/Button";
import { CloseIconButton, IconButton } from "../ui/IconButton";
import { SelectField } from "../ui/SelectField";
import { TextField } from "../ui/TextField";
import type {
	AgentRuntimeState,
	AgentTab,
	AppInfo,
	AppSettings,
	AvailableModel,
	ChatMessage,
	CodexImportReport,
	CodexSessionSummary,
	ClaudeImportReport,
	ClaudeSessionSummary,
	FileTreeNode,
	GitBranchInfo,
	ComposerImage,
	ImageContent,
	PiCommand,
	PiInstallStatus,
	Project,
	QuickPromptPreset,
	SessionSummary,
} from "../../../../shared/types";

import { displayPath } from "./AppChromeParts";

const PROJECT_REPO_URL = "https://github.com/UABULAJIQL/PiDeck";
const UPSTREAM_REPO_URL = "https://github.com/ayuayue/PiDeck";

export function fuzzyScore(value: string, keyword: string) {
	if (!keyword) return 1;
	const text = value.toLowerCase();
	const query = keyword.toLowerCase();
	if (text.includes(query)) return 100 + query.length;
	let score = 0;
	let pos = 0;
	for (const ch of query) {
		const found = text.indexOf(ch, pos);
		if (found === -1) return 0;
		score += found === pos ? 8 : 2;
		pos = found + 1;
	}
	return score;
}

export function SettingsModal(props: {
	settings: AppSettings;
	notice: string;
	piStatus: PiInstallStatus | null;
	piChecking: boolean;
	piProxyChecking: boolean;
	piProxyNotice: string;
	piProxyNoticeTone: "info" | "success" | "error";
	webServiceChanging: boolean;
	appInfo: AppInfo;
	customPiPath: string;
	customPathValidating: boolean;
	customPathResult: PiInstallStatus | null;
	onCustomPathChange: (path: string) => void;
	onValidateCustomPath: () => void;
	onClearCustomPath: () => void;
	onCheckPi: () => void;
	onTestPiProxy: () => void;
	onToggleDevTools: () => void;
	onRestartApp: () => void;
	onOpenWebService: (port: string) => void;
	onClose: () => void;
	onChange: (patch: Partial<AppSettings>) => void;
}) {
	const [activeTab, setActiveTab] = useState<SettingsTabId>("base");
	const [webPortDraft, setWebPortDraft] = useState(String(props.settings.webServicePort));
	const piPath = props.settings.customPiPath || props.piStatus?.command || "";
	useEffect(() => {
		setWebPortDraft(String(props.settings.webServicePort));
	}, [props.settings.webServicePort]);
	const applyWebPortDraft = () => {
		const port = Number(webPortDraft);
		if (Number.isInteger(port) && port >= 1 && port <= 65535 && port !== props.settings.webServicePort) {
			props.onChange({ webServicePort: port });
		} else {
			setWebPortDraft(String(props.settings.webServicePort));
		}
	};
	const tabs: Array<{
		id: SettingsTabId;
		label: string;
		description: string;
		icon: ReactNode;
	}> = [
		{
			id: "base",
			label: t("settings.tabs.base"),
			description: t("settings.tabs.baseDesc"),
			icon: <Settings2 size={16} />,
		},
		{
			id: "proxy",
			label: t("settings.tabs.proxy"),
			description: t("settings.tabs.proxyDesc"),
			icon: <Network size={16} />,
		},
		{
			id: "web",
			label: t("settings.tabs.web"),
			description: t("settings.tabs.webDesc"),
			icon: <Globe2 size={16} />,
		},
		{
			id: "dev",
			label: t("settings.tabs.dev"),
			description: t("settings.tabs.devDesc"),
			icon: <Wrench size={16} />,
		},
	];
	const themeOptions = [
		{ value: "system", label: t("settings.themeSystem") },
		{ value: "light", label: t("settings.themeLight") },
		{ value: "dark", label: t("settings.themeDark") },
	];
	const languageOptions = [
		{ value: "system", label: t("settings.languageSystem") },
		{ value: "zh-CN", label: t("settings.languageZh") },
		{ value: "en-US", label: t("settings.languageEn") },
		{ value: "pseudo", label: t("settings.languagePseudo") },
	];
	const sendShortcutOptions = [
		{ value: "enter-send", label: t("settings.sendShortcut.enter") },
		{ value: "ctrl-enter-send", label: t("settings.sendShortcut.ctrl") },
		{ value: "shift-enter-send", label: t("settings.sendShortcut.shift") },
	];
	const linkOpenModeOptions = [
		{ value: "external", label: t("settings.linkOpenMode.external") },
		{ value: "internal", label: t("settings.linkOpenMode.internal") },
	];

	return (
		<div className="modal-backdrop">
			<div
				className="settings-modal"
			>
				<div className="modal-header">
					<strong>{t("settings.title")}</strong>
					<CloseIconButton
						label={t("common.close")}
						onClick={props.onClose}
					/>
				</div>
				<div className="settings-layout">
					<nav className="settings-tabs" aria-label={t("settings.title")}>
						{tabs.map((tab) => (
							<button
								key={tab.id}
								className={activeTab === tab.id ? "active" : ""}
								onClick={() => setActiveTab(tab.id)}
							>
								<span className="settings-tab-icon">{tab.icon}</span>
								<span>
									<strong>{tab.label}</strong>
									<small>{tab.description}</small>
								</span>
							</button>
						))}
						<div className="settings-about">
							<strong>{t("settings.about")}</strong>
							<small>{t("settings.aboutDesc")}</small>
							<a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer">
								<span>{t("settings.aboutCurrentRepo")}</span>
								<code>{PROJECT_REPO_URL}</code>
							</a>
							<a href={UPSTREAM_REPO_URL} target="_blank" rel="noreferrer">
								<span>{t("settings.aboutUpstreamRepo")}</span>
								<code>{UPSTREAM_REPO_URL}</code>
							</a>
						</div>
					</nav>
					<div className="settings-panel">
						{activeTab === "base" && (
							<>
								<SettingsSection title={t("settings.interface")}>
									<SelectField
										className="setting-field"
										label={t("settings.theme")}
										value={props.settings.theme}
										options={themeOptions}
										onChange={(value) =>
											props.onChange({
												theme: value as AppSettings["theme"],
											})
										}
									/>
									<SelectField
										className="setting-field"
										label={t("settings.language")}
										value={props.settings.language}
										options={languageOptions}
										onChange={(value) =>
											props.onChange({
												language: value as AppSettings["language"],
											})
										}
									/>
									<SettingSwitch
										title={t("settings.nativeTitleBar")}
										checked={props.settings.useNativeTitleBar}
										onChange={(checked) =>
											props.onChange({ useNativeTitleBar: checked })
										}
									/>
									<SettingSwitch
										title={t("settings.nativeMenu")}
										checked={props.settings.showNativeMenu}
										onChange={(checked) =>
											props.onChange({ showNativeMenu: checked })
										}
									/>
								</SettingsSection>
								<SettingsSection title={t("settings.notificationSection")}>
									<SettingSwitch
										title={t("settings.closeToTray")}
										checked={props.settings.closeToTray}
										onChange={(checked) =>
											props.onChange({ closeToTray: checked })
										}
									/>
									<SettingSwitch
										title={t("settings.enableNotifications")}
										checked={props.settings.enableNotifications}
										onChange={(checked) =>
											props.onChange({ enableNotifications: checked })
										}
									/>
									<SettingSwitch
										title={t("settings.showThinking")}
										description={t("settings.showThinkingDesc")}
										checked={props.settings.showThinking}
										onChange={(checked) =>
											props.onChange({ showThinking: checked })
										}
									/>
									<SelectField
										className="setting-field"
										label={t("settings.inputShortcut")}
										value={props.settings.sendShortcut}
										options={sendShortcutOptions}
										onChange={(value) =>
											props.onChange({
												sendShortcut:
													value as AppSettings["sendShortcut"],
											})
										}
									/>
									<TextField
										className="setting-field"
										label={t("settings.rpcTimeout")}
										type="number"
										value={String(Math.round(props.settings.rpcTimeout / 1000))}
										description={t("settings.rpcTimeoutDesc")}
										onChange={(value) => {
											const seconds = Math.max(30, parseInt(value) || 600);
											props.onChange({ rpcTimeout: seconds * 1000 });
										}}
									/>
									<SelectField
										className="setting-field"
										label={t("settings.linkOpenMode")}
										description={t("settings.linkOpenModeDesc")}
										value={props.settings.linkOpenMode}
										options={linkOpenModeOptions}
										onChange={(value) =>
											props.onChange({
												linkOpenMode: value as AppSettings["linkOpenMode"],
											})
										}
									/>
									<TextField
										className="setting-field"
										label={t("settings.maxEditorFileSize")}
										description={t("settings.maxEditorFileSizeDesc")}
										type="number"
										value={String(props.settings.maxEditorFileSizeMB)}
										onChange={(value) => {
											const mb = Math.max(1, parseInt(value) || 5);
											props.onChange({ maxEditorFileSizeMB: mb });
										}}
									/>

								</SettingsSection>
							</>
						)}
						{activeTab === "proxy" && (
							<>
								<SettingsSection
									title={t("settings.piProxy")}
									description={t("settings.piProxyDesc")}
								>
									<SettingSwitch
										title={t("settings.enablePiProxy")}
										description={t("settings.settingTakesEffectAfterRestart")}
										checked={props.settings.piProxyEnabled}
										onChange={(checked) =>
											props.onChange({ piProxyEnabled: checked })
										}
									/>
									{props.settings.piProxyEnabled && (
										<div className="setting-proxy-panel">
											<TextField
												className="setting-field"
												label={t("settings.proxyUrl")}
												value={props.settings.piProxyUrl}
												placeholder="http://127.0.0.1:7890"
												onChange={(value) =>
													props.onChange({ piProxyUrl: value })
												}
											/>
											<TextField
												className="setting-field"
												label={t("settings.proxyBypass")}
												value={props.settings.piProxyBypass}
												placeholder="localhost,127.0.0.1,::1"
												description={t("settings.noProxyHint")}
												onChange={(value) =>
													props.onChange({ piProxyBypass: value })
												}
											/>
											<div className="setting-row">
												<div>
													<strong>{t("settings.proxyTest")}</strong>
													<small>
														{t("settings.proxyNoApiKey")}
													</small>
													{props.piProxyNotice && (
														<small
															className={`setting-status ${props.piProxyNoticeTone}`}
														>
															{props.piProxyNotice}
														</small>
													)}
												</div>
												<Button
													onClick={props.onTestPiProxy}
													disabled={props.piProxyChecking}
												>
													{props.piProxyChecking ? t("settings.testingProxy") : t("settings.testProxy")}
												</Button>
											</div>
										</div>
									)}
								</SettingsSection>
								<SettingsSection
									title={t("settings.desktopProxy")}
									description={t("settings.desktopProxyDesc")}
								>
									<SettingSwitch
										title={t("settings.enableDesktopProxy")}
										description={t("settings.desktopProxyDesc")}
										checked={props.settings.desktopProxyEnabled}
										onChange={(checked) =>
											props.onChange({ desktopProxyEnabled: checked })
										}
									/>
									{props.settings.desktopProxyEnabled && (
										<div className="setting-proxy-panel">
											<TextField
												className="setting-field"
												label={t("settings.proxyUrl")}
												value={props.settings.desktopProxyUrl}
												placeholder="http://127.0.0.1:7890"
												onChange={(value) =>
													props.onChange({ desktopProxyUrl: value })
												}
											/>
											<TextField
												className="setting-field"
												label={t("settings.proxyBypass")}
												value={props.settings.desktopProxyBypass}
												placeholder="localhost,127.0.0.1,::1"
												description={t("settings.electronProxyHint")}
												onChange={(value) =>
													props.onChange({ desktopProxyBypass: value })
												}
											/>
										</div>
									)}
								</SettingsSection>
							</>
						)}
						{activeTab === "web" && (
							<SettingsSection
								title={t("settings.webLocalService")}
								description={t("settings.webLocalServiceDesc")}
							>
								<SettingSwitch
									title={t("settings.enableWebService")}
									description={
										props.webServiceChanging
											? t("settings.webOpening")
											: t("settings.webOffDesc")
									}
									checked={props.settings.webServiceEnabled}
									disabled={props.webServiceChanging}
									onChange={(checked) =>
										props.onChange({ webServiceEnabled: checked })
									}
								/>
								<div className="web-endpoint-panel">
									<div className="web-endpoint-grid">
										<div className="web-endpoint-metric">
											<span>{t("common.host")}</span>
											<code>{props.settings.webServiceHost}</code>
										</div>
										<label className="web-endpoint-metric editable">
											<span>{t("common.port")}</span>
											<input
												type="number"
												min={1}
												max={65535}
												value={webPortDraft}
												disabled={props.webServiceChanging}
												onChange={(event) => setWebPortDraft(event.target.value)}
												onBlur={applyWebPortDraft}
												onKeyDown={(event) => {
													if (event.key === "Enter") {
														event.preventDefault();
														applyWebPortDraft();
														event.currentTarget.blur();
													}
												}}
											/>
										</label>
									</div>
									<div className="web-endpoint-summary">
										<span className={props.settings.webServiceEnabled ? "online" : ""} />
										<div>
											<strong>
												http://127.0.0.1:{webPortDraft || props.settings.webServicePort}
											</strong>
											<small>{t("settings.localWebHint")}</small>
										</div>
										<Button
											buttonSize="sm"
											disabled={!props.settings.webServiceEnabled}
											onClick={() => props.onOpenWebService(webPortDraft || String(props.settings.webServicePort))}
										>
											{t("common.open")}
										</Button>
									</div>
								</div>
							</SettingsSection>
						)}
						{activeTab === "dev" && (
							<>
								<SettingsSection title={t("settings.environment")}>
									<div className="setting-row">
										<div>
											<strong>{t("settings.piEnvironment")}</strong>
											<small>
												{props.piStatus
													? props.piStatus.installed
														? t("settings.foundPi", {
																version: props.piStatus.version ?? "pi",
															})
														: t("settings.piMissing")
													: t("settings.piCliAvailable")}
											</small>
											{piPath && (
												<small className="setting-path">
													{t("settings.currentPath", { path: piPath })}
												</small>
											)}
											{props.piStatus && !props.piStatus.installed && props.piStatus.error && (
												<small className="setting-status error setting-error-detail">
													{t("settings.detectFailed", {
														error: props.piStatus.error,
													})}
												</small>
											)}
										</div>
										<Button onClick={props.onCheckPi} disabled={props.piChecking}>
											{props.piChecking ? t("settings.detecting") : t("settings.detectEnvironment")}
										</Button>
									</div>
									<div className="setting-pi-path-panel">
										<TextField
											className="setting-field"
											label={t("settings.customPiPath")}
											value={props.customPiPath}
											placeholder={
												piPath ||
												"D:\\mise-data\\installs\\node\\24 13 0\\pi.cmd"
											}
											description={t("settings.customPiPathHint")}
											disabled={props.customPathValidating}
											onChange={props.onCustomPathChange}
										/>
										<div className="setting-pi-path-actions">
											<Button
												onClick={props.onValidateCustomPath}
												disabled={!props.customPiPath.trim() || props.customPathValidating}
											>
												{props.customPathValidating
													? t("settings.validating")
													: t("settings.validatePiPath")}
											</Button>
											<Button
												onClick={props.onClearCustomPath}
												disabled={!props.settings.customPiPath || props.customPathValidating}
											>
												{t("settings.clearCustomPiPath")}
											</Button>
										</div>
										{props.customPathResult && (
											<small className={`setting-status ${props.customPathResult.installed ? "success" : "error"}`}>
												{props.customPathResult.installed
													? t("settings.validatePassed", {
															value:
																props.customPathResult.command ??
																props.customPathResult.version ??
																"pi",
														})
													: t("settings.validateFailed", {
															error:
																props.customPathResult.error ??
																t("environment.unableToRun"),
														})}
											</small>
										)}
									</div>
									<div className="setting-row">
										<div>
											<strong>{t("settings.currentVersion")}</strong>
											<small>v{props.appInfo.version}</small>
										</div>
									</div>
								</SettingsSection>
								<SettingsSection title={t("settings.debug")}>
									<div className="setting-row">
										<div>
											<strong>{t("settings.restartApp")}</strong>
											<small>{t("settings.restartAppDesc")}</small>
										</div>
										<Button onClick={props.onRestartApp}>
											{t("settings.restartAppButton")}
										</Button>
									</div>
									<div className="setting-row">
										<div>
											<strong>{t("settings.devTools")}</strong>
											<small>{t("settings.devToolsDesc")}</small>
										</div>
										<Button onClick={props.onToggleDevTools}>
											{t("settings.toggle")}
										</Button>
									</div>
								</SettingsSection>
							</>
						)}
						<p>{props.notice || t("settings.restartNotice")}</p>
					</div>
				</div>
			</div>
		</div>
	);
}

export function CodexImportModal(props: {
	project: Project;
	sessions: CodexSessionSummary[];
	selectedPaths: string[];
	loading: boolean;
	importing: boolean;
	report: CodexImportReport | null;
	onClose: () => void;
	onRefresh: () => void;
	onToggle: (sourcePath: string) => void;
	onToggleAll: () => void;
	onImport: () => void;
}) {
	const selected = new Set(props.selectedPaths);
	const allSelected =
		props.sessions.length > 0 &&
		props.sessions.every((session) => selected.has(session.sourcePath));
	return (
		<div className="modal-backdrop">
			<section className="codex-import-modal">
				<div className="modal-header">
					<div>
						<strong>{t("codex.title")}</strong>
						<small>{props.project.name}</small>
					</div>
					<CloseIconButton
						label={t("common.close")}
						onClick={props.onClose}
					/>
				</div>
				<div className="codex-import-toolbar">
					<div>
						<strong>{t("codex.importCount", { count: props.sessions.length })}</strong>
						<span>{displayPath(props.project.path)}</span>
					</div>
					<div className="codex-import-actions">
						<button onClick={props.onRefresh} disabled={props.loading || props.importing}>
							<RefreshCw size={14} />
							{t("common.refresh")}
						</button>
						<button onClick={props.onToggleAll} disabled={props.sessions.length === 0}>
							<Check size={14} />
							{allSelected ? t("codex.selectNone") : t("common.selectAll")}
						</button>
						<button
							className="primary-action"
							onClick={props.onImport}
							disabled={props.importing || props.selectedPaths.length === 0}
						>
							<UploadCloud size={14} />
							{props.importing
								? t("codex.importing")
								: t("codex.importSelected", {
										count: props.selectedPaths.length,
									})}
						</button>
					</div>
				</div>
				<div className="codex-import-body">
					{props.loading ? (
						<div className="history-loading">
							<div className="loader" />
							<span>{t("codex.scanning")}</span>
						</div>
					) : props.sessions.length === 0 ? (
						<div className="codex-import-empty">
							<strong>{t("codex.emptyTitle")}</strong>
							<span>{t("codex.emptyDesc")}</span>
						</div>
					) : (
						<div className="codex-session-list">
							{props.sessions.map((session) => (
								<label key={session.sourcePath} className="codex-session-row">
									<input
										type="checkbox"
										checked={selected.has(session.sourcePath)}
										onChange={() => props.onToggle(session.sourcePath)}
									/>
									<div className="codex-session-main">
										<div className="codex-session-title">
											<strong>{session.title}</strong>
											<span className={`codex-status ${session.status}`}>
												{formatCodexStatus(session.status)}
											</span>
										</div>
										<p>{session.preview}</p>
										<small>
											{new Date(session.updatedAt).toLocaleString()} ·{" "}
											{t("drawer.sessionMessages", {
												count: session.messageCount,
											})} ·{" "}
											{formatBytes(session.sourceSize)}
										</small>
									</div>
								</label>
							))}
						</div>
					)}
				</div>
				{props.report && (
					<div className="codex-import-report">
						<strong>
							{t("codex.importDone", {
								imported: props.report.imported,
								failed: props.report.failed,
							})}
						</strong>
						<div>
							{props.report.results.map((result) => (
								<span
									key={result.sourcePath}
									className={result.success ? "success" : "error"}
									title={result.error || result.targetPath}
								>
									{result.success ? "✓" : "✗"} {result.title || result.sourcePath}
								</span>
							))}
						</div>
					</div>
				)}
			</section>
		</div>
	);
}

export function formatCodexStatus(status: CodexSessionSummary["status"]) {
	if (status === "current") return t("codex.status.current");
	if (status === "outdated") return t("codex.status.outdated");
	return t("codex.status.new");
}

export function formatClaudeStatus(status: ClaudeSessionSummary["status"]) {
	if (status === "current") return t("claude.status.current");
	if (status === "outdated") return t("claude.status.outdated");
	return t("claude.status.new");
}

export function ClaudeImportModal(props: {
	project: Project;
	sessions: ClaudeSessionSummary[];
	selectedPaths: string[];
	loading: boolean;
	importing: boolean;
	report: ClaudeImportReport | null;
	onClose: () => void;
	onRefresh: () => void;
	onToggle: (sourcePath: string) => void;
	onToggleAll: () => void;
	onImport: () => void;
}) {
	const selected = new Set(props.selectedPaths);
	const allSelected =
		props.sessions.length > 0 &&
		props.sessions.every((session) => selected.has(session.sourcePath));
	return (
		<div className="modal-backdrop">
			<section className="codex-import-modal">
				<div className="modal-header">
					<div>
						<strong>{t("claude.title")}</strong>
						<small>{props.project.name}</small>
					</div>
					<CloseIconButton
						label={t("common.close")}
						onClick={props.onClose}
					/>
				</div>
				<div className="codex-import-toolbar">
					<div>
						<strong>{t("claude.importCount", { count: props.sessions.length })}</strong>
						<span>{displayPath(props.project.path)}</span>
					</div>
					<div className="codex-import-actions">
						<button onClick={props.onRefresh} disabled={props.loading || props.importing}>
							<RefreshCw size={14} />
							{t("common.refresh")}
						</button>
						<button onClick={props.onToggleAll} disabled={props.sessions.length === 0}>
							<Check size={14} />
							{allSelected ? t("claude.selectNone") : t("common.selectAll")}
						</button>
						<button
							className="primary-action"
							onClick={props.onImport}
							disabled={props.importing || props.selectedPaths.length === 0}
						>
							<UploadCloud size={14} />
							{props.importing
								? t("claude.importing")
								: t("claude.importSelected", {
										count: props.selectedPaths.length,
									})}
						</button>
					</div>
				</div>
				<div className="codex-import-body">
					{props.loading ? (
						<div className="history-loading">
							<div className="loader" />
							<span>{t("claude.scanning")}</span>
						</div>
					) : props.sessions.length === 0 ? (
						<div className="codex-import-empty">
							<strong>{t("claude.emptyTitle")}</strong>
							<span>{t("claude.emptyDesc")}</span>
						</div>
					) : (
						<div className="codex-session-list">
							{props.sessions.map((session) => (
								<label key={session.sourcePath} className="codex-session-row">
									<input
										type="checkbox"
										checked={selected.has(session.sourcePath)}
										onChange={() => props.onToggle(session.sourcePath)}
									/>
									<div className="codex-session-main">
										<div className="codex-session-title">
											<strong>{session.title}</strong>
											<span className={`codex-status ${session.status}`}>
												{formatClaudeStatus(session.status)}
											</span>
										</div>
										<p>{session.preview}</p>
										<small>
											{new Date(session.updatedAt).toLocaleString()} ·{" "}
											{t("drawer.sessionMessages", {
												count: session.messageCount,
											})} ·{" "}
											{formatBytes(session.sourceSize)}
										</small>
									</div>
								</label>
							))}
						</div>
					)}
				</div>
				{props.report && (
					<div className="codex-import-report">
						<strong>
							{t("claude.importDone", {
								imported: props.report.imported,
								failed: props.report.failed,
							})}
						</strong>
						<div>
							{props.report.results.map((result) => (
								<span
									key={result.sourcePath}
									className={result.success ? "success" : "error"}
									title={result.error || result.targetPath}
								>
									{result.success ? "✓" : "✗"} {result.title || result.sourcePath}
								</span>
							))}
						</div>
					</div>
				)}
			</section>
		</div>
	);
}

export function formatBytes(value: number) {
	if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
	if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
	return `${value} B`;
}

export type SettingsTabId = "base" | "proxy" | "web" | "dev";

export function SettingsSection(props: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<section className="settings-section">
			<div className="settings-section-header">
				<strong>{props.title}</strong>
				{props.description && <small>{props.description}</small>}
			</div>
			<div className="settings-section-body">{props.children}</div>
		</section>
	);
}

export function SettingSwitch(props: {
	title: string;
	description?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="setting-switch-row">
			<span>
				<strong>{props.title}</strong>
				{props.description && <small>{props.description}</small>}
			</span>
			<input
				type="checkbox"
				checked={props.checked}
				disabled={props.disabled}
				onChange={(event) => props.onChange(event.target.checked)}
			/>
		</label>
	);
}
