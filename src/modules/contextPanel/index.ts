/**
 * Context Panel Module
 *
 * This is the main entry point for the Paper Pilot context panel, which provides
 * a chat interface in Zotero's reader/library side panel.
 *
 * The module is split into focused sub-modules:
 * - constants.ts   – shared constants
 * - types.ts       – shared type definitions
 * - state.ts       – module-level mutable state
 * - buildUI.ts     – UI construction
 * - setupHandlers.ts – event handler wiring
 * - chat.ts        – conversation logic, send/refresh
 * - shortcuts.ts   – shortcut rendering and management
 * - screenshot.ts  – screenshot capture from PDF reader
 * - pdfContext.ts   – PDF text extraction, chunking, BM25, embeddings
 * - multiContextPlanner.ts – budget-first adaptive multi-context assembly
 * - notes.ts       – Zotero note creation from chat
 * - contextResolution.ts – tab/reader context resolution
 * - menuPositioning.ts   – dropdown/context menu positioning
 * - prefHelpers.ts – preference access helpers
 * - textUtils.ts   – text sanitization, formatting
 */

import { getLocaleID } from "../../utils/locale";
import { config, PANE_ID } from "./constants";

import {
    readerContextPanelRegistered,
    setReaderContextPanelRegistered,
    activeContextPanels,
    activeContextPanelRawItems,
    activeContextPanelStateSync,
} from "./state"

import { buildUI } from "./buildUI";
import { setupHandlers } from "./setupHandlers";

import { refreshChat } from "./chat";

import { ensureConversationLoaded, getConversationKey } from "./chat";

import {
  clearCompletedPanelLifecycleSignature,
  hasCompletedPanelLifecycleSignature,
  markCompletedPanelLifecycleSignature,
  type PanelLifecycleSignature,
} from "./panelLifecycleSignature";
import {
  hasPanelContextOwnerChanged,
  shouldRefreshContextSourceWithoutPanelRebuild,
} from "./panelContextLifecycle";

import {
  // getActiveContextAttachmentFromTabs,
  // getActiveReaderForSelectedTab,
  refreshLastKnownSelectedTabId,
  // getItemSelectionCacheKeys,
  resolvePanelContextLifecycleState,
  // appendSelectedTextContextForItem,
  // applySelectedTextPreview,
  // getSelectedTextContextEntries,
} from "./contextResolution";

import {
  resolveInitialPanelItemState,
  resolveActiveLibraryID,
  resolveConversationSystemForItem,
  resolveDisplayConversationKind,
  // resolveShortcutMode,
} from "./portalScope";
import { getLockedGlobalConversationKey } from "./prefHelpers";

import { freshStartupConversationSession } from "./freshStartupConversation";
import { registerReaderSelectionTracking } from "./readerSelectionTracking";

export { openStandaloneChat } from "./standaloneWindow";
import {
  isStandaloneWindowActive,
  notifyStandaloneItemChanged,
  renderStandalonePlaceholder,
} from "./standaloneWindow";

// =============================================================================
// Public API
// =============================================================================

function isPanelRootInitialized(
  panelRoot: HTMLElement | null | undefined,
): boolean {
  return Boolean(panelRoot?.dataset?.handlersInitialized);
}

function getPanelContextSourceStateKey(
  item: Zotero.Item | null | undefined,
): string {
  const state = resolvePanelContextLifecycleState(item);
  if (!state) return "";
  const contextItemId = state.requiresAsyncResolution ? 0 : state.contextItemId;
  return [
    state.sourceKind,
    contextItemId > 0 ? `${contextItemId}` : "",
    state.supportKind || "",
    state.contentSourceMode || "",
    state.requiresAsyncResolution ? "async" : "sync",
  ].join(":");
}

function writePanelContextDataset(
  panelRoot: HTMLElement | null | undefined,
  rawItem: Zotero.Item | null | undefined,
) {
  if (!panelRoot) return;
  const rawContextItemKey = rawItem
    ? String(Number(rawItem.id || 0) || "")
    : "";
  // panelRoot.dataset.contextItemId = getPanelContextItemIdKey(rawItem);
  // panelRoot.dataset.contextOwnerItemId = getPanelContextOwnerItemIdKey(rawItem);
  // panelRoot.dataset.contextSourceStateKey =
  //   getPanelContextSourceStateKey(rawItem);
  panelRoot.dataset.rawContextItemId = rawContextItemKey;
}

export function registerPaperPilotStyles(win: _ZoteroTypes.MainWindow) {
  const doc = win.document;
  if (doc.getElementById(`${config.addonRef}-styles`)) return;

  // Main styles
  const link = doc.createElement("link") as HTMLLinkElement;
  link.id = `${config.addonRef}-styles`;
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = `chrome://${config.addonRef}/content/zoteroPane.css`;
  doc.documentElement?.appendChild(link);

  // KaTeX styles for math rendering
  const katexLink = doc.createElement("link") as HTMLLinkElement;
  katexLink.id = `${config.addonRef}-katex-styles`;
  katexLink.rel = "stylesheet";
  katexLink.type = "text/css";
  katexLink.href = `chrome://${config.addonRef}/content/vendor/katex/katex.min.css`;
  doc.documentElement?.appendChild(katexLink);
}

function getPanelContextOwnerItemIdKey(
  item: Zotero.Item | null | undefined,
): string {
  const id = resolvePanelContextLifecycleState(item)?.ownerItemId || 0;
  return id > 0 ? `${id}` : "";
}

function getPanelItemIdKey(item: Zotero.Item | null | undefined): string {
  const id = Math.floor(Number((item as any)?.id || 0));
  return Number.isFinite(id) && id > 0 ? `${id}` : "";
}

function buildPanelLifecycleSignature(
  rawItem: Zotero.Item | null | undefined,
  resolvedItem: Zotero.Item | null | undefined,
): PanelLifecycleSignature {
  const rawContextItem = rawItem || resolvedItem;
  return {
    conversationKey: resolvedItem ? `${getConversationKey(resolvedItem)}` : "0",
    rawContextItemId: getPanelContextOwnerItemIdKey(rawContextItem),
    contextItemId: "",
    conversationSystem:
      resolveConversationSystemForItem(resolvedItem) || "upstream",
    conversationKind: resolveDisplayConversationKind(resolvedItem) || "",
    shortcutMode: "", //resolveShortcutMode(resolvedItem),
  };
}

export function registerReaderContextPanel() {
    if (readerContextPanelRegistered) return;
    setReaderContextPanelRegistered(true);
    registerReaderSelectionTracking();
    freshStartupConversationSession.begin();
    // Generation counter: incremented on every onAsyncRender call so stale
    // (superseded) renders can bail out at each await point.
    let renderGeneration = 0;
    let lastItemChangeSignature = "";
    const setupEmbeddedPanelHandlers = (
        body: Element,
        rawItem: Zotero.Item | null | undefined,
        resolvedItem: Zotero.Item | null | undefined,
    ) => {
        const startWithFreshConversation = resolvedItem
        ? freshStartupConversationSession.consume()
        : false;
        setupHandlers(
            body,
            rawItem,
            startWithFreshConversation
                ? { startWithFreshConversation: true }
                : undefined,
        );
    };
    Zotero.ItemPaneManager.registerSection({
        paneID: PANE_ID,
        pluginID: config.addonID,
        header: {
            l10nID: getLocaleID("paperpilot-panel-head"),
            icon: `chrome://${config.addonRef}/content/icons/icon.svg`,
        },
        sidenav: {
            l10nID: getLocaleID("paperpilot-panel-sidenav-tooltip"),
            icon: `chrome://${config.addonRef}/content/icons/icon.svg`,
        },
        onInit: ({ setEnabled, tabType }) => {
            setEnabled(true);
            ztoolkit.log(`Paper Pilot: panel init tabType=${tabType}`);
        },
        onItemChange: ({ setEnabled, tabType, item }) => {
            setEnabled(true);
            if (isStandaloneWindowActive()) {
                notifyStandaloneItemChanged(item || null);
                return true;
            }
            const selectedTabId = refreshLastKnownSelectedTabId();
            const itemChangeSignature = [
                tabType || "",
                selectedTabId ?? "",
                getPanelItemIdKey(item || null),
            ].join("|");
            if (itemChangeSignature === lastItemChangeSignature) {
                return true;
            }
            lastItemChangeSignature = itemChangeSignature;
            return true;
        },
        onRender: ({ body, item }) => {
            // When standalone window is open, show placeholder instead of full UI
            if (isStandaloneWindowActive()) {
                clearCompletedPanelLifecycleSignature(body);
                // void releaseClaudeRuntimeForBody(body);
                renderStandalonePlaceholder(body);
                const resolvedState = resolveInitialPanelItemState(item);
                activeContextPanels.set(body, () => resolvedState.item);
                activeContextPanelRawItems.set(body, item || null);
                (body as any).__paperpilotSyncRendered = true;
                return;
            }
            try {
                const panelRoot = body.querySelector("#paperpilot-main") as HTMLElement | null;
                // Treat missing panel root as needing a full render — the body may
                // belong to a tab that onAsyncRender never fired for.
                // Also treat an uninitialized shell as incomplete.  Zotero can fire a
                // superseded async render after buildUI() but before setupHandlers();
                // that leaves a blank chat box and default "Model: ..." controls.
                const needsFullRender =
                    !activeContextPanels.has(body) ||
                    !panelRoot ||
                    !isPanelRootInitialized(panelRoot);

                const resolvedState = resolveInitialPanelItemState(item);
                const expectedSystem =
                    resolveConversationSystemForItem(resolvedState.item) || "upstream";

                // Also check if a global lock requires switching to open chat
                const libraryID =
                    resolveActiveLibraryID() ||
                        (resolvedState.item
                            ? Number(resolvedState.item.libraryID || 0)
                            : 0) ||
                        (item ? Number(item.libraryID || 0) : 0);
                const lockedKey = libraryID > 0
                    ? getLockedGlobalConversationKey(libraryID)
                    : null;
                const currentKind = panelRoot?.dataset?.conversationKind;
                const currentItemKey = panelRoot?.dataset?.itemId;
                const currentSystem = panelRoot?.dataset?.conversationSystem || "";
                const currentContextItemKey = panelRoot?.dataset?.contextItemId || "";
                const currentRawContextItemKey =
                panelRoot?.dataset?.rawContextItemId || "";
                const currentContextOwnerItemKey =
                panelRoot?.dataset?.contextOwnerItemId || "";
                const currentContextSourceStateKey =
                panelRoot?.dataset?.contextSourceStateKey || "";
                // Lock is stale if:
                // - lock active + panel in paper mode (need to switch to global)
                // - lock active + panel shows different global conversation
                // - lock cleared + panel still in global mode (need to switch back to paper)
                const lockStale =
                    (lockedKey !== null &&
                        (currentKind === "paper" ||
                        (currentItemKey !== undefined &&
                            currentItemKey !== String(lockedKey)))) ||
                    (lockedKey === null && currentKind === "global" && !needsFullRender);

                // Detect if the active item has changed (e.g. user switched reader tabs).
                // If so, the panel must fully re-render to switch conversations.
                const storedItemKey = panelRoot?.dataset?.itemId;
                const newItemKey = resolvedState.item
                    ? String(getConversationKey(resolvedState.item))
                    : "0";
                const rawContextItem = item || resolvedState.item;
                const rawContextItemKey = rawContextItem
                    ? String(Number(rawContextItem.id || 0) || "")
                    : "";
                const newContextOwnerItemKey =
                    getPanelContextOwnerItemIdKey(rawContextItem);
                const newContextSourceStateKey =
                    getPanelContextSourceStateKey(rawContextItem);
                const itemChanged =
                    !needsFullRender &&
                    storedItemKey !== undefined &&
                    storedItemKey !== newItemKey;
                const contextDecision = {
                    needsFullRender,
                    storedItemKey,
                    newItemKey,
                    currentKind,
                    currentRawContextItemKey,
                    rawContextItemKey,
                    currentContextOwnerItemKey,
                    newContextOwnerItemKey,
                    currentContextSourceStateKey:
                        currentContextSourceStateKey || currentContextItemKey,
                    newContextSourceStateKey,
                };
                const contextOwnerChanged =
                    hasPanelContextOwnerChanged(contextDecision);
                const sameOwnerContextSourceChanged =
                    shouldRefreshContextSourceWithoutPanelRebuild(contextDecision);
                const systemChanged =
                    !needsFullRender && currentSystem !== expectedSystem;

                if (
                    needsFullRender ||
                    lockStale ||
                    itemChanged ||
                    contextOwnerChanged ||
                    systemChanged
                ) {
                    clearCompletedPanelLifecycleSignature(body);
                    // persistPendingChatScrollRestoreFromBody(body);
                    // Build UI synchronously so panel data attributes (basePaperItemId,
                    // conversationKind, etc.) are immediately correct.  The reader popup
                    // "Add Text" path reads these attributes to decide paper-mismatch —
                    // if we defer buildUI, the stale panel from the previous tab wins.
                    buildUI(body, resolvedState.item);
                    const nextPanelRoot = body.querySelector(
                        "#paperpilot-main",
                    ) as HTMLElement | null;
                    writePanelContextDataset(nextPanelRoot, rawContextItem);
                    activeContextPanels.set(body, () => resolvedState.item);
                    activeContextPanelRawItems.set(body, item || null);
                    // void retainClaudeRuntimeForBody(body, resolvedState.item);
                    // Attach handlers synchronously so buttons are
                    // immediately interactive — don't gate on ensureConversationLoaded.
                    setupEmbeddedPanelHandlers(body, item, resolvedState.item);
                    // Flag: onAsyncRender can skip the duplicate buildUI + setupHandlers.
                    (body as any).__paperpilotSyncRendered = true;
                    // Defer conversation loading and chat rendering
                    void (async () => {
                        try {
                            if ((body as any).__paperpilotFreshStartupConversationInFlight) return;
                            // if (resolvedState.item)
                            //     await ensureConversationLoaded(resolvedState.item);
                            if (isStandaloneWindowActive()) return;
                            refreshChat(body, resolvedState.item);
                        } catch (err) {
                            ztoolkit.log("Paper Pilot: onRender async setup failed", err);
                        }
                    })();   
                } else {
                    // Same item — keep item reference current so delegated handlers
                    // (e.g. Add Text) always resolve the active item.
                    activeContextPanels.set(body, () => resolvedState.item);
                    activeContextPanelRawItems.set(body, item || null);
                    writePanelContextDataset(panelRoot, rawContextItem);
                    // void retainClaudeRuntimeForBody(body, resolvedState.item);
                    if (sameOwnerContextSourceChanged) {
                        // persistPendingChatScrollRestoreFromBody(body);
                        (body as any).__paperpilotContextRefreshOnly = true;
                        const refreshContextSource = (body as any)
                        .__paperpilotRefreshContextSourceForCurrentItem;
                        if (typeof refreshContextSource === "function") {
                            refreshContextSource();
                        } else {
                            activeContextPanelStateSync.get(body)?.();
                        }
                    }
                }
            } catch {
                /* ignore */
            }
        },
        onAsyncRender: async ({ body, item, setEnabled }) => {
            setEnabled(true);
            // Skip full render when standalone window is active
            if (isStandaloneWindowActive()) return;

            const resolvedInitialState = resolveInitialPanelItemState(item);
            const resolvedItem = resolvedInitialState.item;
            const lifecycleSignature = buildPanelLifecycleSignature(
                item || null,
                resolvedItem,
            );
            // if (
            //     isPanelBodyInitialized(body) &&
            //     hasCompletedPanelLifecycleSignature(body, lifecycleSignature, {
            //         conversationLoaded: isPanelConversationLoaded(resolvedItem),
            //     })
            // ) {
            //     return;
            // }

            const thisGeneration = ++renderGeneration;

            // // If onRender already did the synchronous buildUI + setupHandlers for
            // // this render cycle, skip the duplicate work.  We still run the
            // // async-only steps: ensureConversationLoaded (properly awaited),
            // // renderShortcuts, refreshChat (after data ready), and content caching.
            const syncAlreadyRendered = (body as any).__paperpilotSyncRendered === true;
            if (syncAlreadyRendered) {
                delete (body as any).__paperpilotSyncRendered;
            }
            const contextRefreshOnly =
                (body as any).__paperpilotContextRefreshOnly === true &&
                Boolean(body.querySelector("#paperpilot-main"));
            if (contextRefreshOnly) {
                delete (body as any).__paperpilotContextRefreshOnly;
                activeContextPanels.set(body, () => resolvedItem);
                activeContextPanelRawItems.set(body, item || null);
            } else if (!syncAlreadyRendered) {
                // persistPendingChatScrollRestoreFromBody(body);
                buildUI(body, resolvedItem);
                const panelRoot = body.querySelector("#paperpilot-main") as HTMLElement | null;
                writePanelContextDataset(panelRoot, item || resolvedItem);
                activeContextPanelRawItems.set(body, item || null);
            }

            if (resolvedItem) {
                if ((body as any).__paperpilotFreshStartupConversationInFlight) return;
                await ensureConversationLoaded(resolvedItem);
            }
            // Bail if a newer render has started while we were awaiting,
            // or if the standalone window was opened during the await.
            if (renderGeneration !== thisGeneration) return;
            if (isStandaloneWindowActive()) return;
            // await renderShortcuts(
            //     body,
            //     resolvedItem,
            //     resolveShortcutMode(resolvedItem),
            // );
            if (renderGeneration !== thisGeneration) return;
            if (isStandaloneWindowActive()) return;
            if (!syncAlreadyRendered && !contextRefreshOnly) {
                setupEmbeddedPanelHandlers(body, item, resolvedItem);
            }
            if (contextRefreshOnly) {
                const refreshContextSource = (body as any).__paperpilotRefreshContextSourceForCurrentItem;
                if (typeof refreshContextSource === "function") {
                    refreshContextSource();
                } else {
                    activeContextPanelStateSync.get(body)?.();
                }
            }
            refreshChat(body, resolvedItem);
            markCompletedPanelLifecycleSignature(body, lifecycleSignature);
            // // Defer content extraction so the panel becomes interactive sooner.
            // const activeContextItem = getActiveContextAttachmentFromTabs();
            // if (activeContextItem) {
            //     void ensurePDFTextCached(activeContextItem);
            // } else if (item && (item as any).isNote?.()) {
            //     void ensureNoteTextCached(item);
            // }
        },
    });
}


