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

import { SessionModifiedFile } from "./AppChromeParts";
import { fuzzyScore } from "./SettingsImportParts";

export function getQuickPromptTitle(content: string) {
	const firstLine = content
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find(Boolean);
	if (!firstLine) return "…";
	return firstLine.length > 36 ? `${firstLine.slice(0, 36)}…` : firstLine;
}

export const MODIFIED_FILES_PREVIEW_LIMIT = 5;

export function FilesPanel(props: {
	files: FileTreeNode[];
	/** 当前会话中 agent 修改过的文件 */
	modifiedFiles: SessionModifiedFile[];
	expandedDirs: Set<string>;
	onToggleDirectory: (path: string) => void;
	onFileContextMenu: (node: FileTreeNode, x: number, y: number) => void;
	onRefreshFiles: () => void;
	onDiffFile?: (path: string) => void;
	onOpenFile?: (path: string) => void;
	onViewFile?: (path: string) => void;
}) {
	const [modifiedFilesExpanded, setModifiedFilesExpanded] = useState(false);
	// 后端按修改时间升序传入；抽屉顶部优先展示最新文件，避免文件多时用户看不到刚改的内容。
	const latestModifiedFiles = [...props.modifiedFiles].reverse();
	const visibleModifiedFiles = modifiedFilesExpanded
		? latestModifiedFiles
		: latestModifiedFiles.slice(0, MODIFIED_FILES_PREVIEW_LIMIT);
	const hiddenModifiedFileCount = Math.max(
		0,
		latestModifiedFiles.length - visibleModifiedFiles.length,
	);

	return (
		<div className="files-panel">
			<div className="panel-action-row">
				<span>{t("drawer.fileItems", { count: props.files.length })}</span>
				<button onClick={props.onRefreshFiles}>{t("common.refresh")}</button>
			</div>
			{props.modifiedFiles.length > 0 && (
				<div className="modified-files-section">
					<div className="modified-files-header">{t("drawer.gitChangedFiles")}</div>
					{visibleModifiedFiles.map((file) => {
						const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
						const isRunning = file.status === "running";
						// 构造最小的 FileTreeNode 以复用右键菜单,保持修改清单和文件树相同的打开/定位入口。
						const fakeNode: FileTreeNode = {
							name: fileName,
							path: file.path,
							relativePath: file.path,
							type: "file",
						};
						return (
							<div
								key={file.path}
								className={`modified-file-row${isRunning ? " running" : ""}`}
								title={file.path}
								onContextMenu={(e) => {
									e.preventDefault();
									props.onFileContextMenu(fakeNode, e.clientX, e.clientY);
								}}
								onClick={() => props.onDiffFile?.(file.path)}
							>
								<span
									className={`modified-file-icon${isRunning ? "" : " done"}`}
								>
									{file.toolName === "git"
										? gitStatusIcon(file.status)
										: isRunning
											? "◌"
											: "✓"}
								</span>
								<span className="modified-file-name">{fileName}</span>
								{file.toolName === "git" && file.status !== "deleted" && (
									<span className="modified-file-lines">{file.status === "added" ? "新" : "改"}</span>
								)}
								{file.toolName !== "git" && Boolean(file.changedLines) && (
									<span className="modified-file-lines">
										{t("drawer.changedLines", {
											count: file.changedLines ?? 0,
										})}
									</span>
								)}
								<span className="modified-file-tool">{file.toolName}</span>
							</div>
						);
					})}
					{latestModifiedFiles.length > MODIFIED_FILES_PREVIEW_LIMIT && (
						<button
							className="modified-files-toggle"
							type="button"
							onClick={() => setModifiedFilesExpanded((current) => !current)}
						>
							{modifiedFilesExpanded
								? t("common.collapse")
								: t("drawer.moreFiles", { count: hiddenModifiedFileCount })}
						</button>
					)}
				</div>
			)}
			{props.files.map((node) => (
				<FileNode
					key={node.path}
					node={node}
					expandedDirs={props.expandedDirs}
					onToggleDirectory={props.onToggleDirectory}
					onFileContextMenu={props.onFileContextMenu}
					onOpenFile={props.onOpenFile}
					onViewFile={props.onViewFile}
					onDiffFile={props.onDiffFile}
				/>
			))}
		</div>
	);
}

export function SessionFileSummary(props: {
	files: SessionModifiedFile[];
	onOpenFile?: (path: string) => void;
	onDiffFile?: (path: string) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const totalLines = props.files.reduce(
		(total, file) => total + (file.changedLines ?? 0),
		0,
	);
	const visibleFiles = expanded ? props.files : props.files.slice(0, 4);
	const hiddenCount = Math.max(0, props.files.length - visibleFiles.length);
	return (
		<section className="session-file-summary-list-card" aria-label={t("drawer.modifiedFilesAria")}>
			<div className="session-file-summary-title">
				<span>{t("drawer.modifiedFiles")}</span>
				<small title={t("drawer.changedLinesEstimate")}>
					{props.files.length} {t("app.files")}
					{totalLines > 0
						? ` · ${t("drawer.changedLinesShort", { count: totalLines })}`
						: ""}
				</small>
			</div>
			<ul className="session-file-summary-list">
				{visibleFiles.map((file) => {
					const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
					return (
						<li key={file.path}>
							<button
								className="session-file-summary-row"
								type="button"
								title={file.path}
								onClick={() => props.onDiffFile?.(file.path)}
							>
								<span className="session-file-summary-name">{fileName}</span>
								<span
									className="session-file-summary-lines"
									title={t("drawer.changedLinesEstimate")}
								>
									{file.changedLines
										? `~${t("drawer.changedLines", { count: file.changedLines })}`
										: t("drawer.changed")}
								</span>
							</button>
						</li>
					);
				})}
			</ul>
			{props.files.length > 4 && (
				<button
					className="session-file-summary-toggle"
					type="button"
					onClick={() => setExpanded((current) => !current)}
				>
					{expanded ? t("common.collapse") : t("drawer.moreFiles", { count: hiddenCount })}
				</button>
			)}
		</section>
	);
}

export function FileNode(props: {
	node: FileTreeNode;
	expandedDirs: Set<string>;
	onToggleDirectory: (path: string) => void;
	onFileContextMenu: (node: FileTreeNode, x: number, y: number) => void;
	onOpenFile?: (path: string) => void;
	onViewFile?: (path: string) => void;
	onDiffFile?: (path: string) => void;
	depth?: number;
}) {
	const { node, expandedDirs, onToggleDirectory, depth = 0 } = props;
	const directoryKey = node.relativePath || node.path;
	const expanded = expandedDirs.has(directoryKey);
	// 每行保持同一个宽度，只通过 CSS 变量控制缩进；避免深层递归容器把最后一层可用宽度越压越窄。
	const rowStyle = { "--file-depth-offset": `${depth * 16}px` } as CSSProperties;
	const menu = (event: React.MouseEvent) => {
		event.preventDefault();
		props.onFileContextMenu(node, event.clientX, event.clientY);
	};
	if (node.type === "file")
		return (
			<div className="file-node" style={rowStyle}>
				<button
					className="file file-node-row"
					style={rowStyle}
					title={node.relativePath}
					onClick={() => props.onViewFile?.(node.path)}
					onContextMenu={menu}
				>
					<span className="file-node-icon">{fileIcon(node.name)}</span>
					<span className="file-node-name">{node.name}</span>
				</button>
			</div>
		);
	return (
		<div className="file-node" style={rowStyle}>
			<button
				className="directory file-node-row"
				style={rowStyle}
				onClick={() => onToggleDirectory(directoryKey)}
				onContextMenu={menu}
				title={node.relativePath}
			>
				<span className="file-node-icon">
					{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
				</span>
				<span className="file-node-name">{node.name}</span>
			</button>
			{expanded && node.children && node.children.length > 0 && (
				<div className="file-children">
					{node.children.map((child) => (
						<FileNode
							key={child.path}
							node={child}
							expandedDirs={expandedDirs}
							onToggleDirectory={onToggleDirectory}
							onFileContextMenu={props.onFileContextMenu}
							onOpenFile={props.onOpenFile}
							onViewFile={props.onViewFile}
							onDiffFile={props.onDiffFile}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

export function fileIcon(name: string) {
	if (/\.(ts|tsx|js|jsx)$/.test(name)) return "◇";
	if (/\.(md|mdx)$/.test(name)) return "M";
	if (/\.(json|yaml|yml)$/.test(name)) return "{}";
	return "·";
}

export function gitStatusIcon(status: string): string {
	switch (status) {
		case "added":
			return "+";
		case "deleted":
			return "×";
		case "renamed":
			return "→";
		default:
			return "~";
	}
}

export function SessionsPanel(props: {
	sessions: SessionSummary[];
	onRefresh: () => void;
	onOpen: (session: SessionSummary) => void;
	onRename: (filePath: string, newName: string) => void | Promise<void>;
	onCopy: (session: SessionSummary) => void | Promise<void>;
	onExport: (session: SessionSummary) => void | Promise<void>;
	onDelete: (session: SessionSummary) => void | Promise<void>;
}) {
	const [renamingPath, setRenamingPath] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [sessionActionNotice, setSessionActionNotice] = useState<{
		filePath: string;
		text: string;
	} | null>(null);
	const [sessionActionLoading, setSessionActionLoading] = useState<{
		filePath: string;
		action: "copy" | "export" | "delete";
	} | null>(null);
	const [deleteConfirmSession, setDeleteConfirmSession] =
		useState<SessionSummary | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	function startRename(session: SessionSummary) {
		setRenamingPath(session.filePath);
		setEditValue(session.name || "");
		requestAnimationFrame(() => inputRef.current?.focus());
	}

	function confirmRename() {
		if (renamingPath && editValue.trim()) {
			void props.onRename(renamingPath, editValue.trim());
		}
		setRenamingPath(null);
		setEditValue("");
	}

	async function runSessionAction(
		session: SessionSummary,
		actionType: "copy" | "export" | "delete",
		action: () => void | Promise<void>,
		successText: string,
	) {
		setSessionActionLoading({ filePath: session.filePath, action: actionType });
		setSessionActionNotice({
			filePath: session.filePath,
			text:
				actionType === "copy"
					? t("drawer.sessionActionCopying")
					: actionType === "export"
						? t("drawer.sessionActionExporting")
						: t("drawer.sessionActionDeleting"),
		});
		try {
			await action();
			setSessionActionNotice({ filePath: session.filePath, text: successText });
			window.setTimeout(() => setSessionActionNotice(null), 1600);
		} catch (error) {
			setSessionActionNotice({
				filePath: session.filePath,
				text: error instanceof Error ? error.message : t("drawer.sessionActionFailed"),
			});
			window.setTimeout(() => setSessionActionNotice(null), 2400);
		} finally {
			setSessionActionLoading(null);
		}
	}

	function renderSessionCard(session: SessionSummary) {
		return (
			<div
				key={session.filePath}
				className="session-card"
			>
				{renamingPath === session.filePath ? (
					<div className="session-rename-row">
						<input
							ref={inputRef}
							value={editValue}
							onChange={(e) => setEditValue(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") confirmRename();
								if (e.key === "Escape") {
									setRenamingPath(null);
									setEditValue("");
								}
							}}
							autoFocus
						/>
						<button onClick={confirmRename}>{t("common.save")}</button>
						<button
							onClick={() => {
								setRenamingPath(null);
								setEditValue("");
							}}
						>
							{t("common.cancel")}
						</button>
					</div>
				) : (
					<div className="session-card-display">
						<button
							className="session-card-inner"
							onClick={() => props.onOpen(session)}
							title={session.filePath}
						>
							<div className="session-card-title">
								<strong>{session.name || t("common.untitled")}</strong>
								<small>
									{new Date(session.updatedAt).toLocaleString()} ·{" "}
									{t("drawer.sessionMessages", {
										count: session.messageCount,
									})}
								</small>
							</div>
						</button>
						<div className="session-card-actions">
							<button
								className="session-rename-button"
								title={t("menu.copySession")}
								disabled={Boolean(sessionActionLoading)}
								onClick={() =>
									void runSessionAction(
										session,
										"copy",
										() => props.onCopy(session),
										t("drawer.sessionCopied"),
									)
								}
							>
								{sessionActionLoading?.filePath === session.filePath &&
									sessionActionLoading.action === "copy" && <span className="mini-loader" />}
								<span>
									{sessionActionLoading?.filePath === session.filePath &&
									sessionActionLoading.action === "copy"
										? t("menu.copying")
										: t("common.copy")}
								</span>
							</button>
							<button
								className="session-rename-button"
								title={t("menu.exportHtml")}
								disabled={Boolean(sessionActionLoading)}
								onClick={() =>
									void runSessionAction(
										session,
										"export",
										() => props.onExport(session),
										t("drawer.sessionExported"),
									)
								}
							>
								{sessionActionLoading?.filePath === session.filePath &&
									sessionActionLoading.action === "export" && <span className="mini-loader" />}
								<span>
									{sessionActionLoading?.filePath === session.filePath &&
									sessionActionLoading.action === "export"
										? t("menu.exporting")
										: t("common.export")}
								</span>
							</button>
							<button
								className="session-rename-button"
								title={t("common.rename")}
								onClick={() => startRename(session)}
							>
								<span>{t("common.rename")}</span>
							</button>
							<button
								className="session-rename-button danger"
								title={t("common.delete")}
								disabled={Boolean(sessionActionLoading)}
								onClick={() => setDeleteConfirmSession(session)}
							>
								{sessionActionLoading?.filePath === session.filePath &&
									sessionActionLoading.action === "delete" && <span className="mini-loader" />}
								<span>
									{sessionActionLoading?.filePath === session.filePath &&
									sessionActionLoading.action === "delete"
										? t("drawer.sessionActionDeleting")
										: t("common.delete")}
								</span>
							</button>
						</div>
						{sessionActionNotice?.filePath === session.filePath && (
							<div className="session-action-notice">{sessionActionNotice.text}</div>
						)}
					</div>
				)}
			</div>
		);
	}


	return (
		<div className="sessions-panel">
			<div className="panel-action-row">
				<span>{t("drawer.sessionCount", { count: props.sessions.length })}</span>
				<button onClick={props.onRefresh}>{t("common.refresh")}</button>
			</div>
			{props.sessions.length === 0 && (
				<div className="sessions-empty">
					<strong>{t("drawer.sessionEmptyTitle")}</strong>
					<span>{t("drawer.sessionEmptyDesc")}</span>
				</div>
			)}
			{props.sessions.map(renderSessionCard)}
			{deleteConfirmSession && (
				<div className="session-delete-confirm-backdrop" onClick={() => setDeleteConfirmSession(null)}>
					<section
						className="session-delete-confirm"
						onClick={(event) => event.stopPropagation()}
					>
						<strong>{t("drawer.sessionDeleteTitle")}</strong>
						<p>
							{t("drawer.sessionDeleteBody", {
								name: deleteConfirmSession.name || t("common.untitled"),
							})}
						</p>
						<div className="session-delete-confirm-actions">
							<button onClick={() => setDeleteConfirmSession(null)}>{t("common.cancel")}</button>
							<button
								className="danger"
								onClick={() => {
									const target = deleteConfirmSession;
									setDeleteConfirmSession(null);
									void runSessionAction(
										target,
										"delete",
										() => props.onDelete(target),
										t("drawer.sessionDeleted"),
									);
								}}
							>
								{t("common.delete")}
							</button>
						</div>
					</section>
				</div>
			)}
		</div>
	);
}

export function SessionHistoryModal(props: {
	project: Project;
	sessions: SessionSummary[];
	loading: boolean;
	onClose: () => void;
	onRefresh: () => void;
	onOpen: (session: SessionSummary) => void;
	onRename: (filePath: string, newName: string) => void | Promise<void>;
	onCopy: (session: SessionSummary) => void | Promise<void>;
	onExport: (session: SessionSummary) => void | Promise<void>;
	onDelete: (session: SessionSummary) => void | Promise<void>;
}) {
	return (
		<div className="picker-backdrop session-history-backdrop" onClick={props.onClose}>
			<section
				className="session-history-modal command-palette"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="command-palette-header session-history-header">
					<div>
						<strong>{t("drawer.historyTitle")}</strong>
						<span>{props.project.name}</span>
					</div>
					<IconButton
						className="command-palette-close"
						label={t("common.close")}
						onClick={props.onClose}
					>
						<X size={16} strokeWidth={2.2} aria-hidden="true" />
					</IconButton>
				</div>
				<div className="session-history-path" title={props.project.path}>
					{props.project.path}
				</div>
				<div className="session-history-body">
					{props.loading ? (
						<div className="session-history-loading">
							<div className="loader" />
							<span>{t("drawer.historyLoading")}</span>
						</div>
					) : (
						<SessionsPanel
							sessions={props.sessions}
							onRefresh={props.onRefresh}
							onOpen={props.onOpen}
							onRename={props.onRename}
							onCopy={props.onCopy}
							onExport={props.onExport}
							onDelete={props.onDelete}
						/>
					)}
				</div>
			</section>
		</div>
	);
}

export function flattenFiles(nodes: FileTreeNode[]): FileTreeNode[] {
	return nodes.flatMap((node) =>
		node.type === "file" ? [node] : flattenFiles(node.children ?? []),
	);
}

export function applySuggestion(current: string, value: string) {
	const index = findTriggerIndex(current);
	if (index === -1) return `${current}${value} `;
	return `${current.slice(0, index)}${value} `;
}

export function clearSuggestionTrigger(current: string) {
	const index = findTriggerIndex(current);
	if (index === -1) return current;
	return current.slice(0, index);
}

export function findTriggerIndex(current: string) {
	const lastSlash = current.lastIndexOf("/");
	const lastAt = current.lastIndexOf("@");
	return Math.max(lastSlash, lastAt);
}

export type SuggestionItem = {
	key: string;
	label: string;
	description: string;
	value: string;
	kind: "command" | "file";
	source?: PiCommand["source"];
};

export function buildSuggestionItems(
	prompt: string,
	commands: PiCommand[],
	files: FileTreeNode[],
): SuggestionItem[] {
	const allCommands = mergeCommands(commands);
	const tail = prompt.split(/\s/).at(-1) ?? "";
	if (tail.startsWith("/")) {
		const keyword = tail.slice(1).toLowerCase();
		return allCommands
			.map((command, index) => ({ command, index }))
			.filter(({ command }) => command.name.toLowerCase().includes(keyword))
			.sort((a, b) => {
				const aPinned = PINNED_COMMAND_NAMES.has(a.command.name);
				const bPinned = PINNED_COMMAND_NAMES.has(b.command.name);
				if (aPinned !== bPinned) return aPinned ? -1 : 1;
				return a.index - b.index;
			})
			.map(({ command }) => ({
				key: command.name,
				label: `/${command.name}`,
				description: command.description ?? "",
				value: `/${command.name}`,
				kind: "command" as const,
				source: command.source,
			}));
	}
	if (tail.startsWith("@")) {
		const keyword = tail.slice(1).toLowerCase();
		return files
			.map((file) => ({
				file,
				score:
					fuzzyScore(file.relativePath, keyword) +
					fuzzyScore(file.name, keyword) * 2,
			}))
			.filter((item) => item.score > 0 || !keyword)
			.sort((a, b) => b.score - a.score)
			.slice(0, 8)
			.map((item) => ({
				key: item.file.path,
				label: `@${item.file.name}`,
				description: item.file.relativePath,
				value: `@${item.file.relativePath}`,
				kind: "file" as const,
			}));
	}
	return [];
}

export function mergeCommands(commands: PiCommand[]) {
	const visibleCommands = commands.filter(isVisibleDesktopCommand);
	const names = new Set(visibleCommands.map((command) => command.name));
	const extras = getBuiltinCommands().filter(
		(command) => !names.has(command.name) && isVisibleDesktopCommand(command),
	);
	return [...visibleCommands, ...extras];
}

export const PINNED_COMMAND_NAMES = new Set<string>();

export const HIDDEN_DESKTOP_BUILTIN_COMMAND_NAMES = new Set([
	"new",
	"model",
	"resume",
	"fork",
	"name",
	"session",
	"tree",
	"clone",
	"copy",
	"export",
	"share",
	"settings",
	"reload",
	"hotkeys",
	"login",
	"logout",
]);

export function isBuiltinDesktopCommand(command: PiCommand) {
	// get_commands 可能返回 source 为空的 pi 内置命令;扩展/skill 命令通常带有自己的 source。
	// Desktop 只隐藏 CLI 内置命令,避免误伤用户自己安装的同名扩展能力。
	return command.source == null || command.source === "builtin";
}

export function isVisibleDesktopCommand(command: PiCommand) {
	return !(
		isBuiltinDesktopCommand(command) &&
		HIDDEN_DESKTOP_BUILTIN_COMMAND_NAMES.has(command.name.toLowerCase())
	);
}

export function getBuiltinCommands(): PiCommand[] {
	return [
	{
		name: "session",
		description: t("prompt.command.session.description"),
		source: "builtin",
	},
	{
		name: "tree",
		description: t("prompt.command.tree.description"),
		source: "builtin",
	},
	{ name: "clone", description: t("prompt.command.clone.description"), source: "builtin" },
	{
		name: "compact",
		description: t("prompt.command.compact.description"),
		source: "builtin",
	},
	{ name: "copy", description: t("prompt.command.copy.description"), source: "builtin" },
	{ name: "export", description: t("prompt.command.export.description"), source: "builtin" },
	{
		name: "share",
		description: t("prompt.command.share.description"),
		source: "builtin",
	},
	{ name: "settings", description: t("prompt.command.settings.description"), source: "builtin" },
	{ name: "restart", description: t("prompt.command.restart.description"), source: "builtin" },
	{ name: "hotkeys", description: t("prompt.command.hotkeys.description"), source: "builtin" },
	{
		name: "login",
		description: t("prompt.command.login.description"),
		source: "builtin",
	},
	{ name: "logout", description: t("prompt.command.logout.description"), source: "builtin" },
	];
}

export function PromptSuggestions(props: {
	prompt: string;
	items: SuggestionItem[];
	selectedIndex: number;
	onSelectedIndexChange: (index: number) => void;
	onClose: () => void;
	onPick: (value: string) => void;
}) {
	const listRef = useRef<HTMLDivElement>(null);
	const tail = props.prompt.split(/\s/).at(-1) ?? "";

	// 滚动到选中项
	useEffect(() => {
		const list = listRef.current;
		if (!list) return;
		const item = list.children[props.selectedIndex] as HTMLElement;
		if (item) {
			item.scrollIntoView({ block: "nearest" });
		}
	}, [props.selectedIndex]);

	if (props.items.length === 0) return null;

	return (
		<div className="command-palette">
			<div className="command-palette-header">
				<span>{tail.startsWith("/") ? t("prompt.commands") : t("prompt.files")}</span>
				<IconButton
					className="command-palette-close"
					label={t("common.close")}
					onClick={props.onClose}
				>
					<X size={16} strokeWidth={2.2} aria-hidden="true" />
				</IconButton>
			</div>
			<div className="command-palette-list" ref={listRef}>
				{props.items.map((item, index) => (
					<button
						key={item.key}
						className={`command-palette-item${index === props.selectedIndex ? " selected" : ""}`}
						onMouseEnter={() => props.onSelectedIndexChange(index)}
						onClick={() => props.onPick(item.value)}
					>
						<span className="command-palette-label">{item.label}</span>
						<span className="command-palette-desc">{item.description}</span>
					</button>
				))}
			</div>
			<div className="command-palette-footer">
				<span>{t("prompt.selectHint")}</span>
				<span>{t("prompt.confirmHint")}</span>
				<span>{t("prompt.closeHint")}</span>
			</div>
		</div>
	);
}
