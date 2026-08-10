import { config } from "../../package.json";
import {
  UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE,
  isConversationKeyForKind,
} from "./conversationKeySpace";

type ZoteroPrefsAPI = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
};

function getZoteroPrefs(): ZoteroPrefsAPI | null {
  return (
    (globalThis as typeof globalThis & { Zotero?: { Prefs?: ZoteroPrefsAPI } })
      .Zotero?.Prefs || null
  );
}

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

function getStringPref(key: string): string {
  const value = getZoteroPrefs()?.get?.(prefKey(key), true);
  return typeof value === "string" ? value : "";
}

function setPref(key: string, value: unknown): void {
  getZoteroPrefs()?.set?.(prefKey(key), value, true);
}

function getNumberPref(key: string): number | null {
  const value = getZoteroPrefs()?.get?.(prefKey(key), true);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function getJsonNumberMapPref(key: string): Record<string, number> {
  const raw = getStringPref(key).trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [entryKey, entryValue] of Object.entries(parsed)) {
      const value = Number(entryValue);
      if (!Number.isFinite(value) || value <= 0) continue;
      out[entryKey] = Math.floor(value);
    }
    return out;
  } catch {
    return {};
  }
}

function setJsonNumberMapPref(
  key: string,
  value: Record<string, number>,
): void {
  setPref(key, JSON.stringify(value));
}

function cleanJsonNumberMapPref(
  key: string,
  keep: (entryKey: string, value: number) => boolean,
): void {
  const map = getJsonNumberMapPref(key);
  const filtered: Record<string, number> = {};
  let changed = false;
  for (const [entryKey, value] of Object.entries(map)) {
    if (keep(entryKey, value)) {
      filtered[entryKey] = value;
    } else {
      changed = true;
    }
  }
  if (changed) {
    setJsonNumberMapPref(key, filtered);
  }
}

function cleanScalarConversationKeyPref(
  key: string,
  keep: (value: number) => boolean,
): void {
  const value = getNumberPref(key);
  if (value && !keep(value)) {
    setPref(key, 0);
  }
}

function isUpstreamPaperConversationKeyForPrefs(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value < UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE
  );
}

export function cleanupRememberedConversationKeyPrefs(): void {
  const prefs = getZoteroPrefs();
  if (!prefs?.get || !prefs.set) return;

  cleanJsonNumberMapPref("lastUsedPaperConversationMap", (_key, value) =>
    isUpstreamPaperConversationKeyForPrefs(value),
  );
  cleanJsonNumberMapPref("lastUsedGlobalConversationMap", (_key, value) =>
    isConversationKeyForKind("upstream", "global", value),
  );
}
