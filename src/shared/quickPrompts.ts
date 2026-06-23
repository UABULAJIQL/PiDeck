import type { QuickPromptPreset } from "./types";

export const DEFAULT_QUICK_PROMPTS = [
  "先总结当前上下文，再给出执行计划。",
  "先定位根因，再给出最小修改方案。",
  "请先阅读相关文件，并列出你将修改的点。",
] satisfies string[];

export function createDefaultQuickPrompts(): QuickPromptPreset[] {
  return DEFAULT_QUICK_PROMPTS.map((content, index) => ({
    id: `default-${index + 1}`,
    content,
  }));
}

export function areQuickPromptPresetsEqual(
  left: QuickPromptPreset[],
  right: QuickPromptPreset[],
) {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.id === right[index]?.id && item.content === right[index]?.content,
    )
  );
}
