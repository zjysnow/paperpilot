declare const Zotero: any;

import {
  conversationRepository,
  type ConversationCatalogEntry,
} from "../../core/conversations/repository";
import { resolveConversationStorageSystem } from "../../shared/conversationStorageRouting";
import type { ConversationSystem } from "../../shared/types";
import { getConversationKey } from "./conversationIdentity";
import {
  buildDefaultClaudeGlobalConversationKey,
  buildDefaultClaudePaperConversationKey,
  buildDefaultCodexGlobalConversationKey,
  buildDefaultCodexPaperConversationKey,
} from "../../utils/removedBackends";
import {
  resolveActiveNoteSession,
  resolveConversationBaseItem,
  resolveConversationKeyForNoteFocus,
  resolveConversationSystemForItem,
  resolveDisplayConversationKind,
  resolvePreferredConversationSystem,
} from "./portalScope";

type ConversationKind = "global" | "paper";

function normalizePositiveInt(value: unknown): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function sameRuntimeScope(
  summary: ConversationCatalogEntry | null,
  params: {
    kind: ConversationKind;
    libraryID: number;
    paperItemID?: number | null;
  },
): summary is ConversationCatalogEntry {
  if (!summary) return false;
  if (summary.kind !== params.kind) return false;
  if (summary.libraryID !== params.libraryID) return false;
  if (params.kind === "paper") {
    return (summary.paperItemID || null) === (params.paperItemID || null);
  }
  return true;
}

function resolveProvisionScope(
  item: Zotero.Item,
  system: ConversationSystem,
): {
  conversationKey: number;
  kind: ConversationKind;
  libraryID: number;
  paperItemID?: number;
} | null {
  const noteScope = resolveActiveNoteSession(item);
  const conversationKey = normalizePositiveInt(
    noteScope
      ? resolveConversationKeyForNoteFocus(item, { conversationSystem: system })
      : getConversationKey(item),
  );
  const kind = resolveDisplayConversationKind(item);
  if (!conversationKey || !kind) return null;
  if (kind === "global") {
    const libraryID = normalizePositiveInt(item?.libraryID);
    return libraryID
      ? {
          conversationKey,
          kind,
          libraryID,
        }
      : null;
  }
  const baseItem = resolveConversationBaseItem(item);
  const paperItemID = normalizePositiveInt(baseItem?.id);
  const libraryID = normalizePositiveInt(
    baseItem?.libraryID || item?.libraryID,
  );
  if (!libraryID || !paperItemID) return null;
  return {
    conversationKey,
    kind,
    libraryID,
    paperItemID,
  };
}

export function resolveConversationStorageSystemForItem(params: {
  item: Zotero.Item;
  conversationSystem?: ConversationSystem | null;
}): ConversationSystem | null {
  const noteScope = resolveActiveNoteSession(params.item);
  const requestedSystem =
    params.conversationSystem ||
    resolveConversationSystemForItem(params.item) ||
    (noteScope
      ? resolvePreferredConversationSystem({ item: params.item })
      : null) ||
    "upstream";
  const conversationKey = normalizePositiveInt(
    noteScope
      ? resolveConversationKeyForNoteFocus(params.item, {
          conversationSystem: requestedSystem,
        })
      : getConversationKey(params.item),
  );
  if (!conversationKey) return null;
  const itemSystem = resolveConversationSystemForItem(params.item);
  return resolveConversationStorageSystem({
    conversationKey,
    conversationSystem: itemSystem || params.conversationSystem,
  });
}

async function provisionUpstreamConversation(scope: {
  conversationKey: number;
  kind: ConversationKind;
  libraryID: number;
  paperItemID?: number;
}): Promise<boolean> {
  return Boolean(
    await conversationRepository.ensureCatalogEntry({
      system: "upstream",
      conversationKey: scope.conversationKey,
      kind: scope.kind,
      libraryID: scope.libraryID,
      paperItemID: scope.paperItemID,
    }),
  );
}

export async function provisionConversationScopeForItem(params: {
  item: Zotero.Item;
  conversationSystem?: ConversationSystem | null;
}): Promise<boolean> {
  const storageSystem = resolveConversationStorageSystemForItem(params);
  if (!storageSystem) return false;
  const scope = resolveProvisionScope(params.item, storageSystem);
  if (!scope) return false;
  try {
    if (storageSystem === "upstream") {
      return await provisionUpstreamConversation(scope);
    }
  } catch (err) {
    const debug = (
      globalThis as typeof globalThis & {
        Zotero?: { debug?: (message: string, err?: unknown) => void };
      }
    ).Zotero?.debug;
    debug?.("LLM: Failed to provision conversation scope", err);
  }
  return false;
}
