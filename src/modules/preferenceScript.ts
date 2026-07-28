import { config } from "../../package.json";
import { t } from "../utils/i18n";




export async function registerPrefsScripts(_window: Window | undefined | null) {
    if (!_window) {
        ztoolkit.log("Preference window not available");
        return;
    }

    const doc = _window.document;

    await new Promise((resolve) => setTimeout(resolve, 100));

    // ── Translate static XHTML text ────────────────────────────────
    // Tab buttons
    const tabButtons = doc.querySelectorAll("[data-pref-tab]");
    for (let i = 0; i < tabButtons.length; i++) {
        const btn = tabButtons[i] as HTMLElement;
        const text = btn.textContent?.trim();
        if (text) btn.textContent = t(text);
    }
    // Walk all labels, spans, and helper text in the preference panels
    // and translate their text content if it matches a known key.
    // Collapse multi-line whitespace into a single space for translation lookup
    const normalizeWs = (s: string): string => s.replace(/\s+/g, " ").trim();

    const translateTextNodes = (container: Element) => {
        const elements = container.querySelectorAll(
        "label, span, div, summary, button, option, a",
        );
        for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        // For labels with inputs, translate the text node after the input
        if (el.tagName.toLowerCase() === "label" && el.querySelector("input")) {
            for (const child of Array.from(el.childNodes)) {
            if (
                child &&
                child.nodeType === 3 /* TEXT_NODE */ &&
                child.textContent &&
                child.textContent.trim()
            ) {
                const original = normalizeWs(child.textContent);
                const translated = t(original);
                if (translated !== original) {
                child.textContent = ` ${translated}`;
                }
            }
            }
            continue;
        }
        // For plain text elements (no children) — replace directly
        if (el.children.length === 0) {
            const text = normalizeWs(el.textContent || "");
            if (text) {
            const translated = t(text);
            if (translated !== text) {
                el.textContent = translated;
            }
            }
            continue;
        }
        // For elements with inline children (e.g., <a>, <br>, <strong>) —
        // translate each text node individually
        for (const child of Array.from(el.childNodes)) {
            if (
            child &&
            child.nodeType === 3 /* TEXT_NODE */ &&
            child.textContent &&
            child.textContent.trim()
            ) {
            const original = normalizeWs(child.textContent);
            const translated = t(original);
            if (translated !== original) {
                child.textContent = ` ${translated} `;
            }
            }
        }
        }
    };
    const translateAttributes = (container: Element) => {
        const elements = container.querySelectorAll(
        "[placeholder], [title], [aria-label]",
        );
        const attrs = ["placeholder", "title", "aria-label"] as const;
        for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        for (const attr of attrs) {
            const value = el.getAttribute(attr);
            if (!value?.trim()) continue;
            const translated = t(normalizeWs(value));
            if (translated !== value) el.setAttribute(attr, translated);
        }
        }
    };
    const prefPanels = doc.querySelectorAll("[data-pref-panel]");
    for (let i = 0; i < prefPanels.length; i++) {
        translateTextNodes(prefPanels[i]);
        translateAttributes(prefPanels[i]);
    }
}
