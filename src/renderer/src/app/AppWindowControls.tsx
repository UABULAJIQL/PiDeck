import type { AppLayoutProps } from "./AppContext";
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
import { ConfigModal } from "../ConfigModal";
import { ApprovalDialog } from "../components/app/ApprovalDialog";
import { SlashCommandStagePanel } from "../components/app/SlashCommandStagePanel";
import { TerminalDock } from "../components/terminal/TerminalDock";
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
  displayPath,
  matches,
} from "../components/app/AppParts";
import { FileDiffViewer } from "../components/app/FileDiffViewer";
import { VirtualizedMessageList } from "../components/app/VirtualizedMessageList";
import { partitionSessionsForDisplay, sortSessionsForDisplay } from "../../../shared/sessionDisplay";
import type { SessionSummary } from "../../../shared/types";
import { formatSidebarRelativeTime } from "../sidebarRelativeTime";
import { t } from "../i18n";
import {
  displayProjectDirectoryName,
  getSessionAlertKey,
  handoffProjectSessionWheel,
  isChatProject,
  isLanWeb,
  isPendingAgentId,
  isSameSessionPath,
} from "./appRuntime";

export function AppWindowControls(props: AppLayoutProps) {
  const { _debugOpen, _logs, _setDebugOpen, abortAgent, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addProject, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, api, appendQuickPromptToComposer, appInfo, applyMessagePatch, applySuggestion, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, checkPiInstall, checkPiInstallInline, clampComposerHeight, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, clearCustomPiPath, clearImages, clearSuggestionTrigger, cloneAgentSession, closeAgent, closeDrawer, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, collapseDrawer, commandHistory, commands, compactAgent, compacting, compactRpcLogData, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, copySession, copySidebarSession, createAgent, createBranch, currentProjectPath, customPathResult, customPathValidating, customPiPath, cycleThinking, dataUrlToImageContent, DEFAULT_LIST_WIDTH, deleteHistorySession, describeApprovalRequest, diffFilePath, diffViewFile, diffViewMode, diffViewOriginalContent, discardAttachedImages, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, ensureComposerTailVisible, environmentDialog, executeSlashCommandStage, expandedDirs, exportAgentHtml, exportHistorySession, exportSidebarSession, fileMenu, files, filesProjectIdRef, fileToImageContent, filteredAgents, filteredProjects, finalizeTurnSummary, finishProjectDrag, flatFiles, focusComposerTextarea, getComposerMaxHeight, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, handleAddQuickPromptPreset, handleComposerKeyDown, handleDragOver, handleDrop, handleGoalCommand, handlePaste, handleProjectDragLeave, handleProjectDragOver, handleProjectDragStart, handleProjectDrop, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, importClaudeSessions, importCodexSessions, isAgentBusy, isAgentStarting, isAwaitingAssistant, isExtensionSlashCommand, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, openAgentRename, openClaudeImport, openCodexImport, openCurrentProjectInVSCode, openDrawer, openFilePath, openHistorySession, openModelPicker, openProjectSessions, openSessionRename, openSidebarSession, openSlashCommandStage, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, processImageFile, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, refreshFiles, refreshGitChangedFiles, refreshProjects, refreshProjectSessions, refreshRuntimeState, refreshSessionHistory, refreshSessions, relativeTimeNow, releaseDiscardedComposerImage, releaseListHoverSuppression, removeImage, removePendingCommandMessage, removeQuickPromptPreset, renameHistorySession, renamingFile, renamingFileInput, renderedMessages, reorderProjects, replaceMessages, resendUserMessage, resizeImageFile, resolvedComposerHeight, resolvedLocale, respondApproval, restartAgent, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, scanClaudeSessions, scanCodexSessions, scrollToBottom, search, seenProjectIdsRef, selectedSuggestionIndex, selectModel, selectThinking, sendBehaviorMenuOpen, sendPrompt, sendPromptAsFollowUp, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAttachedImages, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPrompt, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalCollapsedForAgent, setTerminalDockStateByAgent, setTerminalHeightByAgent, setTerminalOpenForAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, showToast, slashCommandStage, startComposerResize, startResize, stripPendingUiSlashMessages, submitAgentRename, submitComposerPrompt, submitPromptSnapshot, submitSessionRename, suggestionItems, suggestionsOpen, switchBranch, switchingBranch, syncComposerAutoHeight, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, testPiProxy, thinkingPickerOpen, timelineRef, toast, toggleAllClaudeSessions, toggleAllCodexSessions, toggleClaudeSession, toggleCodexSession, toggleDirectory, toggleDrawerPinned, toggleListCollapsed, transferAgentDraft, undoUserMessage, updateAfterProjectRemoved, updateQuickPromptState, updateSettings, upsertAgentMessagePatch, validateCustomPiPath, viewFilePath, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized } = props;

  return (
    <>
      {!settings.useNativeTitleBar && (
              <div className="window-controls" aria-label={t("app.windowControls")}>
                <button
                  type="button"
                  className={`window-control pin${windowAlwaysOnTop ? " active" : ""}`}
                  aria-label={
                    windowAlwaysOnTop ? t("app.windowUnpin") : t("app.windowPin")
                  }
                  title={
                    windowAlwaysOnTop ? t("app.windowUnpin") : t("app.windowPin")
                  }
                  onClick={async () => {
                    const next = await api.app.toggleAlwaysOnTopWindow();
                    setWindowAlwaysOnTop(next);
                  }}
                >
                  <Pin size={15} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="window-control"
                  aria-label={t("app.windowMinimize")}
                  title={t("app.windowMinimize")}
                  onClick={() => api.app.minimizeWindow()}
                >
                  <Minus size={15} strokeWidth={2.2} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="window-control"
                  aria-label={
                    windowMaximized
                      ? t("app.windowRestore")
                      : t("app.windowMaximize")
                  }
                  title={
                    windowMaximized
                      ? t("app.windowRestore")
                      : t("app.windowMaximize")
                  }
                  onClick={() => api.app.toggleMaximizeWindow()}
                >
                  {windowMaximized ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {/* 恢复图标：两个重叠小方块 */}
                      <rect x="2.5" y="0.5" width="8" height="8" rx="0.5" />
                      <rect x="0.5" y="2.5" width="8" height="8" rx="0.5" />
                    </svg>
                  ) : (
                    <Square size={14} strokeWidth={1.5} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  className="window-control close"
                  aria-label={t("app.windowClose")}
                  title={t("app.windowClose")}
                  onClick={() => api.app.closeWindow()}
                >
                  <X size={16} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
            )}
    </>
  );
}
