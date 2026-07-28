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
} from "./constants"



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

