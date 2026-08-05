import {
  buildDefaultUpstreamGlobalConversationKey,
  GLOBAL_CONVERSATION_KEY_BASE,
  PAPER_CONVERSATION_KEY_BASE,
  isUpstreamGlobalConversationKey,
} from "./constants";
import { isSupportedContextAttachment } from "./contextAttachmentSupport";
import { normalizePositiveInt } from "./normalizers";
import {
  buildPaperStateKey,
  getLastUsedPaperConversationKey,
  getLockedGlobalConversationKey,
} from "./prefHelpers";
import {
  activeConversationModeByLibrary,
  activeGlobalConversationByLibrary,
  activePaperConversationByPaper,
} from "./state";

import type {
  ActiveNoteSession,
  GlobalPortalItem,
  PaperPortalItem,
} from "./types";
import type { ConversationSystem } from "../../shared/types";

export function resolveActiveLibraryID(): number | null {
  try {
    const pane = Zotero.getActiveZoteroPane?.() as
      | {
          getSelectedLibraryID?: () => unknown;
          getSelectedItems?: () => Zotero.Item[];
        }
      | undefined;
    const selectedLibraryID = normalizePositiveInt(
      pane?.getSelectedLibraryID?.(),
    );
    if (selectedLibraryID) return selectedLibraryID;
    const selectedItems = pane?.getSelectedItems?.() || [];
    const firstItemLibrary = normalizePositiveInt(selectedItems[0]?.libraryID);
    if (firstItemLibrary) return firstItemLibrary;
  } catch (_err) {
    void _err;
  }

  const userLibraryID = normalizePositiveInt(
    (Zotero as unknown as { Libraries?: { userLibraryID?: unknown } }).Libraries
      ?.userLibraryID,
  );
  return userLibraryID;
}

export function isGlobalPortalItem(item: unknown): item is GlobalPortalItem {
  if (!item || typeof item !== "object") return false;
  const typed = item as Partial<GlobalPortalItem>;
  if (typed.__paperpilotGlobalPortalItem !== true) return false;
  const normalizedId = normalizePositiveInt(typed.id);
  return Boolean(normalizedId && normalizedId >= GLOBAL_CONVERSATION_KEY_BASE);
}

export function isPaperPortalItem(item: unknown): item is PaperPortalItem {
  if (!item || typeof item !== "object") return false;
  const typed = item as Partial<PaperPortalItem>;
  if (typed.__paperpilotPaperPortalItem !== true) return false;
  const normalizedConversationKey = normalizePositiveInt(typed.id);
  const normalizedBasePaperID = normalizePositiveInt(
    typed.__paperpilotPaperPortalBaseItemID,
  );
  return Boolean(normalizedConversationKey && normalizedBasePaperID);
}


export function getPaperPortalBaseItemID(item: unknown): number | null {
  if (!isPaperPortalItem(item)) return null;
  const normalized = normalizePositiveInt(item.__paperpilotPaperPortalBaseItemID);
  return normalized || null;
}

export function isPaperChatBaseItem(
  item: Zotero.Item | null | undefined,
): item is Zotero.Item {
  if (!item) return false;
  if (item.isAttachment?.()) {
    return isSupportedContextAttachment(item);
  }
  return Boolean(item.isRegularItem?.());
}


export function resolvePaperPortalBaseItem(
  item: Zotero.Item | null | undefined,
): Zotero.Item | null {
  const baseItemID = getPaperPortalBaseItemID(item);
  if (!baseItemID) return null;
  const resolved = Zotero.Items.get(baseItemID) || null;
  return isPaperChatBaseItem(resolved) ? resolved : null;
}



export function resolvePaperChatSourceItem(
  targetItem: Zotero.Item | null | undefined,
): Zotero.Item | null {
  if (!targetItem) return null;
  if (
    isGlobalPortalItem(targetItem)
  ) {
    return null;
  }
  if (isPaperPortalItem(targetItem)) {
    return resolvePaperPortalBaseItem(targetItem);
  }
  if (targetItem.isAttachment() && targetItem.parentID) {
    if (!isSupportedContextAttachment(targetItem)) return null;
    const parent = Zotero.Items.get(targetItem.parentID) || null;
    return parent?.isRegularItem?.() ? parent : null;
  }
  return isPaperChatBaseItem(targetItem) ? targetItem : null;
}

export function resolveConversationBaseItem(
  targetItem: Zotero.Item | null | undefined,
): Zotero.Item | null {
  if (!targetItem) return null;
  if (
    isGlobalPortalItem(targetItem)
  ) {
    return null;
  }
  if (isPaperPortalItem(targetItem)) {
    return resolvePaperPortalBaseItem(targetItem);
  }
  if ((targetItem as any).isNote?.()) {
    return targetItem;
  }
  return resolvePaperChatSourceItem(targetItem);
}


function resolveLibraryIdFromItem(
  targetItem: Zotero.Item | null | undefined,
): number {
  const parsed = Number(targetItem?.libraryID);
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  return resolveActiveLibraryID() || 0;
}



function resolvePreferredConversationMode(
  libraryID: number,
  system: ConversationSystem,
): "global" | "paper" {
  const rememberedMode = activeConversationModeByLibrary.get(libraryID);
  if (rememberedMode === "paper") {
    return "paper";
  }
  if (getLockedGlobalConversationKey(libraryID) !== null) {
    return "global";
  }
  return rememberedMode === "global" ? "global" : "paper";
}


function resolveGlobalConversationKey(
  libraryID: number,
  system: ConversationSystem,
): number {
  const lockedKey = getLockedGlobalConversationKey(libraryID);
  if (lockedKey !== null) {
    return lockedKey === GLOBAL_CONVERSATION_KEY_BASE
      ? buildDefaultUpstreamGlobalConversationKey(libraryID)
      : lockedKey;
  }
  const activeKey = Number(
    activeGlobalConversationByLibrary.get(libraryID) || 0,
  );
  if (isUpstreamGlobalConversationKey(activeKey)) {
    return activeKey === GLOBAL_CONVERSATION_KEY_BASE
      ? buildDefaultUpstreamGlobalConversationKey(libraryID)
      : Math.floor(activeKey);
  }
  return buildDefaultUpstreamGlobalConversationKey(libraryID);
}


export function createGlobalPortalItem(
  libraryID: number,
  conversationKey: number,
): Zotero.Item {
  const normalizedLibraryID = normalizePositiveInt(libraryID) || 1;
  const normalizedConversationKey =
    normalizePositiveInt(conversationKey) ||
    buildDefaultUpstreamGlobalConversationKey(normalizedLibraryID);
  const portalItem: GlobalPortalItem = {
    __paperpilotGlobalPortalItem: true,
    id: normalizedConversationKey,
    libraryID: normalizedLibraryID,
    parentID: undefined,
    attachmentContentType: "",
    isAttachment: () => false,
    isRegularItem: () => false,
    getAttachments: () => [],
    getField: (field: string) => {
      if (field === "title") return "Global Library Portal";
      if (field === "libraryCatalog") return "Library";
      return "";
    },
  };
  return portalItem as unknown as Zotero.Item;
}



function resolvePaperConversationKeyForBaseItem(
  basePaperItem: Zotero.Item,
  system: ConversationSystem,
): number {
  const libraryID = resolveLibraryIdFromItem(basePaperItem);
  const paperItemID = normalizePositiveInt(basePaperItem?.id) || 0;
  if (!libraryID || !paperItemID) return paperItemID;
  const rememberedPaperKey = Number(
    activePaperConversationByPaper.get(
        buildPaperStateKey(libraryID, paperItemID),
      ) ||
      getLastUsedPaperConversationKey(libraryID, paperItemID) ||
      paperItemID,
  );
  return Number.isFinite(rememberedPaperKey) && rememberedPaperKey > 0
    ? Math.floor(rememberedPaperKey)
    : paperItemID;
}



export function createPaperPortalItem(
  basePaperItem: Zotero.Item,
  conversationKey: number,
  sessionVersion: number,
): Zotero.Item {
  const basePaperItemID = normalizePositiveInt(basePaperItem?.id) || 0;
  const normalizedLibraryID =
    normalizePositiveInt(basePaperItem?.libraryID) || 1;
  const normalizedConversationKey =
    normalizePositiveInt(conversationKey) || PAPER_CONVERSATION_KEY_BASE;
  const normalizedSessionVersion = normalizePositiveInt(sessionVersion) || 1;
  const portalItem: PaperPortalItem = {
    __paperpilotPaperPortalItem: true,
    __paperpilotPaperPortalBaseItemID: basePaperItemID,
    __paperpilotPaperPortalSessionVersion: normalizedSessionVersion,
    id: normalizedConversationKey,
    libraryID: normalizedLibraryID,
    parentID: undefined,
    attachmentContentType: "",
    isAttachment: () => false,
    isRegularItem: () => true,
    getAttachments: () => {
      const resolvedBase = basePaperItemID
        ? Zotero.Items.get(basePaperItemID) || null
        : null;
      if (resolvedBase?.isRegularItem?.()) return resolvedBase.getAttachments();
      if (isSupportedContextAttachment(resolvedBase)) return [basePaperItemID];
      return [];
    },
    getField: (field: string) => {
      const resolvedBase = basePaperItemID
        ? Zotero.Items.get(basePaperItemID) || null
        : null;
      if (resolvedBase) {
        try {
          return String(resolvedBase.getField(field) || "");
        } catch (_err) {
          void _err;
        }
      }
      if (field === "title") return "Paper chat";
      return "";
    },
  };
  return portalItem as unknown as Zotero.Item;
}




export function resolveInitialPanelItemState(
  initialItem: Zotero.Item | null | undefined,
  options?: {
    conversationSystem?: ConversationSystem | null;
  },
): {
  item: Zotero.Item | null;
  basePaperItem: Zotero.Item | null;
} {
  let item = initialItem || null;
  const basePaperItem = resolveConversationBaseItem(item);
  if (!basePaperItem) {
    return { item, basePaperItem: null };
  }

  if (
    item?.isAttachment?.() &&
    item.parentID &&
    basePaperItem.isRegularItem?.()
  ) {
    item = basePaperItem;
  }

  if (
    isPaperPortalItem(item)
  ) {
    return { item, basePaperItem };
  }

  const libraryID = resolveLibraryIdFromItem(basePaperItem);
  const conversationSystem = "upstream";
  const preferredMode = resolvePreferredConversationMode(
    libraryID,
    conversationSystem,
  );

  if (preferredMode === "global") {
    const conversationKey = resolveGlobalConversationKey(
      libraryID,
      conversationSystem,
    );
    item = createGlobalPortalItem(libraryID, conversationKey);
    return { item, basePaperItem };
  }

  const paperItemID = Number(basePaperItem.id || 0);
  const rememberedPaperKey = resolvePaperConversationKeyForBaseItem(
    basePaperItem,
    conversationSystem,
  );
  if (
    Number.isFinite(rememberedPaperKey) &&
    rememberedPaperKey > 0 &&
    Math.floor(rememberedPaperKey) !== paperItemID
  ) {
    item = createPaperPortalItem(
      basePaperItem,
      Math.floor(rememberedPaperKey),
      0,
    );
  }
  return { item, basePaperItem };
}



export function resolveConversationSystemForItem(
  item: Zotero.Item | null | undefined,
): ConversationSystem | null {
  if (isGlobalPortalItem(item) || isPaperPortalItem(item)) {
    return "upstream";
  }
  return null;
}


export function resolveDisplayConversationKind(
  item: Zotero.Item | null | undefined,
): "global" | "paper" | null {
  if (!item) return null;
  return isGlobalPortalItem(item) 
    ? "global"
    : "paper";
}




export function resolvePreferredConversationSystem(params: {
  item: Zotero.Item | null | undefined;
  preferredSystem?: ConversationSystem | null;
}): ConversationSystem {
  const itemSystem = resolveConversationSystemForItem(params.item);
  return itemSystem || "upstream";
}
