import { useCallback, useMemo, useRef, useState } from "react";
import type { AgentMessagePatch, AgentTab, ChatMessage, ComposerImage } from "../../../shared/types";
import type { SessionModifiedFile } from "../components/app/AppParts";
import {
  applyOutlinePatch,
  buildModifiedFileContributionMap,
  buildOutline,
  createEmptyAgentConversationState,
  createModifiedFileContribution,
  deriveModifiedFiles,
  deriveModifiedFilesFromContributions,
  type AgentConversationState,
  type ConversationState,
  type ModifiedFileContribution,
  upsertMessage,
} from "../conversationState";

function migrateAgentRecord<T>(
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

export function useConversationStore() {
  const [stateByAgent, setStateByAgent] = useState<ConversationState>({});
  const turnFileBaselineByAgentRef = useRef<Record<string, Map<string, SessionModifiedFile>>>({});
  const finalizedTurnByAgentRef = useRef<Record<string, string | null>>({});
  const modifiedFileContributionsByAgentRef = useRef<Record<string, Map<string, ModifiedFileContribution>>>({});

  const ensureState = useCallback((agentId: string, current: ConversationState) => {
    return current[agentId] ?? createEmptyAgentConversationState();
  }, []);

  const ensureModifiedFileContributions = useCallback((agentId: string, messages: ChatMessage[]) => {
    let contributions = modifiedFileContributionsByAgentRef.current[agentId];
    if (!contributions) {
      contributions = buildModifiedFileContributionMap(messages);
      modifiedFileContributionsByAgentRef.current[agentId] = contributions;
    }
    return contributions;
  }, []);

  const replaceMessages = useCallback((agentId: string, messages: ChatMessage[]) => {
    setStateByAgent((current) => {
      const previous = ensureState(agentId, current);
      const contributions = buildModifiedFileContributionMap(messages);
      modifiedFileContributionsByAgentRef.current[agentId] = contributions;
      const nextState: AgentConversationState = {
        ...previous,
        messages,
        modifiedFiles: deriveModifiedFilesFromContributions(contributions.values()),
        outlineItems: buildOutline(messages),
      };
      return {
        ...current,
        [agentId]: nextState,
      };
    });
  }, [ensureState]);

  const applyMessagePatch = useCallback((agentId: string, patch: AgentMessagePatch) => {
    setStateByAgent((current) => {
      const previous = ensureState(agentId, current);
      const op = patch.op === "remove" ? "remove" : "upsert";
      const messages =
        op === "remove"
          ? previous.messages.filter((message) => message.id !== patch.message.id)
          : upsertMessage(previous.messages, patch.message);
      const contributions = ensureModifiedFileContributions(agentId, previous.messages);
      let modifiedFiles = previous.modifiedFiles;
      if (patch.message.role === "tool") {
        if (op === "remove") {
          contributions.delete(patch.message.id);
        } else {
          const order = messages.findIndex((message) => message.id === patch.message.id);
          const contribution = createModifiedFileContribution(patch.message, order < 0 ? messages.length : order);
          if (contribution) contributions.set(patch.message.id, contribution);
          else contributions.delete(patch.message.id);
        }
        modifiedFiles = deriveModifiedFilesFromContributions(contributions.values());
      }
      const nextState: AgentConversationState = {
        ...previous,
        messages,
        modifiedFiles,
        outlineItems: applyOutlinePatch(previous.outlineItems, patch.message, op),
      };
      return {
        ...current,
        [agentId]: nextState,
      };
    });
  }, [ensureModifiedFileContributions, ensureState]);

  const removePendingCommandMessage = useCallback((agentId: string, command: string) => {
    setStateByAgent((current) => {
      const previous = ensureState(agentId, current);
      const lastUserIndex = [...previous.messages]
        .map((message, index) => ({ message, index }))
        .reverse()
        .find(({ message }) => message.role === "user")?.index;
      if (lastUserIndex == null) return current;
      if (previous.messages[lastUserIndex]?.text.trim() !== command.trim()) return current;
      const removed = previous.messages[lastUserIndex];
      if (!removed) return current;
      const messages = previous.messages.filter((_, index) => index !== lastUserIndex);
      return {
        ...current,
        [agentId]: {
          ...previous,
          messages,
          outlineItems: applyOutlinePatch(previous.outlineItems, removed, "remove"),
        },
      };
    });
  }, [ensureState]);

  const setThinking = useCallback((agentId: string, thinking: string) => {
    setStateByAgent((current) => {
      const previous = ensureState(agentId, current);
      return {
        ...current,
        [agentId]: {
          ...previous,
          streamingThinking: thinking,
        },
      };
    });
  }, [ensureState]);

  const setAttachedImages = useCallback((agentId: string, value: ComposerImage[] | ((current: ComposerImage[]) => ComposerImage[])) => {
    setStateByAgent((current) => {
      const previous = ensureState(agentId, current);
      const nextValue = typeof value === "function" ? value(previous.attachedImages) : value;
      return {
        ...current,
        [agentId]: {
          ...previous,
          attachedImages: nextValue,
        },
      };
    });
  }, [ensureState]);

  const migrateAgents = useCallback((replacementById: Map<string, string>, liveIds: Set<string>) => {
    modifiedFileContributionsByAgentRef.current = migrateAgentRecord(
      modifiedFileContributionsByAgentRef.current,
      replacementById,
      liveIds,
    );
    setStateByAgent((current) => migrateAgentRecord(current, replacementById, liveIds));
  }, []);

  const transferAgentDraft = useCallback((fromAgentId: string, toAgentId: string) => {
    const contributions = modifiedFileContributionsByAgentRef.current[fromAgentId];
    if (contributions) {
      modifiedFileContributionsByAgentRef.current[toAgentId] = contributions;
      delete modifiedFileContributionsByAgentRef.current[fromAgentId];
    }
    setStateByAgent((current) => {
      const from = current[fromAgentId];
      if (!from) return current;
      const to = current[toAgentId] ?? createEmptyAgentConversationState();
      const next = {
        ...current,
        [toAgentId]: {
          ...to,
          attachedImages: from.attachedImages,
          streamingThinking: from.streamingThinking,
        },
      };
      delete next[fromAgentId];
      return next;
    });
  }, []);

  const clearAgentData = useCallback((liveIds: Set<string>) => {
    modifiedFileContributionsByAgentRef.current = migrateAgentRecord(
      modifiedFileContributionsByAgentRef.current,
      new Map(),
      liveIds,
    );
    setStateByAgent((current) => {
      const next: ConversationState = {};
      for (const [agentId, value] of Object.entries(current)) {
        if (liveIds.has(agentId)) next[agentId] = value;
      }
      return next;
    });
  }, []);

  const finalizeTurnSummary = useCallback((agent: AgentTab) => {
    const conversation = stateByAgent[agent.id];
    if (!conversation) return null;
    const modifiedFiles = conversation.modifiedFiles;
    if (agent.status === "running") {
      turnFileBaselineByAgentRef.current[agent.id] = new Map(
        modifiedFiles.map((file) => [file.path, file]),
      );
      finalizedTurnByAgentRef.current[agent.id] = null;
      return null;
    }
    if (agent.status !== "idle") return null;
    const lastAssistantMessage = [...conversation.messages]
      .reverse()
      .find((message) => message.role === "assistant");
    const baseline =
      turnFileBaselineByAgentRef.current[agent.id] ??
      new Map<string, SessionModifiedFile>();
    const turnModifiedFiles = modifiedFiles
      .map<SessionModifiedFile | null>((file) => {
        const baselineFile = baseline.get(file.path);
        const changedLines = Math.max(
          0,
          (file.changedLines ?? 0) - (baselineFile?.changedLines ?? 0),
        );
        return changedLines > 0 || !baselineFile
          ? { ...file, changedLines }
          : null;
      })
      .filter((file): file is SessionModifiedFile => Boolean(file));
    if (
      !lastAssistantMessage ||
      turnModifiedFiles.length === 0 ||
      finalizedTurnByAgentRef.current[agent.id] === lastAssistantMessage.id
    ) {
      return null;
    }
    finalizedTurnByAgentRef.current[agent.id] = lastAssistantMessage.id;
    setStateByAgent((current) => {
      const previous = ensureState(agent.id, current);
      return {
        ...current,
        [agent.id]: {
          ...previous,
          turnFileSummaryByMessage: {
            ...previous.turnFileSummaryByMessage,
            [lastAssistantMessage.id]: turnModifiedFiles,
          },
        },
      };
    });
    return { messageId: lastAssistantMessage.id, files: turnModifiedFiles };
  }, [ensureState, stateByAgent]);

  const snapshot = useMemo(() => stateByAgent, [stateByAgent]);

  return {
    stateByAgent: snapshot,
    replaceMessages,
    applyMessagePatch,
    removePendingCommandMessage,
    setThinking,
    setAttachedImages,
    migrateAgents,
    transferAgentDraft,
    clearAgentData,
    finalizeTurnSummary,
  };
}
