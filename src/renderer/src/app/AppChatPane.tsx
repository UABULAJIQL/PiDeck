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

export function AppChatPane(props: AppLayoutProps) {
  const { _debugOpen, _logs, _setDebugOpen, abortAgent, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addProject, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, api, appendQuickPromptToComposer, appInfo, applyMessagePatch, applySuggestion, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, checkPiInstall, checkPiInstallInline, clampComposerHeight, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, clearCustomPiPath, clearImages, clearSuggestionTrigger, cloneAgentSession, closeAgent, closeDrawer, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, collapseDrawer, commandHistory, commands, compactAgent, compacting, compactRpcLogData, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, copySession, copySidebarSession, createAgent, createBranch, currentProjectPath, customPathResult, customPathValidating, customPiPath, cycleThinking, dataUrlToImageContent, DEFAULT_LIST_WIDTH, deleteHistorySession, describeApprovalRequest, diffFilePath, diffViewFile, diffViewMode, diffViewOriginalContent, discardAttachedImages, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, ensureComposerTailVisible, environmentDialog, executeSlashCommandStage, expandedDirs, exportAgentHtml, exportHistorySession, exportSidebarSession, fileMenu, files, filesProjectIdRef, fileToImageContent, filteredAgents, filteredProjects, finalizeTurnSummary, finishProjectDrag, flatFiles, focusComposerTextarea, getComposerMaxHeight, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, handleAddQuickPromptPreset, handleComposerKeyDown, handleDragOver, handleDrop, handleGoalCommand, handlePaste, handleProjectDragLeave, handleProjectDragOver, handleProjectDragStart, handleProjectDrop, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, importClaudeSessions, importCodexSessions, isAgentBusy, isAgentStarting, isAwaitingAssistant, isExtensionSlashCommand, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, openAgentRename, openClaudeImport, openCodexImport, openCurrentProjectInVSCode, openDrawer, openFilePath, openHistorySession, openModelPicker, openProjectSessions, openSessionRename, openSidebarSession, openSlashCommandStage, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, processImageFile, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, refreshFiles, refreshGitChangedFiles, refreshProjects, refreshProjectSessions, refreshRuntimeState, refreshSessionHistory, refreshSessions, relativeTimeNow, releaseDiscardedComposerImage, releaseListHoverSuppression, removeImage, removePendingCommandMessage, removeQuickPromptPreset, renameHistorySession, renamingFile, renamingFileInput, renderedMessages, reorderProjects, replaceMessages, resendUserMessage, resizeImageFile, resolvedComposerHeight, resolvedLocale, respondApproval, restartAgent, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, scanClaudeSessions, scanCodexSessions, scrollToBottom, search, seenProjectIdsRef, selectedSuggestionIndex, selectModel, selectThinking, sendBehaviorMenuOpen, sendPrompt, sendPromptAsFollowUp, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAttachedImages, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPrompt, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalCollapsedForAgent, setTerminalDockStateByAgent, setTerminalHeightByAgent, setTerminalOpenForAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, showToast, slashCommandStage, startComposerResize, startResize, stripPendingUiSlashMessages, submitAgentRename, submitComposerPrompt, submitPromptSnapshot, submitSessionRename, suggestionItems, suggestionsOpen, switchBranch, switchingBranch, syncComposerAutoHeight, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, testPiProxy, thinkingPickerOpen, timelineRef, toast, toggleAllClaudeSessions, toggleAllCodexSessions, toggleClaudeSession, toggleCodexSession, toggleDirectory, toggleDrawerPinned, toggleListCollapsed, transferAgentDraft, undoUserMessage, updateAfterProjectRemoved, updateQuickPromptState, updateSettings, upsertAgentMessagePatch, validateCustomPiPath, viewFilePath, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized } = props;

  return (
    <>
      <main ref={chatPaneRef} className="chat-pane">
              <header ref={chatHeaderRef} className="chat-header">
                <div className="chat-title-block">
                  <div className="chat-title-row">
                    <strong
                      title={activeAgent?.title ?? activeProject?.name ?? "PiDeck"}
                    >
                      {activeAgent?.title ??
                        (isChatProject(activeProject)
                          ? t("app.chatProject")
                          : activeProject?.name) ??
                        "PiDeck"}
                    </strong>
                    {activeAgent && (
                      <span className="chat-path" title={activeProject?.path ?? activeAgent.cwd}>
                        {t("app.path")}: {displayPath(activeProject?.path ?? activeAgent.cwd)}
                      </span>
                    )}
                  </div>
                  <div className="chat-subtitle-row">
                    {activeAgent?.status && (
                      <span className={`agent-status-badge status-${activeAgent.status}`}>
                        {activeAgent.status === 'running' && '●'}
                        {activeAgent.status === 'idle' && '○'}
                        {activeAgent.status === 'starting' && '◐'}
                        {' '}
                        {t(`app.status${activeAgent.status.charAt(0).toUpperCase() + activeAgent.status.slice(1)}` as any) || activeAgent.status}
                      </span>
                    )}
                    <SessionStatus
                      state={activeRuntimeState}
                      duration={
                        activeAgentId
                          ? sessionDurationByAgent[activeAgentId]
                          : undefined
                      }
                    />
                </div>
                </div>
                <div
                  className={`chat-header-actions${activeAgent?.status === "starting" ? " loading" : ""}`}
                >
                  <>
                    <div className="header-action-group branch-group">
                      {!isLanWeb && (
                        <BranchSelector
                          gitInfo={gitInfo}
                          switchingBranch={switchingBranch}
                          onSwitch={switchBranch}
                          onCreateBranch={createBranch}
                        />
                      )}
                    </div>
                    <div className="header-action-group panel-group">
                      {!isLanWeb && (
                        <>
                          <button
                            disabled={!currentProjectPath}
                            onClick={openCurrentProjectInVSCode}
                            title={
                              currentProjectPath
                                ? t("app.openInVSCodeTitle")
                                : t("app.openInVSCodeNoProject")
                            }
                          >
                            {t("app.openInVSCode")}
                          </button>
                          <button
                            className={drawer === "files" ? "active" : ""}
                            disabled={isAgentStarting}
                            onClick={() => {
                              openDrawer("files");
                            }}
                          >
                            {t("app.files")}
                          </button>
                          <button
                            className={terminalOpen ? "active" : ""}
                            disabled={!activeAgentId || isAgentStarting}
                            onClick={() => {
                              if (!activeAgentId) return;
                              setTerminalOpenForAgent(activeAgentId, !terminalOpen);
                            }}
                            title={t("app.openTerminalTitle")}
                          >
                            {t("app.terminal")}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                </div>
              </header>
      
              <section className="message-timeline" ref={timelineRef}>
                {/* 先放开消息分页,再放开当前页内较旧的分组渲染,避免长会话一次挂太多动态高度节点。 */}
                {hasMoreMessages && activeAgent && activeAgent.status !== "starting" && (
                  <div className="message-pagination">
                    <button
                      className="message-pagination-button"
                      onClick={loadMoreMessages}
                      disabled={isLoadingMoreMessages}
                    >
                      {isLoadingMoreMessages
                        ? t("common.loading")
                        : t("app.loadMoreHistoryMessages", {
                            count: activeMessages.length - paginatedMessages.length,
                          })}
                    </button>
                  </div>
                )}
                {hiddenRenderGroupCount > 0 && activeAgent && activeAgent.status !== "starting" && (
                  <div className="message-pagination">
                    <button
                      className="message-pagination-button"
                      onClick={() =>
                        setVisibleRenderGroupCount((current: any) => current + 80)
                      }
                    >
                      {t("app.loadMoreRenderedGroups", {
                        count: hiddenRenderGroupCount,
                      })}
                    </button>
                  </div>
                )}
      
                {activeAgent?.status === "starting" && (
                  <div className="history-loading">
                    <div className="loader" />
                    <span>{t("app.agentStarting")}</span>
                  </div>
                )}
                {!activeAgent && (
                  <div className="chat-timeline-empty" />
                )}
                {activeAgent && (
                  <VirtualizedMessageList
                    ref={virtualizedListRef}
                    scrollContainerRef={timelineRef}
                    className="message-list"
                    items={renderedMessages}
                    activeThinking={activeThinking}
                    awaitingAssistant={isAwaitingAssistant}
                    showThinking={settings.showThinking}
                    fileSummariesByMessage={
                      activeAgentId
                        ? (conversationStateByAgent[activeAgentId]?.turnFileSummaryByMessage ?? {})
                        : {}
                    }
                    onPreviewImage={setPreviewImage}
                    onOpenExternal={(url: any) => api.app.openExternal(url)}
                    onOpenFile={openFilePath}
                    onDiffFile={diffFilePath}
                    onUndoUserMessage={undoUserMessage}
                    onResendUserMessage={resendUserMessage}
                    onScrollStateChange={({ atBottom }) => {
                      setAutoScroll(atBottom);
                      setShowScrollToBottom(!atBottom);
                    }}
                  />
                )}
      
                {showScrollToBottom && (
                  <button
                    className="scroll-to-bottom-btn"
                    onClick={scrollToBottom}
                    title={t("app.scrollToBottom")}
                  >
                    <ChevronDown size={18} />
                  </button>
                )}
              </section>
      
              {outlineItems.length > 1 && (
                <ConversationOutline
                  items={outlineItems}
                  onJump={(id: any) =>
                    virtualizedListRef.current?.scrollToKey(id, "smooth")
                  }
                />
              )}
      
              {activeAgent && (
              <footer ref={composerRef} className="composer">
                {approvalRequest && (() => {
                  const approvalUi = describeApprovalRequest(approvalRequest);
                  return (
                    <ApprovalDialog
                      request={approvalRequest}
                      title={approvalUi.title}
                      message={approvalUi.message}
                      options={approvalUi.options}
                      mode={approvalUi.mode}
                      filterPlaceholder={approvalUi.filterPlaceholder}
                      emptyLabel={approvalUi.emptyLabel}
                      helperText={approvalUi.helperText}
                      cancelResponse={approvalUi.cancelResponse}
                      busy={approvalBusy}
                      inline
                      onSelect={(response: any) => void respondApproval(response as Record<string, unknown>)}
                    />
                  );
                })()}
                {/* 图片预览作为输入框上方的附件栏,避免占用 textarea 的可输入区域。 */}
                {attachedImages.length > 0 && (
                  <div className="image-preview-area">
                    {attachedImages.map((img: any, index: any) => (
                      <div key={index} className="image-preview-item">
                        <img
                          src={img.type === "image-asset" ? (img.previewUrl ?? "") : `data:${img.mimeType};base64,${img.data}`}
                          alt={t("app.imageAlt", { index: index + 1 })}
                          onClick={() => setPreviewImage(img)}
                          style={{ cursor: "pointer" }}
                        />
                        <button
                          className="image-remove-btn"
                          onClick={() => removeImage(index)}
                          title={t("app.imageRemove")}
                        >
                          <X size={12} strokeWidth={2.4} />
                        </button>
                      </div>
                    ))}
                    <button
                      className="image-clear-btn"
                      onClick={clearImages}
                      title={t("app.clearImagesTitle")}
                    >
                      {t("app.clearImages")}
                    </button>
                  </div>
                )}
                <div
                  ref={composerBoxRef}
                  className={`composer-box ${
                    prompt.startsWith("!!")
                      ? "shell-silent-mode"
                      : prompt.startsWith("!")
                        ? "shell-mode"
                        : ""
                  }`}
                  style={{ height: resolvedComposerHeight }}
                >
                  <div
                    className="composer-resize-handle"
                    title={t("app.resizeComposer")}
                    onPointerDown={startComposerResize}
                  />
                  <ComposerToolbar
                    state={activeRuntimeState}
                    compacting={compacting}
                    disabled={isAgentBusy || composerDisabled}
                    quickPrompts={quickPrompts}
                    quickPromptDraft={quickPromptDraft}
                    quickPromptDisabled={!activeAgentId}
                    onQuickPromptDraftChange={setQuickPromptDraft}
                    onAddQuickPrompt={handleAddQuickPromptPreset}
                    onUseQuickPrompt={appendQuickPromptToComposer}
                    onRemoveQuickPrompt={removeQuickPromptPreset}
                    onPickModel={openModelPicker}
                    onPickThinking={() => setThinkingPickerOpen(true)}
                    onCompact={compactAgent}
                  />
                  <textarea
                    ref={composerTextareaRef}
                    wrap="soft"
                    value={prompt}
                    className={
                      prompt.startsWith("!!")
                        ? "bang-bang"
                        : prompt.startsWith("!")
                          ? "bang"
                          : ""
                    }
                    onFocus={() => setSuggestionsOpen(true)}
                    onChange={(event: any) => {
                      const newValue = event.target.value;
                      setPrompt(newValue);
                      setSuggestionsOpen(true);
      
                      // 如果正在历史导航,检测到用户手动编辑内容则退出历史模式
                      if (historyNavigating) {
                        const currentHistoryCommand = commandHistory[historyIndex];
                        // 如果编辑后的内容与当前历史命令不同,说明用户在编辑
                        if (newValue !== currentHistoryCommand) {
                          setHistoryIndex(-1);
                          setHistoryNavigating(false);
                          setSavedPrompt("");
                        }
                      }
                    }}
                    onKeyDown={handleComposerKeyDown}
                    onPaste={handlePaste}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    disabled={composerDisabled}
                    placeholder={
                      isAgentStarting
                        ? t("app.agentStartingPlaceholder")
                        : isUiSlashApprovalActive
                          ? t("app.composerUiSlashPlaceholder")
                          : !activeAgent
                          ? t("app.composerNoAgentPlaceholder")
                          : prompt.startsWith("!!")
                            ? t("app.composerSilentPlaceholder")
                            : prompt.startsWith("!")
                              ? t("app.composerShellPlaceholder")
                              : settings.sendShortcut === "enter-send"
                                ? t("app.composerEnterPlaceholder")
                                : t("app.composerShortcutPlaceholder")
                    }
                  />
                  {suggestionsOpen && !composerDisabled && (
                    <PromptSuggestions
                      prompt={prompt}
                      items={suggestionItems}
                      selectedIndex={selectedSuggestionIndex}
                      onSelectedIndexChange={setSelectedSuggestionIndex}
                      onClose={() => {
                        setPrompt((current: any) => clearSuggestionTrigger(current));
                        setSuggestionsOpen(false);
                        requestAnimationFrame(() => {
                          document
                            .querySelector<HTMLTextAreaElement>(
                              ".composer-box textarea",
                            )
                            ?.focus();
                        });
                      }}
                      onPick={(value: any) => {
                        setPrompt((current: any) => applySuggestion(current, value));
                        setSuggestionsOpen(false);
                        requestAnimationFrame(() => {
                          document
                            .querySelector<HTMLTextAreaElement>(
                              ".composer-box textarea",
                            )
                            ?.focus();
                        });
                      }}
                    />
                  )}
                  {slashCommandStage && (
                    <SlashCommandStagePanel
                      stage={slashCommandStage}
                      onStageChange={setSlashCommandStage}
                      onExecute={(stage: any) => void executeSlashCommandStage(stage)}
                    />
                  )}
                  <div className="composer-footer">
                    <span className={composerMode ? "composer-mode-status" : ""}>
                      {composerStatusText}
                    </span>
                    {activeAgent?.status === "running" && !isUiSlashApprovalActive && (
                      <button className="stop-send" onClick={() => abortAgent()}>
                        {t("app.stop")}
                      </button>
                    )}
                    <div className="send-button-group">
                      <button
                        disabled={
                          composerDisabled ||
                          !activeAgentId ||
                          (!prompt.trim() && attachedImages.length === 0)
                        }
                        className={
                          isAgentBusy && (prompt.trim() || attachedImages.length > 0)
                            ? "queue-send"
                            : ""
                        }
                        onClick={sendPrompt}
                      >
                        {isAgentBusy && (prompt.trim() || attachedImages.length > 0)
                          ? t("app.composerAttach")
                          : t("app.send")}
                      </button>
                      {isAgentBusy &&
                        (prompt.trim() || attachedImages.length > 0) && (
                          <div className="send-behavior-menu-wrap">
                            <button
                              className="send-behavior-toggle"
                              title={t("app.sendBehaviorTitle")}
                              onClick={() => setSendBehaviorMenuOpen((open: any) => !open)}
                            >
                              <ChevronDown size={14} />
                            </button>
                            {sendBehaviorMenuOpen && (
                              <div className="send-behavior-menu">
                                <button onClick={sendPrompt}>
                                  <strong>{t("app.sendSteerTitle")}</strong>
                                  <span>{t("app.sendSteerDesc")}</span>
                                </button>
                                <button onClick={sendPromptAsFollowUp}>
                                  <strong>{t("app.sendFollowUpTitle")}</strong>
                                  <span>{t("app.sendFollowUpDesc")}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </footer>
              )}
      
              {!isLanWeb && terminalOpen && activeAgentId && (
                <TerminalDock
                  agentId={activeAgentId}
                  collapsed={terminalCollapsed}
                  height={terminalHeightByAgent[activeAgentId] ?? 220}
                  terminal={api.terminal}
                  onCollapsedChange={(collapsed: any) =>
                    setTerminalCollapsedForAgent(activeAgentId, collapsed)
                  }
                  onHeightChange={(height: any) =>
                    setTerminalHeightByAgent((current: any) => ({
                      ...current,
                      [activeAgentId]: height,
                    }))
                  }
                  onClose={() => setTerminalOpenForAgent(activeAgentId, false)}
                />
              )}
            </main>
    </>
  );
}
