import {
    config,
    FONT_SCALE_DEFAULT_PERCENT,
    FONT_SCALE_MIN_PERCENT,
    FONT_SCALE_MAX_PERCENT,
    MESSAGE_LINE_SPACING_DEFAULT_PERCENT,
    MESSAGE_LINE_SPACING_MIN_PERCENT,
    MESSAGE_LINE_SPACING_MAX_PERCENT,
    MESSAGE_PARAGRAPH_SPACING_DEFAULT_PX,
    MESSAGE_PARAGRAPH_SPACING_MIN_PX,
    MESSAGE_PARAGRAPH_SPACING_MAX_PX,
    MESSAGE_WORD_SPACING_DEFAULT_PX,
    MESSAGE_WORD_SPACING_MIN_PX,
    MESSAGE_WORD_SPACING_MAX_PX,
    GLOBAL_CONVERSATION_KEY_BASE,
    buildDefaultUpstreamGlobalConversationKey,
    isUpstreamGlobalConversationKey,
} from "./constants"

import {
  selectedModelCache,
  panelFontScalePercent,
  messageLineSpacingPercent,
  messageParagraphSpacingPx,
  messageWordSpacingPx,
  messageFontFamily,
} from "./state";


type ZoteroPrefsAPI = {
    get?: (key: string, global?: boolean) => unknown;
    set?: (key: string, value: unknown, global?: boolean) => void;
    clear?: (key: string, global?: boolean) => void;
};

function getZoteroPrefs(): ZoteroPrefsAPI | null {
    return (
        (Zotero as unknown as { Prefs?: ZoteroPrefsAPI } | undefined)?.Prefs || null
    );
}

export function getStringPref(key: string): string {
    const value = getZoteroPrefs()?.get?.(`${config.prefsPrefix}.${key}`, true);
    return typeof value === "string" ? value : "";
}

export function getBoolPref(key: string, defaultValue = false): boolean {
    const value = getZoteroPrefs()?.get?.(`${config.prefsPrefix}.${key}`, true);
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") return true;
        if (normalized === "false") return false;
    }
    return defaultValue;
}


const PANEL_FONT_SCALE_PREF_KEY = "panelFontScale";
const MESSAGE_LINE_SPACING_PREF_KEY = "messageLineSpacing";
const MESSAGE_PARAGRAPH_SPACING_PREF_KEY = "messageParagraphSpacing";
const MESSAGE_WORD_SPACING_PREF_KEY = "messageWordSpacing";
const MESSAGE_FONT_FAMILY_PREF_KEY = "messageFontFamily";
const LAST_PAPER_CONVERSATION_MAP_PREF_KEY = "lastUsedPaperConversationMap";
const GENERIC_FONT_FAMILIES = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "emoji",
  "math",
  "fangsong",
]);

export function getFontScalePref(): number {
  const raw = getZoteroPrefs()?.get?.(
    `${config.prefsPrefix}.${PANEL_FONT_SCALE_PREF_KEY}`,
    true,
  );
  const n = Number(raw);
  if (!Number.isFinite(n)) return FONT_SCALE_DEFAULT_PERCENT;
  return Math.max(FONT_SCALE_MIN_PERCENT, Math.min(n, FONT_SCALE_MAX_PERCENT));
}

export function setFontScalePref(value: number): void {
  const clamped = Math.max(
    FONT_SCALE_MIN_PERCENT,
    Math.min(value, FONT_SCALE_MAX_PERCENT),
  );
  getZoteroPrefs()?.set?.(
    `${config.prefsPrefix}.${PANEL_FONT_SCALE_PREF_KEY}`,
    clamped,
    true,
  );
}

export function getMessageLineSpacingPref(): number {
  const raw = getZoteroPrefs()?.get?.(
    `${config.prefsPrefix}.${MESSAGE_LINE_SPACING_PREF_KEY}`,
    true,
  );
  const n = Number(raw);
  if (!Number.isFinite(n)) return MESSAGE_LINE_SPACING_DEFAULT_PERCENT;
  return Math.max(
    MESSAGE_LINE_SPACING_MIN_PERCENT,
    Math.min(n, MESSAGE_LINE_SPACING_MAX_PERCENT),
  );
}

export function setMessageLineSpacingPref(value: number): void {
  const clamped = Math.max(
    MESSAGE_LINE_SPACING_MIN_PERCENT,
    Math.min(value, MESSAGE_LINE_SPACING_MAX_PERCENT),
  );
  getZoteroPrefs()?.set?.(
    `${config.prefsPrefix}.${MESSAGE_LINE_SPACING_PREF_KEY}`,
    clamped,
    true,
  );
}


export function getMessageParagraphSpacingPref(): number {
  const raw = getZoteroPrefs()?.get?.(
    `${config.prefsPrefix}.${MESSAGE_PARAGRAPH_SPACING_PREF_KEY}`,
    true,
  );
  const n = Number(raw);
  if (!Number.isFinite(n)) return MESSAGE_PARAGRAPH_SPACING_DEFAULT_PX;
  return Math.max(
    MESSAGE_PARAGRAPH_SPACING_MIN_PX,
    Math.min(n, MESSAGE_PARAGRAPH_SPACING_MAX_PX),
  );
}

export function setMessageParagraphSpacingPref(value: number): void {
  const clamped = Math.max(
    MESSAGE_PARAGRAPH_SPACING_MIN_PX,
    Math.min(value, MESSAGE_PARAGRAPH_SPACING_MAX_PX),
  );
  getZoteroPrefs()?.set?.(
    `${config.prefsPrefix}.${MESSAGE_PARAGRAPH_SPACING_PREF_KEY}`,
    clamped,
    true,
  );
}


export function getMessageWordSpacingPref(): number {
  const raw = getZoteroPrefs()?.get?.(
    `${config.prefsPrefix}.${MESSAGE_WORD_SPACING_PREF_KEY}`,
    true,
  );
  const n = Number(raw);
  if (!Number.isFinite(n)) return MESSAGE_WORD_SPACING_DEFAULT_PX;
  return Math.max(
    MESSAGE_WORD_SPACING_MIN_PX,
    Math.min(n, MESSAGE_WORD_SPACING_MAX_PX),
  );
}

export function setMessageWordSpacingPref(value: number): void {
  const clamped = Math.max(
    MESSAGE_WORD_SPACING_MIN_PX,
    Math.min(value, MESSAGE_WORD_SPACING_MAX_PX),
  );
  getZoteroPrefs()?.set?.(
    `${config.prefsPrefix}.${MESSAGE_WORD_SPACING_PREF_KEY}`,
    clamped,
    true,
  );
}


export function getMessageFontFamilyPref(): string {
  const raw = getZoteroPrefs()?.get?.(
    `${config.prefsPrefix}.${MESSAGE_FONT_FAMILY_PREF_KEY}`,
    true,
  );
  return typeof raw === "string" ? raw : "";
}

export function setMessageFontFamilyPref(value: string): void {
  getZoteroPrefs()?.set?.(
    `${config.prefsPrefix}.${MESSAGE_FONT_FAMILY_PREF_KEY}`,
    value,
    true,
  );
}


export function buildPaperStateKey(
  libraryID: number,
  paperItemID: number,
): string {
  return `${Math.floor(libraryID)}:${Math.floor(paperItemID)}`;
}


function getLastPaperConversationMap(): Record<string, number> {
  const raw = getZoteroPrefs()?.get?.(
    `${config.prefsPrefix}.${LAST_PAPER_CONVERSATION_MAP_PREF_KEY}`,
    true,
  );
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normalized = Number(value);
      if (!Number.isFinite(normalized) || normalized <= 0) continue;
      out[key] = Math.floor(normalized);
    }
    return out;
  } catch (_err) {
    return {};
  }
}

export function getLastUsedPaperConversationKey(
  libraryID: number,
  paperItemID: number,
): number | null {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return null;
  if (!Number.isFinite(paperItemID) || paperItemID <= 0) return null;
  const map = getLastPaperConversationMap();
  const key = buildPaperStateKey(libraryID, paperItemID);
  const value = Number(map[key]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.floor(value);
}

function setLastPaperConversationMap(value: Record<string, number>): void {
  getZoteroPrefs()?.set?.(
    `${config.prefsPrefix}.${LAST_PAPER_CONVERSATION_MAP_PREF_KEY}`,
    JSON.stringify(value),
    true,
  );
}

export function setLastUsedPaperConversationKey(
  libraryID: number,
  paperItemID: number,
  conversationKey: number,
): void {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return;
  if (!Number.isFinite(paperItemID) || paperItemID <= 0) return;
  if (!Number.isFinite(conversationKey) || conversationKey <= 0) return;
  const map = getLastPaperConversationMap();
  const key = buildPaperStateKey(libraryID, paperItemID);
  map[key] = Math.floor(conversationKey);
  setLastPaperConversationMap(map);
}

export function removeLastUsedPaperConversationKey(
  libraryID: number,
  paperItemID: number,
): void {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return;
  if (!Number.isFinite(paperItemID) || paperItemID <= 0) return;
  const map = getLastPaperConversationMap();
  const key = buildPaperStateKey(libraryID, paperItemID);
  if (!(key in map)) return;
  delete map[key];
  setLastPaperConversationMap(map);
}


// =============================================================================
// Locked Global Conversation Preference
// =============================================================================

const LOCKED_GLOBAL_CONVERSATION_PREF_KEY = "lockedGlobalConversation";

/**
 * Returns the conversation key that is locked as the default open-chat session
 * for the given library, or null if no lock is active.
 */
export function getLockedGlobalConversationKey(
  libraryID: number,
): number | null {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return null;
  const prefKey = `${config.prefsPrefix}.${LOCKED_GLOBAL_CONVERSATION_PREF_KEY}.${Math.floor(libraryID)}`;
  const raw = getZoteroPrefs()?.get?.(prefKey, true);
  const normalized = Number(raw);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  const conversationKey = Math.floor(normalized);
  if (conversationKey === GLOBAL_CONVERSATION_KEY_BASE) {
    return buildDefaultUpstreamGlobalConversationKey(libraryID);
  }
  return isUpstreamGlobalConversationKey(conversationKey)
    ? conversationKey
    : null;
}



function stripFontFamilyQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return trimmed;
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === `"` && last === `"`) || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}


function formatFontFamilyToken(raw: string): string | null {
  const token = stripFontFamilyQuotes(
    raw
      .replace(/[\n\r;]/g, " ")
      .replace(/[{}]/g, "")
      .trim(),
  );
  if (!token) return null;
  const lower = token.toLowerCase();
  if (GENERIC_FONT_FAMILIES.has(lower)) return lower;
  if (/^-?[A-Za-z_][A-Za-z0-9_-]*$/.test(token)) return token;
  return `"${token.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}



export function formatMessageFontFamilyCssValue(value: string): string {
  const tokens = value
    .split(",")
    .map(formatFontFamilyToken)
    .filter((token): token is string => Boolean(token));
  if (!tokens.length) return "inherit";
  const hasGenericFallback = tokens.some((token) =>
    GENERIC_FONT_FAMILIES.has(token.toLowerCase()),
  );
  if (!hasGenericFallback) tokens.push("sans-serif");
  return tokens.join(", ");
}



export function applyPanelFontScale(panel: HTMLElement | null): void {
  if (!panel) return;
  panel.style.setProperty("--paperpilot-font-scale", `${panelFontScalePercent / 100}`);
  panel.style.setProperty(
    "--paperpilot-message-line-height",
    `${messageLineSpacingPercent / 100}`,
  );
  panel.style.setProperty(
    "--paperpilot-message-paragraph-spacing",
    `${messageParagraphSpacingPx}px`,
  );
  panel.style.setProperty(
    "--paperpilot-message-word-spacing",
    `${messageWordSpacingPx}px`,
  );
  panel.style.setProperty(
    "--paperpilot-message-font-family",
    formatMessageFontFamilyCssValue(messageFontFamily),
  );
}





/**
 * Locks (or unlocks) a global-chat session as the default for the given library.
 * Pass null or 0 to clear the lock.
 */
export function setLockedGlobalConversationKey(
  libraryID: number,
  key: number | null,
): void {
  if (!Number.isFinite(libraryID) || libraryID <= 0) return;
  const prefKey = `${config.prefsPrefix}.${LOCKED_GLOBAL_CONVERSATION_PREF_KEY}.${Math.floor(libraryID)}`;
  if (key === null || !Number.isFinite(key) || key <= 0) {
    getZoteroPrefs()?.set?.(prefKey, 0, true);
  } else {
    getZoteroPrefs()?.set?.(prefKey, Math.floor(key), true);
  }
}


