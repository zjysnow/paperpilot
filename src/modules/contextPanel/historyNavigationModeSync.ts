import type { ConversationSystem } from "../../shared/types";

import {
  activeConversationModeByLibrary,
  activeGlobalConversationByLibrary,
  activePaperConversationByPaper,
} from "./state";
import {
  buildPaperStateKey,
  getLastUsedUpstreamConversationMode,
  getLastUsedUpstreamGlobalConversationKey,
  getLastUsedPaperConversationKey,
  removeLastUsedUpstreamConversationMode,
  removeLastUsedUpstreamGlobalConversationKey,
  removeLastUsedPaperConversationKey,
  setLastUsedUpstreamConversationMode,
  setLastUsedUpstreamGlobalConversationKey,
  setLastUsedPaperConversationKey,
} from "./prefHelpers";

export type HistoryNavigationMode = "global" | "paper";

type MapEntrySnapshot<K, V> = {
  map: Map<K, V>;
  key: K;
  hadValue: boolean;
  value: V | undefined;
};

export type HistoryNavigationModeSnapshot = {
  restore: () => void;
};

type HistoryNavigationModeParams = {
  system: ConversationSystem;
  libraryID: number;
  mode: HistoryNavigationMode;
  conversationKey?: number;
  paperItemID?: number;
};

function normalizePositiveInt(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function snapshotMapEntry<K, V>(
  map: Map<K, V>,
  key: K,
): MapEntrySnapshot<K, V> {
  return {
    map,
    key,
    hadValue: map.has(key),
    value: map.get(key),
  };
}

function restoreMapEntry<K, V>(snapshot: MapEntrySnapshot<K, V>): void {
  if (snapshot.hadValue) {
    snapshot.map.set(snapshot.key, snapshot.value as V);
    return;
  }
  snapshot.map.delete(snapshot.key);
}

function restoreOptionalNumber(
  value: number | null,
  setValue: (value: number) => void,
  removeValue: () => void,
): void {
  if (value && value > 0) {
    setValue(value);
    return;
  }
  removeValue();
}

function restoreOptionalMode(
  value: HistoryNavigationMode | null,
  setValue: (value: HistoryNavigationMode) => void,
  removeValue: () => void,
): void {
  if (value === "global" || value === "paper") {
    setValue(value);
    return;
  }
  removeValue();
}

function noopSnapshot(): HistoryNavigationModeSnapshot {
  return { restore: () => undefined };
}

export function primeHistoryNavigationMode(
  params: HistoryNavigationModeParams,
): HistoryNavigationModeSnapshot {
  const libraryID = normalizePositiveInt(params.libraryID);
  if (!libraryID) return noopSnapshot();

  const conversationKey = normalizePositiveInt(params.conversationKey);
  const paperItemID = normalizePositiveInt(params.paperItemID);
  const mode: HistoryNavigationMode =
    params.mode === "global" ? "global" : "paper";
  const restoreCallbacks: Array<() => void> = [];

  const modeSnapshot = snapshotMapEntry(
    activeConversationModeByLibrary,
    libraryID,
  );
  const previousMode = getLastUsedUpstreamConversationMode(libraryID);
  activeConversationModeByLibrary.set(libraryID, mode);
  setLastUsedUpstreamConversationMode(libraryID, mode);
  restoreCallbacks.push(() => {
    restoreMapEntry(modeSnapshot);
    restoreOptionalMode(
      previousMode,
      (value) => setLastUsedUpstreamConversationMode(libraryID, value),
      () => removeLastUsedUpstreamConversationMode(libraryID),
    );
  });

  if (mode === "global" && conversationKey) {
    const globalSnapshot = snapshotMapEntry(
      activeGlobalConversationByLibrary,
      libraryID,
    );
    const previousGlobalKey =
      getLastUsedUpstreamGlobalConversationKey(libraryID);
    activeGlobalConversationByLibrary.set(libraryID, conversationKey);
    setLastUsedUpstreamGlobalConversationKey(libraryID, conversationKey);
    restoreCallbacks.push(() => {
      restoreMapEntry(globalSnapshot);
      restoreOptionalNumber(
        previousGlobalKey,
        (value) => setLastUsedUpstreamGlobalConversationKey(libraryID, value),
        () => removeLastUsedUpstreamGlobalConversationKey(libraryID),
      );
    });
  } else if (mode === "paper" && conversationKey && paperItemID) {
    const paperKey = buildPaperStateKey(libraryID, paperItemID);
    const paperSnapshot = snapshotMapEntry(
      activePaperConversationByPaper,
      paperKey,
    );
    const previousPaperKey = getLastUsedPaperConversationKey(
      libraryID,
      paperItemID,
    );
    activePaperConversationByPaper.set(paperKey, conversationKey);
    setLastUsedPaperConversationKey(libraryID, paperItemID, conversationKey);
    restoreCallbacks.push(() => {
      restoreMapEntry(paperSnapshot);
      restoreOptionalNumber(
        previousPaperKey,
        (value) =>
          setLastUsedPaperConversationKey(libraryID, paperItemID, value),
        () => removeLastUsedPaperConversationKey(libraryID, paperItemID),
      );
    });
  }

  return {
    restore: () => {
      for (const restore of [...restoreCallbacks].reverse()) restore();
    },
  };
}
