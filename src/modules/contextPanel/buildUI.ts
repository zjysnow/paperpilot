import { createElement } from "../../utils/domHelpers";
import { t } from "../../utils/i18n";

import type { ActionDropdownSpec } from "./types";

function createActionDropdown(doc: Document, spec: ActionDropdownSpec) {
    const slot = createElement(
        doc,
        "div",
        `paperpilot-action-slot ${spec.slotClassName}`.trim(),
        { id: spec.slotId },
    );
    const button = createElement(doc, "button", spec.buttonClassName, {
        id: spec.buttonId,
        textContent: spec.buttonText,
        disabled: spec.disabled,
    });
    const menu = createElement(doc, "div", spec.menuClassName, {
        id: spec.menuId,
    });
    menu.style.display = "none";
    slot.append(button, menu);
    return { slot, button, menu };
}


function buildUI(body: Element, item?: Zotero.Item | null) {

}


export { buildUI };

