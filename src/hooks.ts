import { initLocale } from "./utils/locale";
import { initI18n } from "./utils/i18n";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { config, PREFERENCES_PANE_ID } from "./modules/contextPanel/constants";
import {
  registerReaderContextPanel,
  registerPaperPilotStyles,
  openStandaloneChat,
} from "./modules/contextPanel";
import { resolveActiveLibraryID } from "./modules/contextPanel/portalScope";
import { registerZoteroItemContextMenu } from "./modules/contextPanel/zoteroItemContextMenu";
import { createZToolkit } from "./utils/ztoolkit";
import { clearAllState, initFontScale } from "./modules/contextPanel/state";

async function measureStartupPhase<T>(
  label: string,
  task: () => Promise<T> | T,
): Promise<T> {
  const start = Date.now();
  try {
    return await task();
  } finally {
    ztoolkit.log(
      `Paper Pilot startup: ${label} completed in ${Date.now() - start}ms`,
    );
  }
}

async function onStartup() {
  await measureStartupPhase("Zotero readiness", () =>
    Promise.all([
      Zotero.initializationPromise,
      Zotero.unlockPromise,
      Zotero.uiReadyPromise,
    ]),
  );

  initLocale();
  initI18n();
  initFontScale();

  registerPrefsPane();

  await measureStartupPhase("main window panel registration", () =>
    Promise.all(Zotero.getMainWindows().map((win) => onMainWindowLoad(win))),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();

  win.MozXULElement.insertFTLIfNeeded(
    `${addon.data.config.addonRef}-mainWindow.ftl`,
  );

  registerPaperPilotStyles(win);
  registerReaderContextPanel();
  registerZoteroItemContextMenu({
    ztoolkit,
    getSelectedItems: () => {
      try {
        const pane = Zotero.getActiveZoteroPane?.() as
          { getSelectedItems?: () => Zotero.Item[] } | undefined;
        const activeItems = pane?.getSelectedItems?.();
        if (Array.isArray(activeItems)) return activeItems;
      } catch {
        void 0;
      }
      try {
        const pane = (
          win as unknown as {
            ZoteroPane?: { getSelectedItems?: () => Zotero.Item[] };
          }
        ).ZoteroPane;
        const selectedItems = pane?.getSelectedItems?.();
        return Array.isArray(selectedItems) ? selectedItems : [];
      } catch {
        return [];
      }
    },
    openStandaloneChat: (options) => {
      openStandaloneChat({ initialItem: options?.initialItem || null });
    },
  });

  // Keyboard shortcut: Ctrl/Cmd+Shift+L
  const doc = win.document;
  const keyset = doc.getElementById("mainKeyset");
  if (keyset) {
    const key = doc.createXULElement("key");
    key.id = "paperpilot-key-standalone";
    key.setAttribute("modifiers", "accel,shift");
    key.setAttribute("key", "L");
    key.setAttribute("oncommand", "void(0)");
    key.addEventListener("command", () => {
      let initialItem: Zotero.Item | null = null;
      try {
        const pane = Zotero.getActiveZoteroPane?.() as
          { getSelectedItems?: () => Zotero.Item[] } | undefined;
        initialItem = pane?.getSelectedItems?.()?.[0] || null;
      } catch {
        void 0;
      }
      if (!initialItem && resolveActiveLibraryID()) {
        openStandaloneChat();
        return;
      }
      openStandaloneChat({ initialItem });
    });
    keyset.appendChild(key);
  }
}

function registerPrefsPane() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    id: PREFERENCES_PANE_ID,
    src: `chrome://${addon.data.config.addonRef}/content/preferences.xhtml`,
    label: "Paper Pilot",
    image: `chrome://${addon.data.config.addonRef}/content/icons/icon.svg`,
  });
}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  addon.data.standaloneWindow?.close();
  win.document.getElementById("paperpilot-open-standalone")?.remove();
  win.document.getElementById("paperpilot-key-standalone")?.remove();
}

function onShutdown(): void {
  if (paperSearchInvalidateTimer !== null) {
    clearTimeout(paperSearchInvalidateTimer);
    paperSearchInvalidateTimer = null;
  }
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  addon.data.standaloneWindow?.close();
  clearAllState();
  // Remove addon object
  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

let paperSearchInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

export function flushPaperSearchInvalidationForTests(): void {
  if (paperSearchInvalidateTimer !== null) {
    clearTimeout(paperSearchInvalidateTimer);
    paperSearchInvalidateTimer = null;
  }
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  const shouldInvalidatePaperSearch =
    (type === "item" || type === "file") &&
    ["add", "modify", "delete", "move", "remove", "trash", "refresh"].includes(
      event,
    );
  if (shouldInvalidatePaperSearch) {
    // Debounce: during bulk operations (import, sync) this fires hundreds
    // of times — coalesce into a single invalidation after 500ms of quiet.
    if (paperSearchInvalidateTimer !== null)
      clearTimeout(paperSearchInvalidateTimer);
    paperSearchInvalidateTimer = setTimeout(() => {
      paperSearchInvalidateTimer = null;
      // invalidatePaperSearchCache();
    }, 500);
  }
  ztoolkit.log("notify", event, type, ids, extraData);
  return;
}
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onDialogEvents(_type: string) {
  return;
}

// Add your hooks here. For element click, etc.
// Keep in mind hooks only do dispatch. Don't add code that does real jobs in hooks.
// Otherwise the code would be hard to read and maintain.

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onDialogEvents,
};
