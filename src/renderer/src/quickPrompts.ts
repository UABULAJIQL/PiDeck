import { useEffect, useState } from "react";
import type { QuickPromptPreset } from "./quickPromptTypes";

const QUICK_PROMPTS_STORAGE_KEY = "pi-desktop:quick-prompts";
const DEFAULT_QUICK_PROMPTS = [
  "先总结当前上下文，再给出执行计划。",
  "先定位根因，再给出最小修改方案。",
  "请先阅读相关文件，并列出你将修改的点。",
] satisfies string[];

function createDefaultQuickPrompts(): QuickPromptPreset[] {
  return DEFAULT_QUICK_PROMPTS.map((content, index) => ({
    id: `default-${index + 1}`,
    content,
  }));
}

function loadQuickPromptPresets(): QuickPromptPreset[] {
  if (typeof window === "undefined") return createDefaultQuickPrompts();
  try {
    const raw = window.localStorage.getItem(QUICK_PROMPTS_STORAGE_KEY);
    if (!raw) return createDefaultQuickPrompts();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return createDefaultQuickPrompts();
    const normalized = parsed
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const { id, content } = item as { id?: unknown; content?: unknown };
        if (typeof id !== "string" || !id.trim()) return null;
        if (typeof content !== "string") return null;
        const trimmedContent = content.trim();
        if (!trimmedContent) return null;
        return { id, content: trimmedContent };
      })
      .filter((item): item is QuickPromptPreset => Boolean(item));
    return normalized.length > 0 ? normalized : createDefaultQuickPrompts();
  } catch {
    return createDefaultQuickPrompts();
  }
}

function createQuickPromptId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `quick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useQuickPromptPresets() {
  const [quickPrompts, setQuickPrompts] = useState<QuickPromptPreset[]>(() =>
    loadQuickPromptPresets(),
  );
  const [quickPromptDraft, setQuickPromptDraft] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(
        QUICK_PROMPTS_STORAGE_KEY,
        JSON.stringify(quickPrompts),
      );
    } catch {
      // 快捷输入仅作为本地便利功能，写入失败时保留内存态即可，避免影响聊天主流程。
    }
  }, [quickPrompts]);

  function addQuickPromptPreset() {
    const value = quickPromptDraft.trim();
    if (!value) return;
    setQuickPrompts((current) => {
      const duplicate = current.find((item) => item.content === value);
      if (duplicate) return current;
      return [{ id: createQuickPromptId(), content: value }, ...current];
    });
    setQuickPromptDraft("");
  }

  function removeQuickPromptPreset(id: string) {
    setQuickPrompts((current) => current.filter((item) => item.id !== id));
  }

  return {
    quickPrompts,
    quickPromptDraft,
    setQuickPromptDraft,
    addQuickPromptPreset,
    removeQuickPromptPreset,
  };
}
