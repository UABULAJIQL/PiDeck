import { useCallback, useEffect, useRef, useState } from "react";
import { areQuickPromptPresetsEqual } from "../../shared/quickPrompts";
import type { AppSettings, QuickPromptPreset } from "../../shared/types";

export type QuickPromptSettingsPatch = Pick<
  AppSettings,
  "quickPrompts" | "quickPromptDraft"
>;

type UseQuickPromptPresetsOptions = {
  settings: QuickPromptSettingsPatch;
  settingsLoaded: boolean;
  updateSettings: (patch: QuickPromptSettingsPatch) => Promise<void>;
};

function createQuickPromptId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `quick-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useQuickPromptPresets({
  settings,
  settingsLoaded,
  updateSettings,
}: UseQuickPromptPresetsOptions) {
  const [quickPrompts, setQuickPrompts] = useState<QuickPromptPreset[]>(
    settings.quickPrompts,
  );
  const [quickPromptDraft, setQuickPromptDraft] = useState(
    settings.quickPromptDraft,
  );
  const quickPromptSettingsHydratedRef = useRef(false);
  const quickPromptHydratingFromSettingsRef = useRef(false);

  useEffect(() => {
    if (!settingsLoaded || quickPromptSettingsHydratedRef.current) return;
    const stateMatchesSettings =
      areQuickPromptPresetsEqual(quickPrompts, settings.quickPrompts) &&
      quickPromptDraft === settings.quickPromptDraft;

    // 设置数据异步返回前，界面会先用本地初始值渲染；这里等主进程 settings 就绪后再对齐，
    // 避免第一次真实设置回填时被误判为用户编辑。
    if (!stateMatchesSettings) {
      quickPromptHydratingFromSettingsRef.current = true;
      setQuickPrompts(settings.quickPrompts);
      setQuickPromptDraft(settings.quickPromptDraft);
    }
    quickPromptSettingsHydratedRef.current = true;
  }, [
    settingsLoaded,
    settings.quickPrompts,
    settings.quickPromptDraft,
    quickPrompts,
    quickPromptDraft,
  ]);

  useEffect(() => {
    if (!settingsLoaded || !quickPromptSettingsHydratedRef.current) return;
    const stateMatchesSettings =
      areQuickPromptPresetsEqual(quickPrompts, settings.quickPrompts) &&
      quickPromptDraft === settings.quickPromptDraft;

    if (quickPromptHydratingFromSettingsRef.current) {
      if (stateMatchesSettings) {
        quickPromptHydratingFromSettingsRef.current = false;
      }
      return;
    }
    if (stateMatchesSettings) return;

    const timeoutId = window.setTimeout(() => {
      void updateSettings({ quickPrompts, quickPromptDraft }).catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [
    settingsLoaded,
    settings.quickPrompts,
    settings.quickPromptDraft,
    quickPrompts,
    quickPromptDraft,
    updateSettings,
  ]);

  const addQuickPromptPreset = useCallback(() => {
    const value = quickPromptDraft.trim();
    if (!value) return;
    setQuickPrompts((current) => {
      const duplicate = current.find((item) => item.content === value);
      if (duplicate) return current;
      return [{ id: createQuickPromptId(), content: value }, ...current];
    });
    setQuickPromptDraft("");
  }, [quickPromptDraft]);

  const removeQuickPromptPreset = useCallback((id: string) => {
    setQuickPrompts((current) => current.filter((item) => item.id !== id));
  }, []);

  return {
    quickPrompts,
    quickPromptDraft,
    setQuickPromptDraft,
    addQuickPromptPreset,
    removeQuickPromptPreset,
  };
}
