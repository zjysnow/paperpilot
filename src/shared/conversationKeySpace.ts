import type { ConversationSystem } from "./types";

export type ConversationKeyKind = "global" | "paper";

export type ConversationKeyClassification = {
  system: ConversationSystem;
  kind: ConversationKeyKind;
};

export type ConversationKeyRange = {
  start: number;
  endExclusive: number;
};

export const UPSTREAM_PAPER_CONVERSATION_KEY_BASE = 1_500_000_000;
export const UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE = 2_000_000_000;
export const UPSTREAM_GLOBAL_ALLOCATED_CONVERSATION_KEY_BASE = 2_500_000_000;
export const UPSTREAM_RUNTIME_CONVERSATION_KEY_END = 3_000_000_000;

function normalizeConversationKey(value: number): number | null {
  if (!Number.isFinite(value)) return null;
  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

function normalizeScopeId(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function containsKey(range: ConversationKeyRange, value: number): boolean {
  const normalized = normalizeConversationKey(value);
  return Boolean(
    normalized && normalized >= range.start && normalized < range.endExclusive,
  );
}

function fullKindRange(
  system: ConversationSystem,
  kind: ConversationKeyKind,
): ConversationKeyRange {
  if (system === "upstream") {
    return kind === "global"
      ? {
          start: UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE,
          endExclusive: UPSTREAM_RUNTIME_CONVERSATION_KEY_END,
        }
      : {
          start: 1,
          endExclusive: UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE,
        };
  }
  return kind === "global"
    ? {
        start: UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE,
        endExclusive: UPSTREAM_RUNTIME_CONVERSATION_KEY_END,
      }
    : {
        start: 1,
        endExclusive: UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE,
      };
}

export function getConversationKeyRange(
  system: ConversationSystem,
  kind: ConversationKeyKind,
  profileSignature?: string | null,
): ConversationKeyRange {
  return fullKindRange(system, kind);
}

export function buildDefaultConversationKey(
  system: ConversationSystem,
  kind: ConversationKeyKind,
  scopeId: number,
  profileSignature?: string | null,
): number {
  if (system === "upstream") {
    if (kind === "global") {
      return UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE + normalizeScopeId(scopeId);
    }
    return normalizeScopeId(scopeId);
  }
  return kind === "global"
    ? UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE + normalizeScopeId(scopeId)
    : normalizeScopeId(scopeId);
}

export function buildDefaultUpstreamGlobalConversationKey(
  libraryID: number,
): number {
  return buildDefaultConversationKey("upstream", "global", libraryID);
}

export function classifyConversationKey(
  value: number,
): ConversationKeyClassification | null {
  const key = normalizeConversationKey(value);
  if (!key) return null;
  const kind: ConversationKeyKind =
    key >= UPSTREAM_GLOBAL_CONVERSATION_KEY_BASE ? "global" : "paper";
  if (containsKey(fullKindRange("upstream", kind), key)) {
    return { system: "upstream", kind };
  }
  return null;
}

export function isConversationKeyFor(
  system: ConversationSystem,
  key: number,
): boolean {
  return classifyConversationKey(key)?.system === system;
}

export function isConversationKeyForKind(
  system: ConversationSystem,
  kind: ConversationKeyKind,
  key: number,
): boolean {
  const classification = classifyConversationKey(key);
  return classification?.system === system && classification.kind === kind;
}

export function isConversationKeyInRange(
  key: number,
  range: ConversationKeyRange,
): boolean {
  return containsKey(range, key);
}
