import type { AppContext } from "../AppContext";
import type { ClipboardEvent, DragEvent, KeyboardEvent, PointerEvent } from "react";
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
import type {
  AppSettings,
  ChatMessage,
  ComposerImage,
  ImageContent,
} from "../../../../shared/types";
import {
  COMPOSER_MIN_HEIGHT,
  api,
  createImagePreviewObjectUrl,
  displayProjectDirectoryName,
  getToolChangedLineCount,
  isChatProject,
  isPendingAgentId,
  isSameSessionPath,
  normalizeSessionPathForCompare,
  resolveFileLinkPath,
  revokeComposerImagePreviewUrl,
} from "../appRuntime";

export function handleComposerKeyDown(
  ctx: AppContext,
  event: KeyboardEvent<HTMLTextAreaElement>,
) {
  const { applySuggestion, clearSuggestionTrigger, commandHistory, executeSlashCommandStage, historyIndex, historyNavigating, openSlashCommandStage, prompt, savedPrompt, selectedSuggestionIndex, sendPrompt, setHistoryIndex, setHistoryNavigating, setPrompt, setSavedPrompt, setSelectedSuggestionIndex, setSlashCommandStage, setSuggestionsOpen, settings, slashCommandStage, submitComposerPrompt, suggestionItems, suggestionsOpen } = ctx;

    if (slashCommandStage?.options && slashCommandStage.options.length > 0) {
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        setSlashCommandStage((current: any) =>
          current
            ? {
                ...current,
                selectedIndex: Math.min(
                  (current.selectedIndex ?? 0) + 1,
                  (current.options?.length ?? 1) - 1,
                ),
              }
            : current,
        );
        return;
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        setSlashCommandStage((current: any) =>
          current
            ? {
                ...current,
                selectedIndex: Math.max((current.selectedIndex ?? 0) - 1, 0),
              }
            : current,
        );
        return;
      }
    }

    if (
      slashCommandStage &&
      !isSlashStageStillActive(slashCommandStage, prompt)
    ) {
      setSlashCommandStage(null);
    }

    if (slashCommandStage && event.key === "Escape") {
      event.preventDefault();
      setSlashCommandStage(null);
      return;
    }

    if (suggestionsOpen && suggestionItems.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedSuggestionIndex((index: any) =>
          Math.min(index + 1, suggestionItems.length - 1),
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedSuggestionIndex((index: any) => Math.max(index - 1, 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const selected =
          suggestionItems[
            Math.min(selectedSuggestionIndex, suggestionItems.length - 1)
          ];
        const suggestionEnterIntent = getComposerEnterIntent(
          event,
          settings.sendShortcut,
        );
        const stagedSuggestion = selected
          ? getSlashStageCommand(selected.value)
          : undefined;
        const shouldRunSelectedCommand =
          suggestionEnterIntent === "send" &&
          selected?.kind === "command" &&
          (selected.source === "extension" || Boolean(stagedSuggestion));

        if (selected && shouldRunSelectedCommand) {
          setSuggestionsOpen(false);
          setSlashCommandStage(null);
          if (stagedSuggestion) {
            void openSlashCommandStage(stagedSuggestion, selected.value);
          } else {
            // 选择扩展 slash 命令时直接提交命令快照，不先写入输入框，避免 `/advisor` 被显示成普通消息。
            void submitComposerPrompt(selected.value);
          }
          return;
        }

        if (selected) {
          setPrompt((current: any) => applySuggestion(current, selected.value));
          setSuggestionsOpen(false);
          setSlashCommandStage(null);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setPrompt((current: any) => clearSuggestionTrigger(current));
        setSuggestionsOpen(false);
        return;
      }
    }

    // 历史命令导航:只在光标位于输入末尾时生效
    const textarea = event.currentTarget;
    const isCursorAtEnd =
      textarea.selectionStart === textarea.value.length &&
      textarea.selectionEnd === textarea.value.length;

    if (event.key === "ArrowUp" && isCursorAtEnd && commandHistory.length > 0) {
      event.preventDefault();

      // 首次导航时保存当前输入
      if (!historyNavigating) {
        setSavedPrompt(prompt);
        setHistoryNavigating(true);
        const newIndex = 0;
        setHistoryIndex(newIndex);
        setPrompt(commandHistory[newIndex]);
      } else {
        // 继续向上导航
        const newIndex = Math.min(historyIndex + 1, commandHistory.length - 1);
        if (newIndex !== historyIndex) {
          setHistoryIndex(newIndex);
          setPrompt(commandHistory[newIndex]);
        }
      }
      return;
    }

    if (event.key === "ArrowDown" && isCursorAtEnd && historyNavigating) {
      event.preventDefault();

      if (historyIndex > 0) {
        // 向下导航
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setPrompt(commandHistory[newIndex]);
      } else {
        // 回到最初输入的内容
        setHistoryIndex(-1);
        setHistoryNavigating(false);
        setPrompt(savedPrompt);
        setSavedPrompt("");
      }
      return;
    }

    if (event.key === "Escape") {
      setPrompt((current: any) => clearSuggestionTrigger(current));
      setSuggestionsOpen(false);
      // 如果正在历史导航,ESC 退出并恢复原始输入
      if (historyNavigating) {
        setPrompt(savedPrompt);
        setHistoryIndex(-1);
        setHistoryNavigating(false);
        setSavedPrompt("");
      }
    }
    const enterIntent = getComposerEnterIntent(event, settings.sendShortcut);
    if (enterIntent === "send") {
      const stagedCommand = getSlashStageCommand(prompt);
      if (slashCommandStage && isSlashStageStillActive(slashCommandStage, prompt)) {
        event.preventDefault();
        void executeSlashCommandStage();
        return;
      }
      if (stagedCommand) {
        event.preventDefault();
        void openSlashCommandStage(stagedCommand, prompt);
        return;
      }
      event.preventDefault();
      void sendPrompt();
    } else if (enterIntent === "newline") {
      // 让 textarea 自己处理换行,保持输入体验接近普通聊天软件。
      return;
    }
  
}

export function isExtensionSlashCommand(ctx: AppContext, message: string) {
  const { commands } = ctx;

    const commandName = message.trim().match(/^\/([a-zA-Z][\w-]*)/)?.[1]?.toLowerCase();
    if (!commandName) return false;
    return commands.some(
      (command: any) =>
        command.source === "extension" &&
        command.name.toLowerCase() === commandName,
    );
  
}

export async function sendPrompt(ctx: AppContext, ...args: any[]) {
  const { attachedImages, prompt, submitComposerPrompt } = ctx;

    const images = attachedImages.length > 0 ? attachedImages : undefined;
    await submitComposerPrompt(prompt, images);
  
}

export async function submitComposerPrompt(
  ctx: AppContext,
  message: string,
  images?: ComposerImage[],
) {
  const { activeAgentId, agents, api, commands, handleGoalCommand, isAgentStarting, isExtensionSlashCommand, isUiSlashApprovalActive, pendingUiSlashCommandRef, refreshRuntimeState, setAttachedImages, setCommandHistory, setCommands, setHistoryIndex, setHistoryNavigating, setPendingUiSlashCommandAgentId, setPrompt, setSavedPrompt, setSendBehaviorMenuOpen, setSuggestionsOpen, showToast, submitPromptSnapshot } = ctx;

    if (isUiSlashApprovalActive) {
      showToast(t("app.uiSlashCommandPending"), 2200);
      return;
    }
    if (
      isAgentStarting ||
      !activeAgentId ||
      (!message.trim() && !images?.length)
    )
      return;

    const uiSlashCommand = !images?.length && isExtensionSlashCommand(message);

    // ── /goal 命令处理 ──
    if (message.trim().startsWith("/goal")) {
      handleGoalCommand(message.trim());
      setPrompt("");
      return;
    }

    // 保存到历史记录(只保存非空的文本命令)
    if (message.trim() && !message.startsWith("!") && !uiSlashCommand) {
      setCommandHistory((prev: any) => {
        // 避免重复保存相同的命令
        const filtered = prev.filter((cmd: any) => cmd !== message.trim());
        // 保留最近 50 条
        const newHistory = [message.trim(), ...filtered].slice(0, 50);
        return newHistory;
      });
    }

    // 重置历史导航状态
    setHistoryIndex(-1);
    setHistoryNavigating(false);
    setSavedPrompt("");

    // 发送前先保留快照,再立即清空 composer;运行中发送会走官方 steer 队列,
    // 由 pi runtime 保证在当前工具调用结束后、下一次 LLM 调用前注入。
    setPrompt("");
    setAttachedImages([]);
    setSuggestionsOpen(false);
    setSendBehaviorMenuOpen(false);
    pendingUiSlashCommandRef.current = uiSlashCommand
      ? { agentId: activeAgentId, command: message }
      : null;
    if (uiSlashCommand) setPendingUiSlashCommandAgentId(activeAgentId);
    try {
      await submitPromptSnapshot(activeAgentId, message, images, undefined, uiSlashCommand);
    } catch (error) {
      pendingUiSlashCommandRef.current = null;
      if (uiSlashCommand) setPendingUiSlashCommandAgentId(null);
      throw error;
    } finally {
      if (uiSlashCommand) setPendingUiSlashCommandAgentId(null);
    }
    void refreshRuntimeState(activeAgentId);
    void api.agents
      .commands(activeAgentId)
      .then((cmds: any) =>
        setCommands([
          ...cmds,
          { name: "goal", description: "设置任务目标: /goal <目标>", source: "builtin" },
        ]),
      )
      .catch(() => undefined);
  
}

export async function sendPromptAsFollowUp(ctx: AppContext, ...args: any[]) {
  const { activeAgentId, attachedImages, isAgentStarting, prompt, setAttachedImages, setPrompt, setSendBehaviorMenuOpen, setSuggestionsOpen, submitPromptSnapshot } = ctx;

    if (
      isAgentStarting ||
      !activeAgentId ||
      (!prompt.trim() && attachedImages.length === 0)
    )
      return;
    const message = prompt;
    const images = attachedImages.length > 0 ? attachedImages : undefined;
    setPrompt("");
    setAttachedImages([]);
    setSuggestionsOpen(false);
    setSendBehaviorMenuOpen(false);
    await submitPromptSnapshot(activeAgentId, message, images, "followUp");
  
}

export function handleGoalCommand(ctx: AppContext, input: string) {
  const { activeAgentId, goalContinuationPendingRef, goalIterationRef, goalStartedAtRef, goalStatusRef, goalTextRef, setGoalCompletedAt, setGoalStartedAt, setGoalStatus, setGoalText, showToast, submitPromptSnapshot } = ctx;

    const trimmed = input.replace(/^\/goal/, "").trim();
    const first = trimmed.split(/\s+/)[0];

    if (!trimmed || first === "status") {
      if (goalStatusRef.current === "none") {
        showToast(!activeAgentId ? t("goal.noGoal") : `Usage: /goal <objective>\nNo goal set.`, 3000);
      } else {
        const elapsed = goalStartedAtRef.current ? Math.floor((Date.now() - goalStartedAtRef.current) / 1000) : 0;
        const elapsedStr = elapsed >= 60 ? `${Math.floor(elapsed / 60)}m${elapsed % 60}s` : `${elapsed}s`;
        const tokenHint = goalIterationRef.current > 0 ? ` (续接 ${goalIterationRef.current} 次)` : "";
        showToast(`🎯 ${goalStatusRef.current === "complete" ? "已完成" : "进行中"}: ${goalTextRef.current}\n耗时: ${elapsedStr} | 状态: ${goalStatusRef.current}${tokenHint}`, 4000);
      }
      return;
    }

    if (first === "clear" || first === "stop") {
      goalStatusRef.current = "none";
      goalTextRef.current = "";
      goalStartedAtRef.current = 0;
      goalIterationRef.current = 0;
      goalContinuationPendingRef.current = false;
      setGoalStatus("none");
      setGoalText("");
      setGoalStartedAt(0);
      setGoalCompletedAt(0);
      showToast("🎯 Goal cleared", 2000);
      return;
    }

    if (first === "pause") {
      if (goalStatusRef.current !== "active") {
        showToast("No active goal to pause.", 2000);
        return;
      }
      goalStatusRef.current = "paused";
      setGoalStatus("paused");
      goalContinuationPendingRef.current = false;
      showToast(`🎯 Goal paused: ${goalTextRef.current}`, 3000);
      return;
    }

    if (first === "resume") {
      if (goalStatusRef.current !== "paused") {
        showToast("No paused goal to resume.", 2000);
        return;
      }
      goalStatusRef.current = "active";
      setGoalStatus("active");
      goalContinuationPendingRef.current = false;
      void submitPromptSnapshot(activeAgentId!, `[goal 续接] 之前暂停的目标已恢复，请继续完成:
<goal_objective>
${goalTextRef.current}
</goal_objective>`, undefined, "followUp");
      showToast(`🎯 Goal resumed: ${goalTextRef.current}`, 3000);
      return;
    }

    // /goal <objective> — 启动新目标
    const objective = trimmed;
    const existing = goalStatusRef.current;
    if (existing === "active") {
      if (!window.confirm(`当前有进行中的目标:\n${goalTextRef.current}\n\n是否替换为新目标?`)) return;
    }

    goalTextRef.current = objective;
    goalStatusRef.current = "active";
    goalStartedAtRef.current = Date.now();
    goalIterationRef.current = 0;
    goalContinuationPendingRef.current = false;
    setGoalText(objective);
    setGoalStatus("active");
    setGoalStartedAt(Date.now());
    setGoalCompletedAt(0);

    // 将目标文本作为普通消息发送（不使用 followUp，避免显示错误的消息标签）
    void submitPromptSnapshot(activeAgentId!, objective);
    // 目标文本作为用户消息显示在对话中，goal 状态可通过 /goal status 查看
  
}

export async function submitPromptSnapshot(
  ctx: AppContext,
  agentId: string,
  message: string,
  images?: ComposerImage[],
  streamingBehavior?: "steer" | "followUp",
  uiSlashCommand?: boolean,
) {
  const { agents, api, isAgentBusy, prompt } = ctx;

    // 这里接收快照参数,让 composer 发送和历史消息"重新发送"共享同一条路径。
    // Agent 忙碌时显式使用官方 streamingBehavior=steer:消息会进入 pi 的运行中队列,
    // 而不是留在 desktop 本地等整个 agent idle 后再发送。
    // Slash 扩展命令必须走普通 RPC prompt，pi 才会执行命令展开并发出 extension_ui_request；
    // streamingBehavior=steer 会把它当运行中消息注入，导致 `/advisor` 这类命令变成普通文本发送。
    const isSlashCommandPrompt = message.trimStart().startsWith("/");
    const behavior =
      streamingBehavior ?? (isAgentBusy && !isSlashCommandPrompt ? "steer" : undefined);
    await api.agents.prompt({
      agentId,
      message,
      images,
      ...(behavior ? { streamingBehavior: behavior } : {}),
      ...(uiSlashCommand ? { uiSlashCommand: true } : {}),
    });
  
}

export function resendUserMessage(ctx: AppContext, message: ChatMessage) {
  const { activeAgentId, submitPromptSnapshot } = ctx;

    if (!activeAgentId || message.agentId !== activeAgentId) return;
    // "重新发送"按原消息快照再次提交,不修改输入框,图片也复用原始 base64 内容。
    void submitPromptSnapshot(activeAgentId, message.text, message.images);
  
}

export function undoUserMessage(ctx: AppContext, message: ChatMessage) {
  const { activeAgentId, agents, api, setAttachedImages, setPrompt, setSuggestionsOpen } = ctx;

    if (!activeAgentId || message.agentId !== activeAgentId) return;
    // 撤销不是单纯清空输入框，而是回退这条消息在当前会话视图中的位置，方便用户继续编辑后重发。
    void api.agents.undoMessage(activeAgentId, message.id).then((payload: any) => {
      if (!payload) return;
      const text = payload.text;
      setPrompt(text);
      setAttachedImages(payload.images ?? []);
      setSuggestionsOpen(true);
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLTextAreaElement>(".composer-box textarea")
          ?.focus();
      });
    });
  
}

export async function processImageFile(ctx: AppContext, file: File) {
  const { api, fileToImageContent, resizeImageFile, showToast } = ctx;

    const maxSize = 10 * 1024 * 1024; // 原始文件 10MB 限制,避免误粘超大图片卡住渲染进程
    if (file.size > maxSize) {
      showToast(t("app.imageTooLarge"), 3000);
      return null;
    }

    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp"];
    if (!validTypes.includes(file.type)) {
      showToast(t("app.imageUnsupported"), 3000);
      return null;
    }

    const image = file.type === "image/gif"
      ? await fileToImageContent(file)
      : await resizeImageFile(file, 2000, 0.86).catch(() => fileToImageContent(file));
    const asset = await api.images.createAsset(image);
    // 预览必须由 renderer 持有 blob URL；main 侧 file:// 资产在 Electron 页面里可能被安全策略拦截。
    return { ...asset, previewUrl: createImagePreviewObjectUrl(image) };
  
}

export function fileToImageContent(ctx: AppContext, file: File) {
  const { dataUrlToImageContent } = ctx;

    return new Promise((resolve: any) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(dataUrlToImageContent(String(reader.result), file.type));
      reader.readAsDataURL(file);
    });
  
}

export function dataUrlToImageContent(
  ctx: AppContext,
  dataUrl: string,
  fallbackMimeType: string,
) {

    const [meta, data = ""] = dataUrl.split(",");
    const mimeType = meta.match(/^data:(.*?);base64$/)?.[1] || fallbackMimeType;
    return { type: "image", data, mimeType };
  
}

export function resizeImageFile(
  ctx: AppContext,
  file: File,
  maxEdge: number,
  quality: number,
) {
  const { dataUrlToImageContent } = ctx;

    return new Promise((resolve: any, reject: any) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const scale = Math.min(
            1,
            maxEdge / Math.max(image.width, image.height),
          );
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
          // JPEG 更省 token/传输体积;透明 PNG/WebP 保持 PNG,避免截图透明区域变黑。
          const outputType =
            file.type === "image/png" ? "image/png" : "image/jpeg";
          resolve(
            dataUrlToImageContent(
              canvas.toDataURL(outputType, quality),
              outputType,
            ),
          );
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  
}

export async function handlePaste(
  ctx: AppContext,
  event: ClipboardEvent,
) {
  const { processImageFile, setAttachedImages } = ctx;

    const items = Array.from(event.clipboardData.items);
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const image = await processImageFile(file);
          if (image) {
            setAttachedImages((prev: any) => [...prev, image]);
          }
        }
        return;
      }
    }
  
}

export async function handleDrop(ctx: AppContext, event: DragEvent) {
  const { processImageFile, setAttachedImages } = ctx;

    event.preventDefault();
    const files = Array.from(event.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        const image = await processImageFile(file);
        if (image) {
          setAttachedImages((prev: any) => [...prev, image]);
        }
      }
    }
  
}

export function handleDragOver(ctx: AppContext, event: DragEvent) {

    event.preventDefault();
  
}

export function removeImage(ctx: AppContext, index: number) {
  const { attachedImages, releaseDiscardedComposerImage, setAttachedImages } = ctx;

    const removed = attachedImages[index];
    if (removed) releaseDiscardedComposerImage(removed);
    setAttachedImages((prev: any) => prev.filter((_: any, i: any) => i !== index));
  
}

export function clearImages(ctx: AppContext, ...args: any[]) {
  const { discardAttachedImages } = ctx;

    discardAttachedImages();
  
}

export async function updateSettings(
  ctx: AppContext,
  patch: Partial<AppSettings>,
) {
  const { api, setSettings, setSettingsNotice } = ctx;

    try {
      const next = await api.settings.update(patch);
      setSettings(next);
      let notice = t("app.settingsSaved");
      if ("sendShortcut" in patch) {
        notice = t("app.sendShortcutSaved");
      }
      if ("useNativeTitleBar" in patch) {
        notice = t("app.titleBarSaved");
      }
      setSettingsNotice(notice);
    } catch (error) {
      setSettings(await api.settings.get());
      setSettingsNotice(error instanceof Error ? error.message : String(error));
    }
  
}

export async function switchBranch(ctx: AppContext, branch: string) {
  const { activeProjectId, api, gitInfo, setGitInfo, setSwitchingBranch, showToast } = ctx;

    if (!activeProjectId || !branch || branch === gitInfo.current) return;
    setSwitchingBranch(branch);
    try {
      const next = await api.git.checkout(activeProjectId, branch);
      setGitInfo(next);
    } catch (error) {
      showToast(
        t("app.branchSwitchFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      // 失败后主动刷新一次,覆盖 git 拒绝切换或外部同时切换导致的 UI 状态偏差。
      const refreshed = await api.git
        .branches(activeProjectId)
        .catch(() => ({ current: null, branches: [] }));
      setGitInfo(refreshed);
    } finally {
      setSwitchingBranch(null);
    }
  
}

export async function createBranch(
  ctx: AppContext,
  branchName: string,
) {
  const { activeProjectId, api, setGitInfo, setSwitchingBranch, showToast } = ctx;

    if (!activeProjectId || !branchName.trim()) return;
    setSwitchingBranch(branchName);
    try {
      const next = await api.git.createBranch(activeProjectId, branchName);
      setGitInfo(next);
      showToast(t("app.branchCreated", { branch: branchName }), 2500);
    } catch (error) {
      showToast(
        t("app.branchCreateFailed", {
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    } finally {
      setSwitchingBranch(null);
    }
  
}
