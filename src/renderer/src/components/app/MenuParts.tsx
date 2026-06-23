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

export function ConfirmDialog(props: {
	title: string;
	message: string;
	onConfirm: () => void;
	onCancel: () => void;
	confirmLabel?: string;
	danger?: boolean;
}) {
	const confirmRef = useRef<HTMLButtonElement>(null);

	// 挂载时自动聚焦确认按钮，并监听键盘事件
	useEffect(() => {
		const btn = confirmRef.current;
		// 延迟一帧确保 DOM 已渲染
		const frame = requestAnimationFrame(() => btn?.focus());

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				props.onCancel();
			} else if (e.key === "Enter") {
				e.preventDefault();
				props.onConfirm();
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, []);

	return (
		<div className="config-modal-overlay" onClick={props.onCancel}>
			<div className="config-modal-dialog" onClick={(e) => e.stopPropagation()}>
				<strong>{props.title}</strong>
				<p>{props.message}</p>
				<div className="config-modal-actions">
					<button className="config-btn" onClick={props.onCancel}>
						{t("common.cancel")}
					</button>
					<button
						ref={confirmRef}
						className={`config-btn${props.danger ? " danger" : " primary"}`}
						onClick={props.onConfirm}
					>
						{props.confirmLabel ?? t("common.confirm")}
					</button>
				</div>
			</div>
		</div>
	);
}

export function FileContextMenu(props: {
	menu: { x: number; y: number; node: FileTreeNode };
	onClose: () => void;
	onOpen: () => void;
	onReveal: () => void;
	onAttach: () => void;
	onCopyPath: () => void;
	onDelete?: () => void;
	onRename?: () => void;
}) {
	const isFile = props.menu.node.type === "file";
	return (
		<div className="context-backdrop" onClick={props.onClose}>
			<div
				className="context-menu"
				style={{ left: props.menu.x, top: props.menu.y }}
				onClick={(event) => event.stopPropagation()}
			>
				<button disabled={!isFile} onClick={props.onAttach}>
					{t("menu.attachFile")}
				</button>
				<button disabled={!isFile} onClick={props.onOpen}>
					{t("menu.defaultOpen")}
				</button>
				<button onClick={props.onReveal}>{t("menu.revealFile")}</button>
				<button onClick={props.onCopyPath}>{t("menu.copyPath")}</button>
				{props.onRename && (
					<button onClick={props.onRename}>{t("common.rename")}</button>
				)}
				{props.onDelete && (
					<button className="danger" onClick={props.onDelete}>
						{t("common.delete")}
					</button>
				)}
			</div>
		</div>
	);
}

export function ProjectContextMenu(props: {
	menu: { x: number; y: number; project: Project };
	onClose: () => void;
	onRevealProject: () => void;
	onTogglePin: () => void;
	onImportCodexSessions: () => void;
	onImportClaudeSessions: () => void;
	onRemoveProject: () => void;
}) {
	return (
		<div className="context-backdrop" onClick={props.onClose}>
			<div
				className="context-menu"
				style={{ left: props.menu.x, top: props.menu.y }}
				onClick={(event) => event.stopPropagation()}
			>
				<button onClick={props.onRevealProject}>{t("menu.revealProject")}</button>
				<button onClick={props.onTogglePin}>
					{props.menu.project.pinned ? t("drawer.unpinProject") : t("drawer.pinProject")}
				</button>
				<button onClick={props.onImportCodexSessions}>
					{t("menu.importCodex")}
				</button>
				<button onClick={props.onImportClaudeSessions}>
					{t("menu.importClaude")}
				</button>
				<button onClick={props.onRemoveProject}>{t("menu.removeProject")}</button>
			</div>
		</div>
	);
}

export function AgentContextMenu(props: {
	menu: { x: number; y: number; agent: AgentTab };
	actionLoading?: "copy" | "export" | null;
	onClose: () => void;
	onRename: () => void;
	onRestart: () => void;
	onExport: () => void;
	onCopySession: () => void;
	onShowLogs: () => void;
	onCloseAgent: () => void;
}) {
	return (
		<div className="context-backdrop" onClick={props.onClose}>
			<div
				className="context-menu"
				style={{ left: props.menu.x, top: props.menu.y }}
				onClick={(event) => event.stopPropagation()}
			>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onRename}>{t("common.rename")}</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onRestart}>{t("app.restart")}</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onCopySession}>
					{props.actionLoading === "copy" && <span className="mini-loader" />}
					{props.actionLoading === "copy" ? t("menu.copying") : t("menu.copySession")}
				</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onExport}>
					{props.actionLoading === "export" && <span className="mini-loader" />}
					{props.actionLoading === "export" ? t("menu.exporting") : t("menu.exportHtml")}
				</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onShowLogs}>{t("menu.rpcLogs")}</button>
				<button className="danger" onClick={props.onCloseAgent}>{t("menu.closeAgent")}</button>
			</div>
		</div>
	);
}

export function SessionContextMenu(props: {
	menu: { x: number; y: number; session: SessionSummary };
	actionLoading?: "copy" | "export" | null;
	onClose: () => void;
	onRestartSession: () => void;
	onRename: () => void;
	onExport: () => void;
	onCopySession: () => void;
	onShowLogs: () => void;
	onTogglePin: () => void;
	onDeleteSession: () => void;
}) {
	return (
		<div className="context-backdrop" onClick={props.onClose}>
			<div
				className="context-menu"
				style={{ left: props.menu.x, top: props.menu.y }}
				onClick={(event) => event.stopPropagation()}
			>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onRestartSession}>{t("app.restart")}</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onRename}>{t("common.rename")}</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onTogglePin}>
					{props.menu.session.pinned ? t("app.sessionUnpin") : t("app.sessionPin")}
				</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onCopySession}>
					{props.actionLoading === "copy" && <span className="mini-loader" />}
					{props.actionLoading === "copy" ? t("menu.copying") : t("menu.copySession")}
				</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onExport}>
					{props.actionLoading === "export" && <span className="mini-loader" />}
					{props.actionLoading === "export" ? t("menu.exporting") : t("menu.exportHtml")}
				</button>
				<button disabled={Boolean(props.actionLoading)} onClick={props.onShowLogs}>{t("menu.rpcLogs")}</button>
				<button
					className="danger"
					disabled={Boolean(props.actionLoading)}
					onClick={props.onDeleteSession}
				>
					{t("common.delete")}
				</button>
			</div>
		</div>
	);
}
