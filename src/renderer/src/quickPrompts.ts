import { useCallback, useEffect, useRef, useState } from "react";
import {
  areQuickPromptPresetsEqual,
  createDefaultQuickPrompts,
} from "../../shared/quickPrompts";
import type { QuickPromptPreset } from "../../shared/types";

export type QuickPromptState = {
  presets: QuickPromptPreset[];
  draft: string;
};

type UseQuickPromptPresetsOptions = {
  getState: () => Promise<QuickPromptState>;
  updateState: (state: QuickPromptState) => Promise<void>;
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
  getState,
  updateState,
}: UseQuickPromptPresetsOptions) {
  const [quickPrompts, setQuickPrompts] = useState<QuickPromptPreset[]>(
    createDefaultQuickPrompts(),
  );
  const [quickPromptDraft, setQuickPromptDraft] = useState("");
  const hydratedRef = useRef(false);
  const lastSavedStateRef = useRef<QuickPromptState>({
    presets: createDefaultQuickPrompts(),
    draft: "",
  });

  useEffect(() => {
    let cancelled = false;
    void getState()
      .then((state) => {
        if (cancelled) return;
        hydratedRef.current = true;
        lastSavedStateRef.current = state;
        setQuickPrompts(state.presets);
        setQuickPromptDraft(state.draft);
      })
      .catch(() => {
        if (cancelled) return;
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [getState]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const nextState = { presets: quickPrompts, draft: quickPromptDraft };
    const matchesLastSaved =
      areQuickPromptPresetsEqual(
        nextState.presets,
        lastSavedStateRef.current.presets,
      ) && nextState.draft === lastSavedStateRef.current.draft;
    if (matchesLastSaved) return;

    const timeoutId = window.setTimeout(() => {
      void updateState(nextState)
        .then(() => {
          lastSavedStateRef.current = nextState;
        })
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timeoutId);
  }, [quickPrompts, quickPromptDraft, updateState]);

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
