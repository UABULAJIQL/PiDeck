import type {
  ClipboardEvent,
  DragEvent,
  KeyboardEvent,
  PointerEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { useAppState } from "./useAppState";
import { api } from "./appRuntime";
import type { DrawerPanel } from "../components/app/AppChromeParts";
import type {
  AgentMessagePatch,
  AgentTab,
  AppSettings,
  AvailableModel,
  ChatMessage,
  ComposerImage,
  ImageContent,
  Project,
} from "../../../shared/types";

export type AppStateContext = ReturnType<typeof useAppState>;

export interface AppActionContext {
  api: typeof api;
  applySuggestion: (...args: any[]) => any;
  clearSuggestionTrigger: (...args: any[]) => any;
  describeApprovalRequest: (...args: any[]) => any;
  abortAgent: (agentId?: string) => Promise<any>;
  addProject: () => Promise<any>;
  appendQuickPromptToComposer: (content: string) => void;
  checkPiInstall: (source?: "startup" | "manual") => Promise<any>;
  checkPiInstallInline: () => Promise<any>;
  clampComposerHeight: (height: number) => number;
  clearCustomPiPath: () => Promise<any>;
  clearImages: () => void;
  cloneAgentSession: (...args: any[]) => any;
  closeAgent: (agentId: string) => Promise<any>;
  closeDrawer: () => void;
  collapseDrawer: () => void;
  compactAgent: () => Promise<any>;
  compactRpcLogData: (value: unknown, depth?: number) => unknown;
  copySession: (...args: any[]) => any;
  copySidebarSession: (...args: any[]) => any;
  createAgent: (
    projectId?: string,
    sessionPath?: string,
    title?: string,
    reuseExisting?: boolean,
  ) => Promise<AgentTab | undefined>;
  createBranch: (branchName: string) => Promise<any>;
  cycleThinking: () => Promise<any>;
  dataUrlToImageContent: (
    dataUrl: string,
    fallbackMimeType: string,
  ) => ImageContent;
  deleteHistorySession: (...args: any[]) => any;
  diffFilePath: (path: string) => void;
  discardAttachedImages: () => void;
  ensureComposerTailVisible: () => void;
  executeSlashCommandStage: (...args: any[]) => any;
  exportAgentHtml: (agentId: string) => Promise<any>;
  exportHistorySession: (...args: any[]) => any;
  exportSidebarSession: (...args: any[]) => any;
  fileToImageContent: (file: File) => Promise<ImageContent>;
  finishProjectDrag: (...args: any[]) => any;
  focusComposerTextarea: () => void;
  getComposerMaxHeight: () => number;
  handleAddQuickPromptPreset: () => void;
  handleComposerKeyDown: (
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) => any;
  handleDragOver: (event: DragEvent) => any;
  handleDrop: (event: DragEvent) => Promise<any>;
  handleGoalCommand: (input: string) => any;
  handlePaste: (event: ClipboardEvent) => Promise<any>;
  handleProjectDragLeave: (projectId: string) => any;
  handleProjectDragOver: (
    event: DragEvent<HTMLButtonElement>,
    projectId: string,
  ) => any;
  handleProjectDragStart: (
    event: DragEvent<HTMLButtonElement>,
    projectId: string,
  ) => any;
  handleProjectDrop: (
    event: DragEvent<HTMLButtonElement>,
    targetProjectId: string,
  ) => Promise<any>;
  importClaudeSessions: () => Promise<any>;
  importCodexSessions: (...args: any[]) => any;
  isExtensionSlashCommand: (...args: any[]) => any;
  openAgentRename: (...args: any[]) => any;
  openClaudeImport: (...args: any[]) => any;
  openCodexImport: (...args: any[]) => any;
  openCurrentProjectInVSCode: () => Promise<any>;
  openDrawer: (panel: DrawerPanel) => void;
  openFilePath: (path: string) => void;
  openHistorySession: (...args: any[]) => any;
  openModelPicker: () => Promise<any>;
  openProjectSessions: (...args: any[]) => any;
  openSessionRename: (...args: any[]) => any;
  openSidebarSession: (...args: any[]) => any;
  openSlashCommandStage: (
    command: any,
    promptValue: string,
  ) => Promise<any>;
  processImageFile: (file: File) => Promise<ComposerImage | null>;
  refreshFiles: (projectId?: string) => Promise<any>;
  refreshGitChangedFiles: (projectId?: string) => Promise<any>;
  refreshProjects: () => Promise<any>;
  refreshProjectSessions: (projectId: string) => Promise<any>;
  refreshRuntimeState: (agentId?: string) => Promise<any>;
  refreshSessionHistory: (projectId?: string) => Promise<any>;
  refreshSessions: (projectId?: string) => Promise<any>;
  releaseDiscardedComposerImage: (image: ComposerImage) => void;
  releaseListHoverSuppression: (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  removeImage: (index: number) => void;
  renameHistorySession: (...args: any[]) => any;
  reorderProjects: (
    sourceProjectId: string,
    targetProjectId: string,
  ) => Promise<any>;
  resendUserMessage: (message: ChatMessage) => void;
  resizeImageFile: (
    file: File,
    maxEdge: number,
    quality: number,
  ) => Promise<ImageContent>;
  respondApproval: (response: Record<string, unknown>) => Promise<any>;
  restartAgent: (agentId: string) => Promise<any>;
  scanClaudeSessions: (project?: Project, clearReport?: boolean) => any;
  scanCodexSessions: (...args: any[]) => any;
  scrollToBottom: () => void;
  selectModel: (model: AvailableModel) => Promise<any>;
  selectThinking: (level: string) => Promise<any>;
  sendPrompt: () => Promise<any>;
  sendPromptAsFollowUp: () => Promise<any>;
  setAttachedImages: (
    value: ComposerImage[] | ((current: ComposerImage[]) => ComposerImage[]),
  ) => void;
  setPrompt: (value: string | ((current: string) => string)) => void;
  setTerminalCollapsedForAgent: (agentId: string, collapsed: boolean) => any;
  setTerminalOpenForAgent: (agentId: string, open: boolean) => any;
  showToast: (message: string, duration?: number) => void;
  startComposerResize: (event: ReactPointerEvent) => void;
  startResize: (
    target: "list" | "drawer",
    event: ReactPointerEvent,
  ) => void;
  stripPendingUiSlashMessages: (
    agentId: string,
    messages: ChatMessage[],
  ) => ChatMessage[];
  submitAgentRename: (...args: any[]) => any;
  submitComposerPrompt: (
    message: string,
    images?: ComposerImage[],
  ) => Promise<any>;
  submitPromptSnapshot: (
    agentId: string,
    message: string,
    images?: ComposerImage[],
    streamingBehavior?: "steer" | "followUp",
    uiSlashCommand?: boolean,
  ) => Promise<any>;
  submitSessionRename: (...args: any[]) => any;
  switchBranch: (branch: string) => Promise<any>;
  syncComposerAutoHeight: () => void;
  testPiProxy: () => Promise<any>;
  toggleAllClaudeSessions: () => void;
  toggleAllCodexSessions: (...args: any[]) => any;
  toggleClaudeSession: (sourcePath: string) => void;
  toggleCodexSession: (...args: any[]) => any;
  toggleDirectory: (path: string) => void;
  toggleDrawerPinned: () => void;
  toggleListCollapsed: () => void;
  undoUserMessage: (message: ChatMessage) => void;
  updateAfterProjectRemoved: (removedProjectId: string, next: Project[]) => void;
  updateSettings: (patch: Partial<AppSettings>) => Promise<any>;
  upsertAgentMessagePatch: (
    messages: ChatMessage[],
    patch: AgentMessagePatch,
  ) => ChatMessage[];
  validateCustomPiPath: (options?: { closeDialogOnSuccess?: boolean }) => Promise<any>;
  viewFilePath: (path: string) => void;
}

export type AppContext = AppStateContext & AppActionContext;

export type AppLayoutProps = AppContext;
