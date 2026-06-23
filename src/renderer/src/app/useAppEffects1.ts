import { useEffect } from "react";
import { SIDEBAR_RELATIVE_TIME_REFRESH_MS } from "../sidebarRelativeTime";
import { shouldResetExpandedDirsForProjectChange } from "../fileTreeExpansion";
import { syncCollapsedProjects } from "../projectCollapseState";
import { pruneTerminalDockState } from "../terminalDockState";
import { t } from "../i18n";
import type { AgentServerRequest, SessionSummary, ThinkingUpdate } from "../../../shared/types";
import {
  COMPOSER_MIN_HEIGHT,
  api,
  findReusableProjectAgent,
  getSessionAlertKey,
  isPendingAgentId,
  isReplacementForPendingAgent,
  migrateAgentRecord,
} from "./appRuntime";
import type { AppContext } from "./AppContext";
import type { DrawerPanel } from "../components/app/AppParts";

export function useAppEffects1(ctx: AppContext) {
  const { _debugOpen, _logs, _setDebugOpen, abortAgent, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addProject, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, api, appendQuickPromptToComposer, appInfo, applyMessagePatch, applySuggestion, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, checkPiInstall, checkPiInstallInline, clampComposerHeight, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, clearCustomPiPath, clearImages, clearSuggestionTrigger, cloneAgentSession, closeAgent, closeDrawer, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, collapseDrawer, commandHistory, commands, compactAgent, compacting, compactRpcLogData, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, copySession, copySidebarSession, createAgent, createBranch, currentProjectPath, customPathResult, customPathValidating, customPiPath, cycleThinking, dataUrlToImageContent, DEFAULT_LIST_WIDTH, deleteHistorySession, describeApprovalRequest, diffFilePath, diffViewFile, diffViewMode, diffViewOriginalContent, discardAttachedImages, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, ensureComposerTailVisible, environmentDialog, executeSlashCommandStage, expandedDirs, exportAgentHtml, exportHistorySession, exportSidebarSession, fileMenu, files, filesProjectIdRef, fileToImageContent, filteredAgents, filteredProjects, finalizeTurnSummary, finishProjectDrag, flatFiles, focusComposerTextarea, getComposerMaxHeight, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, handleAddQuickPromptPreset, handleComposerKeyDown, handleDragOver, handleDrop, handleGoalCommand, handlePaste, handleProjectDragLeave, handleProjectDragOver, handleProjectDragStart, handleProjectDrop, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, importClaudeSessions, importCodexSessions, isAgentBusy, isAgentStarting, isAwaitingAssistant, isExtensionSlashCommand, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, openAgentRename, openClaudeImport, openCodexImport, openCurrentProjectInVSCode, openDrawer, openFilePath, openHistorySession, openModelPicker, openProjectSessions, openSessionRename, openSidebarSession, openSlashCommandStage, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, processImageFile, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, refreshFiles, refreshGitChangedFiles, refreshProjects, refreshProjectSessions, refreshRuntimeState, refreshSessionHistory, refreshSessions, relativeTimeNow, releaseDiscardedComposerImage, releaseListHoverSuppression, removeImage, removePendingCommandMessage, removeQuickPromptPreset, renameHistorySession, renamingFile, renamingFileInput, renderedMessages, reorderProjects, replaceMessages, resendUserMessage, resizeImageFile, resolvedComposerHeight, resolvedLocale, respondApproval, restartAgent, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, scanClaudeSessions, scanCodexSessions, scrollToBottom, search, seenProjectIdsRef, selectedSuggestionIndex, selectModel, selectThinking, sendBehaviorMenuOpen, sendPrompt, sendPromptAsFollowUp, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAttachedImages, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPrompt, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalCollapsedForAgent, setTerminalDockStateByAgent, setTerminalHeightByAgent, setTerminalOpenForAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, showToast, slashCommandStage, startComposerResize, startResize, stripPendingUiSlashMessages, submitAgentRename, submitComposerPrompt, submitPromptSnapshot, submitSessionRename, suggestionItems, suggestionsOpen, switchBranch, switchingBranch, syncComposerAutoHeight, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, testPiProxy, thinkingPickerOpen, timelineRef, toast, toggleAllClaudeSessions, toggleAllCodexSessions, toggleClaudeSession, toggleCodexSession, toggleDirectory, toggleDrawerPinned, toggleListCollapsed, transferAgentDraft, undoUserMessage, updateAfterProjectRemoved, updateQuickPromptState, updateSettings, upsertAgentMessagePatch, validateCustomPiPath, viewFilePath, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized } = ctx;

  useEffect(() => {
      if (!drawerPinnedPanel) return;
      if (drawer !== drawerPinnedPanel) setDrawer(drawerPinnedPanel);
      if (drawerCollapsed) setDrawerCollapsed(false);
    }, [drawer, drawerCollapsed, drawerPinnedPanel]);

  useEffect(() => {
      document.documentElement.lang = resolvedLocale;
    }, [resolvedLocale]);

  useEffect(() => {
      const media = window.matchMedia?.("(prefers-color-scheme: dark)");
      const applyTheme = () => {
        const resolvedTheme =
          settings.theme === "system"
            ? media?.matches
              ? "dark"
              : "light"
            : settings.theme;
        document.documentElement.dataset.theme = resolvedTheme;
      };
      applyTheme();
      if (settings.theme !== "system" || !media) return;
      media.addEventListener?.("change", applyTheme);
      return () => media.removeEventListener?.("change", applyTheme);
    }, [settings.theme]);

  useEffect(() => {
      setVisibleRenderGroupCount(120);
    }, [activeAgentId, paginatedMessages.length]);

  useEffect(() => {
      window.setTimeout(() => void refreshProjects(), 0);
      window.setTimeout(() => void api.agents.list().then(setAgents), 0);
      void api.app
        .info()
        .then(setAppInfo)
        .catch(() => undefined);
      void api.settings.get().then((next: any) => {
        setSettings(next);
        setSettingsLoaded(true);
        setCustomPiPath(next.customPiPath ?? "");
        if (!next.piEnvironmentChecked) {
          // 首次检测延后一帧启动,先让主界面完成绘制,避免 packaged app 打开时出现几秒白屏。
          window.setTimeout(() => void checkPiInstall("startup"), 300);
        }
      });
  
      // 加载历史命令
      try {
        const savedHistory = localStorage.getItem("pideck-command-history");
        if (savedHistory) {
          setCommandHistory(JSON.parse(savedHistory));
        }
      } catch (error) {
        console.error("Failed to load command history:", error);
      }
  
      const offProjects = api.projects.onChanged((next: any) => {
        setProjects(next);
        if (next.length > 0) {
          setActiveProjectId((current: any) => current ?? next[0].id);
        }
      });
      const offState = api.agents.onState((nextAgents: any) => {
        const previousPendingAgents = pendingAgentsRef.current;
        const remainingPendingAgents = previousPendingAgents.filter(
          (pending: any) =>
            !nextAgents.some((agent: any) =>
              isReplacementForPendingAgent(agent, pending),
            ),
        );
        const pendingReplacementById = new Map<string, string>(
          previousPendingAgents
            .map((pending: any) => {
              const replacement = nextAgents.find((agent: any) =>
                isReplacementForPendingAgent(agent, pending),
              );
              return replacement ? ([pending.id, replacement.id] as const) : undefined;
            })
            .filter(
              (
                entry,
              ): entry is readonly [string, string] => Boolean(entry),
            ),
        );
        if (remainingPendingAgents.length !== previousPendingAgents.length) {
          pendingAgentsRef.current = remainingPendingAgents;
          setPendingAgents(remainingPendingAgents);
        }
        setAgents(nextAgents);
        setApprovalRequest((current: any) =>
          current && !nextAgents.some((agent: any) => agent.id === current.agentId)
            ? null
            : current,
        );
        if (nextAgents.length === 0) {
          setApprovalBusy(false);
        }
        setActiveAgentId((current: any) => {
          if (!current) return undefined;
          if (nextAgents.some((agent: any) => agent.id === current)) return current;
          const pendingAgent = previousPendingAgents.find(
            (agent: any) => agent.id === current,
          );
          const replacement = pendingAgent
            ? nextAgents.find((agent: any) =>
                isReplacementForPendingAgent(agent, pendingAgent),
              )
            : undefined;
          if (replacement) return replacement.id;
          return pendingAgent ? current : undefined;
        });
        const activeIds = new Set<string>(nextAgents.map((agent: any) => agent.id));
        setRuntimeStateByAgent((current: any) => {
          let changed = false;
          const next = { ...current };
          for (const agentId of Object.keys(next)) {
            if (!activeIds.has(agentId)) {
              delete next[agentId];
              changed = true;
            }
          }
          for (const agent of nextAgents) {
            if (agent.status === "running") continue;
            const state = next[agent.id];
            if (!state?.isStreaming && !state?.isCompacting) continue;
            // agent 状态已由主进程收束为非 running 时，以状态事件为准清理旧 runtimeState，
            // 避免 get_state 延迟或失败留下 isStreaming=true，导致输入框一直显示“进行中”。
            next[agent.id] = {
              ...state,
              isStreaming: false,
              isCompacting: false,
            };
            changed = true;
          }
          return changed ? next : current;
        });
        const draftIds = new Set<string>([
          ...nextAgents.map((agent: any) => agent.id),
          ...remainingPendingAgents.map((agent: any) => agent.id),
        ]);
        setTerminalDockStateByAgent((current: any) =>
          pruneTerminalDockState(current, activeIds),
        );
        setTerminalHeightByAgent((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([agentId]) => activeIds.has(agentId)),
          ) as Record<string, number>,
        );
        setDrawerPinnedByAgent((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([agentId]) => activeIds.has(agentId)),
          ) as Record<string, DrawerPanel>,
        );
        setPromptByAgent((current: any) =>
          migrateAgentRecord(current, pendingReplacementById, draftIds),
        );
        migrateConversationAgents(pendingReplacementById, draftIds);
      });
      const offMessages = api.agents.onMessages((payload: any) => {
        const nextPayloadMessages = stripPendingUiSlashMessages(
          payload.agentId,
          payload.messages,
        );
        replaceMessages(payload.agentId, nextPayloadMessages);
      });
      const offMessagePatch = api.agents.onMessagePatch((payload: any) => {
        applyMessagePatch(payload.agentId, payload);
      });
      const offLog = api.agents.onLog((payload: any) =>
        setLogs((current: any) => {
          // 优化:只在超过200条时才slice,减少不必要的数组操作
          const newLog = `[${payload.agentId.slice(0, 8)}] ${payload.text}`;
          if (current.length < 200) {
            return [...current, newLog];
          }
          return [...current.slice(-199), newLog];
        }),
      );
      const offEvent = api.agents.onEvent((payload: any) => {
        const event = payload.event as {
          type?: string;
          request?: AgentServerRequest;
          requestId?: string | number;
        };
        if (event?.type === "server_request" && event.request) {
          setApprovalBusy(false);
          setApprovalRequest(event.request);
          if (event.request.type === "extension_ui_request") {
            const pendingUiSlash = pendingUiSlashCommandRef.current;
            const shouldClearPendingUiSlash = Boolean(
              event.request.origin === "uiSlashCommand" ||
              (pendingUiSlash && pendingUiSlash.agentId === payload.agentId),
            );
            if (pendingUiSlash && pendingUiSlash.agentId === payload.agentId) {
              removePendingCommandMessage(payload.agentId, pendingUiSlash.command);
            }
            if (shouldClearPendingUiSlash) pendingUiSlashCommandRef.current = null;
          }
          return;
        }
        if (event?.type === "server_request_cancelled") {
          setApprovalRequest((current: any) =>
            current?.requestId === event.requestId ? null : current,
          );
          pendingUiSlashCommandRef.current = null;
          setPendingUiSlashCommandAgentId(null);
          setApprovalBusy(false);
        }
      });
      const offSettings = api.settings.onApplyWindow(() =>
        setSettingsNotice(t("settings.restartNotice")),
      );
      // 监听后端主动推送的 runtimeState 更新(如 agent_end 时重置 isStreaming),
      // 确保前端 isAgentBusy 判断基于最新状态,排队 flush 能正常触发。
      const offRuntimeState = api.agents.onRuntimeState((payload: any) =>
        setRuntimeStateByAgent((current: any) => ({
          ...current,
          [payload.agentId]: payload.state,
        })),
      );
      // 监听流式思考内容更新,用于在 agent 响应前展示推理过程
      const offThinking = api.agents.onThinking((payload: ThinkingUpdate) =>
        setThinking(payload.agentId, payload.thinking),
      );
      // 监听 RPC 日志,保留最近 2000 条用于调试;message_update 高频事件很多,
      // 200 条很容易在一次长响应中被刷掉,但仍设置上限避免 renderer 内存无限增长。
      const offRpcLog = api.agents.onRpcLog((payload: any) =>
        setRpcLogs((current: any) => {
          // 优化:避免频繁创建新数组,只在超过上限时才slice
          const newLog = {
            id: crypto.randomUUID(),
            agentId: payload.agentId,
            direction: payload.direction,
            summary: payload.summary,
            data: compactRpcLogData(payload.data),
            time: Date.now(),
          };
          if (current.length < 2000) {
            return [...current, newLog];
          }
          return [...current.slice(-1999), newLog];
        }),
      );
  
      // 查询窗口初始最大化状态
      void api.app.getWindowMaximized().then(setWindowMaximized);
      const offWindowMaximize = api.app.onWindowMaximizeChanged(
        (maximized: any) => setWindowMaximized(maximized),
      );
  
      return () => {
        offProjects();
        offState();
        offMessages();
        offMessagePatch();
        offLog();
        offEvent();
        offSettings();
        offRuntimeState();
        offThinking();
        offRpcLog();
        offWindowMaximize();
      };
    }, []);

  useEffect(() => {
      const timer = window.setInterval(
        () => setRelativeTimeNow(Date.now()),
        SIDEBAR_RELATIVE_TIME_REFRESH_MS,
      );
      return () => window.clearInterval(timer);
    }, []);

  useEffect(() => {
      const projectIds = new Set<string>(projects.map((project: any) => project.id));
      setSessionsByProject((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([projectId]) =>
            projectIds.has(projectId),
          ),
        ) as Record<string, SessionSummary[]>,
      );
      setSessionLoadingByProject((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([projectId]) =>
            projectIds.has(projectId),
          ),
        ) as Record<string, boolean>,
      );
      // 新项目默认折叠：首次加载或新增项目时折叠，已见过的项目保留用户选择的状态
      const prevCollapsed = collapsedProjects;
      const syncResult = syncCollapsedProjects(
        projectIds,
        prevCollapsed,
        seenProjectIdsRef.current,
      );
      if (syncResult.collapsedProjects !== prevCollapsed) {
        setCollapsedProjects(syncResult.collapsedProjects);
      }
      seenProjectIdsRef.current = syncResult.seenProjectIds;
  
      // 启动时只加载 chat 项目的会话,其他项目延迟到展开时加载
      for (const project of projects) {
        if (project.kind === "chat") {
          void refreshProjectSessions(project.id).catch(() => undefined);
        }
      }
    }, [projectIdsKey]);

  useEffect(() => {
      if (activeAgentId && !isPendingAgentId(activeAgentId))
        void refreshRuntimeState(activeAgentId);
    }, [activeAgentId]);

  useEffect(() => {
      const activeIds = new Set<string>(displayAgents.map((agent: any) => agent.id));
      setTerminalDockStateByAgent((current: any) =>
        pruneTerminalDockState(current, activeIds),
      );
    }, [displayAgents]);

  useEffect(() => {
      let frame = 0;
      const scheduleSync = () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          setComposerHeight((current: any) => clampComposerHeight(current));
          syncComposerAutoHeight();
        });
      };
  
      const box = composerBoxRef.current;
      const observer =
        box &&
        new ResizeObserver((entries: any) => {
          const entry = entries[0];
          if (!entry) return;
          scheduleSync();
        });
      if (box) observer?.observe(box);
  
      window.addEventListener("resize", scheduleSync);
      scheduleSync();
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener("resize", scheduleSync);
        observer?.disconnect();
      };
    }, [activeAgentId]);

  useEffect(() => {
      const frame = requestAnimationFrame(() => {
        setComposerHeight((current: any) => clampComposerHeight(current));
        syncComposerAutoHeight();
      });
      return () => cancelAnimationFrame(frame);
    }, [
      prompt,
      activeAgentId,
      listCollapsed,
      drawerCollapsed,
      drawer,
      terminalOpen,
      activeTerminalHeight,
    ]);

  useEffect(() => {
      if (activeProjectId && activeAgentId)
        setActiveAgentByProject((current: any) => ({
          ...current,
          [activeProjectId]: activeAgentId,
        }));
    }, [activeProjectId, activeAgentId]);

  useEffect(() => {
      if (!activeAgentId || isPendingAgentId(activeAgentId)) {
        setCommands([]);
        return;
      }
  
      let cancelled = false;
      const builtinGoalCommand = {
        name: "goal",
        description: "设置任务目标: /goal <目标>",
        source: "builtin",
      };
  
      const loadCommands = async (retryCount = 0): Promise<void> => {
        try {
          const cmds = await api.agents.commands(activeAgentId);
          if (cancelled) return;
          setCommands([...cmds, builtinGoalCommand]);
        } catch {
          if (cancelled) return;
          const shouldRetry =
            retryCount < 3 &&
            (activeAgent?.status === "starting" || activeAgent?.status === "running");
          if (shouldRetry) {
            window.setTimeout(() => {
              void loadCommands(retryCount + 1);
            }, 500 * (retryCount + 1));
            return;
          }
          setCommands([builtinGoalCommand]);
        }
      };
  
      void loadCommands();
      return () => {
        cancelled = true;
      };
    }, [activeAgentId, activeAgent?.status]);

  useEffect(() => {
      setSelectedSuggestionIndex(0);
    }, [suggestionItems.length]);

  useEffect(() => {
      if (commandHistory.length > 0) {
        try {
          localStorage.setItem("pideck-command-history", JSON.stringify(commandHistory));
        } catch (error) {
          console.error("Failed to save command history:", error);
        }
      }
    }, [commandHistory]);

  useEffect(() => {
      if (!autoScroll) return;
      requestAnimationFrame(() => {
        virtualizedListRef.current?.scrollToBottom("auto");
      });
    }, [activeAgentId, activeMessages.length, autoScroll]);
}
