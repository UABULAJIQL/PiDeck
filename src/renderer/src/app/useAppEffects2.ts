import { useEffect } from "react";
import { SIDEBAR_RELATIVE_TIME_REFRESH_MS } from "../sidebarRelativeTime";
import { shouldResetExpandedDirsForProjectChange } from "../fileTreeExpansion";
import { syncCollapsedProjects } from "../projectCollapseState";
import { pruneTerminalDockState } from "../terminalDockState";
import { t } from "../i18n";
import type { AgentServerRequest } from "../../../shared/types";
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

export function useAppEffects2(ctx: AppContext) {
  const { _debugOpen, _logs, _setDebugOpen, abortAgent, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addProject, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, api, appendQuickPromptToComposer, appInfo, applyMessagePatch, applySuggestion, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, checkPiInstall, checkPiInstallInline, clampComposerHeight, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, clearCustomPiPath, clearImages, clearSuggestionTrigger, cloneAgentSession, closeAgent, closeDrawer, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, collapseDrawer, commandHistory, commands, compactAgent, compacting, compactRpcLogData, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, copySession, copySidebarSession, createAgent, createBranch, currentProjectPath, customPathResult, customPathValidating, customPiPath, cycleThinking, dataUrlToImageContent, DEFAULT_LIST_WIDTH, deleteHistorySession, describeApprovalRequest, diffFilePath, diffViewFile, diffViewMode, diffViewOriginalContent, discardAttachedImages, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, ensureComposerTailVisible, environmentDialog, executeSlashCommandStage, expandedDirs, exportAgentHtml, exportHistorySession, exportSidebarSession, fileMenu, files, filesProjectIdRef, fileToImageContent, filteredAgents, filteredProjects, finalizeTurnSummary, finishProjectDrag, flatFiles, focusComposerTextarea, getComposerMaxHeight, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, handleAddQuickPromptPreset, handleComposerKeyDown, handleDragOver, handleDrop, handleGoalCommand, handlePaste, handleProjectDragLeave, handleProjectDragOver, handleProjectDragStart, handleProjectDrop, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, importClaudeSessions, importCodexSessions, isAgentBusy, isAgentStarting, isAwaitingAssistant, isExtensionSlashCommand, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, openAgentRename, openClaudeImport, openCodexImport, openCurrentProjectInVSCode, openDrawer, openFilePath, openHistorySession, openModelPicker, openProjectSessions, openSessionRename, openSidebarSession, openSlashCommandStage, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, processImageFile, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, refreshFiles, refreshGitChangedFiles, refreshProjects, refreshProjectSessions, refreshRuntimeState, refreshSessionHistory, refreshSessions, relativeTimeNow, releaseDiscardedComposerImage, releaseListHoverSuppression, removeImage, removePendingCommandMessage, removeQuickPromptPreset, renameHistorySession, renamingFile, renamingFileInput, renderedMessages, reorderProjects, replaceMessages, resendUserMessage, resizeImageFile, resolvedComposerHeight, resolvedLocale, respondApproval, restartAgent, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, scanClaudeSessions, scanCodexSessions, scrollToBottom, search, seenProjectIdsRef, selectedSuggestionIndex, selectModel, selectThinking, sendBehaviorMenuOpen, sendPrompt, sendPromptAsFollowUp, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAttachedImages, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPrompt, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalCollapsedForAgent, setTerminalDockStateByAgent, setTerminalHeightByAgent, setTerminalOpenForAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, showToast, slashCommandStage, startComposerResize, startResize, stripPendingUiSlashMessages, submitAgentRename, submitComposerPrompt, submitPromptSnapshot, submitSessionRename, suggestionItems, suggestionsOpen, switchBranch, switchingBranch, syncComposerAutoHeight, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, testPiProxy, thinkingPickerOpen, timelineRef, toast, toggleAllClaudeSessions, toggleAllCodexSessions, toggleClaudeSession, toggleCodexSession, toggleDirectory, toggleDrawerPinned, toggleListCollapsed, transferAgentDraft, undoUserMessage, updateAfterProjectRemoved, updateQuickPromptState, updateSettings, upsertAgentMessagePatch, validateCustomPiPath, viewFilePath, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized } = ctx;

  useEffect(() => {
      for (const agent of displayAgents) {
        if (agent.id !== activeAgentId) continue;
        const previousStatus = agentStatusByAgentRef.current[agent.id];
        if (agent.status === "running" && previousStatus !== "running") {
          sessionStartByAgentRef.current[agent.id] = Date.now();
        } else if (agent.status === "idle") {
          const start = sessionStartByAgentRef.current[agent.id];
          if (start) {
            setSessionDurationByAgent((d: any) => ({
              ...d,
              [agent.id]: Date.now() - start,
            }));
          }
          void finalizeTurnSummary(agent);
        }
        agentStatusByAgentRef.current[agent.id] = agent.status;
      }
    }, [displayAgents, activeAgentId, finalizeTurnSummary]);

  useEffect(() => {
      const nextBusyByAgent: Record<string, boolean> = {};
      const liveSessionKeys = new Set<string>();
      const alertKeysToAdd = new Set<string>();
  
      for (const agent of displayAgents) {
        const runtimeState = runtimeStateByAgent[agent.id];
        const isBusy = Boolean(
          agent.status === "starting" ||
          agent.status === "running" ||
          runtimeState?.isStreaming ||
          runtimeState?.isCompacting,
        );
        nextBusyByAgent[agent.id] = isBusy;
  
        if (agent.projectId && agent.sessionPath) {
          const alertKey = getSessionAlertKey(agent.projectId, agent.sessionPath);
          liveSessionKeys.add(alertKey);
          const previousBusy = completedAlertBusyByAgentRef.current[agent.id];
          // 仅在同一个会话真实经历过忙碌态后落回空闲态时打点，
          // 避免首次载入已有 idle agent 或主进程状态时序抖动时误报绿色提醒。
          if (previousBusy === true && !isBusy && agent.id !== activeAgentIdRef.current) {
            alertKeysToAdd.add(alertKey);
          }
        }
      }
  
      completedAlertBusyByAgentRef.current = nextBusyByAgent;
      setCompletedSessionAlerts((current: any) => {
        const next = new Set<string>(current);
        let changed = false;
        for (const key of alertKeysToAdd) {
          if (!next.has(key)) {
            next.add(key);
            changed = true;
          }
        }
        for (const key of [...next]) {
          if (!liveSessionKeys.has(key)) {
            next.delete(key);
            changed = true;
          }
        }
        return changed ? next : current;
      });
    }, [displayAgents, runtimeStateByAgent]);

  useEffect(() => {
      const activeProjectId = activeAgent?.projectId;
      const activeSessionPath = activeAgent?.sessionPath;
      if (!activeProjectId || !activeSessionPath) return;
      setCompletedSessionAlerts((current: any) => {
        const key = getSessionAlertKey(activeProjectId, activeSessionPath);
        if (!current.has(key)) return current;
        const next = new Set<string>(current);
        next.delete(key);
        return next;
      });
    }, [activeAgent?.projectId, activeAgent?.sessionPath]);

  useEffect(() => {
      if (goalStatusRef.current !== "active") return;
      const goalAgentMessages = activeAgentId
        ? conversationStateByAgent[activeAgentId]?.messages
        : undefined;
      if (!goalAgentMessages) return;
      for (let i = goalAgentMessages.length - 1; i >= 0; i--) {
        const message = goalAgentMessages[i];
        if (message.role === "tool" && message.meta?.toolName === "goal_complete") {
          goalStatusRef.current = "complete";
          goalContinuationPendingRef.current = false;
          setGoalStatus("complete");
          setGoalCompletedAt(Date.now());
          break;
        }
      }
    }, [conversationStateByAgent, activeAgentId]);

  useEffect(() => {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent<{ text: string }>).detail;
        if (detail?.text) {
          setPrompt(detail.text);
          // 自动聚焦到输入框
          requestAnimationFrame(() => {
            document
              .querySelector<HTMLTextAreaElement>(".composer-box textarea")
              ?.focus();
          });
        }
      };
      window.addEventListener("user-message-edit", handler);
      return () => window.removeEventListener("user-message-edit", handler);
    }, []);

  useEffect(() => {
      if (!activeProjectId) {
        setFiles([]);
        setSessions([]);
        setGitInfo({ current: null, branches: [] });
        return;
      }
  
      // 切换项目时,如果该项目未加载过会话,则加载
      const activeProject = projects.find((p: any) => p.id === activeProjectId);
      const hasLoadedSessions = sessionsByProject[activeProjectId]?.length > 0;
      const isLoadingNow = sessionLoadingByProject[activeProjectId];
  
      if (activeProject && !activeProject.kind && !hasLoadedSessions && !isLoadingNow) {
        void refreshProjectSessions(activeProjectId).catch(() => undefined);
      }
  
      const currentAgentBelongsToProject =
        activeAgentId &&
        displayAgents.some(
          (agent: any) =>
            agent.id === activeAgentId && agent.projectId === activeProjectId,
        );
      if (!currentAgentBelongsToProject) {
        const rememberedAgent = activeAgentByProject[activeProjectId];
        const fallbackAgent = displayAgents.find(
          (agent: any) => agent.projectId === activeProjectId,
        )?.id;
        setActiveAgentId(
          rememberedAgent &&
            displayAgents.some((agent: any) => agent.id === rememberedAgent)
            ? rememberedAgent
            : fallbackAgent,
        );
      }
  
    }, [activeProjectId, displayAgents.length]);

  useEffect(() => {
      if (!activeProjectId) {
        filesProjectIdRef.current = undefined;
        setFiles([]);
        setGitInfo({ current: null, branches: [] });
        setExpandedDirs(new Set());
        return;
      }
  
      const projectChanged = shouldResetExpandedDirsForProjectChange(
        filesProjectIdRef.current,
        activeProjectId,
      );
      filesProjectIdRef.current = activeProjectId;
      if (projectChanged) setExpandedDirs(new Set());
  
      let cancelled = false;
      const projectId = activeProjectId;
  
      void api.files
        .list(projectId)
        .then((next: any) => {
          if (!cancelled) setFiles(next);
        })
        .catch((error: any) => {
          if (!cancelled) setLogs((current: any) => [...current, String(error)]);
        });
      void api.git
        .branches(projectId)
        .then((next: any) => {
          if (!cancelled) setGitInfo(next);
        })
        .catch(() => {
          if (!cancelled) setGitInfo({ current: null, branches: [] });
        });
  
      return () => {
        cancelled = true;
      };
    }, [activeProjectId]);

  useEffect(() => {
      if (!activeProjectId) return;
      let stopped = false;
      const shouldPollGit = () =>
        !document.hidden &&
        Boolean(activeProjectId) &&
        Boolean(activeAgentIdRef.current || drawer === "files");
      const refreshGitInfo = async () => {
        if (!shouldPollGit()) return;
        try {
          const next = await api.git.branches(activeProjectId);
          if (stopped) return;
          setGitInfo((current: any) =>
            current.current === next.current &&
            current.branches.join("\n") === next.branches.join("\n")
              ? current
              : next,
          );
          const changed = await api.git.changedFiles(activeProjectId);
          if (!stopped) setGitChangedFiles(changed);
        } catch {
          if (!stopped) {
            setGitInfo({ current: null, branches: [] });
            setGitChangedFiles([]);
          }
        }
      };
      const handleVisibilityChange = () => {
        if (!document.hidden) void refreshGitInfo();
      };
      void refreshGitInfo();
      document.addEventListener("visibilitychange", handleVisibilityChange);
      const timer = window.setInterval(() => {
        void refreshGitInfo();
      }, 4000);
      return () => {
        stopped = true;
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        window.clearInterval(timer);
      };
    }, [activeProjectId, drawer]);

  useEffect(() => {
      const busy = isAgentBusy;
      const wasBusy = prevIsAgentBusyRef.current;
      prevIsAgentBusyRef.current = busy;
      if (wasBusy && !busy && goalStatusRef.current === "active" && activeAgentId) {
        const text = goalTextRef.current;
        // 直接扫描消息确认是否有 goal_complete（防范 effect 时序问题）
        const goalMsgs = activeAgentId ? conversationStateByAgent[activeAgentId]?.messages : undefined;
        if (goalMsgs?.some((m: any) => m.role === "tool" && m.meta?.toolName === "goal_complete")) {
          goalStatusRef.current = "complete";
          setGoalStatus("complete");
          setGoalCompletedAt(Date.now());
          return;
        }
  
        const iteration = goalIterationRef.current + 1;
        goalIterationRef.current = iteration;
  
        // 达到最大续接次数时自动完成，防止死循环
        if (iteration > GOAL_MAX_CONTINUATIONS) {
          goalStatusRef.current = "complete";
          setGoalStatus("complete");
          setGoalCompletedAt(Date.now());
          return;
        }
  
        if (!goalContinuationPendingRef.current && text) {
          goalContinuationPendingRef.current = true;
          const continuationMsg = `[goal 自动续接 #${iteration}]
  当前目标仍未完成，请继续工作:
  <goal_objective>
  ${text}
  </goal_objective>
  
  继续完成该目标。不要停止在分析、计划、TODO 或部分修改上。彻底完成后调用 goal_complete。`;
          api.agents.prompt({
            agentId: activeAgentId,
            message: continuationMsg,
            streamingBehavior: "followUp",
          }).catch(() => {
            goalContinuationPendingRef.current = false;
          });
        }
      }
      if (busy) {
        goalContinuationPendingRef.current = false;
      }
    }, [isAgentBusy, activeAgentId, api.agents]);
}
