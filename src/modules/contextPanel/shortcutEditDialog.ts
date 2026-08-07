import { createElement } from "../../utils/domHelpers";
import { registerAddonInPanelDialog } from "../../utils/dialogRegistry";

export type ShortcutEditDialogOptions = {
  title: string;
  initialLabel: string;
  initialPrompt: string;
  labelText: string;
  promptText: string;
  confirmLabel: string;
  cancelLabel: string;
};

let shortcutEditDialogCounter = 0;

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

export function showShortcutEditDialog(
  doc: Document,
  options: ShortcutEditDialogOptions,
): Promise<{ label: string; prompt: string } | null> {
  const parent = doc.body ?? doc.documentElement;
  if (!parent) return Promise.resolve(null);

  return new Promise((resolve) => {
    shortcutEditDialogCounter += 1;
    const instanceId = shortcutEditDialogCounter;
    const titleId = `paperpilotshortcut-edit-title-${instanceId}`;
    const labelInputId = `paperpilotshortcut-label-input-${instanceId}`;
    const promptInputId = `paperpilotshortcut-prompt-input-${instanceId}`;
    const previousActiveElement = doc.activeElement;

    const overlay = createElement(
      doc,
      "div",
      "paperpilotmodal-overlay paperpilotshortcut-edit-overlay",
    );
    overlay.setAttribute("role", "presentation");

    const dialog = createElement(
      doc,
      "div",
      "paperpilotmodal-dialog paperpilotshortcut-edit-dialog",
    );
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", titleId);

    const title = createElement(doc, "div", "paperpilotmodal-title", {
      id: titleId,
      textContent: options.title,
    });
    const form = createElement(
      doc,
      "form",
      "paperpilotshortcut-edit-form",
    ) as HTMLFormElement;

    const labelField = createElement(doc, "div", "paperpilotshortcut-edit-field");
    const label = createElement(doc, "label", "paperpilotshortcut-edit-label", {
      htmlFor: labelInputId,
      textContent: options.labelText,
    });
    const labelInput = createElement(
      doc,
      "input",
      "paperpilotshortcut-edit-control",
      {
        id: labelInputId,
        type: "text",
        value: options.initialLabel,
      },
    );
    labelInput.setAttribute("autocomplete", "off");
    labelField.append(label, labelInput);

    const promptField = createElement(doc, "div", "paperpilotshortcut-edit-field");
    const promptLabel = createElement(doc, "label", "paperpilotshortcut-edit-label", {
      htmlFor: promptInputId,
      textContent: options.promptText,
    });
    const promptInput = createElement(
      doc,
      "textarea",
      "paperpilotshortcut-edit-control paperpilotshortcut-edit-prompt",
      {
        id: promptInputId,
        rows: 6,
        value: options.initialPrompt,
      },
    );
    promptField.append(promptLabel, promptInput);

    const actions = createElement(doc, "div", "paperpilotmodal-actions");
    const cancelButton = createElement(
      doc,
      "button",
      "paperpilotmodal-btn paperpilotmodal-cancel",
      {
        type: "button",
        textContent: options.cancelLabel,
      },
    );
    const confirmButton = createElement(
      doc,
      "button",
      "paperpilotmodal-btn paperpilotmodal-primary",
      {
        type: "submit",
        textContent: options.confirmLabel,
      },
    );

    const syncConfirmState = () => {
      confirmButton.disabled = !promptInput.value.trim();
    };
    syncConfirmState();

    actions.append(cancelButton, confirmButton);
    form.append(labelField, promptField, actions);
    dialog.append(title, form);
    overlay.appendChild(dialog);

    let settled = false;
    let unregisterDialog = () => {};
    const settle = (value: { label: string; prompt: string } | null) => {
      if (settled) return;
      settled = true;
      unregisterDialog();
      doc.removeEventListener("keydown", onKeydown, true);
      overlay.remove();
      focusElement(previousActiveElement);
      resolve(value);
    };
    const onOverlayClick = (event: MouseEvent) => {
      if (event.target === overlay) settle(null);
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      settle(null);
    };

    overlay.addEventListener("click", onOverlayClick);
    promptInput.addEventListener("input", syncConfirmState);
    cancelButton.addEventListener("click", () => settle(null));
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const prompt = promptInput.value.trim();
      if (!prompt) return;
      settle({ label: labelInput.value, prompt: promptInput.value });
    });
    doc.addEventListener("keydown", onKeydown, true);
    unregisterDialog = registerAddonInPanelDialog(doc, () => settle(null));

    parent.appendChild(overlay);
    focusElement(labelInput);
    try {
      labelInput.select();
    } catch {
      // Selection is cosmetic; focus and editing still work without it.
    }
  });
}
