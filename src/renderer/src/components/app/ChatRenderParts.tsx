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

import { DrawerPanel } from "./AppChromeParts";
import { FilesPanel, SessionsPanel } from "./DrawerSessionParts";

export function ImagePreviewModal(props: {
	image: ComposerImage;
	onClose: () => void;
}) {
	return (
		<div className="image-preview-modal" onClick={props.onClose}>
			<button
				className="image-preview-close"
				onClick={props.onClose}
				aria-label={t("app.imagePreviewClose")}
			>
				<X size={20} strokeWidth={2.4} />
			</button>
			<img
				src={props.image.type === "image-asset" ? (props.image.previewUrl ?? "") : `data:${props.image.mimeType};base64,${props.image.data}`}
				alt={t("app.imagePreviewAlt")}
				onClick={(event) => event.stopPropagation()}
			/>
		</div>
	);
}

export const ANSI_RE = /\x1b\[[0-9;]*[a-zA-Z]/g;

export function stripAnsi(text: string): string {
	return text.replace(ANSI_RE, "");
}

export function stripThinkingTags(text: string): string {
	return text.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
}

export const ChatBubble = memo(function ChatBubble(props: {
	message: ChatMessage;
	onPreviewImage: (image: ComposerImage) => void;
	showThinking?: boolean;
	onOpenExternal: (url: string) => void;
	onOpenFile?: (path: string) => void;
	onUndoUserMessage?: (message: ChatMessage) => void;
	onResendUserMessage?: (message: ChatMessage) => void;
	compact?: boolean;
}) {
	const { message } = props;
	const [expanded, setExpanded] = useState(false);
	const isUser = message.role === "user";
	const isTool = message.role === "tool";
	const isAssistant = message.role === "assistant";
	const hasThinking =
		isAssistant &&
		props.showThinking &&
		message.thinking &&
		message.thinking.length > 0;
	const [thinkingExpanded, setThinkingExpanded] = useState(false);
	const thinkingPreviewLen = 200;
	const thinkingNeedsTruncate =
		(message.thinking?.length ?? 0) > thinkingPreviewLen;
	const thinkingDisplayText =
		thinkingExpanded || !thinkingNeedsTruncate
			? (message.thinking ?? "")
			: (message.thinking ?? "").slice(0, thinkingPreviewLen) + "...";
	const label = message.role === "assistant" ? "pi" : message.role;
	const deliveryBehavior =
		message.role === "user" ? message.meta?.streamingBehavior : undefined;
	const deliveryLabel =
		deliveryBehavior === "steer"
			? t("app.messageDeliverySteer")
			: deliveryBehavior === "followUp"
				? t("app.messageDeliveryFollowUp")
				: null;
	const detailText =
		typeof message.meta?.detailText === "string"
			? message.meta.detailText
			: JSON.stringify(message.meta ?? {}, null, 2);
	// 过滤 ANSI 转义码,pi 终端输出的颜色序列在桌面 UI 中无意义
	const cleanText = stripThinkingTags(stripAnsi(message.text));
	const cleanDetail = stripAnsi(detailText);
	return (
		<article
			data-message-id={message.id}
			className={[
				isUser ? "chat-message mine" : `chat-message ${message.role}`,
				props.compact ? "compact-message" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<div className="msg-avatar">
				{isUser ? t("app.userAvatar") : label.slice(0, 1).toUpperCase()}
			</div>
			<div className="msg-content">
				<div className="msg-name">
					<span>{label}</span>
					<time>
						{deliveryLabel && (
							<span
								className={`message-delivery-badge ${deliveryBehavior === "followUp" ? "follow-up" : "steer"}`}
								title={
									deliveryBehavior === "followUp"
										? t("app.messageDeliveryFollowUpTitle")
										: t("app.messageDeliverySteerTitle")
								}
							>
								{deliveryLabel}
							</span>
						)}
						{formatTime(message.timestamp)}
					</time>
				</div>
				<div className={`msg-bubble ${isUser ? "" : "markdown-body"}`}>
					{/* 思考内容展示:可折叠,默认收起长文本 */}
					{hasThinking && (
						<div className="thinking-block">
							<div
								className="thinking-header"
								onClick={() => setThinkingExpanded((v) => !v)}
							>
								<Brain size={14} />
								<span>{t("thinking.title")}</span>
								<em>{thinkingExpanded ? t("common.collapse") : t("common.expand")}</em>
							</div>
							{thinkingExpanded && (
								<div className="thinking-content">{thinkingDisplayText}</div>
							)}
						</div>
					)}
					{/* 显示消息中附加的图片 */}
					{message.images && message.images.length > 0 && (
						<div className="message-images">
							{message.images.map((img, index) => (
								<img
									key={index}
									src={img.type === "image-asset" ? (img.previewUrl ?? "") : `data:${img.mimeType};base64,${img.data}`}
									alt={t("app.imageAlt", { index: index + 1 })}
									className="message-image"
									onClick={() => props.onPreviewImage(img)}
								/>
							))}
						</div>
					)}
					{/* 用户消息使用纯文本显示,避免特殊字符被 markdown 解释导致渲染异常 */}
					{isUser ? (
						<div className="user-message-text">{cleanText}</div>
					) : (
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							urlTransform={markdownUrlTransform}
							components={{
								pre: CodeBlock,
								a: (linkProps) => (
									<MarkdownLink
										{...linkProps}
										onOpenExternal={props.onOpenExternal}
										onOpenFile={props.onOpenFile}
									/>
								),
							}}
						>
							{linkifyFilePaths(cleanText)}
						</ReactMarkdown>
					)}
					{expanded && <pre className="tool-detail">{cleanDetail}</pre>}
				</div>
				<div className="msg-actions">
					<button
						onClick={() =>
							navigator.clipboard.writeText(
								expanded && isTool ? cleanDetail : cleanText,
							)
						}
					>
						{t("common.copy")}
					</button>
					{isTool && (
						<button onClick={() => setExpanded((value) => !value)}>
							{expanded ? t("common.collapse") : t("common.details")}
						</button>
					)}
					{isUser && (
						<>
							<button
								onClick={() => {
									const text = message.text;
									// 编辑只把原消息放回输入框,不自动发送,方便用户二次加工。
									document
										.querySelector<HTMLTextAreaElement>(".composer-box textarea")
										?.focus();
									// 触发自定义事件让 App 层处理编辑
									window.dispatchEvent(
										new CustomEvent("user-message-edit", {
											detail: { text },
										}),
									);
								}}
							>
								{t("common.edit")}
							</button>
							{props.onUndoUserMessage && (
							<button
								onClick={() => props.onUndoUserMessage?.(message)}
								title={t("app.undoTitle")}
							>
								{t("app.undo")}
							</button>
						)}
						<button
								onClick={() => props.onResendUserMessage?.(message)}
								title={t("app.resendTitle")}
							>
								{t("app.resend")}
							</button>
						</>
					)}
				</div>
			</div>
		</article>
	);
});

export function CodeBlock(props: React.HTMLAttributes<HTMLPreElement>) {
	const text = extractText(props.children);
	return (
		<div className="code-block-wrap">
			<button
				className="code-copy"
				onClick={() => navigator.clipboard.writeText(text)}
			>
				{t("code.copy")}
			</button>
			<pre {...props}>{props.children}</pre>
		</div>
	);
}

export function markdownUrlTransform(url: string): string {
	// react-markdown 默认会清空 file:// 协议；这里只放行本地文件链接，普通外链仍使用默认安全过滤。
	return url.startsWith("file://") ? url : defaultUrlTransform(url);
}

export function MarkdownLink(
	props: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
		onOpenExternal: (url: string) => void;
		onOpenFile?: (path: string) => void;
	},
) {
	const { onOpenExternal, onOpenFile, ...anchorProps } = props;
	const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault();
		if (!props.href) return;
		
		// 处理文件路径链接（file:// 协议）
		if (props.href.startsWith('file://')) {
			const filePath = decodeURIComponent(props.href.slice(7));
			if (onOpenFile) {
				void onOpenFile(filePath);
			}
		} else {
			// 普通 URL 链接用系统浏览器打开
			void onOpenExternal(props.href);
		}
	};
	return <a {...anchorProps} onClick={handleClick} />;
}

export function linkifyFilePaths(text: string): string {
	const protectedRanges = collectMarkdownProtectedRanges(text);
	// 支持常见文件路径：Windows 盘符路径、Unix 绝对路径、./ 或 ../ 相对路径、src/file.ts 这类项目相对路径。
	// 排除 Markdown 控制字符和 URL 常见字符，防止匹配到已有链接语法或普通 http(s) 地址。
	const filePathRegex = /(?:['"`])?(?:(?:[A-Z]:\\|[A-Z]:\/|\.\.?\/|\/)[^\s<>"'`|?*\n\[\]()]+|(?:[a-zA-Z_][a-zA-Z0-9_-]*[\\/])+[^\s<>"'`|?*\n\[\]()]+)\.[a-zA-Z0-9]+(?:['"`])?/g;
	const replacements: Array<{ start: number; end: number; value: string }> = [];

	for (const match of text.matchAll(filePathRegex)) {
		const start = match.index ?? 0;
		const end = start + match[0].length;
		if (overlapsProtectedRange(start, end, protectedRanges)) continue;

		let path = match[0].trim();
		if (/^['"`]/.test(path)) path = path.slice(1);
		if (/['"`]$/.test(path)) path = path.slice(0, -1);
		if (!path) continue;

		replacements.push({
			start,
			end,
			value: `[${path}](file://${encodeFileLinkPath(path)})`,
		});
	}

	let result = text;
	// 从后向前替换，避免前面的替换改变后续匹配下标。
	for (const item of replacements.reverse()) {
		result = `${result.slice(0, item.start)}${item.value}${result.slice(item.end)}`;
	}
	return result;
}

export function encodeFileLinkPath(path: string): string {
	const normalizedPath = path.replace(/\\/g, "/");
	return normalizedPath
		.split("/")
		.map((part) => (/^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)))
		.join("/");
}

export function collectMarkdownProtectedRanges(text: string): Array<{ start: number; end: number }> {
	return mergeRanges([
		...collectMarkdownLinkRanges(text),
		...collectMarkdownCodeRanges(text),
		...collectUrlRanges(text),
	]);
}

export function overlapsProtectedRange(start: number, end: number, ranges: Array<{ start: number; end: number }>): boolean {
	return ranges.some((range) => start < range.end && end > range.start);
}

export function collectMarkdownLinkRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	const linkRegex = /\[[^\]\n]+\]\([^\)\n]+\)/g;
	for (const match of text.matchAll(linkRegex)) {
		const start = match.index ?? 0;
		ranges.push({ start, end: start + match[0].length });
	}
	return ranges;
}

export function collectMarkdownCodeRanges(text: string): Array<{ start: number; end: number }> {
	return mergeRanges([...collectFencedCodeRanges(text), ...collectInlineCodeRanges(text)]);
}

export function collectFencedCodeRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	let openFence: { start: number; markerChar: string; length: number } | null = null;
	const lineRegex = /[^\n]*(?:\n|$)/g;

	for (const match of text.matchAll(lineRegex)) {
		const line = match[0];
		const lineStart = match.index ?? 0;
		if (!line && lineStart >= text.length) continue;

		const content = line.replace(/\r?\n$/, "");
		const fenceMatch = content.match(/^(?: {0,3})(`{3,}|~{3,})/);
		if (!fenceMatch) continue;

		const marker = fenceMatch[1] ?? "";
		const markerChar = marker[0] ?? "";
		if (!openFence) {
			openFence = { start: lineStart, markerChar, length: marker.length };
			continue;
		}

		if (markerChar === openFence.markerChar && marker.length >= openFence.length) {
			ranges.push({ start: openFence.start, end: lineStart + line.length });
			openFence = null;
		}
	}

	if (openFence) ranges.push({ start: openFence.start, end: text.length });
	return ranges;
}

export function collectInlineCodeRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	let index = 0;

	while (index < text.length) {
		if (text[index] !== "`") {
			index += 1;
			continue;
		}

		const start = index;
		let tickCount = 1;
		while (text[start + tickCount] === "`") tickCount += 1;

		const marker = "`".repeat(tickCount);
		const end = text.indexOf(marker, start + tickCount);
		if (end < 0) {
			index = start + tickCount;
			continue;
		}

		ranges.push({ start, end: end + tickCount });
		index = end + tickCount;
	}

	return ranges;
}

export function collectUrlRanges(text: string): Array<{ start: number; end: number }> {
	const ranges: Array<{ start: number; end: number }> = [];
	const urlRegex = /\b(?:https?:\/\/|file:\/\/)[^\s<>"'`]+/g;
	for (const match of text.matchAll(urlRegex)) {
		const start = match.index ?? 0;
		ranges.push({ start, end: start + match[0].length });
	}
	return ranges;
}

export function mergeRanges(ranges: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
	const sortedRanges = ranges
		.filter((range) => range.end > range.start)
		.sort((left, right) => left.start - right.start || left.end - right.end);
	const merged: Array<{ start: number; end: number }> = [];

	for (const range of sortedRanges) {
		const last = merged[merged.length - 1];
		if (last && range.start <= last.end) {
			last.end = Math.max(last.end, range.end);
		} else {
			merged.push({ ...range });
		}
	}

	return merged;
}

export function extractText(node: ReactNode): string {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (Array.isArray(node)) return node.map(extractText).join("");
	if (isValidElement<{ children?: ReactNode }>(node))
		return extractText(node.props.children);
	return "";
}

export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}.${Math.floor((ms % 1000) / 100)}s`;
	const minutes = Math.floor(seconds / 60);
	const remaining = seconds % 60;
	return remaining > 0 ? `${minutes}m${remaining}s` : `${minutes}m`;
}

export function formatTime(timestamp: number) {
	return new Date(timestamp).toLocaleString(undefined, {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function buildOutline(messages: ChatMessage[]) {
	return messages
		.filter(
			(message) => message.role === "user" || message.role === "assistant",
		)
		.map((message) => ({
			id: message.id,
			role: message.role,
			title: summarizeMessage(message.text),
			time: formatTime(message.timestamp),
		}))
		.filter((item) => item.title);
}

export function summarizeMessage(text: string) {
	// 过滤 ANSI 转义码,避免 outline 标题显示乱码
	const cleaned = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
	const firstLine =
		cleaned
			.replace(/```[\s\S]*?```/g, " ")
			.split(/\r?\n/)
			.map((line) => line.trim())
			.find(Boolean) ?? "";
	return firstLine.length > 48 ? `${firstLine.slice(0, 48)}...` : firstLine;
}

export function RpcLogModal(props: {
	logs: Array<{
		id: string;
		agentId: string;
		direction: string;
		summary: string;
		time: number;
		data?: unknown;
	}>;
	onClose: () => void;
}) {
	const panelRef = useRef<HTMLDivElement>(null);
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [directionFilter, setDirectionFilter] = useState<"all" | "send" | "recv">("all");
	const [keyword, setKeyword] = useState("");
	const normalizedKeyword = keyword.trim().toLowerCase();
	const visibleLogs = props.logs
		.filter((log) => directionFilter === "all" || log.direction === directionFilter)
		.filter((log) => {
			if (!normalizedKeyword) return true;
			// 搜索同时覆盖摘要和完整 JSON,方便直接查 502、terminated、auto_retry 等排障关键词。
			return formatRpcLogForCopy(log).toLowerCase().includes(normalizedKeyword);
		})
		.slice(-2000);

	useEffect(() => {
		const el = panelRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [props.logs.length, visibleLogs.length]);

	const copyLogs = (logs: typeof visibleLogs) =>
		navigator.clipboard.writeText(logs.map(formatRpcLogForCopy).join("\n"));

	return (
		<div className="modal-backdrop" onClick={props.onClose}>
			<div className="rpc-log-modal" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header rpc-log-header">
					<strong>
						{t("rpc.title", {
							visible: visibleLogs.length,
							total: props.logs.length,
						})}
					</strong>
					<div className="modal-header-actions rpc-log-header-actions">
						<button className="config-btn primary" onClick={() => copyLogs(props.logs)}>
							{t("common.copyAll")}
						</button>
						<button className="config-btn blue" onClick={() => copyLogs(visibleLogs)}>
							{t("common.copyVisible")}
						</button>
						<CloseIconButton
							label={t("common.close")}
							onClick={props.onClose}
						/>
					</div>
				</div>
				<div className="rpc-log-toolbar">
					<div className="rpc-log-filter-tabs">
						<button
							className={directionFilter === "all" ? "active" : ""}
							onClick={() => setDirectionFilter("all")}
						>
							{t("rpc.filterAll")}
						</button>
						<button
							className={directionFilter === "send" ? "active" : ""}
							onClick={() => setDirectionFilter("send")}
						>
							{t("rpc.filterSend")}
						</button>
						<button
							className={directionFilter === "recv" ? "active" : ""}
							onClick={() => setDirectionFilter("recv")}
						>
							{t("rpc.filterReceive")}
						</button>
					</div>
					<input
						value={keyword}
						onChange={(event) => setKeyword(event.target.value)}
						placeholder={t("rpc.searchPlaceholder")}
					/>
				</div>
				<div className="rpc-log-list" ref={panelRef}>
					{visibleLogs.map((log) => {
						const jsonText = JSON.stringify(log.data ?? {}, null, 2);
						return (
							<div key={log.id} className="rpc-log-entry-wrap">
								<div
									className={`rpc-log-entry ${log.direction === "send" ? "log-send" : "log-recv"}`}
									onClick={() =>
										setExpandedId(expandedId === log.id ? null : log.id)
									}
								>
									<time>
										{new Date(log.time).toLocaleTimeString(undefined, {
											hour: "2-digit",
											minute: "2-digit",
											second: "2-digit",
										})}
									</time>
									<span className="log-direction">
										{log.direction === "send" ? "→" : "←"}
									</span>
									<span className="log-summary">{log.summary}</span>
									<div className="rpc-log-entry-actions" onClick={(event) => event.stopPropagation()}>
										<button onClick={() => navigator.clipboard.writeText(formatRpcLogForCopy(log))}>
											{t("common.copy")}
										</button>
										<button onClick={() => navigator.clipboard.writeText(jsonText)}>
											{t("rpc.copyJson")}
										</button>
									</div>
								</div>
								{expandedId === log.id && log.data != null && (
									<pre className="rpc-log-detail">{jsonText}</pre>
								)}
							</div>
						);
					})}
					{visibleLogs.length === 0 && (
						<div className="rpc-log-empty">
							{t("rpc.empty")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

export function formatRpcLogForCopy(log: {
	agentId: string;
	direction: string;
	summary: string;
	time: number;
	data?: unknown;
}) {
	return JSON.stringify({
		time: new Date(log.time).toISOString(),
		agentId: log.agentId,
		direction: log.direction,
		summary: log.summary,
		data: log.data,
	});
}

export function ConversationOutline(props: {
	items: Array<{ id: string; role: string; title: string; time: string }>;
	onJump: (id: string) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [top, setTop] = useState(() => getInitialOutlineTop());
	const dragRef = useRef<{ startY: number; startTop: number } | null>(null);
	const topRef = useRef(top);
	const visibleItems = expanded ? props.items : props.items.slice(-15);
	const hasMore = props.items.length > 15;

	useEffect(() => {
		topRef.current = top;
	}, [top]);

	useEffect(() => {
		if (!dragging) return;
		function onMove(event: PointerEvent) {
			const drag = dragRef.current;
			if (!drag) return;
			setTop(clampOutlineTop(drag.startTop + event.clientY - drag.startY));
		}
		function onUp() {
			setDragging(false);
			dragRef.current = null;
			localStorage.setItem(OUTLINE_TOP_STORAGE_KEY, String(topRef.current));
		}
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
	}, [dragging]);

	useEffect(() => {
		const onResize = () => setTop((value) => clampOutlineTop(value));
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	function startDrag(event: ReactPointerEvent<HTMLElement>) {
		event.preventDefault();
		event.stopPropagation();
		dragRef.current = { startY: event.clientY, startTop: topRef.current };
		setDragging(true);
	}

	return (
		<div
			className={`outline-hover${dragging ? " dragging" : ""}`}
			style={{ top }}
		>
			<button
				className="outline-trigger"
				title={t("outline.trigger", { count: props.items.length })}
				onPointerDown={startDrag}
			>
				☰
			</button>
			<nav className="conversation-outline">
				<div className="outline-title">
					<span
						className="outline-drag-handle"
						title={t("outline.drag")}
						onPointerDown={startDrag}
					>
						⋮⋮
					</span>
					<span>{t("outline.title")}</span>
					<span className="outline-count">{props.items.length}</span>
				</div>
				<div className="outline-list">
					{hasMore && !expanded && (
						<button
							className="outline-expand"
							onClick={() => setExpanded(true)}
						>
							{t("outline.showAll", { count: props.items.length })}
						</button>
					)}
					{visibleItems.map((item) => (
						<button
							key={item.id}
							className={
								item.role === "user" ? "outline-user" : "outline-assistant"
							}
							onClick={() => props.onJump(item.id)}
						>
							<strong>{item.title}</strong>
							<span>{item.time}</span>
						</button>
					))}
				</div>
			</nav>
		</div>
	);
}

export const OUTLINE_TOP_STORAGE_KEY = "pi-desktop:outline-top";

export function getInitialOutlineTop() {
	if (typeof window === "undefined") return 180;
	const saved = Number(localStorage.getItem(OUTLINE_TOP_STORAGE_KEY));
	if (Number.isFinite(saved) && saved > 0) return clampOutlineTop(saved);
	return clampOutlineTop(Math.round(window.innerHeight * 0.32));
}

export function clampOutlineTop(value: number) {
	if (typeof window === "undefined") return value;
	return Math.min(window.innerHeight - 92, Math.max(76, value));
}

export function DrawerContent(props: {
	panel: DrawerPanel;
	project?: Project;
	files: FileTreeNode[];
	sessions: SessionSummary[];
	/** Git 工作区中对比 HEAD 有变更的文件列表 */
	gitChangedFiles: { path: string; status: string }[];
	expandedDirs: Set<string>;
	onToggleDirectory: (path: string) => void;
	pinned: boolean;
	onTogglePin: () => void;
	onCollapse: () => void;
	onClose: () => void;
	onFileContextMenu: (node: FileTreeNode, x: number, y: number) => void;
	onRefreshFiles: () => void;
	onRefreshSessions: () => void;
	onOpenSession: (session: SessionSummary) => void;
	onRenameSession: (filePath: string, newName: string) => void;
	onCopySession: (session: SessionSummary) => void | Promise<void>;
	onExportSession: (session: SessionSummary) => void | Promise<void>;
	onDeleteSession: (session: SessionSummary) => void | Promise<void>;
	onDiffFile?: (path: string) => void;
	onOpenFile?: (path: string) => void;
	onViewFile?: (path: string) => void;
}) {
	const title =
		props.panel === "files"
			? t("drawer.files")
			: props.project
				? t("drawer.projectSessions", { name: props.project.name })
				: t("drawer.historyTitle");
	return (
		<>
			<div className="drawer-header">
				<strong>{title}</strong>
				<div className="drawer-header-actions">
					<button
						className={props.pinned ? "active" : ""}
						title={props.pinned ? t("drawer.unpin") : t("drawer.pin")}
						aria-label={props.pinned ? t("drawer.unpin") : t("drawer.pin")}
						onClick={props.onTogglePin}
					>
						<Pin size={15} />
					</button>
					<button
						disabled={props.pinned}
						title={props.pinned ? t("drawer.pinnedCannotCollapse") : t("drawer.collapsePanel")}
						aria-label={t("drawer.collapsePanel")}
						onClick={props.onCollapse}
					>
						<ChevronRight size={16} />
					</button>
					<button
						disabled={props.pinned}
						title={props.pinned ? t("drawer.pinnedCannotClose") : t("drawer.closePanel")}
						aria-label={t("drawer.closePanel")}
						onClick={props.onClose}
					>
						<X size={16} />
					</button>
				</div>
			</div>
			<div className="drawer-body">
				{props.panel === "files" && (
					<FilesPanel
						files={props.files}
						// 将 Git 变更文件列表转换为 SessionModifiedFile 格式传入 FilesPanel 展示
						modifiedFiles={props.gitChangedFiles.map((f) => ({
							path: f.path,
							toolName: "git",
							status: "done",
						}))}
						expandedDirs={props.expandedDirs}
						onToggleDirectory={props.onToggleDirectory}
						onFileContextMenu={props.onFileContextMenu}
						onRefreshFiles={props.onRefreshFiles}
						onDiffFile={props.onDiffFile}
						onOpenFile={props.onOpenFile}
						onViewFile={props.onViewFile}
					/>
				)}
				{props.panel === "sessions" && (
					<SessionsPanel
						sessions={props.sessions}
						onRefresh={props.onRefreshSessions}
						onOpen={props.onOpenSession}
						onRename={props.onRenameSession}
						onCopy={props.onCopySession}
						onExport={props.onExportSession}
						onDelete={props.onDeleteSession}
					/>
				)}
			</div>
		</>
	);
}
