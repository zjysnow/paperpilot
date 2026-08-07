import { createElement } from "../../utils/domHelpers";
import { registerAddonInPanelDialog } from "../../utils/dialogRegistry";

export type StandaloneConfirmationDialogOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
};

let standaloneConfirmationDialogCounter = 0;

function nextDialogElementId(prefix: string): string {
  standaloneConfirmationDialogCounter += 1;
  return `${prefix}-${standaloneConfirmationDialogCounter}`;
}

function focusElement(element: Element | null | undefined): void {
  const focus = (element as { focus?: (options?: FocusOptions) => void } | null)
    ?.focus;
  if (typeof focus !== "function") return;
  try {
    focus.call(element, { preventScroll: true });
  } catch {
    focus.call(element);
  }
}

export function showStandaloneConfirmationDialog(
  doc: Document,
  options: StandaloneConfirmationDialogOptions,
): Promise<boolean> {
  const parent = doc.body ?? doc.documentElement;
  if (!parent) return Promise.resolve(false);

  return new Promise((resolve) => {
    const previousActiveElement = doc.activeElement;
    const titleId = nextDialogElementId("paperpilotstandalone-confirm-title");
    const messageId = nextDialogElementId("paperpilotstandalone-confirm-message");

    const overlay = createElement(
      doc,
      "div",
      "paperpilotmodal-overlay paperpilotstandalone-confirm-overlay",
    );
    overlay.setAttribute("role", "presentation");

    const dialog = createElement(
      doc,
      "div",
      "paperpilotmodal-dialog paperpilotstandalone-confirm-dialog",
    );
    dialog.setAttribute("role", "alertdialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", messageId);

    const title = createElement(
      doc,
      "div",
      "paperpilotmodal-title paperpilotstandalone-confirm-title",
      {
        id: titleId,
        textContent: options.title,
      },
    );
    const message = createElement(
      doc,
      "div",
      "paperpilotstandalone-confirm-message",
      {
        id: messageId,
        textContent: options.message,
      },
    );
    const actions = createElement(
      doc,
      "div",
      "paperpilotmodal-actions paperpilotstandalone-confirm-actions",
    );
    const cancelButton = createElement(
      doc,
      "button",
      "paperpilotmodal-btn paperpilotmodal-cancel paperpilotstandalone-confirm-btn paperpilotstandalone-confirm-cancel",
      {
        type: "button",
        textContent: options.cancelLabel,
      },
    );
    const confirmButton = createElement(
      doc,
      "button",
      [
        "paperpilotmodal-btn",
        "paperpilotmodal-primary",
        "paperpilotstandalone-confirm-btn",
        "paperpilotstandalone-confirm-primary",
        options.destructive ? "paperpilotstandalone-confirm-destructive" : "",
      ]
        .filter(Boolean)
        .join(" "),
      {
        type: "button",
        textContent: options.confirmLabel,
      },
    );

    actions.append(cancelButton, confirmButton);
    dialog.append(title, message, actions);
    overlay.appendChild(dialog);

    let settled = false;
    let unregisterDialog = () => {};
    const settle = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      unregisterDialog();
      doc.removeEventListener("keydown", onKeydown, true);
      overlay.remove();
      focusElement(previousActiveElement);
      resolve(confirmed);
    };

    const onOverlayClick = (event: MouseEvent) => {
      if (event.target === overlay) settle(false);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      settle(false);
    };

    overlay.addEventListener("click", onOverlayClick);
    cancelButton.addEventListener("click", () => settle(false));
    confirmButton.addEventListener("click", () => settle(true));
    doc.addEventListener("keydown", onKeydown, true);
    unregisterDialog = registerAddonInPanelDialog(doc, () => settle(false));

    parent.appendChild(overlay);
    focusElement(cancelButton);
  });
}
