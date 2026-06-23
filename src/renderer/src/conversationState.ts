import type { ChatMessage, ComposerImage } from "../../shared/types";
import type { SessionModifiedFile } from "./components/app/AppParts";

export type OutlineItem = {
  id: string;
  role: string;
  title: string;
  time: string;
};

export type ModifiedFileContribution = {
  messageId: string;
  path: string;
  toolName: string;
  status: string;
  changedLines: number;
  originalContent?: string;
  order: number;
};

export type AgentConversationState = {
  messages: ChatMessage[];
  attachedImages: ComposerImage[];
  streamingThinking: string;
  modifiedFiles: SessionModifiedFile[];
  outlineItems: OutlineItem[];
  turnFileSummaryByMessage: Record<string, SessionModifiedFile[]>;
};

export type ConversationState = Record<string, AgentConversationState>;

export function createEmptyAgentConversationState(): AgentConversationState {
  return {
    messages: [],
    attachedImages: [],
    streamingThinking: "",
    modifiedFiles: [],
    outlineItems: [],
    turnFileSummaryByMessage: {},
  };
}

export function upsertMessage(messages: ChatMessage[], nextMessage: ChatMessage) {
  const next = [...messages];
  const index = next.findIndex((message) => message.id === nextMessage.id);
  if (index >= 0) next[index] = nextMessage;
  else next.push(nextMessage);
  return next;
}

function countContentLines(value: unknown) {
  if (typeof value !== "string") return 0;
  if (!value) return 0;
  return value.split(/\r\n|\r|\n/).length;
}

function getToolChangedLineCount(toolName: string, args: any) {
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

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function summarizeMessage(text: string) {
  const cleaned = text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
  const firstLine = cleaned
    .replace(/```[\s\S]*?```/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? "";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}...` : firstLine;
}

function toOutlineItem(message: ChatMessage): OutlineItem | null {
  if (message.role !== "user" && message.role !== "assistant") return null;
  const title = summarizeMessage(message.text);
  if (!title) return null;
  return {
    id: message.id,
    role: message.role,
    title,
    time: formatTime(message.timestamp),
  };
}

export function buildOutline(messages: ChatMessage[]): OutlineItem[] {
  return messages.map(toOutlineItem).filter((item): item is OutlineItem => Boolean(item));
}

export function applyOutlinePatch(
  outlineItems: OutlineItem[],
  patch: ChatMessage,
  op: "upsert" | "remove" = "upsert",
) {
  const index = outlineItems.findIndex((item) => item.id === patch.id);
  if (op === "remove") {
    if (index < 0) return outlineItems;
    return outlineItems.filter((item) => item.id !== patch.id);
  }
  const nextItem = toOutlineItem(patch);
  if (!nextItem) return index < 0 ? outlineItems : outlineItems.filter((item) => item.id !== patch.id);
  if (index < 0) return [...outlineItems, nextItem];
  const next = [...outlineItems];
  next[index] = nextItem;
  return next;
}

function resolveToolFilePath(message: ChatMessage) {
  const toolName: string | undefined = message.meta?.toolName as string | undefined;
  const args: any = message.meta?.args;
  if (!toolName || !/write|edit|create/i.test(toolName)) return null;
  const filePath =
    typeof args?.filePath === "string"
      ? args.filePath
      : typeof args?.path === "string"
        ? args.path
        : typeof args?.file === "string"
          ? args.file
          : typeof args?.fileName === "string"
            ? args.fileName
            : undefined;
  if (!filePath) return null;
  return {
    filePath,
    toolName,
    args,
    status: String(message.meta?.status ?? "done"),
    originalContent: message.meta?.originalContent as string | undefined,
  };
}

export function createModifiedFileContribution(
  message: ChatMessage,
  order: number,
): ModifiedFileContribution | null {
  if (message.role !== "tool") return null;
  const resolved = resolveToolFilePath(message);
  if (!resolved) return null;
  return {
    messageId: message.id,
    path: resolved.filePath,
    toolName: resolved.toolName,
    status: resolved.status,
    changedLines: getToolChangedLineCount(resolved.toolName, resolved.args),
    originalContent: resolved.originalContent,
    order,
  };
}

export function buildModifiedFileContributionMap(messages: ChatMessage[]) {
  const contributions = new Map<string, ModifiedFileContribution>();
  messages.forEach((message, index) => {
    const contribution = createModifiedFileContribution(message, index);
    if (contribution) contributions.set(message.id, contribution);
  });
  return contributions;
}

export function deriveModifiedFilesFromContributions(
  contributions: Iterable<ModifiedFileContribution>,
): SessionModifiedFile[] {
  const byPath = new Map<string, SessionModifiedFile>();
  const ordered = Array.from(contributions).sort((a, b) => a.order - b.order);
  for (const contribution of ordered) {
    const previous = byPath.get(contribution.path);
    if (previous) byPath.delete(contribution.path);
    byPath.set(contribution.path, {
      path: contribution.path,
      toolName: contribution.toolName,
      status:
        contribution.status === "running"
          ? "running"
          : (previous?.status ?? contribution.status),
      changedLines: (previous?.changedLines ?? 0) + contribution.changedLines,
      originalContent: previous?.originalContent ?? contribution.originalContent ?? "",
    });
  }
  return Array.from(byPath.values());
}

export function deriveModifiedFiles(messages: ChatMessage[]): SessionModifiedFile[] {
  return deriveModifiedFilesFromContributions(
    buildModifiedFileContributionMap(messages).values(),
  );
}

export function mapImageContentToAssetRef(images?: ChatMessage["images"]): ComposerImage[] {
  if (!images?.length) return [];
  return images.filter((image) => image.type === "image-asset");
}
