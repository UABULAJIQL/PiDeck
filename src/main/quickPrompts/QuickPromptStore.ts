import { app } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createDefaultQuickPrompts } from "../../shared/quickPrompts";
import type { QuickPromptPreset } from "../../shared/types";

export type QuickPromptState = {
  presets: QuickPromptPreset[];
  draft: string;
};

type LegacyQuickPromptSettings = {
  quickPrompts?: unknown;
  quickPromptDraft?: unknown;
};

const defaultState = (): QuickPromptState => ({
  presets: createDefaultQuickPrompts(),
  draft: "",
});

export class QuickPromptStore {
  private readonly filePath = join(app.getPath("userData"), "quick-prompts.json");
  private readonly legacySettingsPath = join(app.getPath("userData"), "settings.json");
  private state: QuickPromptState = defaultState();

  async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.state = this.parseState(JSON.parse(raw) as unknown);
    } catch {
      const migrated = await this.loadFromLegacySettings();
      this.state = migrated ?? defaultState();
      if (migrated) {
        await this.save();
      }
    }
    return this.get();
  }

  get() {
    return {
      presets: [...this.state.presets],
      draft: this.state.draft,
    };
  }

  async update(next: QuickPromptState) {
    this.state = this.parseState(next);
    await this.save();
    return this.get();
  }

  private parseState(value: unknown): QuickPromptState {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return defaultState();
    }
    const { presets, draft } = value as {
      presets?: unknown;
      draft?: unknown;
    };
    if (!Array.isArray(presets) || typeof draft !== "string") {
      return defaultState();
    }
    const normalizedPresets = presets
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
    return {
      presets: normalizedPresets,
      draft,
    };
  }

  private async loadFromLegacySettings() {
    try {
      const raw = await readFile(this.legacySettingsPath, "utf8");
      const parsed = JSON.parse(raw) as LegacyQuickPromptSettings | undefined;
      if (!parsed) return null;
      return this.parseState({
        presets: parsed.quickPrompts,
        draft: parsed.quickPromptDraft,
      });
    } catch {
      return null;
    }
  }

  private async save() {
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), "utf8");
  }
}
