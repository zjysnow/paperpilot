import { config } from "../../package.json";

const ENABLE_SUBAGENTS_KEY = `${config.prefsPrefix}.enableSubagents`;

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

export function isSubagentsEnabled(): boolean {
  const value = getPrefs()?.get?.(ENABLE_SUBAGENTS_KEY, true);
  return value === true || `${value || ""}`.toLowerCase() === "true";
}

export function setSubagentsEnabled(value: boolean): void {
  getPrefs()?.set?.(ENABLE_SUBAGENTS_KEY, value, true);
}
