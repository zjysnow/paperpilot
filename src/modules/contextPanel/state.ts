import type {
  Message,
  ChatRuntimeMode,
  SelectedTextContext,
  PaperContextRef,
  QuoteCitation,
  GeneratedChatImage,
} from "./types"
import { TTLMap } from "./contexts/ttlMap";

// =============================================================================
// Module State
// =============================================================================

export const chatHistory = new Map<number, Message[]>();
// export const conversationForkLinks = new Map<number, ConversationForkLink>();
export const loadedConversationKeys = new Set<number>();
export const loadingConversationTasks = new Map<number, Promise<void>>();
export const selectedModelCache = new Map<number, string>();

export const selectedRuntimeModeCache = new Map<number, ChatRuntimeMode>();

export const activeContextPanels = new Map<Element, () => Zotero.Item | null>();
/** Raw Zotero item (from onRender) per body — used to recover the original
 *  paper item when clearing a global lock. */
export const activeContextPanelRawItems = new Map<
  Element,
  Zotero.Item | null
>();
export const activeContextPanelStateSync = new Map<Element, () => void>();

export const activeGlobalConversationByLibrary = new Map<number, number>();
export const activeConversationModeByLibrary = new Map<
  number,
  "paper" | "global"
>();

export const activePaperConversationByPaper = new Map<string, number>();


export let readerContextPanelRegistered = false;
export function setReaderContextPanelRegistered(value: boolean) {
  readerContextPanelRegistered = value;
}

export let currentRequestId = 0;
export function nextRequestId(): number {
  return ++currentRequestId;
}


export let panelFontScalePercent = 120; // FONT_SCALE_DEFAULT_PERCENT — overwritten by initFontScale()
export function setPanelFontScalePercent(value: number) {
  panelFontScalePercent = value;
  // Lazy-import to avoid circular dependency (prefHelpers imports from state).
  import("./prefHelpers")
    .then((m) => m.setFontScalePref(value))
    .catch(() => {});
}
export let messageLineSpacingPercent = 150; // MESSAGE_LINE_SPACING_DEFAULT_PERCENT
export function setMessageLineSpacingPercent(value: number) {
  messageLineSpacingPercent = value;
  import("./prefHelpers")
    .then((m) => m.setMessageLineSpacingPref(value))
    .catch(() => {});
}
export let messageParagraphSpacingPx = 8; // MESSAGE_PARAGRAPH_SPACING_DEFAULT_PX
export function setMessageParagraphSpacingPx(value: number) {
  messageParagraphSpacingPx = value;
  import("./prefHelpers")
    .then((m) => m.setMessageParagraphSpacingPref(value))
    .catch(() => {});
}
export let messageWordSpacingPx = 0; // MESSAGE_WORD_SPACING_DEFAULT_PX
export function setMessageWordSpacingPx(value: number) {
  messageWordSpacingPx = value;
  import("./prefHelpers")
    .then((m) => m.setMessageWordSpacingPref(value))
    .catch(() => {});
}
export let messageFontFamily = "";
export function setMessageFontFamily(value: string) {
  messageFontFamily = value;
  import("./prefHelpers")
    .then((m) => m.setMessageFontFamilyPref(value))
    .catch(() => {});
}

/** Call once at plugin startup to restore the persisted font scale. */
export function initFontScale(): void {
    // Lazy-import to avoid circular dependency.
    import("./prefHelpers")
        .then((m) => {
            panelFontScalePercent = m.getFontScalePref();
            messageLineSpacingPercent = m.getMessageLineSpacingPref();
            messageParagraphSpacingPx = m.getMessageParagraphSpacingPref();
            messageWordSpacingPx = m.getMessageWordSpacingPref();
            messageFontFamily = m.getMessageFontFamilyPref();
        })
        .catch(() => {});
}


/**
 * Release all module-level state.  Called on plugin shutdown to prevent
 * memory leaks across hot-reloads.
 */
export function clearAllState(): void {
  // Disconnect any ResizeObservers stored on panel bodies before clearing.
  for (const [panelBody] of activeContextPanels) {
      const obs = (panelBody as any).__paperpilotResizeObservers as
      | ResizeObserver[]
      | undefined;
      if (obs) {
      for (const o of obs) o.disconnect();
      delete (panelBody as any).__paperpilotResizeObservers;
      }
  }

  // chatHistory.clear();
  // conversationForkLinks.clear();
  // loadedConversationKeys.clear();
  // loadingConversationTasks.clear();
  // webChatForceNewChatConversationKeys.clear();
  // webChatPdfUploadedConversationKeys.clear();
  selectedModelCache.clear();
  // selectedReasoningCache.clear();
  // selectedReasoningProviderCache.clear();
  selectedRuntimeModeCache.clear();
  // pdfTextCache.clear();
  // pdfTextLoadingTasks.clear();
  // shortcutTextCache.clear();
  activeContextPanels.clear();
  activeContextPanelRawItems.clear();
  activeContextPanelStateSync.clear();
  // selectedImageCache.clear();
  // selectedFileAttachmentCache.clear();
  // selectedFilePreviewExpandedCache.clear();
  // selectedPaperContextCache.clear();
  // selectedOtherRefContextCache.clear();
  // selectedCollectionContextCache.clear();
  // paperContextModeOverrides.clear();
  // paperContentSourceOverrides.clear();
  selectedPaperPreviewExpandedCache.clear();
  // selectedPaperContextListExpandedCache.clear();
  activeGlobalConversationByLibrary.clear();
  activeConversationModeByLibrary.clear();
  // draftInputCache.clear();
  selectedTextCache.clear();
  selectedTextPreviewExpandedCache.clear();
  selectedNotePreviewExpandedCache.clear();
  selectedImagePreviewExpandedCache.clear();
  selectedImagePreviewActiveIndexCache.clear();
  pinnedSelectedTextKeys.clear();
  pinnedImageKeys.clear();
  pinnedFileKeys.clear();
  pinnedPaperKeys.clear();
  recentReaderSelectionCache.clear();
  activePaperConversationByPaper.clear();
  pendingRequestIds.clear();
  cancelledRequestIds.clear();
  abortControllers.clear();
  autoLockedGlobalConversationKeys.clear();
}



export const selectedTextCache = new Map<number, SelectedTextContext[]>();
export const selectedTextPreviewExpandedCache = new Map<number, number>();
export const selectedNotePreviewExpandedCache = new Map<number, boolean>();
export const selectedImagePreviewExpandedCache = new Map<number, boolean>();
export const selectedImagePreviewActiveIndexCache = new Map<number, number>();
export const pinnedSelectedTextKeys = new Map<number, Set<string>>();
export const pinnedImageKeys = new Map<number, Set<string>>();
export const pinnedFileKeys = new Map<number, Set<string>>();
export const pinnedPaperKeys = new Map<number, Set<string>>();
// Recent reader text selections — capped (5-min TTL, max 50).
export const recentReaderSelectionCache = new TTLMap<number, string>(
  5 * 60 * 1000,
  50,
);

const pendingRequestIds = new Map<number, number>();
const cancelledRequestIds = new Map<number, number>();
const abortControllers = new Map<number, AbortController | null>();


/** Returns true if the given conversation has an in-flight request. */
export function isRequestPending(conversationKey: number): boolean {
  return (pendingRequestIds.get(conversationKey) || 0) > 0;
}



// ── Auto-lock state (open chat locks during generation) ─────────────────────
// Multiple conversations can be auto-locked simultaneously.
const autoLockedGlobalConversationKeys = new Set<number>();
export function addAutoLockedGlobalConversationKey(key: number): void {
  autoLockedGlobalConversationKeys.add(key);
}
export function removeAutoLockedGlobalConversationKey(key: number): void {
  autoLockedGlobalConversationKeys.delete(key);
}
export function isAutoLockedGlobalConversation(key: number): boolean {
  return autoLockedGlobalConversationKeys.has(key);
}


// Stores the contextItemId of the currently expanded (sticky) paper chip, or false/undefined if none
export const selectedPaperPreviewExpandedCache = new Map<
  number,
  number | false
>();




export type ResponseActionTarget = {
  item: Zotero.Item;
  contentText: string;
  queryText?: string;
  modelName: string;
  conversationKey?: number;
  userTimestamp?: number;
  assistantTimestamp?: number;
  paperContexts?: PaperContextRef[];
  quoteCitations?: QuoteCitation[];
  generatedImages?: GeneratedChatImage[];
};

export let responseMenuTarget: ResponseActionTarget | null = null;
export function setResponseMenuTarget(value: typeof responseMenuTarget) {
  responseMenuTarget = value;
}


export type ResponseActionKind = "copy" | "note" | "fork" | "delete";
export type ResponseActionRunner = (
  action: ResponseActionKind,
  target: ResponseActionTarget | null,
) => Promise<void>;


const responseActionRunners = new WeakMap<Element, ResponseActionRunner>();
export function setResponseActionRunner(
  body: Element,
  value: ResponseActionRunner | null,
): void {
  if (value) {
    responseActionRunners.set(body, value);
  } else {
    responseActionRunners.delete(body);
  }
}

