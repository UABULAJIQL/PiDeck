import { useState } from "react";
import type { AgentRuntimeState } from "../../../shared/types";
import type { DrawerPanel } from "../components/app/AppParts";
import type { TerminalDockStateByAgent } from "../terminalDockState";

type RpcLogEntry = {
  id: string;
  agentId: string;
  direction: string;
  summary: string;
  data?: unknown;
  time: number;
};

export function useAgentUiState() {
  const [runtimeStateByAgent, setRuntimeStateByAgent] = useState<
    Record<string, AgentRuntimeState>
  >({});
  const [promptByAgent, setPromptByAgent] = useState<Record<string, string>>(
    {},
  );
  const [sessionDurationByAgent, setSessionDurationByAgent] = useState<
    Record<string, number>
  >({});
  const [rpcLogs, setRpcLogs] = useState<RpcLogEntry[]>([]);
  const [terminalDockStateByAgent, setTerminalDockStateByAgent] =
    useState<TerminalDockStateByAgent>({});
  const [terminalHeightByAgent, setTerminalHeightByAgent] = useState<
    Record<string, number>
  >({});
  const [drawerPinnedByAgent, setDrawerPinnedByAgent] = useState<
    Record<string, DrawerPanel>
  >({});

  return {
    runtimeStateByAgent,
    setRuntimeStateByAgent,
    promptByAgent,
    setPromptByAgent,
    sessionDurationByAgent,
    setSessionDurationByAgent,
    rpcLogs,
    setRpcLogs,
    terminalDockStateByAgent,
    setTerminalDockStateByAgent,
    terminalHeightByAgent,
    setTerminalHeightByAgent,
    drawerPinnedByAgent,
    setDrawerPinnedByAgent,
  };
}
