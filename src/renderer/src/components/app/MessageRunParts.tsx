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
import { ChatBubble, formatDuration, formatTime, stripAnsi, stripThinkingTags } from "./ChatRenderParts";
import { SessionFileSummary } from "./DrawerSessionParts";

export type ToolGroupItem = {
	kind: "tool-group";
	id: string;
	messages: ChatMessage[];
};

export type MessageItem = { kind: "message"; message: ChatMessage };

export type ThinkingGroupItem = {
	kind: "thinking-group";
	id: string;
	messages: ChatMessage[];
	text: string;
	startedAt: number;
	endedAt: number;
};

export type AgentRunItem = {
	kind: "agent-run";
	id: string;
	items: Array<MessageItem | ToolGroupItem | ThinkingGroupItem>;
	startedAt: number;
	endedAt: number;
};

export type RenderMessage = MessageItem | ToolGroupItem | ThinkingGroupItem | AgentRunItem;

export function groupToolMessages(messages: ChatMessage[]): RenderMessage[] {
	const result: RenderMessage[] = [];
	let currentTools: ChatMessage[] = [];
	let currentThinking: ChatMessage[] = [];
	let currentRun: Array<MessageItem | ToolGroupItem | ThinkingGroupItem> = [];
	let runStartedAt = 0;
	let runEndedAt = 0;

	function isThinkingOnly(message: ChatMessage) {
		return (
			message.role === "assistant" &&
			Boolean(message.thinking?.trim()) &&
			!stripThinkingTags(stripAnsi(message.text)).trim()
		);
	}

	function flushThinking() {
		if (currentThinking.length === 0) return;
		const previous = currentRun[currentRun.length - 1];
		const nextGroup: ThinkingGroupItem = {
			kind: "thinking-group",
			id: currentThinking.map((message) => message.id).join("|"),
			messages: currentThinking,
			text: currentThinking
				.map((message) => stripAnsi(message.thinking ?? ""))
				.filter(Boolean)
				.join("\n\n"),
			startedAt: currentThinking[0]?.timestamp ?? runStartedAt,
			endedAt:
				currentThinking[currentThinking.length - 1]?.timestamp ?? runEndedAt,
		};
		if (previous?.kind === "thinking-group") {
			// 历史会话可能把多段纯 thinking 拆成多条 assistant 消息；如果展示层上已经相邻，
			// 继续合并成一个折叠块，避免一轮回答里出现一串重复“思考过程”卡片。
			previous.id = `${previous.id}|${nextGroup.id}`;
			previous.messages = [...previous.messages, ...nextGroup.messages];
			previous.text = [previous.text, nextGroup.text].filter(Boolean).join("\n\n");
			previous.endedAt = nextGroup.endedAt;
		} else {
			currentRun.push(nextGroup);
		}
		runEndedAt = nextGroup.endedAt;
		currentThinking = [];
	}

	function flushTools() {
		if (currentTools.length === 0) return;
		flushThinking();
		// 同一轮问答里的连续 tool 消息聚合显示,减少工具调用刷屏;详情仍保留在每条 tool 的 meta 里可展开查看。
		const group: ToolGroupItem = {
			kind: "tool-group",
			id: currentTools.map((message) => message.id).join("|"),
			messages: currentTools,
		};
		currentRun.push(group);
		runEndedAt = currentTools[currentTools.length - 1]?.timestamp ?? runEndedAt;
		currentTools = [];
	}

	function flushRun() {
		flushTools();
		flushThinking();
		if (currentRun.length === 0) return;

		// 合并连续的 assistant 文本消息，避免同一轮回答被拆成多个气泡
		const merged: Array<MessageItem | ToolGroupItem | ThinkingGroupItem> = [];
		for (const item of currentRun) {
			const prev = merged[merged.length - 1];
			if (
				item.kind === "message" &&
				item.message.role === "assistant" &&
				prev?.kind === "message" &&
				prev.message.role === "assistant"
			) {
				prev.message = {
					...prev.message,
					text: prev.message.text + "\n\n" + item.message.text,
					thinking: (prev.message.thinking || "") + (item.message.thinking ? "\n\n" + item.message.thinking : ""),
					id: prev.message.id + "|" + item.message.id,
				};
			} else {
				merged.push(item);
			}
		}

		result.push({
			kind: "agent-run",
			id: merged
				.map((item) => (item.kind === "message" ? item.message.id : item.id))
				.join("|"),
			items: merged,
			startedAt: runStartedAt,
			endedAt: runEndedAt || runStartedAt,
		});
		currentRun = [];
		runStartedAt = 0;
		runEndedAt = 0;
	}

	function appendRunMessage(message: ChatMessage) {
		flushThinking();
		flushTools();
		if (currentRun.length === 0) runStartedAt = message.timestamp;
		runEndedAt = message.timestamp;
		currentRun.push({ kind: "message", message });
	}

	for (const message of messages) {
		if (isThinkingOnly(message)) {
			flushTools();
			if (currentRun.length === 0 && currentThinking.length === 0) {
				runStartedAt = message.timestamp;
			}
			currentThinking.push(message);
			runEndedAt = message.timestamp;
		} else if (message.role === "assistant") {
			appendRunMessage(message);
		} else if (message.role === "tool") {
			flushThinking();
			if (currentRun.length === 0) runStartedAt = message.timestamp;
			currentTools.push(message);
		} else {
			flushRun();
			result.push({ kind: "message", message });
		}
	}
	flushRun();
	return result;
}

export const ThinkingGroup = memo(function ThinkingGroup(props: {
	group: ThinkingGroupItem;
	showThinking?: boolean;
}) {
	const [expanded, setExpanded] = useState(false);
	if (!props.showThinking || !props.group.text.trim()) return null;

	const previewLen = 220;
	const needsTruncate = props.group.text.length > previewLen;
	const previewText =
		expanded || !needsTruncate
			? props.group.text
			: `${props.group.text.slice(0, previewLen)}...`;

	return (
		<section className="thinking-block thinking-group-block">
			<button
				className="thinking-header"
				onClick={() => setExpanded((value) => !value)}
			>
				<Brain size={14} />
				<span>{t("thinking.title")}</span>
				<small>{formatTime(props.group.endedAt)}</small>
				<em>{expanded ? t("common.collapse") : t("common.expand")}</em>
			</button>
			{expanded && <div className="thinking-content">{previewText}</div>}
		</section>
	);
});

export type RunActivityItem = MessageItem | ToolGroupItem | ThinkingGroupItem;

export type ActivityEvent =
	| {
			kind: "thinking";
			id: string;
			text: string;
			timestamp: number;
			sourceCount: number;
	  }
	| {
			kind: "tool";
			id: string;
			message: ChatMessage;
			name: string;
			status: "running" | "done" | "error";
			tone: "running" | "ok" | "warning" | "error";
			statusLabel: string;
			detailText: string;
			timestamp: number;
	  }
	| {
			kind: "answer";
			id: string;
			preview: string;
			text: string;
			timestamp: number;
	  };

export function RunActivity(props: {
	items: RunActivityItem[];
	showThinking?: boolean;
}) {
	const events = buildActivityEvents(props.items, Boolean(props.showThinking));
	const toolEvents = events.filter((event) => event.kind === "tool");
	const thinkingEvents = events.filter((event) => event.kind === "thinking");
	const answerEvents = events.filter((event) => event.kind === "answer");
	const hasProcessEvents = toolEvents.length > 0 || thinkingEvents.length > 0;
	const runningCount = toolEvents.filter((event) => event.tone === "running").length;
	const warningCount = toolEvents.filter(
		(event) => event.tone === "warning" || event.tone === "error",
	).length;
	const visibleTools = toolEvents.slice(0, 8);
	const hiddenToolCount = toolEvents.length - visibleTools.length;
	const defaultExpanded =
		runningCount > 0 || warningCount > 0 || answerEvents.length === 0;
	const [manualExpanded, setManualExpanded] = useState<boolean | null>(null);
	const expanded = manualExpanded ?? defaultExpanded;
	const toggleExpanded = () =>
		setManualExpanded((value) => !(value ?? defaultExpanded));

	if (!hasProcessEvents) return null;

	return (
		<section
			className={[
				"run-activity",
				expanded ? "expanded" : "",
				runningCount > 0 ? "running" : "",
				warningCount > 0 ? "has-warning" : "",
			]
				.filter(Boolean)
				.join(" ")}
		>
			<button
				className="run-activity-header"
				onClick={toggleExpanded}
				aria-expanded={expanded}
			>
				<ChevronRight
					size={14}
					className={expanded ? "run-activity-chevron open" : "run-activity-chevron"}
				/>
				<Wrench size={14} />
				<span className="run-activity-title">{t("activity.title")}</span>
				<span className="run-activity-summary">
					{thinkingEvents.length > 0 && (
						<b>{t("activity.thinkingCount", { count: thinkingEvents.length })}</b>
					)}
					{toolEvents.length > 0 && (
						<b>{t("activity.toolCount", { count: toolEvents.length })}</b>
					)}
					{answerEvents.length > 0 && (
						<b>{t("activity.answerCount", { count: answerEvents.length })}</b>
					)}
					{warningCount > 0 && (
						<b className="warning">
							{t("activity.warningCount", { count: warningCount })}
						</b>
					)}
					{runningCount > 0 && (
						<b className="running">{t("activity.running")}</b>
					)}
				</span>
				<em>{expanded ? t("common.collapse") : t("common.details")}</em>
			</button>
			{!expanded && toolEvents.length > 0 && (
				<div className="run-activity-strip">
					{visibleTools.map((event) => (
						<button
							key={event.id}
							className={`activity-tool-chip ${event.tone}`}
							title={`${event.name} · ${event.statusLabel}`}
							onClick={() => setManualExpanded(true)}
						>
							{event.name}
						</button>
					))}
					{hiddenToolCount > 0 && (
						<span className="activity-tool-chip muted">+{hiddenToolCount}</span>
					)}
				</div>
			)}
			{expanded && (
				<div className="run-activity-timeline">
					{events.map((event) => (
						<ActivityEventRow key={event.id} event={event} />
					))}
				</div>
			)}
		</section>
	);
}

export function buildActivityEvents(
	items: RunActivityItem[],
	showThinking: boolean,
): ActivityEvent[] {
	const events: ActivityEvent[] = [];
	for (const item of items) {
		if (item.kind === "thinking-group") {
			if (showThinking && item.text.trim()) {
				events.push({
					kind: "thinking",
					id: item.id,
					text: item.text,
					timestamp: item.endedAt,
					sourceCount: item.messages.length,
				});
			}
			continue;
		}
		if (item.kind === "tool-group") {
			for (const message of item.messages) {
				events.push(createToolActivityEvent(message));
			}
			continue;
		}
		const message = item.message;
		if (showThinking && message.thinking?.trim()) {
			events.push({
				kind: "thinking",
				id: `${message.id}-thinking`,
				text: stripAnsi(message.thinking),
				timestamp: message.timestamp,
				sourceCount: 1,
			});
		}
		const answerText = getMessageDisplayText(message);
		if (message.role === "assistant" && answerText.trim()) {
			events.push({
				kind: "answer",
				id: `${message.id}-answer`,
				preview: createAnswerPreview(answerText),
				text: answerText,
				timestamp: message.timestamp,
			});
		}
	}
	return events;
}

export function createToolActivityEvent(message: ChatMessage): ActivityEvent {
	const status = getToolStatus(message);
	const exitCode = getToolExitCode(message);
	const isToolError = status === "error" || message.meta?.isError === true;
	const tone =
		status === "running"
			? "running"
			: isToolError
				? "error"
				: typeof exitCode === "number" && exitCode !== 0
					? "warning"
					: "ok";
	const statusLabel =
		status === "running"
			? t("tool.statusRunning")
			: isToolError
				? t("tool.statusError")
				: typeof exitCode === "number"
					? t("activity.exitCode", { code: exitCode })
					: t("tool.statusDone");
	return {
		kind: "tool",
		id: message.id,
		message,
		name: getToolName(message),
		status,
		tone,
		statusLabel,
		detailText: getToolDetailText(message),
		timestamp: message.timestamp,
	};
}

export function ActivityEventRow(props: { event: ActivityEvent }) {
	const [expanded, setExpanded] = useState(false);
	const event = props.event;
	const canExpand = event.kind !== "answer" || event.text.length > 180;
	const tone = event.kind === "tool" ? event.tone : event.kind;
	const label =
		event.kind === "thinking"
			? t("activity.thinking")
			: event.kind === "tool"
				? t("activity.tool")
				: t("activity.answer");
	const title =
		event.kind === "thinking"
			? t("thinking.title")
			: event.kind === "tool"
				? event.name
				: event.preview;
	const meta =
		event.kind === "thinking"
			? event.sourceCount > 1
				? t("activity.thinkingParts", { count: event.sourceCount })
				: t("activity.thinking")
			: event.kind === "tool"
				? event.statusLabel
				: t("activity.answerMarker");
	const eventContent = (
		<>
			<span className="activity-event-kind">
				{event.kind === "thinking" ? (
					<Brain size={13} />
				) : event.kind === "tool" ? (
					<Wrench size={13} />
				) : (
					<Check size={13} />
				)}
				{label}
			</span>
			<strong title={title}>{title}</strong>
			<small title={meta}>
				{formatTime(event.timestamp)} · {meta}
			</small>
			{canExpand && (
				<em>{expanded ? t("common.collapse") : t("common.details")}</em>
			)}
		</>
	);

	return (
		<div className={`activity-event ${event.kind} ${tone}`}>
			<span className="activity-event-rail" aria-hidden="true">
				<span className="activity-event-dot" />
			</span>
			{canExpand ? (
				<button
					className="activity-event-main"
					onClick={() => setExpanded((value) => !value)}
					aria-expanded={expanded}
				>
					{eventContent}
				</button>
			) : (
				<div className="activity-event-main static">{eventContent}</div>
			)}
			{expanded && event.kind === "thinking" && (
				<pre className="activity-event-detail thinking-detail">{event.text}</pre>
			)}
			{expanded && event.kind === "answer" && (
				<div className="activity-event-detail answer-detail">{event.text}</div>
			)}
			{expanded && event.kind === "tool" && (
				<div className="activity-event-detail tool-event-detail">
					<pre>{event.detailText}</pre>
					<button
						onClick={() => navigator.clipboard.writeText(event.detailText)}
						title={t("tool.copyDetail")}
					>
						{t("common.copy")}
					</button>
				</div>
			)}
		</div>
	);
}

export function getToolStatus(message: ChatMessage): "running" | "done" | "error" {
	const status = String(message.meta?.status ?? "done");
	if (status === "running" || status === "error") return status;
	return "done";
}

export function getToolName(message: ChatMessage) {
	const name = message.meta?.toolName;
	if (typeof name === "string" && name.trim()) return name.trim();
	const text = stripAnsi(message.text).replace(/^[▶✓✗]\s*/u, "").trim();
	return text || "tool";
}

export function getToolDetailText(message: ChatMessage) {
	if (typeof message.meta?.detailText === "string") {
		return stripAnsi(message.meta.detailText);
	}
	return stripAnsi(JSON.stringify(message.meta ?? {}, null, 2));
}

export function getToolExitCode(message: ChatMessage) {
	const result = message.meta?.result;
	if (!result || typeof result !== "object") return undefined;
	const value = (result as { exitCode?: unknown }).exitCode;
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim()) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

export function getMessageDisplayText(message: ChatMessage) {
	return stripThinkingTags(stripAnsi(message.text));
}

export function createAnswerPreview(text: string) {
	const collapsed = text.replace(/\s+/g, " ").trim();
	return collapsed.length > 180 ? `${collapsed.slice(0, 180)}...` : collapsed;
}

export function ThinkingBubble(props: { thinking?: string; showThinking?: boolean }) {
	const hasThinking =
		props.showThinking && props.thinking && props.thinking.length > 0;
	const [expanded, setExpanded] = useState(false);
	const previewLen = 200;
	const needsTruncate = (props.thinking?.length ?? 0) > previewLen;
	const displayText =
		expanded || !needsTruncate
			? (props.thinking ?? "")
			: (props.thinking ?? "").slice(0, previewLen) + "...";

	return (
		<article className="chat-message assistant thinking-message">
			<div className="msg-avatar">P</div>
			<div className="msg-content">
				<div className="msg-name">
					<span>pi</span>
					<time>{hasThinking ? t("thinking.streaming") : t("thinking.responding")}</time>
				</div>
				{hasThinking && (
					<div className="thinking-block streaming">
						<div className="thinking-header">
							<Brain size={14} />
							<span>{t("thinking.title")}</span>
						</div>
						<div className="thinking-content">{displayText}</div>
						{needsTruncate && (
							<button
								className="thinking-toggle"
								onClick={() => setExpanded((v) => !v)}
							>
								{expanded ? t("common.collapse") : t("thinking.expandAll")}
							</button>
						)}
					</div>
				)}
				{!hasThinking && (
					<div className="msg-bubble typing-bubble">
						<span /> <span /> <span />
					</div>
				)}
			</div>
		</article>
	);
}

export const ToolGroup = memo(function ToolGroup(props: {
	group: ToolGroupItem;
	index?: number;
	total?: number;
}) {
	const [expanded, setExpanded] = useState(false);
	// 工具消息按 toolCallId 原地更新;最后一条仍为 running 时,表示当前工具组还没收尾。
	const running =
		props.group.messages.length > 0 &&
		props.group.messages[props.group.messages.length - 1].meta?.status ===
			"running";

	// 移除错误判断 - 工具调用成功就是成功，不管命令结果
	const errorCount = 0;
	const failed = false;

	const visibleChips = props.group.messages.slice(0, 6);
	const hiddenCount = props.group.messages.length - visibleChips.length;

	// 计算进度
	const showProgress = props.index !== undefined && props.total !== undefined && props.total > 1;
	const progressText = showProgress ? `${(props.index ?? 0) + 1}/${props.total ?? 0}` : '';

	// 计算时长
	const firstTimestamp = props.group.messages[0]?.timestamp ?? 0;
	const lastTimestamp = props.group.messages[props.group.messages.length - 1]?.timestamp ?? 0;
	const duration = lastTimestamp > firstTimestamp ? lastTimestamp - firstTimestamp : 0;
	const showDuration = !running && duration > 100; // 只显示已完成且超过 100ms 的

	return (
		<article
			className={`tool-group ${running ? "running streaming" : "done"}`}
			data-message-id={props.group.id}
		>
			<button
				className="tool-group-header"
				onClick={() => setExpanded((value) => !value)}
			>
				<span className="tool-status-dot" />
				{showProgress && (
					<span className="tool-progress">{progressText}</span>
				)}
				<span className="tool-group-title">
					{running ? t("tool.running") : t("tool.done")}
				</span>
				<strong>
					{props.group.messages.length}
					{t("tool.countSuffix")}
					{showDuration && ` · ${formatDuration(duration)}`}
				</strong>
				<em>{expanded ? t("common.collapse") : t("common.details")}</em>
			</button>
			{expanded ? (
				<div className="tool-group-list">
					{props.group.messages.map((message) => (
						<ToolSummary key={message.id} message={message} />
					))}
				</div>
			) : (
				<div className="tool-compact-row">
					{visibleChips.map((message) => (
						<ToolChip
							key={message.id}
							message={message}
							onClick={() => setExpanded(true)}
						/>
					))}
					{hiddenCount > 0 && (
						<span className="tool-chip muted">+{hiddenCount}</span>
					)}
				</div>
			)}
		</article>
	);
});

export function ToolChip(props: { message: ChatMessage; onClick?: () => void }) {
	const status = String(props.message.meta?.status ?? "done");
	const toolName = String(props.message.meta?.toolName ?? props.message.text);
	return (
		<button
			className={`tool-chip ${status}`}
			title={props.message.text}
			onClick={props.onClick}
		>
			{toolName}
		</button>
	);
}

export function ToolSummary(props: { message: ChatMessage }) {
	const [expanded, setExpanded] = useState(false);
	const status = String(props.message.meta?.status ?? "done");
	const toolName = String(props.message.meta?.toolName ?? props.message.text);
	const statusLabel =
		status === "running"
			? t("tool.statusRunning")
			: status === "error"
				? t("tool.statusError")
				: t("tool.statusDone");
	const detailText =
		typeof props.message.meta?.detailText === "string"
			? props.message.meta.detailText
			: JSON.stringify(props.message.meta ?? {}, null, 2);
	return (
		<div className={`tool-summary ${status}`}>
			<div
				className="tool-summary-main"
				onClick={() => setExpanded((value) => !value)}
				style={{ cursor: 'pointer' }}
			>
				<strong>{toolName}</strong>
				<small>
					{statusLabel} · {formatTime(props.message.timestamp)}
				</small>
			</div>
			<div className="tool-summary-actions">
				<button onClick={() => setExpanded((value) => !value)}>
					{expanded ? t("common.collapse") : t("common.details")}
				</button>
				<button
					onClick={() => navigator.clipboard.writeText(detailText)}
					title={t("tool.copyDetail")}
				>
					{t("common.copy")}
				</button>
			</div>
			{expanded && <pre className="tool-detail">{detailText}</pre>}
		</div>
	);
}

export const AgentRun = memo(function AgentRun(props: {
	run: AgentRunItem;
	onPreviewImage: (image: ComposerImage) => void;
	showThinking?: boolean;
	onOpenExternal: (url: string) => void;
	onOpenFile?: (path: string) => void;
	onDiffFile?: (path: string) => void;
	onUndoUserMessage?: (message: ChatMessage) => void;
	onResendUserMessage?: (message: ChatMessage) => void;
	fileSummariesByMessage?: Record<string, SessionModifiedFile[]>;
}) {
	const activityItems = props.run.items;
	const messageItems = props.run.items.filter(
		(item): item is MessageItem => item.kind === "message",
	);
	const isComplete = props.run.endedAt > 0;

	return (
		<article className="agent-run" data-message-id={props.run.id}>
			<div className="msg-avatar">P</div>
			<div className="agent-run-content">
				<div className="msg-name">
					<span>pi</span>
					<time>{formatTime(props.run.endedAt)}</time>
					{isComplete && props.run.startedAt > 0 && (
						<span className="agent-run-duration">
							⏱ {formatDuration(props.run.endedAt - props.run.startedAt)}
						</span>
					)}
				</div>
				<RunActivity
					items={activityItems}
					showThinking={props.showThinking}
				/>
				<div className="agent-run-stack">
					{/* 合并本轮所有 assistant 消息为一个气泡 */}
					{(() => {
						const textParts: string[] = [];
						const thinkingParts: string[] = [];
						const assistantMessages = messageItems.filter(
							(item): item is MessageItem => item.message.role === "assistant",
						);
						if (assistantMessages.length === 0) return null;
						const firstMsg = assistantMessages[0]!;
						for (const item of assistantMessages) {
							const t = item.message.text.trim();
							if (t) textParts.push(t);
							if (item.message.thinking?.trim()) thinkingParts.push(item.message.thinking);
						}
						if (textParts.length === 0) return null;
						const merged: ChatMessage = {
							...firstMsg.message,
							text: textParts.join("\n\n"),
							thinking: thinkingParts.join("\n\n") || firstMsg.message.thinking,
							id: assistantMessages.map((m) => m.message.id).join("|"),
						};
						const fileSummary = props.fileSummariesByMessage?.[assistantMessages[0]!.message.id];
						return (
							<div className="agent-run-message-stack">
								<ChatBubble
									message={merged}
									onPreviewImage={props.onPreviewImage}
									onOpenExternal={props.onOpenExternal}
									onOpenFile={props.onOpenFile}
									onUndoUserMessage={props.onUndoUserMessage}
									onResendUserMessage={props.onResendUserMessage}
									showThinking={false}
									compact
								/>
								{fileSummary && fileSummary.length > 0 && (
									<SessionFileSummary files={fileSummary} onOpenFile={props.onOpenFile} onDiffFile={props.onDiffFile} />
								)}
							</div>
						);
					})()}
				</div>
			</div>
		</article>
	);
});
