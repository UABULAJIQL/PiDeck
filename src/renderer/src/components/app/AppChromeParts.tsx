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

import { getQuickPromptTitle } from "./DrawerSessionParts";

export type DrawerPanel = "files" | "sessions";

export type SessionModifiedFile = {
	path: string;
	toolName: string;
	status: string;
	changedLines?: number;
	/** 工具执行前的文件原始内容，用于历史会话恢复时展示差异对比。 */
	originalContent?: string;
};

export function EnvironmentDialog(props: {
	status: PiInstallStatus | null;
	checking: boolean;
	onClose: () => void;
	onRecheck: () => void;
	onOpenInstallDocs: () => void;
	/** 用户手动输入的 pi 路径 */
	customPath: string;
	/** 正在校验自定义路径 */
	customPathValidating: boolean;
	/** 自定义路径校验结果 */
	customPathResult: PiInstallStatus | null;
	onCustomPathChange: (path: string) => void;
	onValidateCustomPath: () => void;
}) {
	const installed = props.status?.installed || props.customPathResult?.installed;
	const searchedDirs = props.status?.searchedDirs.slice(0, 16) ?? [];
	const errorText = props.status?.error ?? props.customPathResult?.error;
	const steps = [
		t("environment.stepCli"),
		t("environment.stepPath"),
		t("environment.stepPermission"),
		t("environment.stepDone"),
	];
	const activeStep = props.checking ? 0 : installed ? 3 : 1;

	// Windows 统一使用 CMD 查找 .cmd/.exe shim，不再引导用户使用 PowerShell 的 .ps1 入口。
	const refCmd = 'where pi';

	return (
		<div className="modal-backdrop environment-backdrop">
			<section className="environment-modal">
				<div className="modal-header">
					<strong>{t("environment.title")}</strong>
					<CloseIconButton
						label={t("common.close")}
						onClick={props.onClose}
					/>
				</div>

				<div className="environment-body">
					<div className="env-stepper" aria-label={t("environment.title")}>
						{steps.map((step, index) => (
							<div
								key={step}
								className={`env-step ${index < activeStep ? "done" : ""} ${index === activeStep ? "active" : ""}`}
							>
								<span>{index < activeStep ? "✓" : index + 1}</span>
								<b>{step}</b>
							</div>
						))}
					</div>

					{props.checking && (
						<div className="env-card env-loading-card">
							<div className="loader" />
							<span>{t("environment.checking")}</span>
						</div>
					)}

					{!props.checking && installed && (
						<div className="env-card env-success-card">
							<div className="env-success-icon">✓</div>
							<div className="env-success-info">
								<strong>{t("environment.passed")}</strong>
								<span>
									{t("environment.path")}：{(props.customPathResult || props.status)?.command}
								</span>
								{(props.customPathResult || props.status)?.version && (
									<span>
										{t("environment.version")}：{(props.customPathResult || props.status)!.version}
									</span>
								)}
								<small>{t("environment.autoClose")}</small>
							</div>
						</div>
					)}

					{!props.checking && !installed && (
						<>
							{/* 状态说明卡片 */}
							<div className="env-card env-status-card">
								<strong>{t("environment.notFoundTitle")}</strong>
								<small>{t("environment.notFoundDesc")}</small>
							</div>

							{/* 自动检测错误信息（如有） */}
							{errorText && (
								<div className="env-card env-error-card">
									<strong>{t("environment.errorDetails")}</strong>
									<pre className="env-error-pre">{errorText}</pre>
								</div>
							)}

							{/* 安装指引卡片 */}
							<div className="env-card env-guide-card">
								<strong>{t("environment.installTitle")}</strong>
								<small>{t("environment.installDesc")}</small>
								<button
									className="env-card-btn"
									onClick={props.onOpenInstallDocs}
								>
									{t("environment.openInstallDocs")}
								</button>
							</div>

							{/* 手动输入 pi 路径卡片 */}
							<div className="env-card env-custom-card">
								<strong>{t("environment.customPathTitle")}</strong>
								<small>{t("environment.customPathDesc")}</small>
								<div className="ref-commands">
									<div className="ref-command-item">
										<span className="ref-label">{t("environment.commandLabel")}</span>
										<code>{refCmd}</code>
									</div>

								</div>
								<div className="custom-path-input-row">
									<input
										type="text"
										placeholder="D:\\mise-data\\installs\\node\\24 13 0\\pi.cmd"
										value={props.customPath}
										onChange={(e) =>
											props.onCustomPathChange(e.target.value)
										}
										disabled={props.customPathValidating}
									/>
									<button
										className="env-card-btn primary"
										onClick={props.onValidateCustomPath}
										disabled={
											!props.customPath.trim() ||
											props.customPathValidating
										}
									>
										{props.customPathValidating
											? t("environment.validatingPath")
											: t("environment.validatePath")}
									</button>
								</div>
								{props.customPathResult && (
									<div
										className={`custom-path-result ${props.customPathResult.installed ? "success" : "error"}`}
									>
										{props.customPathResult.installed
											? `✓ ${t("environment.validatePassed", { value: props.customPathResult.version ?? "pi" })}`
											: `✗ ${t("environment.validateFailed", { value: props.customPathResult.error ?? t("environment.unableToRun") })}`}
									</div>
								)}
							</div>

							{/* 检测路径卡片 */}
							{searchedDirs.length > 0 && (
								<div className="env-card env-dirs-card">
									<strong>{t("environment.searchedDirs")}</strong>
									<small>{t("environment.searchedDirsDesc")}</small>
									<ul className="env-dirs-list">
										{searchedDirs.map((dir) => (
											<li key={dir}>{dir}</li>
										))}
									</ul>
								</div>
							)}
						</>
					)}
				</div>

				<div className="environment-footer">
					<button
						onClick={props.onRecheck}
						disabled={props.checking || props.customPathValidating}
					>
						{t("environment.recheck")}
					</button>
				</div>
			</section>
		</div>
	);
}

export function SessionStatus(props: {
	state?: AgentRuntimeState;
	duration?: number;
}) {
	if (!props.state) return null;
	return (
		<div className="session-status">
			<span className="model-chip">
				{props.state.provider ? `${props.state.provider}/` : ""}{props.state.modelName ?? props.state.modelId ?? "model"}
			</span>
			<span className="think-chip">{t("app.think")}: {props.state.thinkingLevel ?? "-"}</span>
			{props.state.contextPercent != null && (
				<span className="ctx-chip">
					{t("app.ctx")}:{" "}
					{props.state.contextPercent?.toFixed?.(1) ??
						props.state.contextPercent}
					% / {formatCompact(props.state.contextWindow)}
				</span>
			)}
			{props.state.cacheTotal != null && (
				<span className="cache-chip">{t("app.cache")}: {formatCompact(props.state.cacheTotal)}</span>
			)}
		</div>
	);
}

export function ComposerToolbar(props: {
	state?: AgentRuntimeState;
	compacting: boolean;
	disabled?: boolean;
	quickPrompts: QuickPromptPreset[];
	quickPromptDraft: string;
	quickPromptDisabled?: boolean;
	onQuickPromptDraftChange: (value: string) => void;
	onAddQuickPrompt: () => void;
	onUseQuickPrompt: (content: string) => void;
	onRemoveQuickPrompt: (id: string) => void;
	onPickModel: () => void;
	onPickThinking: () => void;
	onCompact: () => void;
}) {
	const [quickPromptOpen, setQuickPromptOpen] = useState(false);
	const [quickPromptPosition, setQuickPromptPosition] = useState<{
		top: number;
		left: number;
		width: number;
		maxHeight: number;
	} | null>(null);
	const quickPromptRef = useRef<HTMLDivElement>(null);
	const quickPromptTriggerRef = useRef<HTMLButtonElement>(null);
	const ctxPercent = props.state?.contextPercent;
	const showCompact = ctxPercent != null && ctxPercent > 30;
	const currentThinkingLevel = props.state?.thinkingLevel;
	const thinkingLevelLabel = currentThinkingLevel
		? THINKING_LEVELS.find((level) => level.value === currentThinkingLevel)?.labelKey
		: undefined;
	const thinkingDisplay = thinkingLevelLabel ? t(thinkingLevelLabel) : "-";
	const trimmedDraft = props.quickPromptDraft.trim();

	useEffect(() => {
		if (!quickPromptOpen) return;

		function updateQuickPromptPosition() {
			const rect = quickPromptTriggerRef.current?.getBoundingClientRect();
			if (!rect) return;
			const viewportMargin = 16;
			const gap = 12;
			const preferredWidth = 440;
			const minHeight = 240;
			const preferredMaxHeight = 520;
			const width = Math.min(
				preferredWidth,
				window.innerWidth - viewportMargin * 2,
			);
			const left = Math.max(
				viewportMargin,
				Math.min(
					rect.left,
					window.innerWidth - viewportMargin - width,
				),
			);
			const availableBelow = window.innerHeight - rect.bottom - gap - viewportMargin;
			const availableAbove = rect.top - gap - viewportMargin;
			const shouldOpenAbove =
				availableBelow < minHeight && availableAbove > availableBelow;
			const chosenAvailableHeight = Math.max(
				0,
				shouldOpenAbove ? availableAbove : availableBelow,
			);
			const maxHeight = Math.min(
				preferredMaxHeight,
				window.innerHeight - viewportMargin * 2,
				chosenAvailableHeight || window.innerHeight - viewportMargin * 2,
			);
			const top = shouldOpenAbove
				? Math.max(viewportMargin, rect.top - gap - maxHeight)
				: Math.max(
					viewportMargin,
					Math.min(
						window.innerHeight - viewportMargin - maxHeight,
						rect.bottom + gap,
					),
				);
			setQuickPromptPosition({ top, left, width, maxHeight });
		}

		function handlePointerDown(event: PointerEvent) {
			const target = event.target as Node;
			if (
				!quickPromptRef.current?.contains(target) &&
				!quickPromptTriggerRef.current?.contains(target)
			) {
				setQuickPromptOpen(false);
			}
		}
		function handleEscape(event: KeyboardEvent) {
			if (event.key === "Escape") setQuickPromptOpen(false);
		}

		updateQuickPromptPosition();
		document.addEventListener("pointerdown", handlePointerDown);
		document.addEventListener("keydown", handleEscape);
		window.addEventListener("resize", updateQuickPromptPosition);
		window.addEventListener("scroll", updateQuickPromptPosition, true);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown);
			document.removeEventListener("keydown", handleEscape);
			window.removeEventListener("resize", updateQuickPromptPosition);
			window.removeEventListener("scroll", updateQuickPromptPosition, true);
		};
	}, [quickPromptOpen]);

	const quickPromptPopover =
		quickPromptOpen && quickPromptPosition
			? createPortal(
				<div
					className="composer-quick-prompts-popover"
					ref={quickPromptRef}
					role="dialog"
					aria-label={t("composer.quickPrompts")}
					style={{
						position: "fixed",
						top: quickPromptPosition.top,
						left: quickPromptPosition.left,
						width: quickPromptPosition.width,
						maxHeight: quickPromptPosition.maxHeight,
					}}
				>
					<div className="composer-quick-prompts-header">
						<div>
							<strong>{t("composer.quickPrompts")}</strong>
							<p>{t("composer.quickPromptsDesc")}</p>
						</div>
						<CloseIconButton
							label={t("common.close")}
							onClick={() => setQuickPromptOpen(false)}
						/>
					</div>
					<div className="composer-quick-prompts-list">
						{props.quickPrompts.length === 0 ? (
							<div className="composer-quick-prompts-empty">
								{t("composer.quickPromptEmpty")}
							</div>
						) : (
							props.quickPrompts.map((item) => (
								<div key={item.id} className="composer-quick-prompt-item">
									<button
										type="button"
										className="composer-quick-prompt-use"
										disabled={props.quickPromptDisabled}
										title={t("composer.quickPromptUse")}
										onClick={() => {
											props.onUseQuickPrompt(item.content);
											setQuickPromptOpen(false);
										}}
									>
										<span className="composer-quick-prompt-preview">
											{getQuickPromptTitle(item.content)}
										</span>
									</button>
									<IconButton
										className="composer-quick-prompt-remove"
										label={t("composer.quickPromptDelete")}
										onClick={() => props.onRemoveQuickPrompt(item.id)}
									>
										<X size={14} strokeWidth={2.2} aria-hidden="true" />
									</IconButton>
								</div>
							))
						)}
					</div>
					<div className="composer-quick-prompts-editor">
						<textarea
							value={props.quickPromptDraft}
							onChange={(event) => props.onQuickPromptDraftChange(event.target.value)}
							placeholder={t("composer.quickPromptPlaceholder")}
							rows={4}
						/>
						<button
							type="button"
							disabled={!trimmedDraft}
							onClick={props.onAddQuickPrompt}
						>
							<Plus size={14} strokeWidth={2.2} aria-hidden="true" />
							<span>{t("composer.quickPromptAdd")}</span>
						</button>
					</div>
				</div>,
				document.body,
			)
			: null;

	return (
		<div className="composer-toolbar">
			<button onClick={props.onPickModel} disabled={props.disabled}>
				{t("app.model")}: {props.state?.provider ? `${props.state.provider}/` : ""}{props.state?.modelName ?? "-"}
			</button>
			<button onClick={props.onPickThinking} disabled={props.disabled}>
				{t("app.think")}: {thinkingDisplay}
			</button>
			<div className="composer-toolbar-quick-prompts">
				<button
					ref={quickPromptTriggerRef}
					type="button"
					disabled={props.disabled}
					className={quickPromptOpen ? "active" : ""}
					onClick={() => setQuickPromptOpen((current) => !current)}
				>
					{t("composer.quickPrompts")}
					<ChevronDown size={12} strokeWidth={2.2} aria-hidden="true" />
				</button>
				{quickPromptPopover}
			</div>
			{showCompact && (
				<button
					className={
						props.state?.isCompacting || props.compacting ? "compacting" : ""
					}
					disabled={
						props.state?.isCompacting ||
						props.compacting ||
						!!props.state?.isStreaming
					}
					title={t("app.contextCompactTitle", {
						percent: ctxPercent.toFixed(1),
					})}
					onClick={props.onCompact}
				>
					{props.state?.isCompacting || props.compacting
						? t("app.compacting")
						: `${t("app.compact")} ${ctxPercent.toFixed(0)}%`}
				</button>
			)}
		</div>
	);
}

export function ModelPicker(props: {
	models: AvailableModel[];
	current?: { provider?: string; modelId?: string; modelName?: string };
	onClose: () => void;
	onPick: (model: AvailableModel) => void;
}) {
	const [modelPickerSearch, setModelPickerSearch] = useState("");
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
	const normalizedSearch = modelPickerSearch.trim().toLowerCase();
	const currentModelKey = props.current?.provider && props.current?.modelId
		? `${props.current.provider}/${props.current.modelId}`
		: undefined;
	// 搜索同时覆盖模型展示名、模型 id 和 provider,避免用户只记得任一字段时找不到模型。
	const filteredModels = normalizedSearch
		? props.models.filter((model) =>
				[
					model.name,
					model.id,
					model.provider,
					`${model.provider}/${model.id}`,
				]
					.filter(Boolean)
					.some((value) =>
						String(value).toLowerCase().includes(normalizedSearch),
					),
			)
		: props.models;
	
	// 按供应商分组
	const groupedModels = filteredModels.reduce<Record<string, AvailableModel[]>>((groups, model) => {
		const provider = model.provider || 'other';
		if (!groups[provider]) {
			groups[provider] = [];
		}
		groups[provider].push(model);
		return groups;
	}, {});
	
	// 供应商排序：常见的放前面
	const providerOrder = ['anthropic', 'openai', 'google', 'deepseek', 'other'];
	const sortedProviders = Object.keys(groupedModels).sort((a, b) => {
		const aIndex = providerOrder.indexOf(a);
		const bIndex = providerOrder.indexOf(b);
		if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
		if (aIndex !== -1) return -1;
		if (bIndex !== -1) return 1;
		return a.localeCompare(b);
	});
	
	const content = (
		<div className="picker-backdrop" onClick={props.onClose}>
			<div
				className="picker-palette model-picker"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="picker-palette-header">
					<span>{t("app.modelPickerTitle")}</span>
					<IconButton
						className="picker-palette-close"
						label={t("common.close")}
						onClick={props.onClose}
					>
						<X size={16} strokeWidth={2.2} aria-hidden="true" />
					</IconButton>
				</div>
				<div className="picker-palette-search">
					<input
						autoFocus
						value={modelPickerSearch}
						onChange={(event) => setModelPickerSearch(event.target.value)}
						placeholder={t("app.modelPickerSearch")}
					/>
				</div>
				<div className="picker-palette-list">
					{sortedProviders.length > 0 ? (
						sortedProviders.map((provider) => (
							<div key={provider} className="model-group">
								<div
									className={`model-group-header${collapsedGroups.has(provider) && !normalizedSearch ? ' collapsed' : ''}`}
									onClick={() => {
										setCollapsedGroups(prev => {
											const next = new Set(prev);
											if (next.has(provider)) next.delete(provider);
											else next.add(provider);
											return next;
										});
									}}
								>
									{provider}
									<span className="model-group-count">{groupedModels[provider].length}</span>
								</div>
								{!(collapsedGroups.has(provider) && !normalizedSearch) && groupedModels[provider].map((model) => {
									const modelKey = `${model.provider}/${model.id}`;
									const selected = modelKey === currentModelKey;
									return (
										<button
											key={modelKey}
											className={`picker-palette-item${selected ? " selected" : ""}`}
											onClick={() => props.onPick(model)}
										>
											<span className="picker-palette-label">{model.name ?? model.id}</span>
											<span className="picker-palette-desc">
												{model.provider}/{model.id}
											</span>
											{selected && <span className="picker-palette-check">✓</span>}
										</button>
									);
								})}
							</div>
						))
					) : (
						<div className="picker-palette-empty">{t("app.modelPickerEmpty")}</div>
					)}
				</div>
			</div>
		</div>
	);
	return typeof document === "undefined" ? content : createPortal(content, document.body);
}

export const THINKING_LEVELS = [
	{ value: "off", labelKey: "thinking.levelLabel.off", descriptionKey: "thinking.level.off" },
	// minimal 是 pi/Codex reasoning 的最轻量档位,放在 Off 与 Low 之间便于按强度递增选择。
	{ value: "minimal", labelKey: "thinking.levelLabel.minimal", descriptionKey: "thinking.level.minimal" },
	{ value: "low", labelKey: "thinking.levelLabel.low", descriptionKey: "thinking.level.low" },
	{ value: "medium", labelKey: "thinking.levelLabel.medium", descriptionKey: "thinking.level.medium" },
	{ value: "high", labelKey: "thinking.levelLabel.high", descriptionKey: "thinking.level.high" },
	// xhigh 只在部分模型上可用;选择后以前端收到的 runtime state 为准,必要时提示用户已被回退。
	{ value: "xhigh", labelKey: "thinking.levelLabel.xhigh", descriptionKey: "thinking.level.xhigh" },
] satisfies Array<{ value: string; labelKey: TranslationKey; descriptionKey: TranslationKey }>;

export function ThinkingPicker(props: {
	current?: string;
	onClose: () => void;
	onPick: (level: string) => void;
}) {
	const content = (
		<div className="picker-backdrop" onClick={props.onClose}>
			<div
				className="picker-palette thinking-picker"
				onClick={(event) => event.stopPropagation()}
			>
				<div className="picker-palette-header">
					<div className="thinking-picker-header-content">
						<span>{t("app.thinkingPickerTitle")}</span>
						<small className="thinking-picker-hint">
							{t("app.thinkingPickerHint")}
						</small>
					</div>
					<IconButton
						className="picker-palette-close"
						label={t("common.close")}
						onClick={props.onClose}
					>
						<X size={16} strokeWidth={2.2} aria-hidden="true" />
					</IconButton>
				</div>
				<div className="picker-palette-list">
					{THINKING_LEVELS.map((level) => {
						const selected = level.value === props.current;
						return (
							<button
								key={level.value}
								className={`picker-palette-item${selected ? " selected" : ""}`}
								onClick={() => props.onPick(level.value)}
							>
								<span className="picker-palette-label">{t(level.labelKey)}</span>
								<span className="picker-palette-desc">{t(level.descriptionKey)}</span>
								{selected && <span className="picker-palette-check">✓</span>}
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
	return typeof document === "undefined" ? content : createPortal(content, document.body);
}

export function formatCompact(value?: number | null) {
	if (value == null) return "-";
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
	return String(value);
}

export function BranchSelector(props: {
	gitInfo: GitBranchInfo;
	switchingBranch?: string | null;
	onSwitch: (branch: string) => void;
	onCreateBranch: (branchName: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const [creatingBranch, setCreatingBranch] = useState(false);
	const [newBranchName, setNewBranchName] = useState("");
	const ref = useRef<HTMLDivElement>(null);

	// 点击外部区域自动关闭下拉
	useEffect(() => {
		if (!open) return;
		const handler = (event: MouseEvent) => {
			if (ref.current && !ref.current.contains(event.target as Node)) {
				setOpen(false);
				setCreatingBranch(false);
				setNewBranchName("");
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [open]);

	const current = props.gitInfo.current ?? "";
	const branches = props.gitInfo.branches;

	// 无分支信息时不渲染
	if (!current && branches.length === 0) return null;

	const handleCreateBranch = () => {
		const trimmed = newBranchName.trim();
		if (!trimmed) return;
		props.onCreateBranch(trimmed);
		setOpen(false);
		setCreatingBranch(false);
		setNewBranchName("");
	};

	return (
		<div className="branch-select" ref={ref}>
			<button
				className="branch-trigger"
				disabled={Boolean(props.switchingBranch)}
				onClick={() => setOpen((v) => !v)}
				title={t("app.branchCurrent", {
					branch: current,
					count: branches.length,
				})}
			>
				<span className="branch-icon">
					<GitBranch size={14} />
				</span>
				<span className="branch-label" title={current}>
					{current || "detached"}
				</span>
				<span className="branch-badge">{branches.length}</span>
				<span className={`branch-chevron${open ? " open" : ""}`}>
					<ChevronDown size={12} />
				</span>
			</button>
			{open && (
				<div className="branch-dropdown">
					{branches.length <= 1 && (
						<div className="branch-empty-hint">{t("app.branchOnlyOne")}</div>
					)}
					{branches.map((branch) => {
						const switching = props.switchingBranch === branch;
						return (
						<button
							key={branch}
							className={branch === current ? "active" : ""}
							disabled={Boolean(props.switchingBranch)}
							onClick={() => {
								if (branch !== current) props.onSwitch(branch);
								setOpen(false);
							}}
						>
							<span className="branch-item-icon">
								{branch === current ? (
									<Check size={14} className="branch-check" />
								) : (
									<GitBranch size={14} />
								)}
							</span>
							<span className="branch-item-label" title={branch}>
								{switching ? t("app.branchSwitching") : branch}
							</span>
						</button>
					);
					})}
					{creatingBranch ? (
						<div className="branch-create-form">
							<input
								type="text"
								placeholder={t("app.branchNewPlaceholder")}
								value={newBranchName}
								onChange={(e) => setNewBranchName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleCreateBranch();
									if (e.key === "Escape") {
										setCreatingBranch(false);
										setNewBranchName("");
									}
								}}
								autoFocus
							/>
							<button
								className="branch-create-confirm"
								disabled={!newBranchName.trim()}
								onClick={handleCreateBranch}
							>
								<Check size={14} />
							</button>
						</div>
					) : (
						<button
							className="branch-create-trigger"
							onClick={() => setCreatingBranch(true)}
						>
							<Plus size={14} />
							<span>{t("app.branchCreate")}</span>
						</button>
					)}
				</div>
			)}
		</div>
	);
}

export function LogoMark() {
	return (
		<div className="logo-mark" aria-label={t("app.logoLabel")}>
			<svg viewBox="140 140 520 520" width="22" height="22" aria-hidden="true">
				<path
					fill="#fff"
					fillRule="evenodd"
					d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"
				/>
				<path fill="#fff" d="M517.36 400H634.72V634.72H517.36Z" />
			</svg>
		</div>
	);
}

export function ProjectAvatar(props: { name: string; kind?: "chat" | "project" }) {
	return (
		<div
			className={`conversation-avatar project-avatar${props.kind === "chat" ? " chat-avatar" : ""}`}
			title={t("app.projectAvatarTitle", { name: props.name })}
		>
			{props.kind === "chat" ? (
				<MessageCircle size={16} strokeWidth={1.9} />
			) : (
				<Folder size={16} strokeWidth={1.8} />
			)}
		</div>
	);
}

export function AgentAvatar(props: { status: string }) {
	return (
		<div className={`conversation-avatar agent-avatar ${props.status}`}>
			<svg viewBox="140 140 520 520" width="28" height="28" aria-hidden="true">
				<path
					fill="#fff"
					fillRule="evenodd"
					d="M165.29 165.29H517.36V400H400V517.36H282.65V634.72H165.29ZM282.65 282.65V400H400V282.65Z"
				/>
				<path fill="#fff" d="M517.36 400H634.72V634.72H517.36Z" />
			</svg>
		</div>
	);
}

export function matches(value: string, keyword: string) {
	return (
		!keyword.trim() ||
		value.toLowerCase().includes(keyword.trim().toLowerCase())
	);
}

export function displayPath(path?: string) {
	if (!path) return "";
	const home = getHomePathPrefix();
	const normalized = path.replace(/\\/g, "/");
	const friendly =
		home && normalized.toLowerCase().startsWith(home.toLowerCase())
			? `~${normalized.slice(home.length)}`
			: normalized;
	return friendly.length > 36 ? `...${friendly.slice(-35)}` : friendly;
}

export function getHomePathPrefix() {
	// 浏览器侧无法直接读取 OS home;从常见 Windows 用户路径中提取到 /Users/name,其他路径保持原样。
	const match = location.href.match(/file:\/\/\/([A-Za-z]:\/Users\/[^/]+)/i);
	return match?.[1] ?? "C:/Users/14012";
}
