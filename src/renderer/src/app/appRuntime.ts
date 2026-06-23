import { type WheelEvent as ReactWheelEvent } from "react";
import { createBrowserApi } from "../browserApi";
import { createPreviewApi } from "../previewApi";
import type { AgentTab, ComposerImage, ImageContent, Project } from "../../../shared/types";

export const isLanWeb =
  !window.piDesktop && window.location.protocol.startsWith("http");

export const api =
  window.piDesktop ?? (isLanWeb ? createBrowserApi() : createPreviewApi());

export const COMPOSER_MIN_HEIGHT = 260;

export const COMPOSER_DEFAULT_TERMINAL_HEIGHT = 220;

export const COMPOSER_MIN_TIMELINE_HEIGHT = 160;

export function countContentLines(value: unknown) {
  if (typeof value !== "string") return 0;
  if (!value) return 0;
  return value.split(/\r\n|\r|\n/).length;
}

export function getToolChangedLineCount(toolName: string, args: any) {
  // 会话结束摘要只能使用 renderer 已收到的工具参数,不能重新 diff 工作区;
  // 这里按编辑/写入工具的输入估算"本次触达行数",避免把用户在会话外的改动也计入。
  if (/edit/i.test(toolName)) {
    const edits = Array.isArray(args?.edits) ? args.edits : undefined;
    if (edits) {
      return edits.reduce((total: number, edit: any) => {
        const oldLines = countContentLines(edit?.oldText);
        const newLines = countContentLines(edit?.newText);
        return total + Math.max(oldLines, newLines);
      }, 0);
    }
    return Math.max(
      countContentLines(args?.oldText),
      countContentLines(args?.newText),
    );
  }
  if (/write|create/i.test(toolName)) {
    return countContentLines(args?.content ?? args?.text ?? args?.data);
  }
  return 0;
}

export function displayProjectDirectoryName(project: Project) {
  if (isChatProject(project)) return "Chat";
  const normalizedPath = project.path.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalizedPath.split("/").pop() || project.name || project.path;
}

export function isChatProject(project?: Project) {
  return project?.kind === "chat";
}

export function isAbsoluteFilePath(path: string) {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("/");
}

export function resolveFileLinkPath(path: string, basePath?: string) {
  if (!path || isAbsoluteFilePath(path) || !basePath) return path;
  // 浏览器端不引入 Node path;按项目根路径分隔符拼接,满足点击 AI 输出的项目相对路径。
  const separator = basePath.includes("\\") ? "\\" : "/";
  return `${basePath.replace(/[\\/]+$/, "")}${separator}${path.replace(/^[\\/]+/, "")}`;
}

export function normalizeSessionPathForCompare(sessionPath?: string) {
  if (!sessionPath) return undefined;
  const normalized = sessionPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const isWindowsPath = sessionPath.includes("\\") || /^[A-Za-z]:\//.test(normalized);
  return isWindowsPath ? normalized.toLowerCase() : normalized;
}

export function isSameSessionPath(left?: string, right?: string) {
  const normalizedLeft = normalizeSessionPathForCompare(left);
  const normalizedRight = normalizeSessionPathForCompare(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
}

export function createImagePreviewObjectUrl(image: ImageContent) {
  const binary = atob(image.data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return URL.createObjectURL(new Blob([bytes], { type: image.mimeType }));
}

export function revokeComposerImagePreviewUrl(image: ComposerImage) {
  if (image.type === "image-asset" && image.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(image.previewUrl);
  }
}

export function isReplacementForPendingAgent(agent: AgentTab, pending: AgentTab) {
  if (!pending.id.startsWith("pending-")) return false;
  if (agent.projectId !== pending.projectId || agent.cwd !== pending.cwd) {
    return false;
  }
  if (isSameSessionPath(agent.sessionPath, pending.sessionPath)) return true;
  if (pending.sessionPath) return false;
  return agent.createdAt >= pending.createdAt - 1000;
}

export function isAgentEffectivelyEmpty(agent: AgentTab) {
  return !agent.sessionPath && (!agent.title || / agent$/i.test(agent.title));
}

export function findReusableProjectAgent(agents: AgentTab[], projectId: string) {
  return agents.find(
    (agent) =>
      agent.projectId === projectId &&
      (agent.status === "starting" || isAgentEffectivelyEmpty(agent)),
  );
}

export function isPendingAgentId(agentId?: string) {
  return Boolean(agentId?.startsWith("pending-"));
}

export function migrateAgentRecord<T>(
  current: Record<string, T>,
  replacementById: Map<string, string>,
  liveIds: Set<string>,
) {
  const next: Record<string, T> = {};
  for (const [agentId, value] of Object.entries(current)) {
    const nextAgentId = replacementById.get(agentId) ?? agentId;
    if (liveIds.has(nextAgentId)) next[nextAgentId] = value;
  }
  return next;
}

export function getSessionAlertKey(projectId: string, filePath: string) {
  return `${projectId}::${normalizeSessionPathForCompare(filePath) ?? filePath}`;
}

export function findScrollableAncestor(start: HTMLElement | null) {
  let current = start;
  while (current) {
    const { overflowY } = window.getComputedStyle(current);
    const canScroll =
      /(auto|scroll|overlay)/.test(overflowY) &&
      current.scrollHeight > current.clientHeight;
    if (canScroll) return current;
    current = current.parentElement;
  }
  return null;
}

export function handoffProjectSessionWheel(event: ReactWheelEvent<HTMLDivElement>) {
  const scrollContainer = event.currentTarget;
  const maxScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
  if (maxScrollTop <= 0 || event.deltaY === 0) return;
  const previousScrollTop = scrollContainer.scrollTop;
  const nextScrollTop = Math.min(
    maxScrollTop,
    Math.max(0, previousScrollTop + event.deltaY),
  );
  const consumedDelta = nextScrollTop - previousScrollTop;
  const remainingDelta = event.deltaY - consumedDelta;
  if (Math.abs(remainingDelta) < 0.5) return;
  const outerScrollable = findScrollableAncestor(scrollContainer.parentElement);
  if (!outerScrollable) return;
  event.preventDefault();
  scrollContainer.scrollTop = nextScrollTop;
  outerScrollable.scrollTop += remainingDelta;
}
