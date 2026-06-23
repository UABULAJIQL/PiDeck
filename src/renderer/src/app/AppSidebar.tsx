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

export function AppSidebar(props: AppLayoutProps) {
  const { _debugOpen, _logs, _setDebugOpen, abortAgent, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addProject, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, api, appendQuickPromptToComposer, appInfo, applyMessagePatch, applySuggestion, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, checkPiInstall, checkPiInstallInline, clampComposerHeight, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, clearCustomPiPath, clearImages, clearSuggestionTrigger, cloneAgentSession, closeAgent, closeDrawer, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, collapseDrawer, commandHistory, commands, compactAgent, compacting, compactRpcLogData, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, copySession, copySidebarSession, createAgent, createBranch, currentProjectPath, customPathResult, customPathValidating, customPiPath, cycleThinking, dataUrlToImageContent, DEFAULT_LIST_WIDTH, deleteHistorySession, describeApprovalRequest, diffFilePath, diffViewFile, diffViewMode, diffViewOriginalContent, discardAttachedImages, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, ensureComposerTailVisible, environmentDialog, executeSlashCommandStage, expandedDirs, exportAgentHtml, exportHistorySession, exportSidebarSession, fileMenu, files, filesProjectIdRef, fileToImageContent, filteredAgents, filteredProjects, finalizeTurnSummary, finishProjectDrag, flatFiles, focusComposerTextarea, getComposerMaxHeight, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, handleAddQuickPromptPreset, handleComposerKeyDown, handleDragOver, handleDrop, handleGoalCommand, handlePaste, handleProjectDragLeave, handleProjectDragOver, handleProjectDragStart, handleProjectDrop, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, importClaudeSessions, importCodexSessions, isAgentBusy, isAgentStarting, isAwaitingAssistant, isExtensionSlashCommand, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, openAgentRename, openClaudeImport, openCodexImport, openCurrentProjectInVSCode, openDrawer, openFilePath, openHistorySession, openModelPicker, openProjectSessions, openSessionRename, openSidebarSession, openSlashCommandStage, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, processImageFile, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, refreshFiles, refreshGitChangedFiles, refreshProjects, refreshProjectSessions, refreshRuntimeState, refreshSessionHistory, refreshSessions, relativeTimeNow, releaseDiscardedComposerImage, releaseListHoverSuppression, removeImage, removePendingCommandMessage, removeQuickPromptPreset, renameHistorySession, renamingFile, renamingFileInput, renderedMessages, reorderProjects, replaceMessages, resendUserMessage, resizeImageFile, resolvedComposerHeight, resolvedLocale, respondApproval, restartAgent, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, scanClaudeSessions, scanCodexSessions, scrollToBottom, search, seenProjectIdsRef, selectedSuggestionIndex, selectModel, selectThinking, sendBehaviorMenuOpen, sendPrompt, sendPromptAsFollowUp, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAttachedImages, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPrompt, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalCollapsedForAgent, setTerminalDockStateByAgent, setTerminalHeightByAgent, setTerminalOpenForAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, showToast, slashCommandStage, startComposerResize, startResize, stripPendingUiSlashMessages, submitAgentRename, submitComposerPrompt, submitPromptSnapshot, submitSessionRename, suggestionItems, suggestionsOpen, switchBranch, switchingBranch, syncComposerAutoHeight, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, testPiProxy, thinkingPickerOpen, timelineRef, toast, toggleAllClaudeSessions, toggleAllCodexSessions, toggleClaudeSession, toggleCodexSession, toggleDirectory, toggleDrawerPinned, toggleListCollapsed, transferAgentDraft, undoUserMessage, updateAfterProjectRemoved, updateQuickPromptState, updateSettings, upsertAgentMessagePatch, validateCustomPiPath, viewFilePath, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized } = props;

  return (
    <>
      <aside
              className="chat-list-pane"
              onPointerLeave={() => {
                if (listHoverRevealSuppressed) setListHoverRevealSuppressed(false);
              }}
            >
              <div className="list-toolbar">
                <div className="app-badge">
                  <LogoMark />
                  <span className="brand-wordmark" aria-label="PiDeck">
                    PiDeck
                  </span>
                </div>
              </div>
              <button
                className="collapse-button list-collapse"
                title={listCollapsed ? t("app.expandList") : t("app.collapseList")}
                onClick={toggleListCollapsed}
              >
                {listCollapsed ? (
                  <ChevronRight size={16} />
                ) : (
                  <ChevronLeft size={16} />
                )}
              </button>
      
              <div className="search-row">
                <div className="search-box">
                  <span className="search-icon">
                    <Search size={14} />
                  </span>
                  <input
                    value={search}
                    onChange={(event: any) => setSearch(event.target.value)}
                    placeholder={t("app.search")}
                  />
                </div>
                <button className="round-add" onClick={addProject}>
                  <Plus size={18} />
                </button>
              </div>
      
              <div className="conversation-list">
                {filteredProjects.map((project: any) => {
                  const projectIsChat = isChatProject(project);
                  const projectDirectoryName = projectIsChat
                    ? t("app.chatProject")
                    : displayProjectDirectoryName(project);
                  const canDragProject = canReorderProjects && !projectIsChat;
                  const projectAgents = filteredAgents.filter(
                    (agent: any) => agent.projectId === project.id,
                  );
                  const projectSessions = sessionsByProject[project.id] ?? [];
                  const projectSearch = search.trim();
                  const projectSessionAgents = projectAgents.filter(
                    (agent: any) => agent.sessionPath,
                  );
                  const projectAgentsForList = projectAgents.filter(
                    (agent: any) => !agent.sessionPath,
                  );
                  const sessionAgentPaths = new Set(
                    projectSessionAgents
                      .map((agent: any) => agent.sessionPath)
                      .filter((path: string | undefined): path is string => Boolean(path)),
                  );
                  const sessionMatchesSearch = (session: SessionSummary) =>
                    !projectSearch ||
                    matches(
                      `${session.name ?? ""}${session.preview}${session.filePath}`,
                      projectSearch,
                    );
                  const projectAgentSessionSummaries = projectSessionAgents
                    .map((agent: any) => {
                      const matchedSession = projectSessions.find((session: any) =>
                        isSameSessionPath(agent.sessionPath, session.filePath),
                      );
                      const sessionSummary: SessionSummary = matchedSession
                        ? {
                            ...matchedSession,
                            name: agent.title || matchedSession.name,
                          }
                        : {
                            id: agent.id,
                            filePath: agent.sessionPath!,
                            projectPath: agent.cwd,
                            name: agent.title,
                            preview: "",
                            updatedAt: agent.createdAt || Date.now(),
                            messageCount: 0,
                            pinned: false,
                          };
                      return sessionMatchesSearch(sessionSummary)
                        ? sessionSummary
                        : undefined;
                    })
                    .filter((session: SessionSummary | undefined): session is SessionSummary => Boolean(session));
                  const visibleProjectSessions = [
                    ...projectSessions.filter(
                      (session: any) =>
                        !sessionAgentPaths.has(session.filePath) &&
                        sessionMatchesSearch(session),
                    ),
                    ...projectAgentSessionSummaries,
                  ];
                  const isActiveSidebarSession = (session: SessionSummary) =>
                    activeAgent?.projectId === project.id &&
                    isSameSessionPath(activeAgent?.sessionPath, session.filePath);
                  const prioritizeActiveSession = (sectionSessions: SessionSummary[]) => {
                    const activeSession = sectionSessions.find(isActiveSidebarSession);
                    if (!activeSession) return sectionSessions;
                    return [
                      activeSession,
                      ...sectionSessions.filter((session: any) => session !== activeSession),
                    ];
                  };
                  const partitionedProjectSessions = partitionSessionsForDisplay(
                    visibleProjectSessions,
                  );
                  const pinnedProjectSessions = prioritizeActiveSession(
                    partitionedProjectSessions.pinned,
                  );
                  const normalProjectSessions = prioritizeActiveSession(
                    partitionedProjectSessions.normal,
                  );
                  const projectSessionsLoaded = Object.prototype.hasOwnProperty.call(
                    sessionsByProject,
                    project.id,
                  );
                  const projectSessionsLoading = Boolean(
                    sessionLoadingByProject[project.id],
                  );
                  const hasProjectChildren =
                    projectAgentsForList.length > 0 ||
                    visibleProjectSessions.length > 0 ||
                    projectSessionsLoading;
                  const isCollapsed = collapsedProjects.has(project.id);
                  const findSessionAgent = (filePath: string) =>
                    projectSessionAgents.find((agent: any) =>
                      isSameSessionPath(agent.sessionPath, filePath),
                    );
                  const renderProjectSessionButton = (session: SessionSummary) => {
                    const sessionAgent = findSessionAgent(session.filePath);
                    const isActiveSession = isActiveSidebarSession(session);
                    const sessionStatus = sessionAgent?.status;
                    const showCloseAction = Boolean(sessionAgent) && !isPendingAgentId(sessionAgent?.id);
                    const hasCompletionAlert =
                      !isActiveSession &&
                      completedSessionAlerts.has(
                        getSessionAlertKey(project.id, session.filePath),
                      );
                    return (
                      <button
                        key={session.filePath}
                        className={
                          isActiveSession
                            ? "conversation agent-row session-row active"
                            : "conversation agent-row session-row"
                        }
                        title={session.filePath}
                        onContextMenu={(event: any) => {
                          event.preventDefault();
                          setSessionMenu({
                            x: event.clientX,
                            y: event.clientY,
                            projectId: project.id,
                            session,
                          });
                        }}
                        onClick={() => void openSidebarSession(project.id, session)}
                      >
                        <span className="session-node-marker" aria-hidden="true" />
                        <div className="conversation-body">
                          <div className="conversation-title">
                            {hasCompletionAlert && (
                              <span
                                className="session-completion-dot"
                                title={t("app.statusIdle") || "idle"}
                                aria-hidden="true"
                              >
                                ●
                              </span>
                            )}
                            <strong>{session.name || t("common.untitled")}</strong>
                            {sessionStatus ? (
                              <span
                                className={`session-relative-time agent-status-indicator status-${sessionStatus}`}
                              >
                                {sessionStatus === "running" && "●"}
                                {sessionStatus === "idle" && "○"}
                                {sessionStatus === "starting" && "◐"}{" "}
                                {t(
                                  `app.status${sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}` as any,
                                ) || sessionStatus}
                              </span>
                            ) : !isActiveSession ? (
                              <time
                                className="session-relative-time"
                                dateTime={new Date(session.updatedAt).toISOString()}
                                title={new Date(session.updatedAt).toLocaleString()}
                              >
                                {formatSidebarRelativeTime(
                                  session.updatedAt,
                                  relativeTimeNow,
                                )}
                              </time>
                            ) : null}
                          </div>
                        </div>
                        {showCloseAction && sessionAgent ? (
                          <span
                            className="agent-row-action agent-delete"
                            title={t("menu.closeAgent")}
                            onClick={(event: any) => {
                              event.stopPropagation();
                              void closeAgent(sessionAgent.id);
                            }}
                          >
                            <X size={14} />
                          </span>
                        ) : null}
                      </button>
                    );
                  };
                  const isDraggingProject = draggingProjectId === project.id;
                  const isProjectDropTarget = dragOverProjectId === project.id;
                  const projectRowClass = [
                    "conversation",
                    canDragProject ? "project-draggable" : "",
                    isDraggingProject ? "dragging" : "",
                    isProjectDropTarget ? "drag-over" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <div
                      key={project.id}
                      className="project-group"
                    >
                      <button
                        className={projectRowClass}
                        draggable={canDragProject}
                        onDragStart={(event: any) =>
                          handleProjectDragStart(event, project.id)
                        }
                        onDragOver={(event: any) =>
                          handleProjectDragOver(event, project.id)
                        }
                        onDragLeave={() => handleProjectDragLeave(project.id)}
                        onDrop={(event: any) => void handleProjectDrop(event, project.id)}
                        onDragEnd={finishProjectDrag}
                        onContextMenu={(event: any) => {
                          event.preventDefault();
                          setProjectMenu({
                            x: event.clientX,
                            y: event.clientY,
                            project,
                          });
                        }}
                        onClick={() => {
                          if (projectDragPreventClickRef.current) return;
                          // 点击项目行只切换展开/收起状态,不改变当前活跃的 Agent。
                          const wasCollapsed = collapsedProjects.has(project.id);
      
                          setCollapsedProjects((prev) => {
                            const next = new Set<string>(prev);
                            if (next.has(project.id)) next.delete(project.id);
                            else next.add(project.id);
                            return next;
                          });
      
                          // 首次点击项目时加载历史会话
                          if (!projectSessionsLoaded && !projectSessionsLoading) {
                            void refreshProjectSessions(project.id).catch(() => undefined);
                          }
                        }}
                      >
                        <span
                          className={`project-fold${isCollapsed ? " folded" : ""}${hasProjectChildren ? " has-agents" : ""}`}
                          title={
                            isCollapsed
                              ? t("app.projectExpand")
                              : t("app.projectCollapse")
                          }
                        >
                          <Play size={12} />
                        </span>
                        <ProjectAvatar
                          name={projectDirectoryName}
                          kind="project"
                        />
                        <div className="conversation-body">
                          <div className="conversation-title">
                            <strong title={project.path}>
                              {projectDirectoryName}
                            </strong>
                          </div>
      
                        </div>
                        <span className="project-row-actions">
                          <span
                            className="project-info"
                            title={
                              projectIsChat
                                ? t("app.projectChatInfo")
                                : t("app.projectInfo")
                            }
                            onClick={(event: any) => event.stopPropagation()}
                          >
                            <Info size={14} />
                          </span>
                          <span
                            className="project-action project-add-agent"
                            title={t("app.projectCreateAgentTitle")}
                            onClick={(event: any) => {
                              event.stopPropagation();
                              void createAgent(project.id, undefined, undefined, false);
                            }}
                          >
                            <Plus size={14} />
                          </span>
                        </span>
                      </button>
                      {!isCollapsed && (
                        <div className="project-children-scroll">
                          {projectAgentsForList.map((agent: any) => {
                            const isActiveAgent = agent.id === activeAgentId;
                            return (
                              <button
                                key={agent.id}
                                className={
                                  isActiveAgent
                                    ? "conversation agent-row active"
                                    : "conversation agent-row"
                                }
                                onContextMenu={(event: any) => {
                                  event.preventDefault();
                                  setAgentMenu({
                                    x: event.clientX,
                                    y: event.clientY,
                                    agent,
                                  });
                                }}
                                onClick={() => {
                                  setActiveProjectId(project.id);
                                  setActiveAgentId(agent.id);
                                }}
                              >
                                <span className="agent-node-marker" aria-hidden="true" />
                                <div className="conversation-body">
                                  <div className="conversation-title">
                                    <strong>{agent.title}</strong>
                                    {agent.status && (
                                      <span
                                        className={`agent-status-indicator status-${agent.status}`}
                                      >
                                        {agent.status === "running" && "●"}
                                        {agent.status === "idle" && "○"}
                                        {agent.status === "starting" && "◐"}{" "}
                                        {t(
                                          `app.status${agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}` as any,
                                        ) || agent.status}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {!isPendingAgentId(agent.id) && (
                                  <span
                                    className="agent-row-action agent-delete"
                                    title={t("menu.closeAgent")}
                                    onClick={(event: any) => {
                                      event.stopPropagation();
                                      void closeAgent(agent.id);
                                    }}
                                  >
                                    <X size={14} />
                                  </span>
                                )}
                              </button>
                            );
                          })}
                          {(pinnedProjectSessions.length > 0 ||
                            normalProjectSessions.length > 0) && (
                            <div
                              className="project-session-list"
                              onWheel={handoffProjectSessionWheel}
                            >
                              {pinnedProjectSessions.map(renderProjectSessionButton)}
                              {pinnedProjectSessions.length > 0 &&
                                normalProjectSessions.length > 0 && (
                                  <div
                                    className="project-session-divider"
                                    aria-hidden="true"
                                  />
                                )}
                              {normalProjectSessions.map(renderProjectSessionButton)}
                            </div>
                          )}
                          {projectSessionsLoading && (
                            <div className="project-session-loading">
                              {t("app.projectSessionsLoading")}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {!isLanWeb && (
                <div className="toolbar-actions sidebar-bottom-actions">
                  <div className="sidebar-bottom-primary-actions">
                    <button
                      className="icon-button settings-icon"
                      title={t("settings.title")}
                      onClick={() => setSettingsOpen(true)}
                    >
                      <Settings size={17} />
                    </button>
                    <button
                      className="icon-button config-icon"
                      title={t("config.title")}
                      onClick={() => setConfigOpen(true)}
                    >
                      <Sliders size={17} />
                    </button>
      
                  </div>
                  <button
                    className="icon-button sidebar-collapse-logo"
                    title={
                      listCollapsed ? t("app.expandList") : t("app.collapseList")
                    }
                    onClick={toggleListCollapsed}
                  >
                    {listCollapsed ? (
                      <PanelLeftOpen size={18} strokeWidth={1.9} />
                    ) : (
                      <PanelLeftClose size={18} strokeWidth={1.9} />
                    )}
                  </button>
                </div>
              )}
            </aside>
    </>
  );
}
