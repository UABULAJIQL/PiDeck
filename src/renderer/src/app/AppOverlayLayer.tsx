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

export function AppOverlayLayer(props: AppLayoutProps) {
  const { _debugOpen, _logs, _setDebugOpen, abortAgent, activeAgent, activeAgentByProject, activeAgentId, activeAgentIdRef, activeMessages, activeProject, activeProjectId, activeRuntimeState, activeTerminalHeight, activeThinking, addProject, addQuickPromptPreset, agentActionLoading, agentMenu, agentRenameTarget, agentRenameValue, agentRenaming, agents, agentStatusByAgentRef, api, appendQuickPromptToComposer, appInfo, applyMessagePatch, applySuggestion, approvalBusy, approvalRequest, attachedImages, autoScroll, availableModels, canReorderProjects, chatHeaderRef, chatPaneRef, checkPiInstall, checkPiInstallInline, clampComposerHeight, claudeImportLoading, claudeImportProject, claudeImportReport, claudeImportRunning, claudeImportSelected, claudeImportSessions, clearCustomPiPath, clearImages, clearSuggestionTrigger, cloneAgentSession, closeAgent, closeDrawer, codexImportLoading, codexImportProject, codexImportReport, codexImportRunning, codexImportSelected, codexImportSessions, collapsedProjects, collapseDrawer, commandHistory, commands, compactAgent, compacting, compactRpcLogData, completedAlertBusyByAgentRef, completedSessionAlerts, composerAutoHeight, composerBoxRef, composerDisabled, composerHeight, composerMode, composerRef, composerStatusText, composerTextareaRef, configOpen, confirmDialog, conversationStateByAgent, copySession, copySidebarSession, createAgent, createBranch, currentProjectPath, customPathResult, customPathValidating, customPiPath, cycleThinking, dataUrlToImageContent, DEFAULT_LIST_WIDTH, deleteHistorySession, describeApprovalRequest, diffFilePath, diffViewFile, diffViewMode, diffViewOriginalContent, discardAttachedImages, displayAgents, draggingProjectId, dragOverProjectId, drawer, drawerCollapsed, drawerPinned, drawerPinnedByAgent, drawerPinnedPanel, drawerWidth, ensureComposerTailVisible, environmentDialog, executeSlashCommandStage, expandedDirs, exportAgentHtml, exportHistorySession, exportSidebarSession, fileMenu, files, filesProjectIdRef, fileToImageContent, filteredAgents, filteredProjects, finalizeTurnSummary, finishProjectDrag, flatFiles, focusComposerTextarea, getComposerMaxHeight, getQuickPromptState, gitChangedFiles, gitInfo, GOAL_MAX_CONTINUATIONS, goalCompletedAt, goalContinuationPendingRef, goalIterationRef, goalStartedAt, goalStartedAtRef, goalStatus, goalStatusRef, goalText, goalTextRef, groupedMessages, handleAddQuickPromptPreset, handleComposerKeyDown, handleDragOver, handleDrop, handleGoalCommand, handlePaste, handleProjectDragLeave, handleProjectDragOver, handleProjectDragStart, handleProjectDrop, hasMoreMessages, hiddenRenderGroupCount, historyIndex, historyNavigating, importClaudeSessions, importCodexSessions, isAgentBusy, isAgentStarting, isAwaitingAssistant, isExtensionSlashCommand, isLoadingMoreMessages, isUiSlashApprovalActive, listCollapsed, listHoverRevealSuppressed, listWidth, loadMoreMessages, migrateConversationAgents, modelPickerOpen, modifiedFiles, openAgentRename, openClaudeImport, openCodexImport, openCurrentProjectInVSCode, openDrawer, openFilePath, openHistorySession, openModelPicker, openProjectSessions, openSessionRename, openSidebarSession, openSlashCommandStage, outlineItems, paginatedMessages, pendingAgents, pendingAgentsRef, pendingUiSlashCommandAgentId, pendingUiSlashCommandRef, piChecking, piProxyChecking, piProxyNotice, piProxyNoticeTone, piStatus, previewImage, prevIsAgentBusyRef, processImageFile, projectDragPreventClickRef, projectIdsKey, projectMenu, projects, prompt, promptByAgent, quickPromptDraft, quickPrompts, refreshFiles, refreshGitChangedFiles, refreshProjects, refreshProjectSessions, refreshRuntimeState, refreshSessionHistory, refreshSessions, relativeTimeNow, releaseDiscardedComposerImage, releaseListHoverSuppression, removeImage, removePendingCommandMessage, removeQuickPromptPreset, renameHistorySession, renamingFile, renamingFileInput, renderedMessages, reorderProjects, replaceMessages, resendUserMessage, resizeImageFile, resolvedComposerHeight, resolvedLocale, respondApproval, restartAgent, rpcLogAgentId, rpcLogs, runtimeStateByAgent, savedPrompt, scanClaudeSessions, scanCodexSessions, scrollToBottom, search, seenProjectIdsRef, selectedSuggestionIndex, selectModel, selectThinking, sendBehaviorMenuOpen, sendPrompt, sendPromptAsFollowUp, sessionActionLoading, sessionDurationByAgent, sessionHistoryLoading, sessionLoadingByProject, sessionMenu, sessionRenameTarget, sessions, sessionsByProject, sessionsProject, sessionsProjectId, sessionStartByAgentRef, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setAgentActionLoading, setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setAppInfo, setApprovalBusy, setApprovalRequest, setAttachedImages, setAutoScroll, setAvailableModels, setClaudeImportLoading, setClaudeImportProject, setClaudeImportReport, setClaudeImportRunning, setClaudeImportSelected, setClaudeImportSessions, setCodexImportLoading, setCodexImportProject, setCodexImportReport, setCodexImportRunning, setCodexImportSelected, setCodexImportSessions, setCollapsedProjects, setCommandHistory, setCommands, setCompacting, setCompletedSessionAlerts, setComposerAutoHeight, setComposerHeight, setConfigOpen, setConfirmDialog, setConversationAttachedImages, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent, setDraggingProjectId, setDragOverProjectId, setDrawer, setDrawerCollapsed, setDrawerPinnedByAgent, setDrawerWidth, setEnvironmentDialog, setExpandedDirs, setFileMenu, setFiles, setGitChangedFiles, setGitInfo, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, setHistoryIndex, setHistoryNavigating, setListCollapsed, setListHoverRevealSuppressed, setListWidth, setLogs, setModelPickerOpen, setPendingAgents, setPendingUiSlashCommandAgentId, setPiChecking, setPiProxyChecking, setPiProxyNotice, setPiProxyNoticeTone, setPiStatus, setPreviewImage, setProjectMenu, setProjects, setPrompt, setPromptByAgent, setQuickPromptDraft, setRelativeTimeNow, setRenamingFile, setRenamingFileInput, setRpcLogAgentId, setRpcLogs, setRuntimeStateByAgent, setSavedPrompt, setSearch, setSelectedSuggestionIndex, setSendBehaviorMenuOpen, setSessionActionLoading, setSessionDurationByAgent, setSessionHistoryLoading, setSessionLoadingByProject, setSessionMenu, setSessionRenameTarget, setSessions, setSessionsByProject, setSessionsProjectId, setSettings, setSettingsLoaded, setSettingsNotice, setSettingsOpen, setShowScrollToBottom, setSlashCommandStage, setSuggestionsOpen, setSwitchingBranch, setTerminalCollapsedForAgent, setTerminalDockStateByAgent, setTerminalHeightByAgent, setTerminalOpenForAgent, setThinking, setThinkingPickerOpen, settings, settingsLoaded, settingsNotice, settingsOpen, setToast, setVisibleRenderGroupCount, setWebServiceChanging, setWindowAlwaysOnTop, setWindowMaximized, showScrollToBottom, showToast, slashCommandStage, startComposerResize, startResize, stripPendingUiSlashMessages, submitAgentRename, submitComposerPrompt, submitPromptSnapshot, submitSessionRename, suggestionItems, suggestionsOpen, switchBranch, switchingBranch, syncComposerAutoHeight, terminalCollapsed, terminalDockState, terminalDockStateByAgent, terminalHeightByAgent, terminalOpen, testPiProxy, thinkingPickerOpen, timelineRef, toast, toggleAllClaudeSessions, toggleAllCodexSessions, toggleClaudeSession, toggleCodexSession, toggleDirectory, toggleDrawerPinned, toggleListCollapsed, transferAgentDraft, undoUserMessage, updateAfterProjectRemoved, updateQuickPromptState, updateSettings, upsertAgentMessagePatch, validateCustomPiPath, viewFilePath, virtualizedListRef, visibleAgents, visibleRenderGroupCount, webServiceChanging, windowAlwaysOnTop, windowMaximized } = props;

  return (
    <>
      {drawer && !drawerCollapsed && (
              <div
                className="splitter splitter-right"
                onPointerDown={(event: any) => startResize("drawer", event)}
              />
            )}
      {drawer && !drawerCollapsed && (
              <aside className="detail-drawer">
                <div className="drawer-content-frame">
                  <DrawerContent
                    panel={drawer}
                    project={drawer === "sessions" ? sessionsProject : undefined}
                    files={files}
                    sessions={sessions}
                    gitChangedFiles={gitChangedFiles}
                    expandedDirs={expandedDirs}
                    onToggleDirectory={toggleDirectory}
                    pinned={drawerPinned}
                    onTogglePin={toggleDrawerPinned}
                    onCollapse={collapseDrawer}
                    onClose={closeDrawer}
                    onFileContextMenu={(node: any, x: any, y: any) => setFileMenu({ node, x, y })}
                    onRefreshFiles={() => {
                      refreshFiles(activeProjectId);
                      refreshGitChangedFiles(activeProjectId);
                    }}
                    onRefreshSessions={() =>
                      refreshSessions(sessionsProjectId ?? activeProjectId)
                    }
                    onOpenSession={(session: any) =>
                      createAgent(
                        sessionsProjectId ?? activeProjectId,
                        session.filePath,
                        session.name || t("common.untitled"),
                      )
                    }
                    onRenameSession={async (filePath: any, newName: any) => {
                      await api.sessions.rename(filePath, newName);
                      await refreshSessions(sessionsProjectId ?? activeProjectId);
                    }}
                    onCopySession={(session: any) =>
                      copySession(
                        session.filePath,
                        sessionsProjectId ?? activeProjectId,
                      )
                    }
                    onExportSession={exportHistorySession}
                    onDeleteSession={deleteHistorySession}
                    onDiffFile={diffFilePath}
                    onViewFile={viewFilePath}
                    onOpenFile={openFilePath}
                  />
                </div>
              </aside>
            )}
      {drawer && drawerCollapsed && (
              <button
                className="drawer-restore"
                title={t("drawer.expandPanel")}
                onClick={() => setDrawerCollapsed(false)}
              >
                <ChevronLeft size={16} />
              </button>
            )}
      {fileMenu && (
              <FileContextMenu
                menu={fileMenu}
                onClose={() => setFileMenu(null)}
                onOpen={() => {
                  void api.files.open(fileMenu.node.path);
                  setFileMenu(null);
                }}
                onReveal={() => {
                  void api.files.showInFolder(fileMenu.node.path);
                  setFileMenu(null);
                }}
                onAttach={() => {
                  setPrompt(
                    (current: any) =>
                      `${current}${current.endsWith(" ") || current.length === 0 ? "" : " "}@${fileMenu.node.relativePath} `,
                  );
                  setFileMenu(null);
                }}
                onCopyPath={() => {
                  void navigator.clipboard.writeText(fileMenu.node.path);
                  setFileMenu(null);
                }}
                onRename={() => {
                  const node = fileMenu.node;
                  setRenamingFile({ path: node.path, name: node.name });
                  setRenamingFileInput(node.name);
                  setFileMenu(null);
                }}
                onDelete={() => {
                  const node = fileMenu.node;
                  setFileMenu(null);
                  setConfirmDialog({
                    title: node.type === "directory" ? t("drawer.deleteFolderTitle") : t("drawer.deleteFileTitle"),
                    message: node.type === "directory"
                      ? t("drawer.deleteFolderConfirm", { name: node.name })
                      : t("drawer.deleteFileConfirm", { name: node.name }),
                    danger: true,
                    confirmLabel: t("common.delete"),
                    onConfirm: async () => {
                      setConfirmDialog(null);
                      try {
                        await api.files.delete(node.path, true);
                        void refreshFiles();
                      } catch (e) {
                        console.error("[File] 删除失败:", e);
                      }
                    },
                  });
                }}
              />
            )}
      {projectMenu && (
              <ProjectContextMenu
                menu={projectMenu}
                onClose={() => setProjectMenu(null)}
                onRevealProject={() => {
                  void api.files.showInFolder(projectMenu.project.path);
                  setProjectMenu(null);
                }}
                onTogglePin={() => {
                  const project = projectMenu.project;
                  setProjectMenu(null);
                  void api.projects.togglePinned(project.id).then((next: any) => {
                    setProjects(next);
                  });
                }}
                onImportCodexSessions={() => openCodexImport(projectMenu.project)}
                onImportClaudeSessions={() => openClaudeImport(projectMenu.project)}
                onRemoveProject={async () => {
                  const project = projectMenu.project;
                  setProjectMenu(null);
                  const next = await api.projects.remove(project.id);
                  setProjects(next);
                  updateAfterProjectRemoved(project.id, next);
                }}
              />
            )}
      {agentMenu && (
              <AgentContextMenu
                menu={agentMenu}
                actionLoading={agentActionLoading}
                onClose={() => {
                  if (!agentActionLoading) setAgentMenu(null);
                }}
                onRename={() => openAgentRename(agentMenu.agent)}
                onRestart={() => {
                  void restartAgent(agentMenu.agent.id);
                }}
                onExport={() => {
                  void exportAgentHtml(agentMenu.agent.id);
                }}
                onCopySession={() => {
                  void cloneAgentSession(agentMenu.agent.id);
                }}
                onShowLogs={() => {
                  setRpcLogAgentId(agentMenu.agent.id);
                  setAgentMenu(null);
                }}
                onCloseAgent={() => {
                  void closeAgent(agentMenu.agent.id);
                  setAgentMenu(null);
                }}
              />
            )}
      {sessionMenu && (
              <SessionContextMenu
                menu={sessionMenu}
                actionLoading={sessionActionLoading}
                onClose={() => {
                  if (!sessionActionLoading) setSessionMenu(null);
                }}
                onRestartSession={() => {
                  void openSidebarSession(sessionMenu.projectId, sessionMenu.session);
                }}
                onRename={() =>
                  openSessionRename(sessionMenu.projectId, sessionMenu.session)
                }
                onExport={() => {
                  void exportSidebarSession(
                    sessionMenu.projectId,
                    sessionMenu.session,
                  );
                }}
                onCopySession={() => {
                  void copySidebarSession(sessionMenu.projectId, sessionMenu.session);
                }}
                onShowLogs={() => {
                  void openSidebarSession(
                    sessionMenu.projectId,
                    sessionMenu.session,
                  ).then((tab: any) => {
                    if (tab) setRpcLogAgentId(tab.id);
                  });
                }}
                onTogglePin={() => {
                  const session = sessionMenu.session;
                  setSessionMenu(null);
                  // 置顶仅影响侧栏排序,不会改变会话内容。这里需要同步刷新主列表和历史列表，避免只改标记不改显示顺序。
                  void api.sessions.togglePinned(sessionMenu.projectId, session.filePath).then(() => {
                    void refreshProjectSessions(sessionMenu.projectId);
                    if (sessionsProjectId === sessionMenu.projectId) {
                      void refreshSessions(sessionMenu.projectId);
                    }
                  });
                }}
                onDeleteSession={() => {
                  const session = sessionMenu.session;
                  const projectId = sessionMenu.projectId;
                  setSessionMenu(null);
                  void deleteHistorySession(session, projectId);
                }}
              />
            )}
      {(agentRenameTarget || sessionRenameTarget) && (
              <div
                className="modal-backdrop rename-dialog-backdrop"
                onClick={() => {
                  if (!agentRenaming) {
                    setAgentRenameTarget(null);
                    setSessionRenameTarget(null);
                  }
                }}
              >
                <form
                  className="rename-dialog"
                  onClick={(event: any) => event.stopPropagation()}
                  onSubmit={(event: any) => {
                    event.preventDefault();
                    if (agentRenameTarget) void submitAgentRename();
                    else void submitSessionRename();
                  }}
                >
                  <div className="rename-dialog-header">
                    <strong>{t("app.renameSessionTitle")}</strong>
                    <button
                      type="button"
                      disabled={agentRenaming}
                      onClick={() => {
                        setAgentRenameTarget(null);
                        setSessionRenameTarget(null);
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <input
                    autoFocus
                    value={agentRenameValue}
                    onChange={(event: any) => setAgentRenameValue(event.target.value)}
                    placeholder={t("app.renameSessionPlaceholder")}
                    disabled={agentRenaming}
                  />
                  <div className="rename-dialog-actions">
                    <button
                      type="button"
                      disabled={agentRenaming}
                      onClick={() => {
                        setAgentRenameTarget(null);
                        setSessionRenameTarget(null);
                      }}
                    >
                      {t("common.cancel")}
                    </button>
                    <button type="submit" disabled={agentRenaming}>
                      {agentRenaming ? t("common.saving") : t("common.save")}
                    </button>
                  </div>
                </form>
              </div>
            )}
      {/* RPC 日志弹窗 */}
      {rpcLogAgentId && (
              <RpcLogModal
                logs={rpcLogs.filter((l: any) => l.agentId === rpcLogAgentId)}
                onClose={() => setRpcLogAgentId(null)}
              />
            )}
      {toast && <div className="toast">{toast}</div>}
      {environmentDialog && (
              <EnvironmentDialog
                status={piStatus}
                checking={piChecking}
                onClose={() => {
                  setEnvironmentDialog(false);
                  setCustomPathResult(null);
                }}
                onRecheck={() => {
                  setCustomPathResult(null);
                  checkPiInstall("manual");
                }}
                onOpenInstallDocs={() =>
                  api.app.openExternal(
                    "https://pi.dev/docs/latest/quickstart#install",
                  )
                }
                customPath={customPiPath}
                customPathValidating={customPathValidating}
                customPathResult={customPathResult}
                onCustomPathChange={(path: any) => {
                  setCustomPiPath(path);
                  setCustomPathResult(null);
                }}
                onValidateCustomPath={() =>
                  validateCustomPiPath({ closeDialogOnSuccess: true })
                }
              />
            )}
      {modelPickerOpen && (
              <ModelPicker
                models={availableModels}
                current={{
                  provider: activeRuntimeState?.provider,
                  modelId: activeRuntimeState?.modelId,
                  modelName: activeRuntimeState?.modelName,
                }}
                onClose={() => setModelPickerOpen(false)}
                onPick={selectModel}
              />
            )}
      {thinkingPickerOpen && (
              <ThinkingPicker
                current={activeRuntimeState?.thinkingLevel}
                onClose={() => setThinkingPickerOpen(false)}
                onPick={selectThinking}
              />
            )}
      {settingsOpen && (
              <SettingsModal
                settings={settings}
                notice={settingsNotice}
                piStatus={piStatus}
                piChecking={piChecking}
                piProxyChecking={piProxyChecking}
                piProxyNotice={piProxyNotice}
                piProxyNoticeTone={piProxyNoticeTone}
                webServiceChanging={webServiceChanging}
                appInfo={appInfo}
                customPiPath={customPiPath}
                customPathValidating={customPathValidating}
                customPathResult={customPathResult}
                onCustomPathChange={(path: any) => {
                  setCustomPiPath(path);
                  setCustomPathResult(null);
                }}
                onValidateCustomPath={() => validateCustomPiPath()}
                onClearCustomPath={clearCustomPiPath}
                onCheckPi={checkPiInstallInline}
                onTestPiProxy={() => testPiProxy()}
                onToggleDevTools={async () => {
                  const opened = await api.app.toggleDevTools();
                  setSettingsNotice(
                    opened ? t("app.devToolsOpened") : t("app.devToolsClosed"),
                  );
                }}
                onRestartApp={() => api.app.restart()}
                onOpenWebService={(port: any) =>
                  api.app.openExternal(`http://127.0.0.1:${port}`)
                }
                onClose={() => {
                  setSettingsOpen(false);
                  setSettingsNotice("");
                }}
                onChange={updateSettings}
              />
            )}
      {diffViewFile && (
              <FileDiffViewer
                filePath={diffViewFile}
                mode={diffViewMode}
                originalContent={diffViewMode === "diff" ? diffViewOriginalContent : undefined}
                onClose={() => { setDiffViewFile(null); setDiffViewMode("view"); }}
                readContent={(path: any) => api.files.readContent(path)}
                readOriginalContent={(path: any) => api.git.originalContent(path)}
                saveContent={(path: any, content: any) => api.files.writeContent(path, content)}
                theme={document.documentElement.dataset.theme === "dark" ? "dark" : "light"}
                maxFileSizeMB={settings.maxEditorFileSizeMB}
              />
            )}
      {previewImage && (
              <ImagePreviewModal
                image={previewImage}
                onClose={() => setPreviewImage(null)}
              />
            )}
      {codexImportProject && (
              <CodexImportModal
                project={codexImportProject}
                sessions={codexImportSessions}
                selectedPaths={codexImportSelected}
                loading={codexImportLoading}
                importing={codexImportRunning}
                report={codexImportReport}
                onClose={() => {
                  setCodexImportProject(null);
                  setCodexImportReport(null);
                }}
                onRefresh={() => scanCodexSessions()}
                onToggle={toggleCodexSession}
                onToggleAll={toggleAllCodexSessions}
                onImport={importCodexSessions}
              />
            )}
      {claudeImportProject && (
              <ClaudeImportModal
                project={claudeImportProject}
                sessions={claudeImportSessions}
                selectedPaths={claudeImportSelected}
                loading={claudeImportLoading}
                importing={claudeImportRunning}
                report={claudeImportReport}
                onClose={() => {
                  setClaudeImportProject(null);
                  setClaudeImportReport(null);
                }}
                onRefresh={() => scanClaudeSessions()}
                onToggle={toggleClaudeSession}
                onToggleAll={toggleAllClaudeSessions}
                onImport={importClaudeSessions}
              />
            )}
      {sessionsProject && (
              <SessionHistoryModal
                project={sessionsProject}
                sessions={sessions}
                loading={sessionHistoryLoading}
                onClose={() => {
                  setSessionsProjectId(undefined);
                  setSessions([]);
                }}
                onRefresh={() => refreshSessionHistory(sessionsProject.id)}
                onOpen={openHistorySession}
                onRename={renameHistorySession}
                onCopy={(session: any) =>
                  copySession(session.filePath, sessionsProject.id)
                }
                onExport={exportHistorySession}
                onDelete={deleteHistorySession}
              />
            )}
      <ConfigModal
              open={configOpen}
              onClose={() => setConfigOpen(false)}
              onSaved={() => {
                // 配置保存后不自动重启，用户可通过 Restart 按钮手动应用新配置。
              }}
              settings={settings}
              projectPath={currentProjectPath}
              onSettingsChange={updateSettings}
            />
      {confirmDialog && (
              <ConfirmDialog
                title={confirmDialog.title}
                message={confirmDialog.message}
                danger={confirmDialog.danger}
                confirmLabel={confirmDialog.confirmLabel}
                onConfirm={confirmDialog.onConfirm}
                onCancel={() => setConfirmDialog(null)}
              />
            )}
      {renamingFile && (
              <div className="config-modal-overlay" onClick={() => setRenamingFile(null)}>
                <div className="config-modal-dialog" onClick={(e: any) => e.stopPropagation()}>
                  <strong>{t("drawer.renameTitle")}</strong>
                  <div style={{ margin: "12px 0" }}>
                    <input
                      type="text"
                      value={renamingFileInput}
                      onChange={(e: any) => setRenamingFileInput(e.target.value)}
                      className="config-input"
                      autoFocus
                      onKeyDown={(e: any) => {
                        if (e.key === "Enter") {
                          const path = renamingFile.path;
                          const newName = renamingFileInput.trim();
                          if (newName && newName !== renamingFile.name) {
                            void api.files.rename(path, newName).then(() => {
                              void refreshFiles();
                              setRenamingFile(null);
                            }).catch((err: any) => console.error("[File] 重命名失败:", err));
                          } else {
                            setRenamingFile(null);
                          }
                        }
                        if (e.key === "Escape") setRenamingFile(null);
                      }}
                    />
                  </div>
                  <div className="config-modal-actions">
                    <button className="config-btn" onClick={() => setRenamingFile(null)}>
                      {t("common.cancel")}
                    </button>
                    <button
                      className="config-btn primary"
                      onClick={() => {
                        const path = renamingFile.path;
                        const newName = renamingFileInput.trim();
                        if (newName && newName !== renamingFile.name) {
                          void api.files.rename(path, newName).then(() => {
                            void refreshFiles();
                            setRenamingFile(null);
                          }).catch((err: any) => console.error("[File] 重命名失败:", err));
                        } else {
                          setRenamingFile(null);
                        }
                      }}
                    >
                      {t("common.confirm")}
                    </button>
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
