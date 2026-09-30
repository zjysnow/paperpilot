import { CONTENT_LIKE_ARGUMENT_KEYS } from "./toolArgumentFields";

const CONTENT_LIKE_ARGUMENT_KEY_SET = new Set(CONTENT_LIKE_ARGUMENT_KEYS);
const RECOVERABLE_JSON_STRING_KEYS = [
  ...CONTENT_LIKE_ARGUMENT_KEYS,
  "command",
] as const;
const CONTENT_LIKE_ARGUMENT_KEY_PATTERN = CONTENT_LIKE_ARGUMENT_KEYS.join("|");
const CONTENT_LIKE_ASSIGNMENT_START_PATTERN = new RegExp(
  `(?:(["'])(?:${CONTENT_LIKE_ARGUMENT_KEY_PATTERN})\\1|\\b(?:${CONTENT_LIKE_ARGUMENT_KEY_PATTERN})\\b)\\s*:\\s*`,
  "gi",
);

export const MALFORMED_TOOL_ARGUMENTS_KEY =
  "__llmForZoteroMalformedToolArguments";

export type MalformedToolArgumentsDiagnostic = {
  [MALFORMED_TOOL_ARGUMENTS_KEY]: true;
  reason: "invalid_json";
  rawPreview: string;
  rawLength: number;
};

function escapeUnescapedJsonControlCharacters(raw: string): string {
  let repaired = "";
  let inString = false;
  let escaped = false;
  for (const character of raw) {
    if (!inString) {
      if (character === '"') inString = true;
      repaired += character;
      continue;
    }
    if (escaped) {
      if (character === "\n") {
        repaired += "n";
      } else if (character === "\r") {
        repaired += "r";
      } else if (character === "\t") {
        repaired += "t";
      } else {
        repaired += character;
      }
      escaped = false;
      continue;
    }
    if (character === "\\") {
      repaired += character;
      escaped = true;
      continue;
    }
    if (character === '"') {
      repaired += character;
      inString = false;
      continue;
    }
    if (character === "\n") {
      repaired += "\\n";
      continue;
    }
    if (character === "\r") {
      repaired += "\\r";
      continue;
    }
    if (character === "\t") {
      repaired += "\\t";
      continue;
    }
    const codePoint = character.charCodeAt(0);
    repaired +=
      codePoint < 0x20
        ? `\\u${codePoint.toString(16).padStart(4, "0")}`
        : character;
  }
  return repaired;
}

function repairRecoverableJsonStringValue(raw: string): unknown | null {
  const keyPattern = RECOVERABLE_JSON_STRING_KEYS.join("|");
  const match = new RegExp(`"(${keyPattern})"\\s*:\\s*"`, "i").exec(raw);
  if (!match || match.index === undefined) return null;
  const valueStart = match.index + match[0].length;
  for (let valueEnd = valueStart; valueEnd < raw.length; valueEnd += 1) {
    if (raw[valueEnd] !== '"') continue;
    const value = raw.slice(valueStart, valueEnd);
    const encodedValue = JSON.stringify(value).slice(1, -1);
    const repaired = `${raw.slice(0, valueStart)}${encodedValue}${raw.slice(valueEnd)}`;
    try {
      return JSON.parse(repaired);
    } catch {
      // The candidate may be a quote within source content or a later field.
    }
  }
  return null;
}

function stripToolArgumentCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n?```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : raw;
}

export function parseToolArgumentsJson(raw: string): unknown | null {
  const candidates = [raw, stripToolArgumentCodeFence(raw)];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      const controlCharacterRepaired =
        escapeUnescapedJsonControlCharacters(candidate);
      try {
        return JSON.parse(controlCharacterRepaired);
      } catch {
        const valueRepaired = repairRecoverableJsonStringValue(candidate);
        if (valueRepaired !== null) return valueRepaired;
      }
    }
  }
  return null;
}

export function isContentLikeToolArgumentKey(key: string): boolean {
  const normalized = key
    .trim()
    .replace(/[-_\s]+/g, "")
    .toLowerCase();
  return CONTENT_LIKE_ARGUMENT_KEY_SET.has(
    normalized as (typeof CONTENT_LIKE_ARGUMENT_KEYS)[number],
  );
}

function redactContentLikeAssignments(raw: string): string {
  CONTENT_LIKE_ASSIGNMENT_START_PATTERN.lastIndex = 0;
  let redacted = "";
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = CONTENT_LIKE_ASSIGNMENT_START_PATTERN.exec(raw))) {
    const valueStart = match.index + match[0].length;
    const valueEnd = findToolArgumentValueEnd(raw, valueStart);
    redacted += raw.slice(cursor, valueStart) + '"[redacted]"';
    cursor = valueEnd;
    CONTENT_LIKE_ASSIGNMENT_START_PATTERN.lastIndex = valueEnd;
  }
  return redacted + raw.slice(cursor);
}

function findToolArgumentValueEnd(raw: string, valueStart: number): number {
  const quote = raw[valueStart];
  if (quote === '"' || quote === "'" || quote === "`") {
    for (let index = valueStart + 1; index < raw.length; index += 1) {
      if (raw[index] === "\\") {
        index += 1;
        continue;
      }
      if (raw[index] === quote) return index + 1;
    }
    return raw.length;
  }
  for (let index = valueStart; index < raw.length; index += 1) {
    const char = raw[index];
    if (char === "," && startsNextToolArgumentField(raw, index)) return index;
  }
  return raw.length;
}

function startsNextToolArgumentField(raw: string, commaIndex: number): boolean {
  let index = commaIndex + 1;
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  const quote = raw[index];
  if (quote === '"' || quote === "'") {
    index += 1;
    while (index < raw.length && raw[index] !== quote) index += 1;
    if (raw[index] !== quote) return false;
    index += 1;
  } else {
    const keyMatch = /^[A-Za-z_$][\w$-]*/.exec(raw.slice(index));
    if (!keyMatch) return false;
    index += keyMatch[0].length;
  }
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  return raw[index] === ":";
}

export function redactToolArgumentPreview(
  raw: string,
  maxLength = 320,
): string {
  const redacted = redactContentLikeAssignments(raw).replace(/\s+/g, " ");
  if (redacted.length <= maxLength) return redacted;
  return `${redacted.slice(0, maxLength)}...[truncated ${
    redacted.length - maxLength
  } chars]`;
}

export function createMalformedToolArgumentsDiagnostic(
  raw: unknown,
): MalformedToolArgumentsDiagnostic {
  const text = typeof raw === "string" ? raw : String(raw ?? "");
  return {
    [MALFORMED_TOOL_ARGUMENTS_KEY]: true,
    reason: "invalid_json",
    rawPreview: redactToolArgumentPreview(text),
    rawLength: text.length,
  };
}

export function isMalformedToolArgumentsDiagnostic(
  value: unknown,
): value is MalformedToolArgumentsDiagnostic {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>)[MALFORMED_TOOL_ARGUMENTS_KEY] === true,
  );
}
