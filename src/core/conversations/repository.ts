import { isConversationKeyForKind } from "../../shared/conversationKeySpace";
import { repairRegisteredConversationScope } from "../../shared/conversationRegistry";
import type {
  ConversationSystem,
  GlobalConversationSummary,
  PaperConversationSummary,
} from "../../shared/types";
import {
  clearConversationTitle,
  createGlobalConversation,
  createPaperConversation,
  deleteUpstreamConversationLocalRows,
  deleteGlobalConversation,
  deletePaperConversation,
  deleteTurnMessages as deleteUpstreamTurnMessages,
  ensureGlobalConversationExists,
  ensurePaperV1Conversation,
  forkUpstreamConversationMessages,
  getGlobalConversation,
  getPaperConversation,
  loadConversation as loadUpstreamConversation,
  listAllPaperConversationsByLibrary,
  listGlobalConversations,
  listPaperConversations,
  preflightDeleteUpstreamConversationLocalRows,
  setGlobalConversationTitle,
  setPaperConversationTitle,
  touchEmptyGlobalConversation,
  touchEmptyPaperConversation,
  touchGlobalConversationTitle,
  touchPaperConversationTitle,
  type StoredChatMessage,
} from "../../utils/chatStore";

import {
  deleteConversationForkLink,
  recordConversationForkLink,
  type ConversationForkLink,
} from "../../shared/conversationForkLinks";

export type ConversationCatalogKind = "global" | "paper";

export type ConversationCatalogEntry = {
  conversationID: string;
  conversationKey: number;
  system: ConversationSystem;
  kind: ConversationCatalogKind;
  libraryID: number;
  createdAt: number;
  lastActivityAt: number;
  title?: string;
  userTurnCount: number;
  paperItemID?: number;
  sessionVersion?: number;
  providerSessionId?: string;
  scopedConversationKey?: string;
  scopeType?: string;
  scopeId?: string;
  scopeLabel?: string;
  cwd?: string;
  model?: string;
  effort?: string;
};

export type ConversationCatalogScope = {
  system: ConversationSystem;
  kind: ConversationCatalogKind;
  libraryID: number;
  paperItemID?: number;
};

type ConversationCatalogListParams = ConversationCatalogScope & {
  limit?: number;
  includeEmpty?: boolean;
};

type ConversationCatalogMutationTarget = {
  system: ConversationSystem;
  conversationKey: number;
  kind?: ConversationCatalogKind;
};

type ConversationMessageTarget = {
  system: ConversationSystem;
  conversationKey: number;
};

type DeleteTurnMessagesParams = ConversationMessageTarget & {
  userTimestamp: number;
  assistantTimestamp: number;
};

type EnsureCatalogEntryParams = ConversationCatalogScope & {
  conversationKey?: number;
  title?: string;
};

type CreateCatalogEntryParams = ConversationCatalogScope;

type ForkConversationParams = ConversationCatalogScope & {
  sourceConversationKey: number;
  throughAssistantTimestamp: number;
  title?: string;
};

export type ForkConversationResult = {
  entry: ConversationCatalogEntry;
  copiedMessageCount: number;
  targetAnchorAssistantTimestamp: number;
  forkLink: ConversationForkLink;
};

function normalizePositiveInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function normalizeLimit(value: unknown, fallback = 50): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.max(1, Math.floor(parsed));
}

function normalizeTitle(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeTimestamp(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizeUserTurnCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function isUpstreamGlobalConversationKey(conversationKey: number): boolean {
  return isConversationKeyForKind("upstream", "global", conversationKey);
}

function isUpstreamPaperConversationKey(conversationKey: number): boolean {
  return isConversationKeyForKind("upstream", "paper", conversationKey);
}

function fromUpstreamGlobalSummary(
  summary: GlobalConversationSummary | null | undefined,
): ConversationCatalogEntry | null {
  if (!summary) return null;
  const conversationKey = normalizePositiveInt(summary.conversationKey);
  const libraryID = normalizePositiveInt(summary.libraryID);
  const createdAt = normalizeTimestamp(summary.createdAt);
  if (
    !conversationKey ||
    !isUpstreamGlobalConversationKey(conversationKey) ||
    !libraryID ||
    !createdAt
  ) {
    return null;
  }
  const lastActivityAt = normalizeTimestamp(summary.lastActivityAt, createdAt);
  return {
    conversationID: summary.conversationID,
    conversationKey,
    system: "upstream",
    kind: "global",
    libraryID,
    createdAt,
    lastActivityAt,
    title: normalizeTitle(summary.title),
    userTurnCount: normalizeUserTurnCount(summary.userTurnCount),
  };
}

function fromUpstreamPaperSummary(
  summary: PaperConversationSummary | null | undefined,
): ConversationCatalogEntry | null {
  if (!summary) return null;
  const conversationKey = normalizePositiveInt(summary.conversationKey);
  const libraryID = normalizePositiveInt(summary.libraryID);
  const paperItemID = normalizePositiveInt(summary.paperItemID);
  const sessionVersion = normalizePositiveInt(summary.sessionVersion);
  const createdAt = normalizeTimestamp(summary.createdAt);
  if (
    !conversationKey ||
    !isUpstreamPaperConversationKey(conversationKey) ||
    !libraryID ||
    !paperItemID ||
    !sessionVersion ||
    !createdAt
  ) {
    return null;
  }
  const lastActivityAt = normalizeTimestamp(summary.lastActivityAt, createdAt);
  return {
    conversationID: summary.conversationID,
    conversationKey,
    system: "upstream",
    kind: "paper",
    libraryID,
    paperItemID,
    sessionVersion,
    createdAt,
    lastActivityAt,
    title: normalizeTitle(summary.title),
    userTurnCount: normalizeUserTurnCount(summary.userTurnCount),
  };
}

async function repairUpstreamRuntimeRegistryFromEntry(
  entry: ConversationCatalogEntry,
): Promise<boolean> {
  if (entry.system !== "upstream") return true;
  if (
    !isConversationKeyForKind("upstream", entry.kind, entry.conversationKey)
  ) {
    return false;
  }
  return await repairRegisteredConversationScope({
    conversationID: entry.conversationID,
    conversationKey: entry.conversationKey,
    system: "upstream",
    kind: entry.kind,
    libraryID: entry.libraryID,
    paperItemID: entry.paperItemID,
    createdAt: entry.createdAt,
    updatedAt: entry.lastActivityAt,
    title: entry.title,
  });
}

function sortCatalogEntries(
  entries: ConversationCatalogEntry[],
): ConversationCatalogEntry[] {
  return entries.sort((a, b) => {
    if (b.lastActivityAt !== a.lastActivityAt) {
      return b.lastActivityAt - a.lastActivityAt;
    }
    return b.conversationKey - a.conversationKey;
  });
}

function catalogEntryMatchesScope(
  entry: ConversationCatalogEntry | null,
  scope: ConversationCatalogScope,
): entry is ConversationCatalogEntry {
  if (!entry) return false;
  if (entry.system !== scope.system) return false;
  if (entry.kind !== scope.kind) return false;
  if (entry.libraryID !== normalizePositiveInt(scope.libraryID)) return false;
  if (scope.kind === "paper") {
    return (
      normalizePositiveInt(entry.paperItemID) ===
      normalizePositiveInt(scope.paperItemID)
    );
  }
  return true;
}

export const conversationRepository = {
  async getCatalogEntry(
    target: ConversationCatalogMutationTarget,
  ): Promise<ConversationCatalogEntry | null> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return null;

    if (
      target.kind === "global" ||
      isUpstreamGlobalConversationKey(conversationKey)
    ) {
      return fromUpstreamGlobalSummary(
        await getGlobalConversation(conversationKey),
      );
    }
    if (
      target.kind === "paper" ||
      isUpstreamPaperConversationKey(conversationKey)
    ) {
      return fromUpstreamPaperSummary(
        await getPaperConversation(conversationKey),
      );
    }
    return null;
  },

  async loadMessages(
    target: ConversationMessageTarget & { limit?: number },
  ): Promise<StoredChatMessage[]> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return [];
    const limit = normalizeLimit(target.limit, 200);

    return loadUpstreamConversation(conversationKey, limit);
  },

  async deleteTurnMessages(target: DeleteTurnMessagesParams): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;
    const userTimestamp = normalizeTimestamp(target.userTimestamp);
    const assistantTimestamp = normalizeTimestamp(target.assistantTimestamp);

    await deleteUpstreamTurnMessages(
      conversationKey,
      userTimestamp,
      assistantTimestamp,
    );
  },

  async ensureCatalogEntry(
    params: EnsureCatalogEntryParams,
  ): Promise<ConversationCatalogEntry | null> {
    const libraryID = normalizePositiveInt(params.libraryID);
    const paperItemID = normalizePositiveInt(params.paperItemID);
    const conversationKey = normalizePositiveInt(params.conversationKey);
    if (!libraryID) return null;

    if (params.kind === "global") {
      if (!conversationKey) return null;
      const ensured = await ensureGlobalConversationExists(
        libraryID,
        conversationKey,
      );
      if (!ensured) return null;
      const entry = fromUpstreamGlobalSummary(
        await getGlobalConversation(conversationKey),
      );
      if (!catalogEntryMatchesScope(entry, params)) return null;
      return (await repairUpstreamRuntimeRegistryFromEntry(entry))
        ? entry
        : null;
    }
    if (!paperItemID) return null;
    const entry = fromUpstreamPaperSummary(
      conversationKey && conversationKey !== paperItemID
        ? await getPaperConversation(conversationKey)
        : await ensurePaperV1Conversation(libraryID, paperItemID),
    );
    if (!catalogEntryMatchesScope(entry, params)) return null;
    return (await repairUpstreamRuntimeRegistryFromEntry(entry)) ? entry : null;
  },

  async createCatalogEntry(
    params: CreateCatalogEntryParams,
  ): Promise<ConversationCatalogEntry | null> {
    const libraryID = normalizePositiveInt(params.libraryID);
    const paperItemID = normalizePositiveInt(params.paperItemID);
    if (!libraryID) return null;

    if (params.kind === "paper") {
      return fromUpstreamPaperSummary(
        paperItemID
          ? await createPaperConversation(libraryID, paperItemID)
          : null,
      );
    }
    const conversationKey = await createGlobalConversation(libraryID);
    return conversationKey
      ? fromUpstreamGlobalSummary(await getGlobalConversation(conversationKey))
      : null;
  },

  async forkConversation(
    params: ForkConversationParams,
  ): Promise<ForkConversationResult | null> {
    if (params.system !== "upstream") return null;
    const libraryID = normalizePositiveInt(params.libraryID);
    const paperItemID = normalizePositiveInt(params.paperItemID);
    const sourceConversationKey = normalizePositiveInt(
      params.sourceConversationKey,
    );
    const throughAssistantTimestamp = normalizeTimestamp(
      params.throughAssistantTimestamp,
    );
    if (!libraryID || !sourceConversationKey || !throughAssistantTimestamp) {
      return null;
    }
    if (params.kind === "paper" && !paperItemID) return null;

    const sourceEntry = await conversationRepository.getCatalogEntry({
      system: params.system,
      kind: params.kind,
      conversationKey: sourceConversationKey,
    });
    if (!catalogEntryMatchesScope(sourceEntry, params)) return null;
    const entry = await conversationRepository.createCatalogEntry({
      system: params.system,
      kind: params.kind,
      libraryID,
      paperItemID,
    });
    if (!entry) return null;

    const cleanupForkEntry = async () => {
      await conversationRepository.deleteCatalogEntry({
        system: params.system,
        kind: entry.kind,
        conversationKey: entry.conversationKey,
      });
    };
    let copiedMessageCount;
    let targetAnchorAssistantTimestamp;
    try {
      const copyResult = await forkUpstreamConversationMessages({
        sourceConversationKey,
        targetConversationKey: entry.conversationKey,
        throughAssistantTimestamp,
        timestampBase: Date.now(),
      });
      copiedMessageCount = copyResult.copiedMessageCount;
      targetAnchorAssistantTimestamp =
        copyResult.targetAnchorAssistantTimestamp;
    } catch (err) {
      await cleanupForkEntry();
      throw err;
    }
    if (copiedMessageCount <= 0 || targetAnchorAssistantTimestamp <= 0) {
      await cleanupForkEntry();
      return null;
    }

    const titleSeed =
      normalizeTitle(params.title) ||
      normalizeTitle(sourceEntry?.title) ||
      "Forked chat";
    await conversationRepository.setCatalogTitle({
      system: params.system,
      kind: entry.kind,
      conversationKey: entry.conversationKey,
      title: `Fork: ${titleSeed}`,
    });

    const refreshed = await conversationRepository.getCatalogEntry({
      system: params.system,
      kind: entry.kind,
      conversationKey: entry.conversationKey,
    });
    const resultEntry = refreshed || entry;
    const forkLink = await recordConversationForkLink({
      targetConversationKey: resultEntry.conversationKey,
      targetConversationID: resultEntry.conversationID,
      targetSystem: params.system,
      targetKind: resultEntry.kind,
      sourceConversationKey,
      sourceConversationID: sourceEntry.conversationID,
      sourceSystem: params.system,
      sourceKind: sourceEntry.kind,
      sourceLibraryID: sourceEntry.libraryID,
      sourcePaperItemID: sourceEntry.paperItemID,
      sourceAssistantTimestamp: throughAssistantTimestamp,
      targetAnchorAssistantTimestamp,
      createdAt: Date.now(),
    }).catch(async (err) => {
      await cleanupForkEntry();
      throw err;
    });
    return {
      entry: resultEntry,
      copiedMessageCount,
      targetAnchorAssistantTimestamp,
      forkLink,
    };
  },

  async listCatalogEntries(
    params: ConversationCatalogListParams,
  ): Promise<ConversationCatalogEntry[]> {
    const libraryID = normalizePositiveInt(params.libraryID);
    const paperItemID = normalizePositiveInt(params.paperItemID);
    const limit = normalizeLimit(params.limit);
    if (!libraryID) return [];

    const rows =
      params.kind === "paper"
        ? await listPaperConversations(
            libraryID,
            paperItemID,
            limit,
            Boolean(params.includeEmpty),
          )
        : await listGlobalConversations(
            libraryID,
            limit,
            Boolean(params.includeEmpty),
          );
    return rows
      .map((row) =>
        params.kind === "paper"
          ? fromUpstreamPaperSummary(row as PaperConversationSummary)
          : fromUpstreamGlobalSummary(row as GlobalConversationSummary),
      )
      .filter((row): row is ConversationCatalogEntry => Boolean(row));
  },

  async listAllCatalogEntries(params: {
    system: ConversationSystem;
    libraryID: number;
    limit?: number | null;
  }): Promise<ConversationCatalogEntry[]> {
    const libraryID = normalizePositiveInt(params.libraryID);
    const limit =
      params.limit === null ? null : normalizeLimit(params.limit, 100);
    if (!libraryID) return [];

    const [paperRows, globalRows] = await Promise.all([
      listAllPaperConversationsByLibrary(libraryID, limit),
      listGlobalConversations(libraryID, limit, false),
    ]);
    return sortCatalogEntries([
      ...paperRows
        .map((row) => fromUpstreamPaperSummary(row))
        .filter((row): row is ConversationCatalogEntry => Boolean(row)),
      ...globalRows
        .map((row) => fromUpstreamGlobalSummary(row))
        .filter((row): row is ConversationCatalogEntry => Boolean(row)),
    ]);
  },

  async setCatalogTitle(
    target: ConversationCatalogMutationTarget & { title: string },
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;

    if (
      target.kind === "paper" ||
      isUpstreamPaperConversationKey(conversationKey)
    ) {
      await setPaperConversationTitle(conversationKey, target.title);
      return;
    }
    await setGlobalConversationTitle(conversationKey, target.title);
  },

  async clearCatalogTitle(
    target: ConversationCatalogMutationTarget,
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;

    await clearConversationTitle(conversationKey);
  },

  async touchCatalogTitle(
    target: ConversationCatalogMutationTarget & { title: string },
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;

    if (
      target.kind === "paper" ||
      isUpstreamPaperConversationKey(conversationKey)
    ) {
      await touchPaperConversationTitle(conversationKey, target.title);
      return;
    }
    await touchGlobalConversationTitle(conversationKey, target.title);
  },

  async touchEmptyCatalogActivity(
    target: ConversationCatalogMutationTarget & { timestamp?: number },
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;
    const timestamp = normalizeTimestamp(target.timestamp, Date.now());
    if (
      target.kind === "paper" ||
      isUpstreamPaperConversationKey(conversationKey)
    ) {
      await touchEmptyPaperConversation(conversationKey, timestamp);
      return;
    }
    await touchEmptyGlobalConversation(conversationKey, timestamp);
  },

  async deleteCatalogEntry(
    target: ConversationCatalogMutationTarget,
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;
    const cleanupForkLink = async () => {
      await deleteConversationForkLink(conversationKey).catch(() => {});
    };

    if (
      target.kind === "paper" ||
      isUpstreamPaperConversationKey(conversationKey)
    ) {
      await deletePaperConversation(conversationKey);
      await cleanupForkLink();
      return;
    }
    await deleteGlobalConversation(conversationKey);
    await cleanupForkLink();
  },

  async deleteLocalConversationRows(
    target: ConversationCatalogMutationTarget,
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;

    await deleteUpstreamConversationLocalRows(conversationKey, target.kind);
  },

  async preflightDeleteLocalConversationRows(
    target: ConversationCatalogMutationTarget,
  ): Promise<void> {
    const conversationKey = normalizePositiveInt(target.conversationKey);
    if (!conversationKey) return;

    await preflightDeleteUpstreamConversationLocalRows(conversationKey);
  },
};
