import {
    activeContextPanels,
    activeContextPanelRawItems,
    activeContextPanelStateSync,
} from "./state";

import {
  resolveActiveLibraryID,
  resolveConversationSystemForItem,
  // resolveDisplayConversationKind,
  resolveInitialPanelItemState,
  resolveConversationBaseItem,
  resolvePaperChatSourceItem,
  // resolveActiveNoteSession,
  // resolvePreferredConversationSystem,
  // resolveNoteFocusSystemSwitch,
  // resolveShortcutMode,
  createGlobalPortalItem,
  createPaperPortalItem,
} from "./portalScope";

import { buildUI } from "./buildUI";
import {
  setupHandlers,
  type ContextPreviewRenderMetrics,
  type SetupHandlersHooks,
} from "./setupHandlers";

import type { ConversationSystem } from "../../shared/types";
import type { ChatRuntimeMode } from "./types";

import { createElement, HTML_NS } from "../../utils/domHelpers";
import { t } from "../../utils/i18n";

type StandaloneSessionState = {
  pending: boolean;
  window: Window | null;
};

const standaloneSessionState: StandaloneSessionState = {
  pending: false,
  window: null,
};

const STANDALONE_MIN_WIDTH_PX = 500;
const STANDALONE_MIN_HEIGHT_PX = 500;
const STANDALONE_SIDEBAR_PANEL_WIDTH_PX = 220;
const STANDALONE_SIDEBAR_AUTO_COLLAPSE_THRESHOLD_PX =
  STANDALONE_MIN_WIDTH_PX + STANDALONE_SIDEBAR_PANEL_WIDTH_PX;
const STANDALONE_SIDEBAR_AUTO_EXPAND_THRESHOLD_PX = 600;
const STANDALONE_WINDOW_FEATURES =
  "chrome,extrachrome,menubar,resizable,scrollbars,status,centerscreen,dialog=no,dependent=no";



function clampStandaloneWindowSize(win: Window): void {
  try {
    const currentWidth = Math.ceil(
      Number(win.outerWidth || win.innerWidth || 0),
    );
    const currentHeight = Math.ceil(
      Number(win.outerHeight || win.innerHeight || 0),
    );
    if (!Number.isFinite(currentWidth) || !Number.isFinite(currentHeight)) {
      return;
    }
    const nextWidth = Math.max(currentWidth, STANDALONE_MIN_WIDTH_PX);
    const nextHeight = Math.max(currentHeight, STANDALONE_MIN_HEIGHT_PX);
    if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
      win.resizeTo(nextWidth, nextHeight);
    }
  } catch (err) {
    ztoolkit.log("Paper Pilot: standalone minimum size fallback failed", err);
  }
}

function getStandaloneSessionWindow(): Window | null {
  const candidate =
    standaloneSessionState.window || addon.data.standaloneWindow || null;
  if (!candidate || candidate.closed) {
    standaloneSessionState.window = null;
    if (addon.data.standaloneWindow === candidate) {
      addon.data.standaloneWindow = undefined;
    }
    return null;
  }
  standaloneSessionState.window = candidate;
  if (addon.data.standaloneWindow !== candidate) {
    addon.data.standaloneWindow = candidate;
  }
  return candidate;
}

function setStandaloneSessionWindow(win: Window | null): void {
  standaloneSessionState.window = win && !win.closed ? win : null;
  addon.data.standaloneWindow = standaloneSessionState.window || undefined;
}

function setStandalonePending(pending: boolean): void {
  standaloneSessionState.pending = pending;
}


// Callback registered by initWindow for item-change notifications.
let standaloneItemChangeHandler: ((item: Zotero.Item | null) => void) | null =
  null;

/** Called by index.ts onItemChange when the user switches paper tabs. */
export function notifyStandaloneItemChanged(item: Zotero.Item | null): void {
  standaloneItemChangeHandler?.(item);
}

function isStandaloneTrackedBody(body: Element): boolean {
  const standaloneWin = getStandaloneSessionWindow();
  if (standaloneWin && body.ownerDocument === standaloneWin.document) {
    return true;
  }
  return (body as HTMLElement).dataset?.standalone === "true";
}


function renderStandalonePlaceholdersInEmbeddedPanels(
  excludedBody?: Element | null,
): void {
    const seenBodies = new Set<Element>();
  const mainWindows = Zotero.getMainWindows?.() || [];
  for (const win of mainWindows) {
    const panelRoots = win?.document?.querySelectorAll?.("#paperpilot-main") || [];
    for (const panelRoot of panelRoots) {
      const body = (panelRoot as Element).parentElement;
      if (
        !body ||
        !body.isConnected ||
        body === excludedBody ||
        isStandaloneTrackedBody(body) ||
        seenBodies.has(body)
      ) {
        continue;
      }
      renderStandalonePlaceholder(body);
      seenBodies.add(body);
    }
  }
  for (const [body] of activeContextPanels) {
    if (
      !(body as Element).isConnected ||
      body === excludedBody ||
      isStandaloneTrackedBody(body as Element) ||
      seenBodies.has(body as Element)
    ) {
      continue;
    }
    renderStandalonePlaceholder(body as Element);
    seenBodies.add(body as Element);
  }
}

function restoreEmbeddedPanelsAfterStandaloneClose(
  excludedBody?: Element | null,
): void {
    for (const [body] of activeContextPanels) {
    if (excludedBody && body === excludedBody) continue;
    if (!(body as Element).isConnected) {
      // void releaseClaudeRuntimeForBody(body as Element);
      activeContextPanels.delete(body);
      activeContextPanelRawItems.delete(body);
      activeContextPanelStateSync.delete(body);
      continue;
    }
    const rawItem = activeContextPanelRawItems.get(body as Element) || null;
    const resolved = resolveInitialPanelItemState(rawItem, {
      conversationSystem: resolveConversationSystemForItem(rawItem),
    });
    buildUI(body as Element, resolved.item);
    activeContextPanels.set(body, () => resolved.item);
    activeContextPanelRawItems.set(body as Element, rawItem);
    setupHandlers(body as Element, resolved.item || rawItem);
    void (async () => {
      try {
        // if (resolved.item) await ensureConversationLoaded(resolved.item);
        // await renderShortcuts(
        //   body as Element,
        //   resolved.item,
        //   resolveShortcutMode(resolved.item),
        // );
        // refreshChat(body as Element, resolved.item);
      } catch (err) {
        ztoolkit.log("Paper Pilot: side panel restore failed", err);
      }
    })();
  }
}

/**
 * Replace a side-panel body with a placeholder message while the
 * standalone window is open.
 */
export function renderStandalonePlaceholder(body: Element): void {
  if (typeof (body as any).replaceChildren === "function") {
    (body as any).replaceChildren();
  } else {
    body.textContent = "";
  }
  const doc = body.ownerDocument!;
  const wrap = createElement(doc, "div", "paperpilot-standalone-placeholder");
  wrap.style.cssText =
    "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
    "height:100%;gap:12px;padding:24px;text-align:center;color:var(--fill-secondary);";

  const msg = createElement(doc, "div", "", {
    textContent: t("Chat is open in a separate window"),
  });
  msg.style.cssText = "font-size:13px;";

  const focusBtn = createElement(doc, "button", "paperpilot-btn paperpilot-btn-primary", {
    textContent: t("Focus Window"),
    type: "button",
  });
  focusBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;" +
    "padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px;" +
    "background:var(--color-accent,#2563eb);color:#fff;border:none;";
  focusBtn.addEventListener("click", () => {
    getStandaloneSessionWindow()?.focus();
  });

  const closeBtn = createElement(doc, "button", "paperpilot-btn", {
    textContent: t("Close Window & Return Here"),
    type: "button",
  });
  closeBtn.style.cssText =
    "display:flex;align-items:center;justify-content:center;" +
    "padding:6px 16px;border-radius:6px;cursor:pointer;font-size:12px;" +
    "background:none;color:var(--fill-secondary);border:1px solid var(--stroke-secondary,#888);";
  closeBtn.addEventListener("click", () => {
    try {
      const win =
        getStandaloneSessionWindow() ||
        (addon.data.standaloneWindow as Window | undefined) ||
        null;
      ztoolkit.log(
        "Paper Pilot: close standalone clicked, win=",
        Boolean(win),
        "closed=",
        win ? (win as any).closed : "N/A",
      );
      if (win && !(win as any).closed) {
        (win as any).close();
      }
    } catch (err) {
      ztoolkit.log("Paper Pilot: close standalone failed", err);
    }
  });

  wrap.append(msg, focusBtn, closeBtn);
  body.appendChild(wrap);
}

type SidebarConv = {
  conversationID?: string;
  conversationKey: number;
  kind?: "global" | "paper";
  conversationSystem?: ConversationSystem;
  libraryID?: number;
  lastActivityAt: number;
  title?: string;
  userTurnCount?: number;
  sessionVersion?: number;
  paperItemID?: number;
  providerSessionId?: string;
  scopedConversationKey?: string;
  mode?: "open" | "paper";
};

type PendingStandaloneHistoryDeletion = {
  entry: SidebarConv;
  conversationSystem: ConversationSystem;
  wasActive: boolean;
  timeoutId: number | null;
  expiresAt: number;
};
type StandaloneCreateConversationOptions = {
  forceFresh?: boolean;
  excludeConversationKey?: number;
};


// ---------------------------------------------------------------------------
// Standalone window
// ---------------------------------------------------------------------------

/**
 * Open the Paper Pilot chat in a standalone window. If already open, focuses it.
 */
export function openStandaloneChat(options?: {
  initialItem?: Zotero.Item | null;
  initialConversationSystem?: ConversationSystem | null;
  initialRuntimeMode?: ChatRuntimeMode | null;
  sourceBody?: Element | null;
}): void {

}


/** Returns true when the standalone chat window is open or being opened. */
export function isStandaloneWindowActive(): boolean {
  if (standaloneSessionState.pending) return true;
  return Boolean(getStandaloneSessionWindow());
}


