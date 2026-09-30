import { createElement } from "../../utils/domHelpers";
import { registerAddonInPanelDialog } from "../../utils/dialogRegistry";
import { t } from "../../utils/i18n";
import { createGlobalPortalItem } from "./portalScope";
import { createPaperPickerController } from "./setupHandlers/controllers/paperPickerController";

const pendingSelections = new WeakMap<Document, Promise<Zotero.Item | null>>();

export function showPaperSelectionDialog(
  doc: Document,
  libraryID: number,
): Promise<Zotero.Item | null> {
  const pending = pendingSelections.get(doc);
  if (pending) return pending;
  const selection = new Promise<Zotero.Item | null>((resolve) => {
    const previousFocus = doc.activeElement;
    const overlay = createElement(doc, "div", "paperpilotmodal-overlay");
    const dialog = createElement(
      doc,
      "div",
      "paperpilotmodal-dialog paperpilotpaper-selection-dialog",
    );
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", t("Select a paper"));
    const title = createElement(doc, "div", "paperpilotmodal-title", {
      textContent: t("Select a paper"),
    });
    const search = createElement(
      doc,
      "textarea",
      "paperpilotconversation-rename-input",
      {
        rows: 1,
        placeholder: t("Search papers by title, author, or year"),
      },
    );
    search.setAttribute(
      "aria-label",
      t("Search papers by title, author, or year"),
    );
    const picker = createElement(doc, "div", "paperpilotpaper-picker");
    picker.style.display = "none";
    const list = createElement(doc, "div", "paperpilotpaper-picker-list");
    list.setAttribute("role", "listbox");
    picker.append(list);
    const status = createElement(
      doc,
      "div",
      "paperpilotstandalone-confirm-message",
    );
    status.setAttribute("role", "status");
    const actions = createElement(doc, "div", "paperpilotmodal-actions");
    const cancel = createElement(
      doc,
      "button",
      "paperpilotmodal-btn paperpilotmodal-cancel",
      {
        type: "button",
        textContent: t("Cancel"),
      },
    );
    actions.append(cancel);
    dialog.append(title, search, picker, status, actions);
    overlay.append(dialog);
    (doc.body ?? doc.documentElement).append(overlay);

    let settled = false;
    let unregister = () => {};
    const settle = (item: Zotero.Item | null) => {
      if (settled) return;
      settled = true;
      unregister();
      doc.removeEventListener("keydown", onKeydown, true);
      controller.closePaperPicker();
      overlay.remove();
      (previousFocus as HTMLElement | null)?.focus?.();
      resolve(item);
    };
    const portal = createGlobalPortalItem(libraryID, 0);
    const controller = createPaperPickerController({
      body: dialog,
      panelRoot: dialog,
      inputBox: search,
      paperPicker: picker,
      paperPickerList: list,
      getItem: () => portal,
      getCurrentLibraryID: () => libraryID,
      onSelectPaper: settle,
      onClose: () => settle(null),
      resolveAutoLoadedPaperContext: () => null,
      getManualPaperContextsForItem: () => [],
      isPaperContextMineru: () => false,
      getTextContextConversationKey: () => null,
      persistDraftInputForCurrentConversation: () => {},
      updatePaperPreviewPreservingScroll: () => {},
      updateSelectedTextPreviewPreservingScroll: () => {},
      setStatusMessage: (message) => {
        status.textContent = message;
      },
      log: (message, ...args) => ztoolkit.log(message, ...args),
    });
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        settle(null);
      } else if (event.key === "Tab") {
        const controls: HTMLElement[] = [];
        for (const control of dialog.querySelectorAll(
          "button:not([disabled]), input:not([disabled]), textarea",
        )) {
          if (!control || control.nodeType !== 1) continue;
          const element = control as HTMLElement;
          if (element.getClientRects().length > 0) controls.push(element);
        }
        const index = controls.indexOf(doc.activeElement as HTMLElement);
        const next =
          (index + (event.shiftKey ? -1 : 1) + controls.length) %
          controls.length;
        event.preventDefault();
        controls[next]?.focus();
      } else if (doc.activeElement === search) {
        const action = {
          ArrowDown: () => controller.moveActiveRow(1),
          ArrowUp: () => controller.moveActiveRow(-1),
          ArrowRight: controller.handleArrowRight,
          ArrowLeft: controller.handleArrowLeft,
          Enter: controller.selectActiveRow,
        }[event.key];
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        action();
      }
    };
    search.addEventListener("input", controller.schedulePaperPickerSearch);
    cancel.addEventListener("click", () => settle(null));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) settle(null);
    });
    doc.addEventListener("keydown", onKeydown, true);
    unregister = registerAddonInPanelDialog(doc, () => settle(null));
    search.focus();
    controller.schedulePaperPickerSearch();
  });
  pendingSelections.set(doc, selection);
  void selection.finally(() => pendingSelections.delete(doc));
  return selection;
}
