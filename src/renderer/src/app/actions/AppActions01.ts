import type { AppContext } from "../AppContext";
import type { PointerEvent } from "react";
import { getComposerEnterIntent } from "../../composerBehavior";
import { t } from "../../i18n";
import {
  createForkStageOptions,
  createSessionStageOptions,
  createSlashCommandStage,
  getSlashStageCommand,
  isSlashStageStillActive,
  type SlashStageCommand,
} from "../../slashCommandStage";
import { setTerminalDockCollapsed, setTerminalDockOpen } from "../../terminalDockState";
import type { AgentMessagePatch, ChatMessage, ComposerImage, ImageContent } from "../../../../shared/types";
import { sortSessionsForDisplay } from "../../../../shared/sessionDisplay";
import {
  COMPOSER_MIN_HEIGHT,
  COMPOSER_MIN_TIMELINE_HEIGHT,
  api,
  createImagePreviewObjectUrl,
  displayProjectDirectoryName,
  getSessionAlertKey,
  getToolChangedLineCount,
  isChatProject,
  isPendingAgentId,
  isSameSessionPath,
  normalizeSessionPathForCompare,
  resolveFileLinkPath,
  revokeComposerImagePreviewUrl,
} from "../appRuntime";

export function compactRpcLogData(
  ctx: AppContext,
  value: unknown,
  depth = 0,
): unknown {

    if (value == null) return value;
    if (typeof value === "string") {
      return value.length > 4000 ? `${value.slice(0, 4000)}…[truncated ${value.length - 4000} chars]` : value;
    }
    if (typeof value !== "object") return value;
    if (depth >= 3) return "[truncated nested object]";
    if (Array.isArray(value)) {
      const next: unknown[] = value.slice(0, 20).map((item: any) => compactRpcLogData(ctx, item, depth + 1));
      if (value.length > 20) next.push(`[truncated ${value.length - 20} items]`);
      return next;
    }
    const entries = Object.entries(value as Record<string, unknown>);
    const limitedEntries: [string, unknown][] = entries.slice(0, 40).map(([key, entryValue]) => [
      key,
      compactRpcLogData(ctx, entryValue, depth + 1),
    ]);
    if (entries.length > 40) {
      limitedEntries.push(["__truncatedKeys", entries.length - 40]);
    }
    return Object.fromEntries(limitedEntries);
  
}

export function stripPendingUiSlashMessages(
  ctx: AppContext,
  agentId: string,
  messages: ChatMessage[],
) {
  const { pendingUiSlashCommandRef } = ctx;

    const pending = pendingUiSlashCommandRef.current;
    if (!pending || pending.agentId !== agentId) return messages;
    const lastUserIndex = [...messages]
      .map((message: any, index: any) => ({ message, index }))
      .reverse()
      .find(({ message }) => message.role === "user")?.index;
    if (lastUserIndex == null) return messages;
    if (messages[lastUserIndex]?.text.trim() !== pending.command.trim()) return messages;
    return messages.filter((_: any, index: any) => index !== lastUserIndex);
  
}

export function upsertAgentMessagePatch(
  ctx: AppContext,
  messages: ChatMessage[],
  patch: AgentMessagePatch,
) {

    const next = [...messages];
    const index = next.findIndex((message: any) => message.id === patch.message.id);
    if (index >= 0) {
      next[index] = patch.message;
      return next;
    }
    next.push(patch.message);
    return next;
  
}

export function setPrompt(
  ctx: AppContext,
  value: string | ((current: string) => string),
) {
  const { activeAgentIdRef, setPromptByAgent } = ctx;

    const targetAgentId = activeAgentIdRef.current;
    if (!targetAgentId) return;
    setPromptByAgent((current: any) => {
      const previous = current[targetAgentId] ?? "";
      const nextValue = typeof value === "function" ? value(previous) : value;
      if (!nextValue) {
        const next = { ...current };
        delete next[targetAgentId];
        return next;
      }
      return {
        ...current,
        [targetAgentId]: nextValue,
      };
    });
  
}

export function setAttachedImages(
  ctx: AppContext,
  value: ComposerImage[] | ((current: ComposerImage[]) => ComposerImage[]),
) {
  const { activeAgentId, setConversationAttachedImages } = ctx;

    if (!activeAgentId) return;
    setConversationAttachedImages(activeAgentId, value);
  
}

export function releaseDiscardedComposerImage(
  ctx: AppContext,
  image: ComposerImage,
) {
  const { api } = ctx;

    revokeComposerImagePreviewUrl(image);
    if (image.type === "image-asset") void api.images.deleteAsset(image);
  
}

export function discardAttachedImages(ctx: AppContext, ...args: any[]) {
  const { attachedImages, releaseDiscardedComposerImage, setAttachedImages } = ctx;

    for (const image of attachedImages) releaseDiscardedComposerImage(image);
    setAttachedImages([]);
  
}

export function focusComposerTextarea(ctx: AppContext, ...args: any[]) {
  const { composerTextareaRef } = ctx;

    requestAnimationFrame(() => {
      composerTextareaRef.current?.focus();
    });
  
}

export function appendQuickPromptToComposer(
  ctx: AppContext,
  content: string,
) {
  const { activeAgentIdRef, focusComposerTextarea, setPrompt, setSuggestionsOpen } = ctx;

    if (!activeAgentIdRef.current) return;
    setPrompt((current: any) => {
      const trimmedCurrent = current.trimEnd();
      if (!trimmedCurrent) return content;
      const separator = /\n\n$/.test(current)
        ? ""
        : /\n$/.test(current)
          ? "\n"
          : "\n\n";
      return `${current}${separator}${content}`;
    });
    setSuggestionsOpen(false);
    focusComposerTextarea();
  
}

export function handleAddQuickPromptPreset(ctx: AppContext, ...args: any[]) {
  const { addQuickPromptPreset, focusComposerTextarea } = ctx;

    addQuickPromptPreset();
    focusComposerTextarea();
  
}

export function getComposerMaxHeight(ctx: AppContext, ...args: any[]) {
  const { activeTerminalHeight, chatHeaderRef, chatPaneRef, composerBoxRef, composerRef, terminalOpen } = ctx;

    const chatPane = chatPaneRef.current;
    const header = chatHeaderRef.current;
    const composer = composerRef.current;
    const box = composerBoxRef.current;
    if (!chatPane || !header || !composer || !box) {
      const reservedTerminalHeight = terminalOpen ? activeTerminalHeight : 0;
      return Math.max(
        180,
        window.innerHeight -
          78 -
          COMPOSER_MIN_TIMELINE_HEIGHT -
          52 -
          reservedTerminalHeight,
      );
    }

    const reservedTerminalHeight = terminalOpen ? activeTerminalHeight : 0;
    const composerChrome = Math.max(
      0,
      composer.offsetHeight - box.offsetHeight,
    );
    // 输入框最大高度取决于聊天区域还剩多少可用空间,而不是固定视口比例;
    // 否则窗口变窄后软换行变多,最小窗口下会比内容需要的高度更早触顶。
    return Math.max(
      180,
      chatPane.clientHeight -
        header.offsetHeight -
        COMPOSER_MIN_TIMELINE_HEIGHT -
        reservedTerminalHeight -
        composerChrome,
    );
  
}

export function clampComposerHeight(ctx: AppContext, height: number) {
  const { getComposerMaxHeight } = ctx;

    const maxHeight = getComposerMaxHeight();
    return Math.min(maxHeight, Math.max(COMPOSER_MIN_HEIGHT, height));
  
}

export function ensureComposerTailVisible(ctx: AppContext, ...args: any[]) {
  const { composerTextareaRef } = ctx;

    const textarea = composerTextareaRef.current;
    if (!textarea || document.activeElement !== textarea) return;
    const selectionAtEnd =
      textarea.selectionStart === textarea.value.length &&
      textarea.selectionEnd === textarea.value.length;
    if (!selectionAtEnd) return;
    requestAnimationFrame(() => {
      const current = composerTextareaRef.current;
      if (!current) return;
      current.scrollTop = current.scrollHeight;
    });
  
}

export function syncComposerAutoHeight(ctx: AppContext, ...args: any[]) {
  const { clampComposerHeight, composerBoxRef, composerTextareaRef, ensureComposerTailVisible, setComposerAutoHeight } = ctx;

    const box = composerBoxRef.current;
    const textarea = composerTextareaRef.current;
    if (!box || !textarea) return;

    // 宽度变化会改变软换行位置,textarea 的 scrollHeight 才是当前内容真实需要的高度。
    // 这里减去 chrome 高度(顶部留白/工具条/底部状态条),把问题修在布局源头而不是靠用户手动拖。
    const chromeHeight = box.offsetHeight - textarea.clientHeight;
    const nextHeight = clampComposerHeight(
      textarea.scrollHeight + chromeHeight,
    );
    setComposerAutoHeight((current: any) =>
      Math.abs(current - nextHeight) <= 1 ? current : nextHeight,
    );
    ensureComposerTailVisible();
  
}

export function scrollToBottom(ctx: AppContext, ...args: any[]) {
  const { setAutoScroll, setShowScrollToBottom, virtualizedListRef } = ctx;

    virtualizedListRef.current?.scrollToBottom("smooth");
    setAutoScroll(true);
    setShowScrollToBottom(false);
  
}

export async function checkPiInstall(
  ctx: AppContext,
  source: "startup" | "manual" = "manual",
) {
  const { api, setEnvironmentDialog, setPiChecking, setPiStatus, setSettings, setSettingsOpen, settings } = ctx;

    setSettingsOpen(false);
    setPiChecking(true);
    setEnvironmentDialog(true);
    try {
      const next = await api.pi.check();
      setPiStatus(next);
      if (next.installed && source === "startup") {
        // 首次启动检测通过后落盘,后续启动不再阻塞/打扰;用户仍可在设置里手动重新检测。
        const saved = await api.settings.update({ piEnvironmentChecked: true });
        setSettings(saved);
        window.setTimeout(() => setEnvironmentDialog(false), 3000);
      }
      if (next.installed && source === "manual")
        window.setTimeout(() => setEnvironmentDialog(false), 3000);
    } finally {
      setPiChecking(false);
    }
  
}

export async function checkPiInstallInline(ctx: AppContext, ...args: any[]) {
  const { api, setCustomPathResult, setPiChecking, setPiStatus, setSettings, setSettingsNotice, settings } = ctx;

    setPiChecking(true);
    setCustomPathResult(null);
    try {
      const next = await api.pi.check();
      setPiStatus(next);
      if (next.installed) {
        const saved = await api.settings.update({ piEnvironmentChecked: true });
        setSettings(saved);
        setSettingsNotice(
          t("app.piCheckPassed", {
            value: next.command ?? next.version ?? "pi",
          }),
        );
      } else {
        setSettingsNotice(
          t("app.piCheckFailed", {
            error: next.error ?? t("settings.piMissing"),
          }),
        );
      }
    } finally {
      setPiChecking(false);
    }
  
}

export async function validateCustomPiPath(
  ctx: AppContext,
  options: { closeDialogOnSuccess?: boolean } = {},
) {
  const { api, customPiPath, setCustomPathResult, setCustomPathValidating, setCustomPiPath, setEnvironmentDialog, setPiStatus, setSettings, setSettingsNotice, settings } = ctx;

    const path = customPiPath.trim();
    if (!path) return;
    setCustomPathValidating(true);
    setCustomPathResult(null);
    try {
      const result = await api.pi.checkCustom(path);
      setCustomPathResult(result);
      if (result.installed) {
        // 主进程会保存 PiLocator 归一化后的路径;这里重新读取,确保 UI 展示的是实际使用路径。
        const updated = await api.settings.get();
        setSettings(updated);
        setCustomPiPath(updated.customPiPath ?? result.command ?? path);
        setPiStatus(result);
        setSettingsNotice(
          t("app.piPathSaved", {
            path: result.command ?? updated.customPiPath ?? path,
          }),
        );
        if (options.closeDialogOnSuccess) {
          // 启动检测弹窗场景下保持原有成功后自动关闭体验;设置页内校验不关闭设置窗口。
          window.setTimeout(() => setEnvironmentDialog(false), 3000);
        }
      } else {
        setSettingsNotice(
          t("app.piPathValidateFailed", {
            error: result.error ?? t("environment.unableToRun"),
          }),
        );
      }
    } finally {
      setCustomPathValidating(false);
    }
  
}

export async function clearCustomPiPath(ctx: AppContext, ...args: any[]) {
  const { api, customPiPath, setCustomPathResult, setCustomPiPath, setPiStatus, setSettings, setSettingsNotice, settings } = ctx;

    const updated = await api.settings.update({ customPiPath: "" });
    setSettings(updated);
    setCustomPiPath("");
    setCustomPathResult(null);
    setSettingsNotice(t("app.piPathCleared"));
    const status = await api.pi.check();
    setPiStatus(status);
  
}

export function showToast(
  ctx: AppContext,
  message: string,
  duration = 3500,
) {
  const { setToast } = ctx;

    setToast(message);
    window.setTimeout(() => setToast(null), duration);
  
}

export async function respondApproval(
  ctx: AppContext,
  response: Record<string, unknown>,
) {
  const { agents, api, approvalRequest, pendingUiSlashCommandRef, setApprovalBusy, setApprovalRequest, setPendingUiSlashCommandAgentId, showToast } = ctx;

    if (!approvalRequest) return;
    setApprovalBusy(true);
    try {
      await api.agents.respondServerRequest(
        approvalRequest.agentId,
        approvalRequest.requestId,
        response,
      );
      pendingUiSlashCommandRef.current = null;
      setPendingUiSlashCommandAgentId(null);
      setApprovalRequest(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Pending request not found/i.test(message)) {
        setApprovalRequest(null);
        showToast(t("approval.requestExpired"), 3200);
      } else {
        showToast(
          t("approval.respondFailed", {
            error: message,
          }),
          3200,
        );
      }
    } finally {
      setApprovalBusy(false);
    }
  
}

export async function refreshProjects(ctx: AppContext, ...args: any[]) {
  const { api, projects, setActiveProjectId, setProjects } = ctx;

    const next = await api.projects.list();
    setProjects(next);
    if (next.length > 0) {
      setActiveProjectId((current: any) => current ?? next[0].id);
    }
  
}

export async function refreshSessions(
  ctx: AppContext,
  projectId = ctx.activeProjectId,
) {
  const { api, sessions, setSessions } = ctx;

    const next = await api.sessions.list(projectId);
    setSessions(sortSessionsForDisplay(next));
  
}

export async function refreshProjectSessions(
  ctx: AppContext,
  projectId: string,
) {
  const { api, sessions, setSessionLoadingByProject, setSessionsByProject } = ctx;

    setSessionLoadingByProject((current: any) => ({
      ...current,
      [projectId]: true,
    }));
    try {
      const next = await api.sessions.list(projectId);
      const sorted = sortSessionsForDisplay(next);
      setSessionsByProject((current: any) => ({
        ...current,
        [projectId]: sorted,
      }));
      return sorted;
    } finally {
      setSessionLoadingByProject((current: any) => ({
        ...current,
        [projectId]: false,
      }));
    }
  
}

export async function refreshFiles(
  ctx: AppContext,
  projectId = ctx.activeProjectId,
) {
  const { api, files, setFiles, showToast } = ctx;

    if (!projectId) return;
    const next = await api.files.list(projectId);
    setFiles(next);
    showToast(t("app.filesRefreshed"), 1800);
  
}

export async function refreshGitChangedFiles(
  ctx: AppContext,
  projectId = ctx.activeProjectId,
) {
  const { api, setGitChangedFiles } = ctx;

    if (!projectId) return;
    try {
      const next = await api.git.changedFiles(projectId);
      setGitChangedFiles(next);
    } catch {
      // 非 Git 项目或 git 未安装，静默置空
      setGitChangedFiles([]);
    }
  
}

export function openFilePath(ctx: AppContext, path: string) {
  const { activeAgent, activeProject, api, files, showToast } = ctx;

    // 绝对路径直接打开;相对路径按当前 agent cwd / 项目目录解析后交给系统默认应用。
    const resolvedPath = resolveFileLinkPath(path, activeAgent?.cwd ?? activeProject?.path);
    void api.files.open(resolvedPath).catch((error: any) => {
      showToast(t("app.openFileFailed", {
        error: error instanceof Error ? error.message : String(error),
      }));
    });
  
}

export function viewFilePath(ctx: AppContext, path: string) {
  const { setDiffViewFile, setDiffViewMode } = ctx;

    setDiffViewMode("view");
    setDiffViewFile(path);
  
}

export function diffFilePath(ctx: AppContext, path: string) {
  const { modifiedFiles, setDiffViewFile, setDiffViewMode, setDiffViewOriginalContent } = ctx;

    setDiffViewMode("diff");
    setDiffViewFile(path);
    // 从当前 modifiedFiles 中查找是否有缓存的原始内容，传递给差异编辑器作为对比基准。
    const modified = modifiedFiles.find((f: any) => f.path === path);
    setDiffViewOriginalContent(modified?.originalContent ?? "");
  
}

export async function refreshSessionHistory(
  ctx: AppContext,
  projectId = ctx.sessionsProjectId,
) {
  const { refreshSessions, setSessionHistoryLoading } = ctx;

    if (!projectId) return;
    setSessionHistoryLoading(true);
    try {
      // 项目历史弹框内的刷新需要显式进入 loading 状态;否则刷新很快完成时用户会误以为按钮没有响应。
      await refreshSessions(projectId);
    } finally {
      setSessionHistoryLoading(false);
    }
  
}

export async function openProjectSessions(ctx: AppContext, ...args: any[]) {
  const { refreshSessionHistory, setActiveProjectId, setDrawer, setProjectMenu, setSessions, setSessionsProjectId } = ctx;
  const project = args[0] as any;

    setProjectMenu(null);
    setActiveProjectId(project.id);
    setSessionsProjectId(project.id);
    setSessions([]);
    setDrawer((current: any) => (current === "sessions" ? null : current));
    await refreshSessionHistory(project.id);
  
}

export async function openHistorySession(ctx: AppContext, ...args: any[]) {
  const { createAgent, sessionsProjectId, setSessions, setSessionsProjectId } = ctx;
  const session = args[0] as any;

    const projectId = sessionsProjectId;
    if (!projectId) return;
    setSessionsProjectId(undefined);
    setSessions([]);
    await createAgent(
      projectId,
      session.filePath,
      session.name || t("common.untitled"),
    );
  
}

export async function renameHistorySession(ctx: AppContext, ...args: any[]) {
  const { api, refreshProjectSessions, refreshSessions, sessions, sessionsProjectId } = ctx;
  const filePath = args[0] as any;
  const newName = args[1] as any;

    await api.sessions.rename(filePath, newName);
    if (sessionsProjectId) await refreshSessions(sessionsProjectId);
    if (sessionsProjectId) await refreshProjectSessions(sessionsProjectId);
  
}

export async function copySession(ctx: AppContext, ...args: any[]) {
  const { activeProjectId, api, refreshProjectSessions, refreshSessions, sessions, sessionsProjectId, showToast } = ctx;
  const filePath = args[0] as any;
  const projectId = args.length > 1 && args[1] !== undefined ? args[1] : sessionsProjectId ?? activeProjectId;

    if (!projectId) return;
    const result = await api.sessions.copy(projectId, filePath);
    if (result.cancelled) {
      showToast(t("app.sessionCopyCancelled"));
      return;
    }
    showToast(t("app.sessionCopied"));
    await refreshSessions(projectId);
    await refreshProjectSessions(projectId);
  
}

export async function exportHistorySession(ctx: AppContext, ...args: any[]) {
  const { activeProjectId, api, sessions, sessionsProjectId, showToast } = ctx;
  const session = args[0] as any;

    const projectId = sessionsProjectId ?? activeProjectId;
    if (!projectId) return;
    const result = await api.sessions.exportHtml(projectId, session.filePath);
    showToast(t("app.exportedPath", { path: result.path }), 3500);
  
}

export async function deleteHistorySession(ctx: AppContext, ...args: any[]) {
  const { activeProjectId, api, refreshProjectSessions, refreshSessions, sessions, sessionsProjectId, showToast } = ctx;
  const session = args[0] as any;
  const projectId = args.length > 1 && args[1] !== undefined ? args[1] : sessionsProjectId ?? activeProjectId;

    await api.sessions.delete(session.filePath);
    showToast(t("app.sessionDeleted"), 2200);
    await refreshSessions(projectId);
    if (projectId) await refreshProjectSessions(projectId);
  
}

export async function cloneAgentSession(ctx: AppContext, ...args: any[]) {
  const { activeProjectId, agents, api, refreshProjectSessions, refreshRuntimeState, refreshSessions, setAgentActionLoading, setAgentMenu, showToast } = ctx;
  const agentId = args[0] as any;

    setAgentActionLoading("copy");
    try {
      const result = await api.agents.cloneSession(agentId);
      if (result?.cancelled) {
        showToast(t("app.sessionCopyCancelled"));
        return;
      }
      showToast(t("app.currentSessionCopied"));
      await refreshRuntimeState(agentId);
      await refreshSessions(activeProjectId);
      if (activeProjectId) await refreshProjectSessions(activeProjectId);
    } finally {
      setAgentActionLoading(null);
      setAgentMenu(null);
    }
  
}

export function openAgentRename(ctx: AppContext, ...args: any[]) {
  const { setAgentMenu, setAgentRenameTarget, setAgentRenameValue, setSessionRenameTarget } = ctx;
  const agent = args[0] as any;

    setAgentMenu(null);
    setAgentRenameTarget(agent);
    setSessionRenameTarget(null);
    setAgentRenameValue(agent.title);
  
}

export function openSessionRename(ctx: AppContext, ...args: any[]) {
  const { setAgentRenameTarget, setAgentRenameValue, setSessionMenu, setSessionRenameTarget } = ctx;
  const projectId = args[0] as any;
  const session = args[1] as any;

    setSessionMenu(null);
    setAgentRenameTarget(null);
    setSessionRenameTarget({ projectId, session });
    setAgentRenameValue(session.name || t("common.untitled"));
  
}

export async function submitAgentRename(ctx: AppContext, ...args: any[]) {
  const { agentRenameTarget, agentRenameValue, agents, api, refreshProjectSessions, refreshSessions, sessionsProjectId, setAgentRenameTarget, setAgentRenameValue, setAgentRenaming, setAgents, setSessionRenameTarget, showToast } = ctx;

    if (!agentRenameTarget) return;
    const name = agentRenameValue.replace(/\s+/g, " ").trim();
    if (!name) {
      showToast(t("app.sessionNameRequired"), 2200);
      return;
    }
    setAgentRenaming(true);
    try {
      const tab = await api.agents.rename(agentRenameTarget.id, name);
      setAgents((current: any) =>
        current.map((agent: any) => (agent.id === tab.id ? tab : agent)),
      );
      setAgentRenameTarget(null);
      setSessionRenameTarget(null);
      setAgentRenameValue("");
      showToast(t("app.sessionRenamed"), 2200);
      await refreshProjectSessions(tab.projectId);
      if (sessionsProjectId === tab.projectId)
        await refreshSessions(tab.projectId);
    } catch (error) {
      showToast(
        t("app.sessionRenameFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    } finally {
      setAgentRenaming(false);
    }
  
}

export async function submitSessionRename(ctx: AppContext, ...args: any[]) {
  const { agentRenameValue, api, refreshProjectSessions, refreshSessions, sessionRenameTarget, sessions, sessionsProjectId, setAgentRenameValue, setAgentRenaming, setSessionRenameTarget, showToast } = ctx;

    if (!sessionRenameTarget) return;
    const name = agentRenameValue.replace(/\s+/g, " ").trim();
    if (!name) {
      showToast(t("app.sessionNameRequired"), 2200);
      return;
    }
    setAgentRenaming(true);
    try {
      await api.sessions.rename(sessionRenameTarget.session.filePath, name);
      await refreshProjectSessions(sessionRenameTarget.projectId);
      if (sessionsProjectId === sessionRenameTarget.projectId) {
        await refreshSessions(sessionRenameTarget.projectId);
      }
      setSessionRenameTarget(null);
      setAgentRenameValue("");
      showToast(t("app.sessionRenamed"), 2200);
    } catch (error) {
      showToast(
        t("app.sessionRenameFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    } finally {
      setAgentRenaming(false);
    }
  
}

export async function openSidebarSession(ctx: AppContext, ...args: any[]) {
  const { createAgent, setCompletedSessionAlerts, setSessionMenu } = ctx;
  const projectId = args[0] as any;
  const session = args[1] as any;

    setSessionMenu(null);
    setCompletedSessionAlerts((current: any) => {
      const key = getSessionAlertKey(projectId, session.filePath);
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    return createAgent(
      projectId,
      session.filePath,
      session.name || t("common.untitled"),
    );
  
}

export async function copySidebarSession(ctx: AppContext, ...args: any[]) {
  const { copySession, setSessionActionLoading, setSessionMenu } = ctx;
  const projectId = args[0] as any;
  const session = args[1] as any;

    setSessionActionLoading("copy");
    try {
      await copySession(session.filePath, projectId);
    } finally {
      setSessionActionLoading(null);
      setSessionMenu(null);
    }
  
}

export async function exportSidebarSession(ctx: AppContext, ...args: any[]) {
  const { api, sessions, setSessionActionLoading, setSessionMenu, showToast } = ctx;
  const projectId = args[0] as any;
  const session = args[1] as any;

    setSessionActionLoading("export");
    try {
      const result = await api.sessions.exportHtml(projectId, session.filePath);
      showToast(t("app.exportedPath", { path: result.path }), 3500);
    } finally {
      setSessionActionLoading(null);
      setSessionMenu(null);
    }
  
}

export async function openCodexImport(ctx: AppContext, ...args: any[]) {
  const { scanCodexSessions, setCodexImportProject, setCodexImportReport, setCodexImportSelected, setCodexImportSessions, setProjectMenu } = ctx;
  const project = args[0] as any;

    setProjectMenu(null);
    setCodexImportProject(project);
    setCodexImportReport(null);
    setCodexImportSessions([]);
    setCodexImportSelected([]);
    await scanCodexSessions(project);
  
}

export async function scanCodexSessions(ctx: AppContext, ...args: any[]) {
  const { api, codexImportProject, setCodexImportLoading, setCodexImportReport, setCodexImportSelected, setCodexImportSessions, showToast } = ctx;
  const project = args.length > 0 && args[0] !== undefined ? args[0] : codexImportProject;
  const clearReport = args.length > 1 && args[1] !== undefined ? args[1] : true;

    if (!project) return;
    setCodexImportLoading(true);
    if (clearReport) setCodexImportReport(null);
    try {
      const next = await api.codexSessions.scan(project.id);
      setCodexImportSessions(next);
      // 默认不自动勾选任何会话,避免用户未确认时批量覆盖已导入历史。
      setCodexImportSelected([]);
    } catch (error) {
      showToast(
        t("codex.scanFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    } finally {
      setCodexImportLoading(false);
    }
  
}

export function toggleCodexSession(ctx: AppContext, ...args: any[]) {
  const { setCodexImportSelected } = ctx;
  const sourcePath = args[0] as any;

    setCodexImportSelected((current: any) =>
      current.includes(sourcePath)
        ? current.filter((item: any) => item !== sourcePath)
        : [...current, sourcePath],
    );
  
}

export function toggleAllCodexSessions(ctx: AppContext, ...args: any[]) {
  const { codexImportSessions, setCodexImportSelected } = ctx;

    const allPaths = codexImportSessions.map((session: any) => session.sourcePath);
    setCodexImportSelected((current: any) =>
      allPaths.length > 0 && allPaths.every((path: any) => current.includes(path))
        ? []
        : allPaths,
    );
  
}

export async function importCodexSessions(ctx: AppContext, ...args: any[]) {
  const { api, codexImportProject, codexImportSelected, refreshProjectSessions, refreshSessions, scanCodexSessions, sessionsProjectId, setCodexImportReport, setCodexImportRunning, showToast } = ctx;

    if (!codexImportProject || codexImportSelected.length === 0) return;
    setCodexImportRunning(true);
    setCodexImportReport(null);
    try {
      const report = await api.codexSessions.import(
        codexImportProject.id,
        codexImportSelected,
      );
      setCodexImportReport(report);
      await scanCodexSessions(codexImportProject, false);
      await refreshProjectSessions(codexImportProject.id);
      if (sessionsProjectId === codexImportProject.id)
        await refreshSessions(codexImportProject.id);
      showToast(
        t("codex.importDone", {
          imported: report.imported,
          failed: report.failed,
        }),
      );
    } catch (error) {
      showToast(
        t("codex.importFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    } finally {
      setCodexImportRunning(false);
    }
  
}

export async function openClaudeImport(ctx: AppContext, ...args: any[]) {
  const { scanClaudeSessions, setClaudeImportProject, setClaudeImportReport, setClaudeImportSelected, setClaudeImportSessions, setProjectMenu } = ctx;
  const project = args[0] as any;

    setProjectMenu(null);
    setClaudeImportProject(project);
    setClaudeImportReport(null);
    setClaudeImportSessions([]);
    setClaudeImportSelected([]);
    await scanClaudeSessions(project);
  
}
