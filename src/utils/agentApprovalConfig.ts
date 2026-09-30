import { config } from "../../package.json";

const AGENT_APPROVAL_MODE_KEY = `${config.prefsPrefix}.agentApprovalMode`;

export type AgentApprovalMode = "default" | "allow_all";

export const DEFAULT_AGENT_APPROVAL_TIMEOUT_MS = 5 * 60 * 1000;

type ZoteroPrefsLike = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
};

function getPrefs(): ZoteroPrefsLike | null {
  return (
    (
      globalThis as typeof globalThis & {
        Zotero?: { Prefs?: ZoteroPrefsLike };
      }
    ).Zotero?.Prefs || null
  );
}

export function getAgentApprovalMode(): AgentApprovalMode {
  return getPrefs()?.get?.(AGENT_APPROVAL_MODE_KEY, true) === "allow_all"
    ? "allow_all"
    : "default";
}

export function setAgentApprovalMode(mode: AgentApprovalMode): void {
  getPrefs()?.set?.(AGENT_APPROVAL_MODE_KEY, mode, true);
}
