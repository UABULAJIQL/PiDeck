import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  Settings,
  Sliders,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Play,
  Plus,
  Minus,
  Pin,
  Square,
  X,
} from "lucide-react";
import { describeApprovalRequest } from "./approvalRequest";
import { AppLayout } from "./app/AppLayout";
import { useAppState } from "./app/useAppState";
import * as AppActions01 from "./app/actions/AppActions01";
import * as AppActions02 from "./app/actions/AppActions02";
import * as AppActions03 from "./app/actions/AppActions03";
import * as AppActions04 from "./app/actions/AppActions04";
import { useAppEffects1 } from "./app/useAppEffects1";
import { useAppEffects2 } from "./app/useAppEffects2";
import {
  COMPOSER_DEFAULT_TERMINAL_HEIGHT,
  COMPOSER_MIN_HEIGHT,
  COMPOSER_MIN_TIMELINE_HEIGHT,
  api,
  createImagePreviewObjectUrl,
  displayProjectDirectoryName,
  findReusableProjectAgent,
  getSessionAlertKey,
  getToolChangedLineCount,
  handoffProjectSessionWheel,
  isChatProject,
  isLanWeb,
  isPendingAgentId,
  isReplacementForPendingAgent,
  isSameSessionPath,
  migrateAgentRecord,
  normalizeSessionPathForCompare,
  resolveFileLinkPath,
  revokeComposerImagePreviewUrl,
} from "./app/appRuntime";
import { ConfigModal } from "./ConfigModal";
import { ApprovalDialog } from "./components/app/ApprovalDialog";
import { SlashCommandStagePanel } from "./components/app/SlashCommandStagePanel";
import { TerminalDock } from "./components/terminal/TerminalDock";
import { getComposerEnterIntent } from "./composerBehavior";
import { resolveLocale, setI18nLocale, t } from "./i18n";
import {
  formatSidebarRelativeTime,
  SIDEBAR_RELATIVE_TIME_REFRESH_MS,
} from "./sidebarRelativeTime";
import {
  createForkStageOptions,
  createSessionStageOptions,
  createSlashCommandStage,
  getSlashStageCommand,
  isSlashStageStillActive,
  type SlashCommandStage,
  type SlashStageCommand,
} from "./slashCommandStage";
import {
  pruneTerminalDockState,
  setTerminalDockCollapsed,
  setTerminalDockOpen,
  type TerminalDockStateByAgent,
} from "./terminalDockState";
import { shouldResetExpandedDirsForProjectChange } from "./fileTreeExpansion";
import { syncCollapsedProjects } from "./projectCollapseState";
import { useMessagePagination } from "./hooks/useMessagePagination";
import { useConversationStore } from "./hooks/useConversationStore";
import { useAgentUiState } from "./hooks/useAgentUiState";
import { useQuickPromptPresets } from "./quickPrompts";
import {
  AgentContextMenu,
  BranchSelector,
  CodexImportModal,
  ClaudeImportModal,
  ComposerToolbar,
  ConversationOutline,
  DrawerContent,

  EnvironmentDialog,
  FileContextMenu,
  ConfirmDialog,
  ImagePreviewModal,
  LogoMark,
  ModelPicker,
  ProjectAvatar,
  ProjectContextMenu,
  PromptSuggestions,
  RpcLogModal,
  SessionContextMenu,
  SessionHistoryModal,
  SessionStatus,
  SettingsModal,
  ThinkingPicker,
  applySuggestion,
  buildSuggestionItems,
  clearSuggestionTrigger,
  displayPath,
  flattenFiles,
  groupToolMessages,
  matches,
  type DrawerPanel,
  type SessionModifiedFile,
} from "./components/app/AppParts";
import { FileDiffViewer } from "./components/app/FileDiffViewer";
import { VirtualizedMessageList, type VirtualizedListHandle } from "./components/app/VirtualizedMessageList";
import { partitionSessionsForDisplay, sortSessionsForDisplay } from "../../shared/sessionDisplay";
import {
  type AgentMessagePatch,
  type AgentRuntimeState,
  type AgentServerRequest,
  type AgentTab,
  type ComposerImage,
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
  ImageContent,
  PiCommand,
  PiInstallStatus,
  Project,
  QuickPromptPreset,
  SessionSummary,
  ThinkingUpdate,
} from "../../shared/types";

export function App() {
  const state = useAppState();
  const { activeAgentId, activeProjectId, claudeImportProject, codexImportProject, sessionsProjectId, slashCommandStage } = state;

  function compactRpcLogData(value: unknown, depth = 0): unknown {
    return AppActions01.compactRpcLogData(appContext, value, depth);
  }

  function stripPendingUiSlashMessages(agentId: string, messages: ChatMessage[]) {
    return AppActions01.stripPendingUiSlashMessages(appContext, agentId, messages);
  }

  function upsertAgentMessagePatch(messages: ChatMessage[], patch: AgentMessagePatch) {
    return AppActions01.upsertAgentMessagePatch(appContext, messages, patch);
  }

  function setPrompt(value: string | ((current: string) => string)) {
    return AppActions01.setPrompt(appContext, value);
  }

  function setAttachedImages(
    value: ComposerImage[] | ((current: ComposerImage[]) => ComposerImage[]),
  ) {
    return AppActions01.setAttachedImages(appContext, value);
  }

  function releaseDiscardedComposerImage(image: ComposerImage) {
    return AppActions01.releaseDiscardedComposerImage(appContext, image);
  }

  function discardAttachedImages() {
    return AppActions01.discardAttachedImages(appContext);
  }

  function focusComposerTextarea() {
    return AppActions01.focusComposerTextarea(appContext);
  }

  function appendQuickPromptToComposer(content: string) {
    return AppActions01.appendQuickPromptToComposer(appContext, content);
  }

  function handleAddQuickPromptPreset() {
    return AppActions01.handleAddQuickPromptPreset(appContext);
  }

  function getComposerMaxHeight() {
    return AppActions01.getComposerMaxHeight(appContext);
  }

  function clampComposerHeight(height: number) {
    return AppActions01.clampComposerHeight(appContext, height);
  }

  function ensureComposerTailVisible() {
    return AppActions01.ensureComposerTailVisible(appContext);
  }

  function syncComposerAutoHeight() {
    return AppActions01.syncComposerAutoHeight(appContext);
  }

  function scrollToBottom() {
    return AppActions01.scrollToBottom(appContext);
  }

  async function checkPiInstall(source: "startup" | "manual" = "manual") {
    return AppActions01.checkPiInstall(appContext, source);
  }

  async function checkPiInstallInline() {
    return AppActions01.checkPiInstallInline(appContext);
  }

  /**
   * 校验用户手动输入的 pi 路径。
   * 主进程执行 command --version 验证后,通过则自动保存到 settings.customPiPath,
   * 之后新建/重启 agent 时 PiProcess 会优先使用自定义路径。
   */
  async function validateCustomPiPath(
    options: { closeDialogOnSuccess?: boolean } = {},
  ) {
    return AppActions01.validateCustomPiPath(appContext, options);
  }

  async function clearCustomPiPath() {
    return AppActions01.clearCustomPiPath(appContext);
  }

  function showToast(message: string, duration = 3500) {
    return AppActions01.showToast(appContext, message, duration);
  }

  async function respondApproval(response: Record<string, unknown>) {
    return AppActions01.respondApproval(appContext, response);
  }

  async function refreshProjects() {
    return AppActions01.refreshProjects(appContext);
  }

  async function refreshSessions(projectId = activeProjectId) {
    return AppActions01.refreshSessions(appContext, projectId);
  }

  async function refreshProjectSessions(projectId: string) {
    return AppActions01.refreshProjectSessions(appContext, projectId);
  }

  async function refreshFiles(projectId = activeProjectId) {
    return AppActions01.refreshFiles(appContext, projectId);
  }

  async function refreshGitChangedFiles(projectId = activeProjectId) {
    return AppActions01.refreshGitChangedFiles(appContext, projectId);
  }

  function openFilePath(path: string) {
    return AppActions01.openFilePath(appContext, path);
  }

  function viewFilePath(path: string) {
    return AppActions01.viewFilePath(appContext, path);
  }

  function diffFilePath(path: string) {
    return AppActions01.diffFilePath(appContext, path);
  }

  async function refreshSessionHistory(projectId = sessionsProjectId) {
    return AppActions01.refreshSessionHistory(appContext, projectId);
  }

  async function openProjectSessions(project: Project) {
    return AppActions01.openProjectSessions(appContext, project);
  }

  async function openHistorySession(session: SessionSummary) {
    return AppActions01.openHistorySession(appContext, session);
  }

  async function renameHistorySession(filePath: string, newName: string) {
    return AppActions01.renameHistorySession(appContext, filePath, newName);
  }

  async function copySession(
    filePath: string,
    projectId = sessionsProjectId ?? activeProjectId,
  ) {
    return AppActions01.copySession(appContext, filePath, projectId);
  }

  async function exportHistorySession(session: SessionSummary) {
    return AppActions01.exportHistorySession(appContext, session);
  }

  async function deleteHistorySession(
    session: SessionSummary,
    projectId = sessionsProjectId ?? activeProjectId,
  ) {
    return AppActions01.deleteHistorySession(appContext, session, projectId);
  }

  async function cloneAgentSession(agentId: string) {
    return AppActions01.cloneAgentSession(appContext, agentId);
  }

  function openAgentRename(agent: AgentTab) {
    return AppActions01.openAgentRename(appContext, agent);
  }

  function openSessionRename(projectId: string, session: SessionSummary) {
    return AppActions01.openSessionRename(appContext, projectId, session);
  }

  async function submitAgentRename() {
    return AppActions01.submitAgentRename(appContext);
  }

  async function submitSessionRename() {
    return AppActions01.submitSessionRename(appContext);
  }

  async function openSidebarSession(
    projectId: string,
    session: SessionSummary,
  ) {
    return AppActions01.openSidebarSession(appContext, projectId, session);
  }

  async function copySidebarSession(
    projectId: string,
    session: SessionSummary,
  ) {
    return AppActions01.copySidebarSession(appContext, projectId, session);
  }

  async function exportSidebarSession(
    projectId: string,
    session: SessionSummary,
  ) {
    return AppActions01.exportSidebarSession(appContext, projectId, session);
  }

  async function openCodexImport(project: Project) {
    return AppActions01.openCodexImport(appContext, project);
  }

  async function scanCodexSessions(
    project = codexImportProject,
    clearReport = true,
  ) {
    return AppActions01.scanCodexSessions(appContext, project, clearReport);
  }

  function toggleCodexSession(sourcePath: string) {
    return AppActions01.toggleCodexSession(appContext, sourcePath);
  }

  function toggleAllCodexSessions() {
    return AppActions01.toggleAllCodexSessions(appContext);
  }

  async function importCodexSessions() {
    return AppActions01.importCodexSessions(appContext);
  }

  async function openClaudeImport(project: Project) {
    return AppActions01.openClaudeImport(appContext, project);
  }

  async function scanClaudeSessions(
    project = claudeImportProject,
    clearReport = true,
  ) {
    return AppActions02.scanClaudeSessions(appContext, project, clearReport);
  }

  function toggleClaudeSession(sourcePath: string) {
    return AppActions02.toggleClaudeSession(appContext, sourcePath);
  }

  function toggleAllClaudeSessions() {
    return AppActions02.toggleAllClaudeSessions(appContext);
  }

  async function importClaudeSessions() {
    return AppActions02.importClaudeSessions(appContext);
  }

  async function reorderProjects(
    sourceProjectId: string,
    targetProjectId: string,
  ) {
    return AppActions02.reorderProjects(appContext, sourceProjectId, targetProjectId);
  }

  function handleProjectDragStart(
    event: React.DragEvent<HTMLButtonElement>,
    projectId: string,
  ) {
    return AppActions02.handleProjectDragStart(appContext, event, projectId);
  }

  function handleProjectDragOver(
    event: React.DragEvent<HTMLButtonElement>,
    projectId: string,
  ) {
    return AppActions02.handleProjectDragOver(appContext, event, projectId);
  }

  function handleProjectDragLeave(projectId: string) {
    return AppActions02.handleProjectDragLeave(appContext, projectId);
  }

  function finishProjectDrag() {
    return AppActions02.finishProjectDrag(appContext);
  }

  async function handleProjectDrop(
    event: React.DragEvent<HTMLButtonElement>,
    targetProjectId: string,
  ) {
    return AppActions02.handleProjectDrop(appContext, event, targetProjectId);
  }

  async function addProject() {
    return AppActions02.addProject(appContext);
  }

  function updateAfterProjectRemoved(
    removedProjectId: string,
    next: Project[],
  ) {
    return AppActions02.updateAfterProjectRemoved(appContext, removedProjectId, next);
  }

  async function createAgent(
    projectId = activeProjectId,
    sessionPath?: string,
    title?: string,
    reuseExisting = true,
  ): Promise<AgentTab | undefined> {
    return AppActions02.createAgent(appContext, projectId, sessionPath, title, reuseExisting);
  }

  async function refreshRuntimeState(agentId = activeAgentId) {
    return AppActions02.refreshRuntimeState(appContext, agentId);
  }

  async function openModelPicker() {
    return AppActions02.openModelPicker(appContext);
  }

  async function selectModel(model: AvailableModel) {
    return AppActions02.selectModel(appContext, model);
  }

  async function cycleThinking() {
    return AppActions02.cycleThinking(appContext);
  }

  async function selectThinking(level: string) {
    return AppActions02.selectThinking(appContext, level);
  }

  async function compactAgent() {
    return AppActions02.compactAgent(appContext);
  }

  async function closeAgent(agentId: string) {
    return AppActions02.closeAgent(appContext, agentId);
  }

  async function abortAgent(agentId = activeAgentId) {
    return AppActions02.abortAgent(appContext, agentId);
  }

  async function exportAgentHtml(agentId: string) {
    return AppActions02.exportAgentHtml(appContext, agentId);
  }

  async function restartAgent(agentId: string) {
    return AppActions02.restartAgent(appContext, agentId);
  }

  function setTerminalOpenForAgent(agentId: string, open: boolean) {
    return AppActions02.setTerminalOpenForAgent(appContext, agentId, open);
  }

  function setTerminalCollapsedForAgent(agentId: string, collapsed: boolean) {
    return AppActions02.setTerminalCollapsedForAgent(appContext, agentId, collapsed);
  }

  async function openSlashCommandStage(
    command: SlashStageCommand,
    promptValue: string,
  ) {
    return AppActions02.openSlashCommandStage(appContext, command, promptValue);
  }

  async function executeSlashCommandStage(stage = slashCommandStage) {
    return AppActions02.executeSlashCommandStage(appContext, stage);
  }

  function handleComposerKeyDown(
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) {
    return AppActions03.handleComposerKeyDown(appContext, event);
  }

  function isExtensionSlashCommand(message: string) {
    return AppActions03.isExtensionSlashCommand(appContext, message);
  }

  async function sendPrompt() {
    return AppActions03.sendPrompt(appContext);
  }

  async function submitComposerPrompt(message: string, images?: ComposerImage[]) {
    return AppActions03.submitComposerPrompt(appContext, message, images);
  }

  async function sendPromptAsFollowUp() {
    return AppActions03.sendPromptAsFollowUp(appContext);
  }

  /** 处理 /goal 命令 */
  function handleGoalCommand(input: string) {
    return AppActions03.handleGoalCommand(appContext, input);
  }

  async function submitPromptSnapshot(
    agentId: string,
    message: string,
    images?: ComposerImage[],
    streamingBehavior?: "steer" | "followUp",
    uiSlashCommand?: boolean,
  ) {
    return AppActions03.submitPromptSnapshot(appContext, agentId, message, images, streamingBehavior, uiSlashCommand);
  }

  function resendUserMessage(message: ChatMessage) {
    return AppActions03.resendUserMessage(appContext, message);
  }

  function undoUserMessage(message: ChatMessage) {
    return AppActions03.undoUserMessage(appContext, message);
  }


  /**
   * 处理图片文件,转为 pi RPC 可识别的 ImageContent。
   * 大图会压缩到最长边 2000px,避免 base64 过大导致 RPC 传输和模型上下文成本上升。
   */
  async function processImageFile(file: File): Promise<ComposerImage | null> {
    return AppActions03.processImageFile(appContext, file) as Promise<ComposerImage | null>;
  }

  function fileToImageContent(file: File): Promise<ImageContent> {
    return AppActions03.fileToImageContent(appContext, file) as Promise<ImageContent>;
  }

  function dataUrlToImageContent(
    dataUrl: string,
    fallbackMimeType: string,
  ): ImageContent {
    return AppActions03.dataUrlToImageContent(appContext, dataUrl, fallbackMimeType) as ImageContent;
  }

  function resizeImageFile(
    file: File,
    maxEdge: number,
    quality: number,
  ): Promise<ImageContent> {
    return AppActions03.resizeImageFile(appContext, file, maxEdge, quality) as Promise<ImageContent>;
  }

  /** 处理粘贴事件:从剪贴板提取图片 */
  async function handlePaste(event: React.ClipboardEvent) {
    return AppActions03.handlePaste(appContext, event);
  }

  /** 处理拖拽事件:支持拖入图片 */
  async function handleDrop(event: React.DragEvent) {
    return AppActions03.handleDrop(appContext, event);
  }

  function handleDragOver(event: React.DragEvent) {
    return AppActions03.handleDragOver(appContext, event);
  }

  /** 移除已附加的图片 */
  function removeImage(index: number) {
    return AppActions03.removeImage(appContext, index);
  }

  /** 清空所有附加图片 */
  function clearImages() {
    return AppActions03.clearImages(appContext);
  }

  async function updateSettings(patch: Partial<AppSettings>) {
    return AppActions03.updateSettings(appContext, patch);
  }

  async function testPiProxy() {
    return undefined;
  }

  async function switchBranch(branch: string) {
    return AppActions03.switchBranch(appContext, branch);
  }

  async function createBranch(branchName: string) {
    return AppActions03.createBranch(appContext, branchName);
  }

  function openDrawer(panel: DrawerPanel) {
    return AppActions04.openDrawer(appContext, panel);
  }

  function closeDrawer() {
    return AppActions04.closeDrawer(appContext);
  }

  function collapseDrawer() {
    return AppActions04.collapseDrawer(appContext);
  }

  async function openCurrentProjectInVSCode() {
    return AppActions04.openCurrentProjectInVSCode(appContext);
  }

  function toggleDrawerPinned() {
    return AppActions04.toggleDrawerPinned(appContext);
  }

  function toggleDirectory(path: string) {
    return AppActions04.toggleDirectory(appContext, path);
  }

  function startResize(target: "list" | "drawer", event: PointerEvent) {
    return AppActions04.startResize(appContext, target, event);
  }

  function startComposerResize(event: PointerEvent) {
    return AppActions04.startComposerResize(appContext, event);
  }

  function toggleListCollapsed() {
    return AppActions04.toggleListCollapsed(appContext);
  }

  function releaseListHoverSuppression(event: PointerEvent<HTMLDivElement>) {
    return AppActions04.releaseListHoverSuppression(appContext, event);
  }
  const appContext = {
    ...state,
    api,
    applySuggestion,
    clearSuggestionTrigger,
    describeApprovalRequest,
    abortAgent,
    addProject,
    appendQuickPromptToComposer,
    checkPiInstall,
    checkPiInstallInline,
    clampComposerHeight,
    clearCustomPiPath,
    clearImages,
    cloneAgentSession,
    closeAgent,
    closeDrawer,
    collapseDrawer,
    compactAgent,
    compactRpcLogData,
    copySession,
    copySidebarSession,
    createAgent,
    createBranch,
    cycleThinking,
    dataUrlToImageContent,
    deleteHistorySession,
    diffFilePath,
    discardAttachedImages,
    ensureComposerTailVisible,
    executeSlashCommandStage,
    exportAgentHtml,
    exportHistorySession,
    exportSidebarSession,
    fileToImageContent,
    finishProjectDrag,
    focusComposerTextarea,
    getComposerMaxHeight,
    handleAddQuickPromptPreset,
    handleComposerKeyDown,
    handleDragOver,
    handleDrop,
    handleGoalCommand,
    handlePaste,
    handleProjectDragLeave,
    handleProjectDragOver,
    handleProjectDragStart,
    handleProjectDrop,
    importClaudeSessions,
    importCodexSessions,
    isExtensionSlashCommand,
    openAgentRename,
    openClaudeImport,
    openCodexImport,
    openCurrentProjectInVSCode,
    openDrawer,
    openFilePath,
    openHistorySession,
    openModelPicker,
    openProjectSessions,
    openSessionRename,
    openSidebarSession,
    openSlashCommandStage,
    processImageFile,
    refreshFiles,
    refreshGitChangedFiles,
    refreshProjects,
    refreshProjectSessions,
    refreshRuntimeState,
    refreshSessionHistory,
    refreshSessions,
    releaseDiscardedComposerImage,
    releaseListHoverSuppression,
    removeImage,
    renameHistorySession,
    reorderProjects,
    resendUserMessage,
    resizeImageFile,
    respondApproval,
    restartAgent,
    scanClaudeSessions,
    scanCodexSessions,
    scrollToBottom,
    selectModel,
    selectThinking,
    sendPrompt,
    sendPromptAsFollowUp,
    setAttachedImages,
    setPrompt,
    setTerminalCollapsedForAgent,
    setTerminalOpenForAgent,
    showToast,
    startComposerResize,
    startResize,
    stripPendingUiSlashMessages,
    submitAgentRename,
    submitComposerPrompt,
    submitPromptSnapshot,
    submitSessionRename,
    switchBranch,
    syncComposerAutoHeight,
    testPiProxy,
    toggleAllClaudeSessions,
    toggleAllCodexSessions,
    toggleClaudeSession,
    toggleCodexSession,
    toggleDirectory,
    toggleDrawerPinned,
    toggleListCollapsed,
    undoUserMessage,
    updateAfterProjectRemoved,
    updateSettings,
    upsertAgentMessagePatch,
    validateCustomPiPath,
    viewFilePath,
  }

  useAppEffects1(appContext);
  useAppEffects2(appContext);

  return <AppLayout {...appContext} />;
}
