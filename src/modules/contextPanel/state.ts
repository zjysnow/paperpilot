


export const activeContextPanels = new Map<Element, () => Zotero.Item | null>();


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
}
