import { useCallback, useMemo, useRef, useState } from "react";
import { resolveLocale, setI18nLocale, t } from "../i18n";
import { useMessagePagination } from "../hooks/useMessagePagination";
import { useConversationStore } from "../hooks/useConversationStore";
import { useAgentUiState } from "../hooks/useAgentUiState";
import { useQuickPromptPresets } from "../quickPrompts";
import {
  buildSuggestionItems,
  flattenFiles,
  groupToolMessages,
  matches,
  type DrawerPanel,
  type SessionModifiedFile,
} from "../components/app/AppParts";
import type { VirtualizedListHandle } from "../components/app/VirtualizedMessageList";
import type { SlashCommandStage } from "../slashCommandStage";
import type {
  AgentMessagePatch,
  AgentRuntimeState,
  AgentServerRequest,
  AgentTab,
  AppInfo,
  AppSettings,
  AvailableModel,
  ChatMessage,
  CodexImportReport,
  CodexSessionSummary,
  ClaudeImportReport,
  ClaudeSessionSummary,
  ComposerImage,
  FileTreeNode,
  GitBranchInfo,
  PiCommand,
  PiInstallStatus,
  Project,
  QuickPromptPreset,
  SessionSummary,
  ThinkingUpdate,
} from "../../../shared/types";
import {
  COMPOSER_DEFAULT_TERMINAL_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  api,
  findReusableProjectAgent,
  isPendingAgentId,
  isReplacementForPendingAgent,
} from "./appRuntime";

export function useAppState() {
  const [projects, setProjects] = useState<Project[]>([]);

  const [draggingProjectId, setDraggingProjectId] = useState<string>();

  const [dragOverProjectId, setDragOverProjectId] = useState<string>();

  const [agents, setAgents] = useState<AgentTab[]>([]);

  const [pendingAgents, setPendingAgents] = useState<AgentTab[]>([]);

  const [activeProjectId, setActiveProjectId] = useState<string>();

  const [activeAgentId, setActiveAgentId] = useState<string>();

  const activeAgentIdRef = useRef<string | undefined>(activeAgentId);

  activeAgentIdRef.current = activeAgentId;

  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    new Set(),
  );

  const [activeAgentByProject, setActiveAgentByProject] = useState<
    Record<string, string>
  >({});

  const {
    stateByAgent: conversationStateByAgent,
    replaceMessages,
    applyMessagePatch,
    removePendingCommandMessage,
    setThinking,
    setAttachedImages: setConversationAttachedImages,
    migrateAgents: migrateConversationAgents,
    transferAgentDraft,
    finalizeTurnSummary,
  } = useConversationStore();

  const [files, setFiles] = useState<FileTreeNode[]>([]);

  /** Git 工作区中对比 HEAD 有变更的文件列表（用于右侧面板展示）。 */
  const [gitChangedFiles, setGitChangedFiles] = useState<
    { path: string; status: string }[]
  >([]);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const [relativeTimeNow, setRelativeTimeNow] = useState(() => Date.now());

  const [sessionsByProject, setSessionsByProject] = useState<
    Record<string, SessionSummary[]>
  >({});

  const [completedSessionAlerts, setCompletedSessionAlerts] = useState<
    Set<string>
  >(() => new Set());

  const [sessionLoadingByProject, setSessionLoadingByProject] = useState<
    Record<string, boolean>
  >({});

  const [gitInfo, setGitInfo] = useState<GitBranchInfo>({
    current: null,
    branches: [],
  });

  const [commands, setCommands] = useState<PiCommand[]>([]);

  const {
    runtimeStateByAgent,
    setRuntimeStateByAgent,
    promptByAgent,
    setPromptByAgent,
    sessionDurationByAgent,
    setSessionDurationByAgent,
    rpcLogs,
    setRpcLogs,
    terminalDockStateByAgent,
    setTerminalDockStateByAgent,
    terminalHeightByAgent,
    setTerminalHeightByAgent,
    drawerPinnedByAgent,
    setDrawerPinnedByAgent,
  } = useAgentUiState();

  const [availableModels, setAvailableModels] = useState<AvailableModel[]>([]);

  const [modelPickerOpen, setModelPickerOpen] = useState(false);

  const [thinkingPickerOpen, setThinkingPickerOpen] = useState(false);

  const [sendBehaviorMenuOpen, setSendBehaviorMenuOpen] = useState(false);

  const [switchingBranch, setSwitchingBranch] = useState<string | null>(null);

  const [previewImage, setPreviewImage] = useState<ComposerImage | null>(null);

  /** Goal 状态 */
  const [goalText, setGoalText] = useState<string>("");

  const goalTextRef = useRef("");

  const [goalStatus, setGoalStatus] = useState<"none" | "active" | "paused" | "complete">("none");

  const goalStatusRef = useRef<"none" | "active" | "paused" | "complete">("none");

  const [goalStartedAt, setGoalStartedAt] = useState(0);

  const goalStartedAtRef = useRef(0);

  const [goalCompletedAt, setGoalCompletedAt] = useState(0);

  const goalIterationRef = useRef(0);

  /** 标记是否已经在等待自动续接,防止多个异步续接冲突 */
  const goalContinuationPendingRef = useRef(false);

  /** 最大自动续接次数，达到后自动标记完成避免死循环 */
  const GOAL_MAX_CONTINUATIONS = 5;

  /** 上一次 isAgentBusy 状态,用于检测 busy→idle 转换 */
  const prevIsAgentBusyRef = useRef(false);


  /** 当前 agent 流式思考的实时文本,agent_end 时清空 */
  /** 每个 agent 最后一次会话的开始时间(status 变为 running 时记录),用 ref 避免 effect 闭包陈旧 */
  const sessionStartByAgentRef = useRef<Record<string, number>>({});

  /** 每个 agent 最后一次会话的总时长(ms),仅在会话结束后更新 */
  /** 每轮回答完成后固化的文件修改摘要由 conversation store 按 agent 增量维护。 */
  const agentStatusByAgentRef = useRef<Record<string, AgentTab["status"]>>({});

  const completedAlertBusyByAgentRef = useRef<Record<string, boolean>>({});

  const [_logs, setLogs] = useState<string[]>([]);
 // 写入式调试日志,仅用于 onLog/onError 捕获
  const [search, setSearch] = useState("");

  const [suggestionsOpen, setSuggestionsOpen] = useState(false);

  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);

  const [slashCommandStage, setSlashCommandStage] =
    useState<SlashCommandStage | null>(null);

  const [fileMenu, setFileMenu] = useState<{
    x: number;
    y: number;
    node: FileTreeNode;
  } | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    danger?: boolean;
    confirmLabel?: string;
  } | null>(null);

  const [approvalRequest, setApprovalRequest] = useState<AgentServerRequest | null>(null);

  const [approvalBusy, setApprovalBusy] = useState(false);

  const [pendingUiSlashCommandAgentId, setPendingUiSlashCommandAgentId] = useState<string | null>(null);

  const pendingUiSlashCommandRef = useRef<{ agentId: string; command: string } | null>(null);

  const [renamingFile, setRenamingFile] = useState<{
    path: string;
    name: string;
  } | null>(null);

  const [renamingFileInput, setRenamingFileInput] = useState("");

  const [agentMenu, setAgentMenu] = useState<{
    x: number;
    y: number;
    agent: AgentTab;
  } | null>(null);

  const [sessionMenu, setSessionMenu] = useState<{
    x: number;
    y: number;
    projectId: string;
    session: SessionSummary;
  } | null>(null);

  const [agentActionLoading, setAgentActionLoading] = useState<
    "copy" | "export" | null
  >(null);

  const [sessionActionLoading, setSessionActionLoading] = useState<
    "copy" | "export" | null
  >(null);

  const [agentRenameTarget, setAgentRenameTarget] = useState<AgentTab | null>(
    null,
  );

  const [sessionRenameTarget, setSessionRenameTarget] = useState<{
    projectId: string;
    session: SessionSummary;
  } | null>(null);

  const [agentRenameValue, setAgentRenameValue] = useState("");

  const [agentRenaming, setAgentRenaming] = useState(false);

  const [projectMenu, setProjectMenu] = useState<{
    x: number;
    y: number;
    project: Project;
  } | null>(null);

  const [diffViewFile, setDiffViewFile] = useState<string | null>(null);

  const [diffViewMode, setDiffViewMode] = useState<"view" | "diff">("view");

  const [diffViewOriginalContent, setDiffViewOriginalContent] = useState<string>("");

  const [codexImportProject, setCodexImportProject] = useState<Project | null>(
    null,
  );

  const [codexImportSessions, setCodexImportSessions] = useState<
    CodexSessionSummary[]
  >([]);

  const [codexImportSelected, setCodexImportSelected] = useState<string[]>([]);

  const [codexImportLoading, setCodexImportLoading] = useState(false);

  const [codexImportRunning, setCodexImportRunning] = useState(false);

  const [codexImportReport, setCodexImportReport] =
    useState<CodexImportReport | null>(null);

  const [claudeImportProject, setClaudeImportProject] = useState<Project | null>(
    null,
  );

  const [claudeImportSessions, setClaudeImportSessions] = useState<
    ClaudeSessionSummary[]
  >([]);

  const [claudeImportSelected, setClaudeImportSelected] = useState<string[]>([]);

  const [claudeImportLoading, setClaudeImportLoading] = useState(false);

  const [claudeImportRunning, setClaudeImportRunning] = useState(false);

  const [claudeImportReport, setClaudeImportReport] =
    useState<ClaudeImportReport | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  // 历史命令相关状态
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const [historyIndex, setHistoryIndex] = useState(-1);

  const [historyNavigating, setHistoryNavigating] = useState(false);

  const [savedPrompt, setSavedPrompt] = useState("");

  const [compacting, setCompacting] = useState(false);

  const [drawer, setDrawer] = useState<DrawerPanel | null>(null);

  const [sessionsProjectId, setSessionsProjectId] = useState<string>();

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [sessionHistoryLoading, setSessionHistoryLoading] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);

  const [configOpen, setConfigOpen] = useState(false);

  const [windowAlwaysOnTop, setWindowAlwaysOnTop] = useState(false);

  const [windowMaximized, setWindowMaximized] = useState(false);

  const [_debugOpen, _setDebugOpen] = useState(false);

  /** RPC 日志弹窗目标 agent */
  const [rpcLogAgentId, setRpcLogAgentId] = useState<string | null>(null);

  /** 是否自动滚动到最新消息 */
  const [autoScroll, setAutoScroll] = useState(true);

  /** 是否显示"移动到最新"按钮 */
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);


  const [settings, setSettings] = useState<AppSettings>({
    useNativeTitleBar: true,
    showNativeMenu: false,
    sendShortcut: "enter-send",
    theme: "system",
    language: "system",
    piEnvironmentChecked: false,
    closeToTray: true,
    enableNotifications: true,
    showThinking: true,
    showDevTools: false,
    piProxyEnabled: false,
    piProxyUrl: "http://127.0.0.1:7890",
    piProxyBypass: "localhost,127.0.0.1,::1",
    desktopProxyEnabled: false,
    desktopProxyUrl: "http://127.0.0.1:7890",
    desktopProxyBypass: "localhost,127.0.0.1,::1",
    customPiPath: "",
    webServiceEnabled: false,
    webServiceHost: "0.0.0.0",
    webServicePort: 8765,
    rpcTimeout: 600_000,
    linkOpenMode: "external",
    maxEditorFileSizeMB: 5,
  });

  const [settingsNotice, setSettingsNotice] = useState("");

  const [piProxyNotice, setPiProxyNotice] = useState("");

  const [piProxyNoticeTone, setPiProxyNoticeTone] = useState<
    "info" | "success" | "error"
  >("info");

  const [piStatus, setPiStatus] = useState<PiInstallStatus | null>(null);

  const [piProxyChecking, setPiProxyChecking] = useState(false);

  const [webServiceChanging, setWebServiceChanging] = useState(false);

  const getQuickPromptState = useCallback(() => api.quickPrompts.get(), []);

  const updateQuickPromptState = useCallback(async (state: {
    presets: QuickPromptPreset[];
    draft: string;
  }) => {
    await api.quickPrompts.update(state);
  }, []);

  const {
    quickPrompts,
    quickPromptDraft,
    setQuickPromptDraft,
    addQuickPromptPreset,
    removeQuickPromptPreset,
  } = useQuickPromptPresets({
    getState: getQuickPromptState,
    updateState: updateQuickPromptState,
  });

  const [appInfo, setAppInfo] = useState<AppInfo>({
    version: "-",
  });

  const [piChecking, setPiChecking] = useState(false);

  const resolvedLocale = resolveLocale(settings.language);

  setI18nLocale(resolvedLocale);

  // 手动输入 pi 路径相关状态
  const [customPiPath, setCustomPiPath] = useState("");

  const [customPathValidating, setCustomPathValidating] = useState(false);

  const [customPathResult, setCustomPathResult] =
    useState<PiInstallStatus | null>(null);

  const [environmentDialog, setEnvironmentDialog] = useState(false);

  const DEFAULT_LIST_WIDTH = 250;

  const [listWidth, setListWidth] = useState(DEFAULT_LIST_WIDTH);

  const [drawerWidth, setDrawerWidth] = useState(270);

  const [composerHeight, setComposerHeight] = useState(COMPOSER_MIN_HEIGHT);

  const [composerAutoHeight, setComposerAutoHeight] =
    useState(COMPOSER_MIN_HEIGHT);

  const [listCollapsed, setListCollapsed] = useState(false);

  const [listHoverRevealSuppressed, setListHoverRevealSuppressed] =
    useState(false);

  const [drawerCollapsed, setDrawerCollapsed] = useState(false);

  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // 记录当前文件树所属的项目 ID，切换项目时才重置展开状态
  const filesProjectIdRef = useRef<string | undefined>(undefined);

  // 首次加载时将所有项目初始化为折叠状态，后续新增项目也默认折叠；
  // 已见过（即用户展开/收起过的）项目保留用户的选择不变。
  const seenProjectIdsRef = useRef<Set<string>>(new Set());

  const chatPaneRef = useRef<HTMLElement | null>(null);

  const chatHeaderRef = useRef<HTMLElement | null>(null);

  const composerRef = useRef<HTMLElement | null>(null);

  const timelineRef = useRef<HTMLDivElement | null>(null);

  const virtualizedListRef = useRef<VirtualizedListHandle | null>(null);

  const composerBoxRef = useRef<HTMLDivElement | null>(null);

  const composerTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const pendingAgentsRef = useRef<AgentTab[]>([]);

  const projectDragPreventClickRef = useRef(false);


  const activeProject = projects.find(
    (project) => project.id === activeProjectId,
  );

  const sessionsProject = projects.find(
    (project) => project.id === sessionsProjectId,
  );

  const displayAgents = useMemo(() => {
    const realIds = new Set(agents.map((agent) => agent.id));
    const filteredPending = pendingAgents.filter((agent) => {
      if (realIds.has(agent.id)) return false;
      if (agents.some((realAgent) => isReplacementForPendingAgent(realAgent, agent))) {
        return false;
      }
      if (!agent.sessionPath) {
        const reusableRealAgent = findReusableProjectAgent(agents, agent.projectId);
        if (reusableRealAgent && reusableRealAgent.id !== agent.id) {
          return false;
        }
      }
      return true;
    });
    return [...agents, ...filteredPending];
  }, [agents, pendingAgents]);

  const activeAgent = displayAgents.find((agent) => agent.id === activeAgentId);

  /** 当前项目路径，供右上角「VS Code 打开」功能使用 */
  const currentProjectPath = activeProject?.path ?? activeAgent?.cwd;

  const prompt = activeAgentId ? (promptByAgent[activeAgentId] ?? "") : "";

  const attachedImages = activeAgentId
    ? (conversationStateByAgent[activeAgentId]?.attachedImages ?? [])
    : [];

  const terminalDockState = activeAgentId
    ? terminalDockStateByAgent[activeAgentId]
    : undefined;

  // 终端打开/折叠状态按 agent 隔离,避免切换项目/agent 后丢失当前终端 UI 状态。
  const terminalOpen = Boolean(terminalDockState?.open);

  const terminalCollapsed = Boolean(terminalDockState?.collapsed);

  const drawerPinnedPanel = activeAgentId
    ? drawerPinnedByAgent[activeAgentId]
    : undefined;

  const drawerPinned = Boolean(drawerPinnedPanel);

  const activeMessages = activeAgentId
    ? (conversationStateByAgent[activeAgentId]?.messages ?? [])
    : [];

  const activeRuntimeState = activeAgentId
    ? runtimeStateByAgent[activeAgentId]
    : undefined;

  const [visibleRenderGroupCount, setVisibleRenderGroupCount] = useState(120);


  // 消息分页:超过 100 条消息时启用,大幅减少输入卡顿
  // 首屏 100 条,每次加载 100 条,一页一页懒加载
  const {
    visibleMessages: paginatedMessages,
    hasMore: hasMoreMessages,
    loadMore: loadMoreMessages,
    isLoading: isLoadingMoreMessages,
  } = useMessagePagination({
    messages: activeMessages,
    initialPageSize: 100, // 首屏 100 条
    pageSize: 100,        // 每次加载 100 条
    enabled: activeMessages.length > 100, // 超过 100 条才启用
  });


  const groupedMessages = useMemo(
    () => groupToolMessages(paginatedMessages),
    [paginatedMessages],
  );

  const renderedMessages = useMemo(() => {
    const start = Math.max(0, groupedMessages.length - visibleRenderGroupCount);
    return groupedMessages.slice(start);
  }, [groupedMessages, visibleRenderGroupCount]);

  const hiddenRenderGroupCount = Math.max(
    0,
    groupedMessages.length - renderedMessages.length,
  );

  const isUiSlashApprovalActive = Boolean(
    pendingUiSlashCommandAgentId === activeAgentId ||
    pendingUiSlashCommandRef.current?.agentId === activeAgentId ||
    (approvalRequest?.agentId === activeAgentId &&
      approvalRequest?.type === "extension_ui_request" &&
      approvalRequest?.origin === "uiSlashCommand"),
  );

  const isAwaitingAssistant = Boolean(
    activeAgent &&
    !isUiSlashApprovalActive &&
    (activeAgent.status === "running" || activeRuntimeState?.isStreaming) &&
    activeMessages.at(-1)?.role !== "assistant",
  );

  /** 当前活跃 agent 的实时思考文本 */
  const activeThinking = activeAgentId
    ? (conversationStateByAgent[activeAgentId]?.streamingThinking ?? "")
    : "";

  const activeTerminalHeight = activeAgentId
    ? (terminalHeightByAgent[activeAgentId] ?? COMPOSER_DEFAULT_TERMINAL_HEIGHT)
    : COMPOSER_DEFAULT_TERMINAL_HEIGHT;

  const resolvedComposerHeight = Math.max(composerHeight, composerAutoHeight);

  const composerMode = prompt.startsWith("!!")
    ? "silent-shell"
    : prompt.startsWith("!")
      ? "shell"
      : null;

  const composerStatusText =
    composerMode === "silent-shell"
      ? t("app.composerSilentStatus")
      : composerMode === "shell"
        ? t("app.composerShellStatus")
        : drawer === "files"
          ? t("app.composerFilesStatus")
          : drawer === "sessions"
            ? t("app.composerSessionStatus", {
                name: sessionsProject?.name ?? t("common.project"),
              })
            : (activeAgent?.sessionPath ?? "");


  const modifiedFiles = activeAgentId
    ? (conversationStateByAgent[activeAgentId]?.modifiedFiles ?? [])
    : [];

  const outlineItems = useMemo(() => {
    if (!activeAgentId) return [];
    const storedOutlineByMessageId = new Map(
      (conversationStateByAgent[activeAgentId]?.outlineItems ?? []).map((item) => [item.id, item]),
    );
    return renderedMessages
      .map((item) => {
        if (item.kind === "message") {
          const source = storedOutlineByMessageId.get(item.message.id);
          return source ? { ...source, id: item.message.id } : null;
        }
        if (item.kind !== "agent-run") return null;
        const assistantMessage = item.items.find(
          (runItem) => runItem.kind === "message" && runItem.message.role === "assistant",
        );
        if (!assistantMessage || assistantMessage.kind !== "message") return null;
        const source = assistantMessage.message.id
          .split("|")
          .map((messageId) => storedOutlineByMessageId.get(messageId))
          .find(Boolean);
        return source ? { ...source, id: item.id } : null;
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [activeAgentId, conversationStateByAgent, renderedMessages]);

  const flatFiles = useMemo(() => flattenFiles(files), [files]);

  // 优化:建议项计算仅在必要时触发,避免每次输入都重计算导致卡顿
  // 只有当建议框打开时才计算,关闭时返回空数组
  const suggestionItems = useMemo(
    () =>
      suggestionsOpen ? buildSuggestionItems(prompt, commands, flatFiles) : [],
    [suggestionsOpen, prompt, commands, flatFiles],
  );

  const visibleAgents = useMemo(
    () =>
      displayAgents.filter((agent) =>
        matches(agent.title + agent.cwd + (agent.sessionId ?? ""), search),
      ),
    [displayAgents, search],
  );

  const filteredAgents = visibleAgents;


  const filteredProjects = useMemo(
    () =>
      projects.filter((project) => {
        const projectSessions = sessionsByProject[project.id] ?? [];
        return (
          matches(project.name + project.path, search) ||
          displayAgents.some(
            (agent) =>
              agent.projectId === project.id &&
              matches(
                agent.title + agent.cwd + (agent.sessionId ?? ""),
                search,
              ),
          ) ||
          projectSessions.some((session) =>
            matches(
              `${session.name ?? ""}${session.preview}${session.filePath}`,
              search,
            ),
          )
        );
      }),
    [displayAgents, projects, search, sessionsByProject],
  );

  const projectIdsKey = useMemo(
    () => projects.map((project) => project.id).join("\n"),
    [projects],
  );

  const canReorderProjects = search.trim().length === 0;


  /** 判断 agent 是否处于忙碌状态(正在处理消息或流式输出中) */
  const isAgentStarting = activeAgent?.status === "starting";

  const composerDisabled = !activeAgent || isAgentStarting || isUiSlashApprovalActive;

  const isAgentBusy = Boolean(
    activeAgent &&
    !isUiSlashApprovalActive &&
    (activeAgent.status === "running" || activeRuntimeState?.isStreaming),
  );

  return { _debugOpen, _logs, _setDebugOpen, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, appInfo, applyMessagePatch, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, commandHistory, commands, compacting, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, currentProjectPath, customPathResult, customPathValidating, customPiPath, DEFAULT_LIST_WIDTH, diffViewFile, diffViewMode, diffViewOriginalContent, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, environmentDialog, expandedDirs, fileMenu, files, filesProjectIdRef, filteredAgents, filteredProjects, finalizeTurnSummary, flatFiles, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, isAgentBusy, isAgentStarting, isAwaitingAssistant, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, relativeTimeNow, removePendingCommandMessage, removeQuickPromptPreset, renamingFile, renamingFileInput, renderedMessages, replaceMessages, resolvedComposerHeight, resolvedLocale, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, search, seenProjectIdsRef, selectedSuggestionIndex, sendBehaviorMenuOpen, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalDockStateByAgent, setTerminalHeightByAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, slashCommandStage, suggestionItems, suggestionsOpen, switchingBranch, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, thinkingPickerOpen, timelineRef, toast, transferAgentDraft, updateQuickPromptState, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized };
}
