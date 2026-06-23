import type { AppContext } from "../AppContext";
import type { PointerEvent } from "react";
import type { DrawerPanel } from "../../components/app/AppChromeParts";
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
import type { ChatMessage, ComposerImage, ImageContent } from "../../../../shared/types";
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

export function openDrawer(ctx: AppContext, panel: DrawerPanel) {
  const { activeProjectId, drawerCollapsed, drawerPinned, drawerPinnedPanel, refreshSessions, setDrawer, setDrawerCollapsed, setSessionsProjectId } = ctx;

    if (drawerPinned && panel !== drawerPinnedPanel) return;
    const wasCollapsed = drawerCollapsed;
    if (panel === "sessions" && activeProjectId) {
      setSessionsProjectId(activeProjectId);
      void refreshSessions(activeProjectId);
    }
    // 如果当前抽屉已经是目标面板但处于 collapsed 状态，第一次点击应展开而不是关闭面板。
    // 否则启动/恢复到 files+collapsed 状态时，用户会感觉第一次点击被吞掉，需要第二次才看到内容。
    setDrawerCollapsed(false);
    setDrawer((current: any) => {
      if (current === panel) return drawerPinned || wasCollapsed ? current : null;
      return panel;
    });
  
}

export function closeDrawer(ctx: AppContext) {
  const { drawerPinned, setDrawer } = ctx;

    if (drawerPinned) return;
    setDrawer(null);
  
}

export function collapseDrawer(ctx: AppContext) {
  const { drawerPinned, setDrawerCollapsed } = ctx;

    if (drawerPinned) return;
    setDrawerCollapsed(true);
  
}

export async function openCurrentProjectInVSCode(ctx: AppContext) {
  const { api, currentProjectPath, showToast } = ctx;

    if (!currentProjectPath) return;
    try {
      await api.app.openInVSCode(currentProjectPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[VSCode] renderer openInVSCode rejected", error);
      showToast(t("app.openInVSCodeFailed", { error: message }));
    }
  
}

export function toggleDrawerPinned(ctx: AppContext) {
  const { activeAgentId, drawer, setDrawerPinnedByAgent } = ctx;

    if (!activeAgentId || !drawer) return;
    setDrawerPinnedByAgent((current: any) => {
      const next = { ...current };
      if (next[activeAgentId]) delete next[activeAgentId];
      else next[activeAgentId] = drawer;
      return next;
    });
  
}

export function toggleDirectory(ctx: AppContext, path: string) {
  const { setExpandedDirs } = ctx;

    // 文件树默认折叠,只有用户显式展开目录才显示子项,避免大仓库一打开就产生视觉噪音。
    setExpandedDirs((current) => {
      const next = new Set<string>(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  
}

export function startResize(
  ctx: AppContext,
  target: "list" | "drawer",
  event: PointerEvent,
) {
  const { drawerCollapsed, drawerPinned, drawerWidth, listCollapsed, listWidth, setDrawerCollapsed, setDrawerWidth, setListCollapsed, setListWidth } = ctx;

    const startX = event.clientX;
    const startListWidth = listCollapsed ? 68 : listWidth;
    const startDrawerWidth = drawerCollapsed ? 0 : drawerWidth;
    let frame = 0;

    function onMove(moveEvent: globalThis.PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const delta = moveEvent.clientX - startX;
        if (target === "list") {
          const next = Math.min(440, Math.max(160, startListWidth + delta));
          setListCollapsed(next <= 170);
          setListWidth(next);
        } else {
          const minDrawerWidth = drawerPinned ? 220 : 180;
          const next = Math.min(
            560,
            Math.max(minDrawerWidth, startDrawerWidth - delta),
          );
          setDrawerCollapsed(!drawerPinned && next <= 190);
          setDrawerWidth(next);
        }
      });
    }

    function onUp() {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("is-resizing");
      document.body.classList.remove("is-list-resizing");
    }

    document.body.classList.add("is-resizing");
    if (target === "list") document.body.classList.add("is-list-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  
}

export function startComposerResize(
  ctx: AppContext,
  event: PointerEvent,
) {
  const { getComposerMaxHeight, resolvedComposerHeight, setComposerAutoHeight, setComposerHeight } = ctx;

    const startY = event.clientY;
    const startHeight = resolvedComposerHeight;
    let frame = 0;

    function onMove(moveEvent: globalThis.PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const maxHeight = getComposerMaxHeight();
        // 拖动的是输入区顶部边线,鼠标向上意味着输入区变高;限制最大高度避免挤压会话阅读区域。
        // 实际高度由手动高度和自动内容高度共同决定;拖到最大后自动高度也会变大,
        // 因此手动缩小时必须同步覆盖 autoHeight,否则 Math.max 会继续把输入框顶在最大高度。
        const next = Math.min(
          maxHeight,
          Math.max(
            COMPOSER_MIN_HEIGHT,
            startHeight + startY - moveEvent.clientY,
          ),
        );
        setComposerHeight(next);
        setComposerAutoHeight(next);
      });
    }

    function onUp() {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("is-composer-resizing");
    }

    document.body.classList.add("is-composer-resizing");
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  
}

export function toggleListCollapsed(ctx: AppContext) {
  const { DEFAULT_LIST_WIDTH, listCollapsed, setListCollapsed, setListHoverRevealSuppressed, setListWidth } = ctx;

    const nextCollapsed = !listCollapsed;
    if (!nextCollapsed) setListWidth(DEFAULT_LIST_WIDTH);
    if (nextCollapsed) {
      // 点击折叠后鼠标和焦点仍在侧栏内;先释放焦点并抑制 hover,避免刚折叠就被 CSS 展开。
      (document.activeElement as HTMLElement | null)?.blur();
    }
    setListHoverRevealSuppressed(nextCollapsed);
    setListCollapsed(nextCollapsed);
  
}

export function releaseListHoverSuppression(
  ctx: AppContext,
  event: PointerEvent<HTMLDivElement>,
) {
  const { listCollapsed, listHoverRevealSuppressed, setListHoverRevealSuppressed } = ctx;

    if (listCollapsed && listHoverRevealSuppressed && event.clientX > 24) {
      setListHoverRevealSuppressed(false);
    }
  
}
