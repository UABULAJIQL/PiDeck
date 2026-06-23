import type { AppContext } from "../AppContext";
import type { DragEvent, PointerEvent } from "react";
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
import type { AgentTab, AvailableModel, ChatMessage, ComposerImage, ImageContent, Project } from "../../../../shared/types";
import {
  COMPOSER_MIN_HEIGHT,
  api,
  createImagePreviewObjectUrl,
  displayProjectDirectoryName,
  findReusableProjectAgent,
  getToolChangedLineCount,
  isChatProject,
  isPendingAgentId,
  isSameSessionPath,
  normalizeSessionPathForCompare,
  resolveFileLinkPath,
  revokeComposerImagePreviewUrl,
} from "../appRuntime";

export async function scanClaudeSessions(
  ctx: AppContext,
  project = ctx.claudeImportProject,
  clearReport = true,
) {
  const { api, setClaudeImportLoading, setClaudeImportReport, setClaudeImportSelected, setClaudeImportSessions, showToast } = ctx;

    if (!project) return;
    setClaudeImportLoading(true);
    if (clearReport) setClaudeImportReport(null);
    try {
      const next = await api.claudeSessions.scan(project.id);
      setClaudeImportSessions(next);
      setClaudeImportSelected([]);
    } catch (error) {
      showToast(
        t("claude.scanFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    } finally {
      setClaudeImportLoading(false);
    }
  
}

export function toggleClaudeSession(ctx: AppContext, sourcePath: string) {
  const { setClaudeImportSelected } = ctx;

    setClaudeImportSelected((current: any) =>
      current.includes(sourcePath)
        ? current.filter((item: any) => item !== sourcePath)
        : [...current, sourcePath],
    );
  
}

export function toggleAllClaudeSessions(ctx: AppContext, ...args: any[]) {
  const { claudeImportSessions, setClaudeImportSelected } = ctx;

    const allPaths = claudeImportSessions.map((session: any) => session.sourcePath);
    setClaudeImportSelected((current: any) =>
      allPaths.length > 0 && allPaths.every((path: any) => current.includes(path))
        ? []
        : allPaths,
    );
  
}

export async function importClaudeSessions(ctx: AppContext, ...args: any[]) {
  const { api, claudeImportProject, claudeImportSelected, refreshProjectSessions, refreshSessions, scanClaudeSessions, sessionsProjectId, setClaudeImportReport, setClaudeImportRunning, showToast } = ctx;

    if (!claudeImportProject || claudeImportSelected.length === 0) return;
    setClaudeImportRunning(true);
    setClaudeImportReport(null);
    try {
      const report = await api.claudeSessions.import(
        claudeImportProject.id,
        claudeImportSelected,
      );
      setClaudeImportReport(report);
      await scanClaudeSessions(claudeImportProject, false);
      await refreshProjectSessions(claudeImportProject.id);
      if (sessionsProjectId === claudeImportProject.id)
        await refreshSessions(claudeImportProject.id);
      showToast(
        t("claude.importDone", {
          imported: report.imported,
          failed: report.failed,
        }),
      );
    } catch (error) {
      showToast(
        t("claude.importFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    } finally {
      setClaudeImportRunning(false);
    }
  
}

export async function reorderProjects(
  ctx: AppContext,
  sourceProjectId: string,
  targetProjectId: string,
) {
  const { api, canReorderProjects, projects, setProjects, showToast } = ctx;

    if (!canReorderProjects || sourceProjectId === targetProjectId) return;
    const sourceProject = projects.find(
      (project: any) => project.id === sourceProjectId,
    );
    const targetProject = projects.find(
      (project: any) => project.id === targetProjectId,
    );
    if (isChatProject(sourceProject) || isChatProject(targetProject)) return;
    const sourceIndex = projects.findIndex(
      (project: any) => project.id === sourceProjectId,
    );
    const targetIndex = projects.findIndex(
      (project: any) => project.id === targetProjectId,
    );
    if (sourceIndex === -1 || targetIndex === -1) return;

    const previousProjects = projects;
    const nextProjects = [...projects];
    const [movedProject] = nextProjects.splice(sourceIndex, 1);
    const targetIndexAfterRemoval = nextProjects.findIndex(
      (project: any) => project.id === targetProjectId,
    );
    const insertIndex =
      sourceIndex < targetIndex
        ? targetIndexAfterRemoval + 1
        : targetIndexAfterRemoval;
    nextProjects.splice(insertIndex, 0, movedProject);
    setProjects(nextProjects);

    try {
      const savedProjects = await api.projects.reorder(
        nextProjects.map((project: any) => project.id),
      );
      setProjects(savedProjects);
    } catch (error) {
      setProjects(previousProjects);
      showToast(
        t("app.projectSortFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
        4000,
      );
    }
  
}

export function handleProjectDragStart(
  ctx: AppContext,
  event: DragEvent<HTMLButtonElement>,
  projectId: string,
) {
  const { canReorderProjects, setDraggingProjectId } = ctx;

    if (!canReorderProjects) {
      event.preventDefault();
      return;
    }
    setDraggingProjectId(projectId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", projectId);
  
}

export function handleProjectDragOver(
  ctx: AppContext,
  event: DragEvent<HTMLButtonElement>,
  projectId: string,
) {
  const { draggingProjectId, projects, setDragOverProjectId } = ctx;

    if (!draggingProjectId || draggingProjectId === projectId) return;
    if (isChatProject(projects.find((project: any) => project.id === projectId)))
      return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverProjectId(projectId);
  
}

export function handleProjectDragLeave(ctx: AppContext, projectId: string) {
  const { setDragOverProjectId } = ctx;

    setDragOverProjectId((current: any) =>
      current === projectId ? undefined : current,
    );
  
}

export function finishProjectDrag(ctx: AppContext, ...args: any[]) {
  const { setDraggingProjectId, setDragOverProjectId } = ctx;

    setDraggingProjectId(undefined);
    setDragOverProjectId(undefined);
  
}

export async function handleProjectDrop(
  ctx: AppContext,
  event: DragEvent<HTMLButtonElement>,
  targetProjectId: string,
) {
  const { draggingProjectId, finishProjectDrag, projectDragPreventClickRef, reorderProjects } = ctx;

    event.preventDefault();
    const sourceProjectId =
      event.dataTransfer.getData("text/plain") || draggingProjectId;
    finishProjectDrag();
    if (!sourceProjectId || sourceProjectId === targetProjectId) return;
    projectDragPreventClickRef.current = true;
    window.setTimeout(() => {
      projectDragPreventClickRef.current = false;
    }, 0);
    await reorderProjects(sourceProjectId, targetProjectId);
  
}

export async function addProject(ctx: AppContext, ...args: any[]) {
  const { api, projects, refreshProjects, setActiveAgentId, setActiveProjectId } = ctx;

    const project = await api.projects.add();
    if (!project) return;
    await refreshProjects();
    setActiveProjectId(project.id);
    setActiveAgentId(undefined);
  
}

export function updateAfterProjectRemoved(
  ctx: AppContext,
  removedProjectId: string,
  next: Project[],
) {
  const { activeProjectId, drawer, sessionsProjectId, setActiveAgentId, setActiveProjectId, setDrawer, setSessionsByProject, setSessionsProjectId } = ctx;

    setSessionsByProject((current: any) => {
      const updated = { ...current };
      delete updated[removedProjectId];
      return updated;
    });
    if (activeProjectId === removedProjectId) {
      setActiveProjectId(next[0]?.id);
      setActiveAgentId(undefined);
    }
    if (sessionsProjectId === removedProjectId) {
      setSessionsProjectId(undefined);
      if (drawer === "sessions") setDrawer(null);
    }
  
}

export async function createAgent(
  ctx: AppContext,
  projectId = ctx.activeProjectId,
  sessionPath?: string,
  title?: string,
  reuseExisting = true,
) {
  const { activeAgentId, agents, api, displayAgents, pendingAgentsRef, projects, refreshProjectSessions, refreshRuntimeState, setActiveAgentByProject, setActiveAgentId, setActiveProjectId, setDrawer, setPendingAgents, setPromptByAgent, transferAgentDraft } = ctx;

    if (!projectId) return;
    const project = projects.find((item: any) => item.id === projectId);
    if (!project) return;
    const knownAgents = [...displayAgents, ...pendingAgentsRef.current];
    const existing = reuseExisting
      ? sessionPath
        ? knownAgents.find(
            (agent: any) =>
              agent.projectId === projectId &&
              isSameSessionPath(agent.sessionPath, sessionPath),
          )
        : findReusableProjectAgent(knownAgents, projectId)
      : undefined;
    if (existing) {
      setActiveProjectId(existing.projectId);
      setActiveAgentId(existing.id);
      setDrawer(null);
      return existing;
    }
    const previousAgentId = activeAgentId;
    const pendingTab: AgentTab = {
      id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      projectId,
      cwd: project.path,
      title: title || `${project.name} agent`,
      status: "starting",
      sessionPath,
      createdAt: Date.now(),
    };
    pendingAgentsRef.current = [...pendingAgentsRef.current, pendingTab];
    setPendingAgents(pendingAgentsRef.current);
    setActiveProjectId(projectId);
    setActiveAgentId(pendingTab.id);
    setActiveAgentByProject((current: any) => ({
      ...current,
      [projectId]: pendingTab.id,
    }));
    // 立即关闭抽屉,避免等待 agent 加载期间列表仍然显示
    setDrawer(null);
    try {
      const tab = await api.agents.create({ projectId, sessionPath, title });
      pendingAgentsRef.current = pendingAgentsRef.current.filter(
        (agent: any) => agent.id !== pendingTab.id,
      );
      setPendingAgents(pendingAgentsRef.current);
      setActiveAgentId((current: any) =>
        current === pendingTab.id ? tab.id : current,
      );
      setActiveAgentByProject((current: any) =>
        current[projectId] === pendingTab.id
          ? {
              ...current,
              [projectId]: tab.id,
            }
          : current,
      );
      setPromptByAgent((current: any) => {
        const draft = current[pendingTab.id];
        if (draft == null) return current;
        const next = { ...current, [tab.id]: draft };
        delete next[pendingTab.id];
        return next;
      });
      transferAgentDraft(pendingTab.id, tab.id);
      void refreshProjectSessions(projectId).catch(() => undefined);
      void refreshRuntimeState(tab.id);
      return tab;
    } catch (e) {
      pendingAgentsRef.current = pendingAgentsRef.current.filter(
        (agent: any) => agent.id !== pendingTab.id,
      );
      setPendingAgents(pendingAgentsRef.current);
      setActiveAgentId((current: any) =>
        current === pendingTab.id ? previousAgentId : current,
      );
      setActiveAgentByProject((current: any) => {
        if (current[projectId] !== pendingTab.id) return current;
        const next = { ...current };
        if (previousAgentId) next[projectId] = previousAgentId;
        else delete next[projectId];
        return next;
      });
      // 创建失败时由 main process 上报错误,前端仅回退乐观占位,避免停留在不存在的 agent。
      return undefined;
    }
  
}

export async function refreshRuntimeState(
  ctx: AppContext,
  agentId = ctx.activeAgentId,
) {
  const { agents, api, setRuntimeStateByAgent } = ctx;

    if (!agentId || isPendingAgentId(agentId)) return;
    const state = await api.agents.runtimeState(agentId).catch(() => undefined);
    if (state)
      setRuntimeStateByAgent((current: any) => ({ ...current, [agentId]: state }));
  
}

export async function openModelPicker(ctx: AppContext, ...args: any[]) {
  const { activeAgentId, agents, api, availableModels, setAvailableModels, setModelPickerOpen } = ctx;

    if (!activeAgentId || isPendingAgentId(activeAgentId)) return;
    const models = await api.agents.availableModels(activeAgentId);
    setAvailableModels(models);
    setModelPickerOpen(true);
  
}

export async function selectModel(
  ctx: AppContext,
  model: AvailableModel,
) {
  const { activeAgentId, agents, api, setModelPickerOpen, setRuntimeStateByAgent } = ctx;

    if (!activeAgentId || isPendingAgentId(activeAgentId)) return;
    const state = await api.agents.setModel(
      activeAgentId,
      model.provider,
      model.id,
    );
    setRuntimeStateByAgent((current: any) => ({
      ...current,
      [activeAgentId]: state,
    }));
    setModelPickerOpen(false);
  
}

export async function cycleThinking(ctx: AppContext, ...args: any[]) {
  const { activeAgentId, agents, api, setRuntimeStateByAgent } = ctx;

    if (!activeAgentId || isPendingAgentId(activeAgentId)) return;
    const state = await api.agents.cycleThinking(activeAgentId);
    setRuntimeStateByAgent((current: any) => ({
      ...current,
      [activeAgentId]: state,
    }));
  
}

export async function selectThinking(
  ctx: AppContext,
  level: string,
) {
  const { activeAgentId, agents, api, setRuntimeStateByAgent, setThinking, setThinkingPickerOpen, showToast } = ctx;

    if (!activeAgentId || isPendingAgentId(activeAgentId)) return;
    try {
      // 使用 setThinking 明确落到用户选择的档位,避免 cycle 模式需要反复点击才能到目标级别。
      const state = await api.agents.setThinking(activeAgentId, level);
      setRuntimeStateByAgent((current: any) => ({
        ...current,
        [activeAgentId]: state,
      }));
      setThinkingPickerOpen(false);
      // pi runtime 会按模型能力 clamp thinking level;对比实际状态,避免用户误以为已运行在不支持的档位。
      if (state.thinkingLevel && state.thinkingLevel !== level) {
        showToast(
          t("app.thinkingUnsupported", {
            level,
            fallback: state.thinkingLevel,
          }),
        );
      }
    } catch (error) {
      showToast(
        t("app.thinkingSwitchFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  
}

export async function compactAgent(ctx: AppContext, ...args: any[]) {
  const { activeAgentId, agents, api, setCompacting, setRuntimeStateByAgent } = ctx;

    if (!activeAgentId || isPendingAgentId(activeAgentId)) return;
    setCompacting(true);
    try {
      const state = await api.agents.compact(activeAgentId);
      setRuntimeStateByAgent((current: any) => ({
        ...current,
        [activeAgentId]: state,
      }));
    } finally {
      setCompacting(false);
    }
  
}

export async function closeAgent(ctx: AppContext, agentId: string) {
  const { agents, api, displayAgents, refreshProjectSessions, refreshSessions, sessionsProjectId } = ctx;

    if (isPendingAgentId(agentId)) return;
    const closingAgent = displayAgents.find((agent: any) => agent.id === agentId);
    const projectId = closingAgent?.projectId;

    await api.agents.stop(agentId);

    // 关闭 agent 后刷新历史会话列表，使持久化的会话文件显示在文件夹历史中。
    // AgentManager.stop() 只移除内存中的 runtime，不会删除磁盘上的 .jsonl 会话文件。
    if (projectId) {
      await refreshProjectSessions(projectId).catch(() => undefined);
      if (sessionsProjectId === projectId) {
        await refreshSessions(projectId).catch(() => undefined);
      }
    }
  
}

export async function abortAgent(
  ctx: AppContext,
  agentId = ctx.activeAgentId,
) {
  const { agents, api, refreshRuntimeState } = ctx;

    if (!agentId || isPendingAgentId(agentId)) return;
    await api.agents.abort(agentId);
    void refreshRuntimeState(agentId);
  
}

export async function exportAgentHtml(
  ctx: AppContext,
  agentId: string,
) {
  const { agents, api, setAgentActionLoading, setAgentMenu, showToast } = ctx;

    if (isPendingAgentId(agentId)) return;
    setAgentActionLoading("export");
    try {
      const result = await api.agents.exportHtml(agentId);
      showToast(t("app.exportedPath", { path: result.path }), 3500);
    } finally {
      setAgentActionLoading(null);
      setAgentMenu(null);
    }
  
}

export async function restartAgent(
  ctx: AppContext,
  agentId: string,
) {
  const { agents, api, refreshRuntimeState, setActiveAgentId, setAgentMenu } = ctx;

    try {
      const tab = await api.agents.restart(agentId);
      setActiveAgentId(tab.id);
      void refreshRuntimeState(tab.id);
    } finally {
      setAgentMenu(null);
    }
  
}

export function setTerminalOpenForAgent(
  ctx: AppContext,
  agentId: string,
  open: boolean,
) {
  const { setTerminalDockStateByAgent } = ctx;

    setTerminalDockStateByAgent((current: any) =>
      setTerminalDockOpen(current, agentId, open),
    );
  
}

export function setTerminalCollapsedForAgent(
  ctx: AppContext,
  agentId: string,
  collapsed: boolean,
) {
  const { setTerminalDockStateByAgent } = ctx;

    setTerminalDockStateByAgent((current: any) =>
      setTerminalDockCollapsed(current, agentId, collapsed),
    );
  
}

export async function openSlashCommandStage(
  ctx: AppContext,
  command: SlashStageCommand,
  promptValue: string,
) {
  const { activeAgentId, activeProjectId, agents, api, sessions, sessionsByProject, sessionsProjectId, setSlashCommandStage, setSuggestionsOpen } = ctx;

    if (command === "session") {
      const projectId = activeProjectId;
      if (!projectId) return;
      const projectSessions =
        sessionsProjectId === projectId && sessions.length > 0
          ? sessions
          : ((sessionsByProject[projectId] ?? []).length > 0
              ? sessionsByProject[projectId]
              : await api.sessions.list(projectId).catch(() => []));
      setSlashCommandStage(
        createSlashCommandStage(
          command,
          promptValue,
          createSessionStageOptions(projectSessions),
        ),
      );
      setSuggestionsOpen(false);
      return;
    }

    if (command === "tree") {
      if (!activeAgentId || isPendingAgentId(activeAgentId)) return;
      const forkMessages = await api.agents.getForkMessages(activeAgentId).catch(
        () => [],
      );
      setSlashCommandStage(
        createSlashCommandStage(
          command,
          promptValue,
          createForkStageOptions(forkMessages),
        ),
      );
      setSuggestionsOpen(false);
      return;
    }

    setSlashCommandStage(createSlashCommandStage(command, promptValue));
    setSuggestionsOpen(false);
  
}

export async function executeSlashCommandStage(
  ctx: AppContext,
  stage = ctx.slashCommandStage,
) {
  const { activeAgentId, activeMessages, activeProjectId, agents, api, cloneAgentSession, discardAttachedImages, exportAgentHtml, refreshProjectSessions, refreshRuntimeState, refreshSessions, restartAgent, setConfigOpen, setPrompt, setSendBehaviorMenuOpen, setSlashCommandStage, setSuggestionsOpen, showToast, submitPromptSnapshot } = ctx;

    if (!stage || !activeAgentId || isPendingAgentId(activeAgentId)) return;

    if (stage.command === "session") {
      const selected = stage.options?.[stage.selectedIndex ?? 0];
      if (!selected) return;
      setSlashCommandStage(null);
      setPrompt("");
      discardAttachedImages();
      setSuggestionsOpen(false);
      setSendBehaviorMenuOpen(false);
      const result = await api.agents.switchSession(activeAgentId, selected.value);
      if (!result?.cancelled) {
        void refreshRuntimeState(activeAgentId);
        if (activeProjectId) {
          await refreshSessions(activeProjectId);
          await refreshProjectSessions(activeProjectId);
        }
      }
      return;
    }

    if (stage.command === "tree") {
      const selected = stage.options?.[stage.selectedIndex ?? 0];
      if (!selected) return;
      setSlashCommandStage(null);
      setPrompt("");
      discardAttachedImages();
      setSuggestionsOpen(false);
      setSendBehaviorMenuOpen(false);
      await api.agents.forkSession(activeAgentId, selected.value);
      void refreshRuntimeState(activeAgentId);
      return;
    }

    if (stage.command === "compact") {
      const suffix = stage.argument.trim();
      const commandText = suffix ? `/compact ${suffix}` : "/compact";
      setPrompt("");
      discardAttachedImages();
      setSuggestionsOpen(false);
      setSendBehaviorMenuOpen(false);
      setSlashCommandStage(null);
      await submitPromptSnapshot(activeAgentId, commandText);
      void refreshRuntimeState(activeAgentId);
      return;
    }

    setSlashCommandStage(null);
    setPrompt("");
    discardAttachedImages();
    setSuggestionsOpen(false);
    setSendBehaviorMenuOpen(false);

    if (stage.command === "copy") {
      const lastAssistant = [...activeMessages]
        .reverse()
        .find((message: any) => message.role === "assistant");
      if (!lastAssistant?.text.trim()) {
        showToast(t("slashStage.copyEmpty"), 2200);
        return;
      }
      await navigator.clipboard.writeText(lastAssistant.text);
      showToast(t("code.copy"), 1800);
      return;
    }

    if (stage.command === "export") {
      await exportAgentHtml(activeAgentId);
      return;
    }

    if (stage.command === "clone") {
      await cloneAgentSession(activeAgentId);
      return;
    }

    if (stage.command === "restart") {
      await restartAgent(activeAgentId);
      return;
    }

    if (stage.command === "settings") {
      setConfigOpen(true);
    }
  
}
