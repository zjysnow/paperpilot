/**
 * Compatibility boundary for conversations persisted by removed runtimes.
 *
 * New conversations use the built-in agent runtime. These functions only keep
 * old UI and migration paths type-safe; they must not start a removed backend.
 */

export type CodexNativeApprovalRequest = any;
export type CodexNativeConversationScope = any;
export type CodexNativeDiagnostics = any;
export type CodexNativeSkillContext = any;
export type CodexAppServerModelCatalogEntry = any;
export type ClaudeRuntimeModel = string;

export const NO_CODEX_APP_SERVER_THREAD_TO_COMPACT_MESSAGE =
  "The Codex app-server backend has been removed.";

const removedBackendError = (): never => {
  throw new Error("The Codex and Claude backends have been removed.");
};

export const buildDefaultClaudeGlobalConversationKey = (_libraryID: number) =>
  0;
export const buildDefaultClaudePaperConversationKey = (_paperItemID: number) =>
  0;
export const buildDefaultCodexGlobalConversationKey = (_libraryID: number) => 0;
export const buildDefaultCodexPaperConversationKey = (_paperItemID: number) =>
  0;
export const getCodexProfileSignature = () => "";
export const getCodexRuntimeModelPref = () => "";
export const getCodexReasoningModePref = () => "default";
export const getClaudeReasoningModePref = (): "auto" | "max" => "auto";
export const buildCodexAppServerReasoningConfig = (
  _value: unknown,
): any => ({});
export const getClaudeAutoCompactThresholdPercent = () => 0;
export const isClaudeAutoCompactEnabled = () => false;
export const isCodexAppServerNativeApprovalsEnabled = () => false;
export const isCodexZoteroMcpToolsEnabled = () => false;
export const isCodexAppServerModeEnabled = () => false;
export const getConfiguredCodexAppServerBinaryPath = () => "";
export const getEffectiveCodexAppServerBinaryPath = (..._args: any[]) => "";
export const getClaudeRuntimeModelEntries = (..._args: any[]): any[] => [];
export const getSelectedClaudeRuntimeEntry = (..._args: any[]): any => null;
export const listClaudeEfforts = (..._args: any[]): any[] => [];
export const refreshClaudeSlashCommands = async (..._args: any[]) => undefined;
export const setClaudeReasoningModePref = (_value: unknown) => undefined;
export const setClaudeRuntimeModelPref = (_value: unknown) => undefined;
export const setCodexRuntimeModelPref = (_value: unknown) => undefined;
export const setCodexReasoningModePref = (_value: unknown) => undefined;
export const buildCodexRuntimeModelEntries = (..._args: any[]): any[] => [];
export const getCodexAppServerReasoningChoices = (
  ..._args: any[]
): Array<{ value: string; label: string }> => [];
export const loadCodexAppServerModelCatalog = async (
  ..._args: any[]
): Promise<any> => ({ models: [] });
export const resolveCodexAppServerReasoningSelection = (
  ..._args: any[]
): any => ({ mode: "auto", choices: [] });
export const retainClaudeRuntimeForBody = async (..._args: any[]) => undefined;
export const releaseClaudeRuntimeForBody = async (..._args: any[]) => undefined;
export const touchClaudeConversationTitle = async (..._args: any[]) =>
  undefined;
export const touchCodexConversationTitle = async (..._args: any[]) => undefined;
export const setLastUsedCodexGlobalConversationKey = (
  _libraryID: number,
  _conversationKey: number,
) => undefined;
export const activeClaudeGlobalConversationByLibrary = new Map<
  string,
  number
>();
export const activeCodexGlobalConversationByLibrary = new Map<string, number>();
export const activeClaudeConversationModeByLibrary = new Map<string, string>();
export const activeClaudePaperConversationByPaper = new Map<string, number>();
export const activeCodexConversationModeByLibrary = new Map<string, string>();
export const activeCodexPaperConversationByPaper = new Map<string, number>();
export const buildClaudeLibraryStateKey = (_libraryID: number) => "";
export const buildCodexLibraryStateKey = (_libraryID: number) => "";
export const isClaudeBlockStreamingEnabled = () => false;
export const getClaudeBridgeRuntime = (_runtime: unknown): any =>
  removedBackendError();
export const captureClaudeSessionInfo = async (..._args: any[]) => undefined;
export const buildClaudeScope = (..._args: any[]) => ({});
export const appendClaudeConversationMessage = async (..._args: any[]) =>
  undefined;
export const appendClaudeMessage = appendClaudeConversationMessage;
export const updateLatestClaudeConversationUserMessage = async (
  ..._args: any[]
) => undefined;
export const updateLatestClaudeConversationAssistantMessage = async (
  ..._args: any[]
) => undefined;
export const appendCodexMessage = async (..._args: any[]) => undefined;
export const pruneCodexConversation = async (..._args: any[]) => undefined;
export const updateLatestCodexUserMessage = async (..._args: any[]) =>
  undefined;
export const updateLatestCodexAssistantMessage = async (..._args: any[]) =>
  undefined;
export const resolveCodexNativeApprovalRequest = (_request: unknown): any =>
  removedBackendError();
export const isCodexNativeBuiltInApprovalRequest = (_request: unknown) => false;
export const buildCodexNativeApprovalPendingAction = (_request: unknown): any =>
  removedBackendError();
export const buildCodexNativeApprovalResponseFromResolution = (
  _request: unknown,
  _resolution: unknown,
) => removedBackendError();
export const runCodexAppServerNativeTurn = (..._args: any[]): any =>
  removedBackendError();
export const compactCodexAppServerConversation = (..._args: any[]): any =>
  removedBackendError();
export const getConversationSystemPref = () => "upstream";
export const setConversationSystemPref = (_value: unknown) => undefined;
