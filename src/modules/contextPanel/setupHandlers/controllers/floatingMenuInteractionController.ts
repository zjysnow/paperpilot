import { copyTextToClipboard, refreshConversationPanels } from "../../chat";
import { closeShortcutMenu, isShortcutMenuVisible } from "../../shortcuts";
import { setPromptMenuTarget, setResponseMenuTarget } from "../../state";
import {
  MODEL_MENU_OPEN_CLASS,
  REASONING_MENU_OPEN_CLASS,
  RETRY_MODEL_MENU_OPEN_CLASS,
  isFloatingMenuOpen,
  setFloatingMenuOpen,
} from "./menuController";

type FloatingMenuInteractionControllerDeps = {
  body: Element;
  panelDoc: Document;
  chatBox: HTMLDivElement | null;
  modelBtn: HTMLButtonElement | null;
  reasoningBtn: HTMLButtonElement | null;
  modelMenu: HTMLDivElement | null;
  reasoningMenu: HTMLDivElement | null;
  retryModelMenu: HTMLDivElement | null;
  slashMenu: HTMLDivElement | null;
  historyMenu: HTMLDivElement | null;
  historyNewMenu: HTMLDivElement | null;
  historyRowMenu: HTMLDivElement | null;
  promptMenu: HTMLDivElement | null;
  shortcutMenu: HTMLDivElement | null;
  paperPicker: HTMLDivElement | null;
  getPaperChipMenu: () => HTMLDivElement | null;
  getPaperChipMineruCacheMenu: () => HTMLDivElement | null;
  getPaperChipMenuSticky: () => boolean;
  getPaperChipMenuAnchor: () => HTMLElement | null;
  closePaperChipMineruCacheMenu: () => void;
  closePaperChipMenu: () => void;
  getItem: () => Zotero.Item | null;
  getInlineEditTarget: () => unknown;
  getInlineEditCleanup: () => (() => void) | null;
  clearInlineEdit: () => void;
  closePromptMenu: () => void;
  closeRetryModelMenu: () => void;
  closePaperPicker: () => void;
  closeHistoryRowMenu: () => void;
  openRetryModelMenu: (anchor: HTMLButtonElement) => void;
  openModelMenu: () => void;
  closeModelMenu: () => void;
  openReasoningMenu: () => void;
  closeReasoningMenu: () => void;
  clearRetryMenuAnchor: () => void;
  isElementNode: (value: unknown) => value is Element;
};

export function attachFloatingMenuInteractionController(
  deps: FloatingMenuInteractionControllerDeps,
): void {
  const {
    body,
    panelDoc,
    chatBox,
    modelBtn,
    reasoningBtn,
    modelMenu,
    reasoningMenu,
    retryModelMenu,
    slashMenu,
    historyMenu,
    historyNewMenu,
    historyRowMenu,
    promptMenu,
    shortcutMenu,
    paperPicker,
  } = deps;

  for (const menu of [
    modelMenu,
    reasoningMenu,
    retryModelMenu,
    slashMenu,
    historyMenu,
    historyNewMenu,
    shortcutMenu,
  ]) {
    if (!menu) continue;
    menu.addEventListener("pointerdown", (event: Event) => {
      event.stopPropagation();
    });
    menu.addEventListener("mousedown", (event: Event) => {
      event.stopPropagation();
    });
  }

  if (historyRowMenu) {
    historyRowMenu.addEventListener("pointerdown", (event: Event) => {
      event.stopPropagation();
    });
    historyRowMenu.addEventListener("mousedown", (event: Event) => {
      event.stopPropagation();
    });
    historyRowMenu.addEventListener("contextmenu", (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  const bodyWithRetryMenuDismiss = body as Element & {
    __llmRetryMenuDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithRetryMenuDismiss.__llmRetryMenuDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithRetryMenuDismiss.__llmRetryMenuDismissHandler,
      true,
    );
  }
  const dismissRetryMenuOnOutsidePointerDown = (event: PointerEvent) => {
    if (typeof event.button === "number" && event.button !== 0) return;
    if (!retryModelMenu || !isFloatingMenuOpen(retryModelMenu)) return;
    const target = event.target as Node | null;
    if (target && retryModelMenu.contains(target)) return;
    deps.closeRetryModelMenu();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissRetryMenuOnOutsidePointerDown,
    true,
  );
  bodyWithRetryMenuDismiss.__llmRetryMenuDismissHandler =
    dismissRetryMenuOnOutsidePointerDown;

  const bodyWithPromptMenuDismiss = body as Element & {
    __llmPromptMenuDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithPromptMenuDismiss.__llmPromptMenuDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithPromptMenuDismiss.__llmPromptMenuDismissHandler,
      true,
    );
  }
  const dismissPromptMenuOnOutsidePointerDown = (event: PointerEvent) => {
    if (!promptMenu || promptMenu.style.display === "none") return;
    const target = event.target as Node | null;
    if (target && promptMenu.contains(target)) return;
    deps.closePromptMenu();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissPromptMenuOnOutsidePointerDown,
    true,
  );
  bodyWithPromptMenuDismiss.__llmPromptMenuDismissHandler =
    dismissPromptMenuOnOutsidePointerDown;

  const bodyWithPaperPickerDismiss = body as Element & {
    __llmPaperPickerDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithPaperPickerDismiss.__llmPaperPickerDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithPaperPickerDismiss.__llmPaperPickerDismissHandler,
      true,
    );
  }
  const dismissPaperPickerOnOutsidePointerDown = (event: PointerEvent) => {
    if (!paperPicker || paperPicker.style.display === "none") return;
    const target = event.target as Node | null;
    if (target && paperPicker.contains(target)) return;
    const inputBox = body.querySelector("#paperpilotinput") as HTMLElement | null;
    if (target && inputBox?.contains(target)) return;
    deps.closePaperPicker();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissPaperPickerOnOutsidePointerDown,
    true,
  );
  bodyWithPaperPickerDismiss.__llmPaperPickerDismissHandler =
    dismissPaperPickerOnOutsidePointerDown;

  const bodyWithPaperChipDismiss = body as Element & {
    __llmPaperChipDismissHandler?: (event: PointerEvent) => void;
  };
  if (bodyWithPaperChipDismiss.__llmPaperChipDismissHandler) {
    panelDoc.removeEventListener(
      "pointerdown",
      bodyWithPaperChipDismiss.__llmPaperChipDismissHandler,
      true,
    );
  }
  const dismissPaperChipOnOutsidePointerDown = (event: PointerEvent) => {
    if (typeof event.button === "number" && event.button !== 0) return;
    const paperChipMenu = deps.getPaperChipMenu();
    if (
      !deps.getPaperChipMenuSticky() ||
      !paperChipMenu ||
      paperChipMenu.style.display === "none"
    ) {
      return;
    }
    const target = event.target as Node | null;
    if (target && paperChipMenu.contains(target)) return;
    const paperChipMineruCacheMenu = deps.getPaperChipMineruCacheMenu();
    if (target && paperChipMineruCacheMenu?.contains(target)) return;
    const paperChipMenuAnchor = deps.getPaperChipMenuAnchor();
    if (target && paperChipMenuAnchor?.contains(target)) return;
    deps.closePaperChipMineruCacheMenu();
    deps.closePaperChipMenu();
  };
  panelDoc.addEventListener(
    "pointerdown",
    dismissPaperChipOnOutsidePointerDown,
    true,
  );
  bodyWithPaperChipDismiss.__llmPaperChipDismissHandler =
    dismissPaperChipOnOutsidePointerDown;

  const bodyWithShortcutMenuDismiss = body as Element & {
    __llmShortcutMenuDismissHandler?: (event: KeyboardEvent) => void;
  };
  if (bodyWithShortcutMenuDismiss.__llmShortcutMenuDismissHandler) {
    panelDoc.removeEventListener(
      "keydown",
      bodyWithShortcutMenuDismiss.__llmShortcutMenuDismissHandler,
      true,
    );
  }
  const dismissShortcutMenuOnEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    let closed = false;
    const shortcutMenus = Array.from(
      panelDoc.querySelectorAll("#paperpilotshortcut-menu"),
    ) as HTMLDivElement[];
    for (const shortcutMenuEl of shortcutMenus) {
      if (!isShortcutMenuVisible(shortcutMenuEl)) continue;
      closeShortcutMenu(shortcutMenuEl);
      closed = true;
    }
    if (!closed) return;
    event.preventDefault();
    event.stopPropagation();
  };
  panelDoc.addEventListener("keydown", dismissShortcutMenuOnEscape, true);
  bodyWithShortcutMenuDismiss.__llmShortcutMenuDismissHandler =
    dismissShortcutMenuOnEscape;

  if (chatBox) {
    chatBox.addEventListener("click", (event: Event) => {
      if (deps.getInlineEditTarget()) {
        const isInsideEdit = (event.target as Element | null)?.closest(
          ".paperpilotinline-edit-wrapper",
        );
        if (!isInsideEdit) {
          deps.getInlineEditCleanup()?.();
          deps.clearInlineEdit();
          refreshConversationPanels(body, deps.getItem());
          return;
        }
      }

      const target = event.target as Element | null;
      const copyBtn = target?.closest(
        ".paperpilotrender-copy-btn",
      ) as HTMLButtonElement | null;
      if (copyBtn) {
        event.preventDefault();
        event.stopPropagation();
        const copyable = copyBtn.closest(".paperpilotcopyable") as HTMLElement | null;
        const source = copyable?.dataset.llmCopySource || "";
        if (source) {
          copyable?.setAttribute("data-copy-feedback", "copied");
          void copyTextToClipboard(body, source);
        }
        return;
      }

      const linkTarget = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (linkTarget) {
        event.preventDefault();
        event.stopPropagation();
        const href = linkTarget.href?.trim();
        if (href) {
          try {
            const launch = (
              Zotero as unknown as { launchURL?: (url: string) => void }
            ).launchURL;
            if (typeof launch === "function") {
              launch(href);
              return;
            }
          } catch {
            /* ignore */
          }
          try {
            body.ownerDocument?.defaultView?.open?.(href, "_blank");
          } catch {
            /* ignore */
          }
        }
        return;
      }

      const retryTarget = target?.closest(
        ".paperpilotretry-latest",
      ) as HTMLButtonElement | null;
      if (!retryTarget) return;
      event.preventDefault();
      event.stopPropagation();
      deps.closePromptMenu();
      if (!deps.getItem() || !retryModelMenu) return;
      if (isFloatingMenuOpen(retryModelMenu)) {
        deps.closeRetryModelMenu();
      } else {
        deps.openRetryModelMenu(retryTarget);
      }
    });
  }

  if (modelBtn) {
    modelBtn.addEventListener("click", (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!deps.getItem() || !modelMenu || modelBtn.disabled) return;
      if (!isFloatingMenuOpen(modelMenu)) {
        deps.openModelMenu();
      } else {
        deps.closeModelMenu();
      }
    });
  }

  if (reasoningBtn) {
    reasoningBtn.addEventListener("click", (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!deps.getItem() || !reasoningMenu || reasoningBtn.disabled) return;
      if (!isFloatingMenuOpen(reasoningMenu)) {
        deps.openReasoningMenu();
      } else {
        deps.closeReasoningMenu();
      }
    });
  }

  if (
    !(panelDoc as unknown as { __llmModelMenuDismiss?: boolean })
      .__llmModelMenuDismiss
  ) {
    panelDoc.addEventListener("mousedown", (event: Event) => {
      const mouseEvent = event as MouseEvent;
      const modelMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotmodel-menu"),
      ) as HTMLDivElement[];
      const reasoningMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotreasoning-menu"),
      ) as HTMLDivElement[];
      const target = event.target as Node | null;
      const retryButtonTarget = deps.isElementNode(target)
        ? (target.closest(".paperpilotretry-latest") as HTMLButtonElement | null)
        : null;
      const retryModelMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotretry-model-menu"),
      ) as HTMLDivElement[];
      const responseMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotresponse-menu"),
      ) as HTMLDivElement[];
      const promptMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotprompt-menu"),
      ) as HTMLDivElement[];
      const exportMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotexport-menu"),
      ) as HTMLDivElement[];
      const slashMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotslash-menu"),
      ) as HTMLDivElement[];
      const historyMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilothistory-menu"),
      ) as HTMLDivElement[];
      const historyNewMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilothistory-new-menu"),
      ) as HTMLDivElement[];
      const historyRowMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilothistory-row-menu"),
      ) as HTMLDivElement[];
      const shortcutMenus = Array.from(
        panelDoc.querySelectorAll("#paperpilotshortcut-menu"),
      ) as HTMLDivElement[];

      for (const modelMenuEl of modelMenus) {
        if (!isFloatingMenuOpen(modelMenuEl)) continue;
        const panelRoot = modelMenuEl.closest("#paperpilotmain");
        const modelButtonEl = panelRoot?.querySelector(
          "#paperpilotmodel-toggle",
        ) as HTMLButtonElement | null;
        if (
          !target ||
          (!modelMenuEl.contains(target) && !modelButtonEl?.contains(target))
        ) {
          setFloatingMenuOpen(modelMenuEl, MODEL_MENU_OPEN_CLASS, false);
        }
      }
      for (const reasoningMenuEl of reasoningMenus) {
        if (!isFloatingMenuOpen(reasoningMenuEl)) continue;
        const panelRoot = reasoningMenuEl.closest("#paperpilotmain");
        const reasoningButtonEl = panelRoot?.querySelector(
          "#paperpilotreasoning-toggle",
        ) as HTMLButtonElement | null;
        if (
          !target ||
          (!reasoningMenuEl.contains(target) &&
            !reasoningButtonEl?.contains(target))
        ) {
          setFloatingMenuOpen(
            reasoningMenuEl,
            REASONING_MENU_OPEN_CLASS,
            false,
          );
        }
      }
      for (const retryModelMenuEl of retryModelMenus) {
        if (!isFloatingMenuOpen(retryModelMenuEl)) continue;
        const panelRoot = retryModelMenuEl.closest("#paperpilotmain");
        const clickedRetryButtonInSamePanel = Boolean(
          retryButtonTarget &&
          panelRoot &&
          panelRoot.contains(retryButtonTarget),
        );
        if (
          !target ||
          (!retryModelMenuEl.contains(target) && !clickedRetryButtonInSamePanel)
        ) {
          setFloatingMenuOpen(
            retryModelMenuEl,
            RETRY_MODEL_MENU_OPEN_CLASS,
            false,
          );
          deps.clearRetryMenuAnchor();
        }
      }

      for (const shortcutMenuEl of shortcutMenus) {
        if (!isShortcutMenuVisible(shortcutMenuEl)) continue;
        if (target && shortcutMenuEl.contains(target)) continue;
        closeShortcutMenu(shortcutMenuEl);
      }

      if (mouseEvent.button !== 0) return;

      let responseMenuClosed = false;
      for (const responseMenuEl of responseMenus) {
        if (responseMenuEl.style.display === "none") continue;
        if (target && responseMenuEl.contains(target)) continue;
        responseMenuEl.style.display = "none";
        responseMenuClosed = true;
      }
      if (responseMenuClosed) setResponseMenuTarget(null);

      let promptMenuClosed = false;
      for (const promptMenuEl of promptMenus) {
        if (promptMenuEl.style.display === "none") continue;
        if (target && promptMenuEl.contains(target)) continue;
        promptMenuEl.style.display = "none";
        promptMenuClosed = true;
      }
      if (promptMenuClosed) setPromptMenuTarget(null);

      for (const exportMenuEl of exportMenus) {
        if (exportMenuEl.style.display === "none") continue;
        if (target && exportMenuEl.contains(target)) continue;
        const panelRoot = exportMenuEl.closest("#paperpilotmain");
        const exportButtonEl = panelRoot?.querySelector(
          "#paperpilotexport",
        ) as HTMLButtonElement | null;
        if (target && exportButtonEl?.contains(target)) continue;
        exportMenuEl.style.display = "none";
      }

      for (const slashMenuEl of slashMenus) {
        if (slashMenuEl.style.display === "none") continue;
        if (target && slashMenuEl.contains(target)) continue;
        const panelRoot = slashMenuEl.closest("#paperpilotmain");
        const slashButtonEl = panelRoot?.querySelector(
          "#paperpilotupload-file",
        ) as HTMLButtonElement | null;
        if (target && slashButtonEl?.contains(target)) continue;
        slashMenuEl.style.display = "none";
        slashButtonEl?.setAttribute("aria-expanded", "false");
      }

      for (const historyMenuEl of historyMenus) {
        if (historyMenuEl.style.display === "none") continue;
        if (target && historyMenuEl.contains(target)) continue;
        const panelRoot = historyMenuEl.closest("#paperpilotmain");
        const historyToggleEl = panelRoot?.querySelector(
          "#paperpilothistory-toggle",
        ) as HTMLButtonElement | null;
        const historyNewEl = panelRoot?.querySelector(
          "#paperpilothistory-new",
        ) as HTMLButtonElement | null;
        if (target && historyToggleEl?.contains(target)) continue;
        if (target && historyNewEl?.contains(target)) continue;
        historyMenuEl.style.display = "none";
        historyToggleEl?.setAttribute("aria-expanded", "false");
      }

      for (const historyNewMenuEl of historyNewMenus) {
        if (historyNewMenuEl.style.display === "none") continue;
        if (target && historyNewMenuEl.contains(target)) continue;
        const panelRoot = historyNewMenuEl.closest("#paperpilotmain");
        const historyNewEl = panelRoot?.querySelector(
          "#paperpilothistory-new",
        ) as HTMLButtonElement | null;
        if (target && historyNewEl?.contains(target)) continue;
        historyNewMenuEl.style.display = "none";
        historyNewEl?.setAttribute("aria-expanded", "false");
      }

      for (const historyRowMenuEl of historyRowMenus) {
        if (historyRowMenuEl.style.display === "none") continue;
        if (target && historyRowMenuEl.contains(target)) continue;
        deps.closeHistoryRowMenu();
        break;
      }
    });
    (
      panelDoc as unknown as { __llmModelMenuDismiss?: boolean }
    ).__llmModelMenuDismiss = true;
  }
}
