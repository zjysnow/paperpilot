export type PanelDomRefs = {
  inputBox: HTMLTextAreaElement | null;
  inputSection: HTMLDivElement | null;
  sendBtn: HTMLButtonElement | null;
  cancelBtn: HTMLButtonElement | null;
  modelBtn: HTMLButtonElement | null;
  modelSlot: HTMLDivElement | null;
  modelMenu: HTMLDivElement | null;
  reasoningBtn: HTMLButtonElement | null;
  runtimeModeBtn: HTMLButtonElement | null;
  reasoningSlot: HTMLDivElement | null;
  reasoningMenu: HTMLDivElement | null;
  actionsRow: HTMLDivElement | null;
  actionsLeft: HTMLDivElement | null;
  actionsRight: HTMLDivElement | null;
  popoutBtn: HTMLButtonElement | null;
  settingsBtn: HTMLButtonElement | null;
  exportBtn: HTMLButtonElement | null;
  clearBtn: HTMLButtonElement | null;
  titleStatic: HTMLDivElement | null;
  historyBar: HTMLDivElement | null;
  historyNewBtn: HTMLButtonElement | null;
  historyNewMenu: HTMLDivElement | null;
  historyNewOpenBtn: HTMLButtonElement | null;
  historyNewPaperBtn: HTMLButtonElement | null;
  historyToggleBtn: HTMLButtonElement | null;
  historyModeIndicator: HTMLButtonElement | null;
  historyMenu: HTMLDivElement | null;
  modeCapsule: HTMLElement | null;
  modeChipBtn: HTMLButtonElement | null;
  historyRowMenu: HTMLDivElement | null;
  historyRowRenameBtn: HTMLButtonElement | null;
  historyUndo: HTMLDivElement | null;
  historyUndoText: HTMLSpanElement | null;
  historyUndoBtn: HTMLButtonElement | null;
  topToast: HTMLDivElement | null;
  claudeSystemToggleBtn: HTMLButtonElement | null;
  claudeSystemToggleIcon: HTMLSpanElement | null;
  selectTextBtn: HTMLButtonElement | null;
  screenshotBtn: HTMLButtonElement | null;
  uploadBtn: HTMLButtonElement | null;
  uploadInput: HTMLInputElement | null;
  slashMenu: HTMLDivElement | null;
  slashUploadOption: HTMLButtonElement | null;
  slashReferenceOption: HTMLButtonElement | null;
  slashPdfPageOption: HTMLButtonElement | null;
  slashPdfMultiplePagesOption: HTMLButtonElement | null;
  imagePreview: HTMLDivElement | null;
  contextPreviews: HTMLDivElement | null;
  selectedContextList: HTMLDivElement | null;
  previewStrip: HTMLDivElement | null;
  previewExpanded: HTMLDivElement | null;
  previewSelected: HTMLDivElement | null;
  previewSelectedImg: HTMLImageElement | null;
  previewMeta: HTMLButtonElement | null;
  removeImgBtn: HTMLButtonElement | null;
  filePreview: HTMLDivElement | null;
  filePreviewMeta: HTMLButtonElement | null;
  filePreviewExpanded: HTMLDivElement | null;
  filePreviewList: HTMLDivElement | null;
  filePreviewClear: HTMLButtonElement | null;
  paperPreview: HTMLDivElement | null;
  paperPreviewList: HTMLDivElement | null;
  paperPicker: HTMLDivElement | null;
  paperPickerList: HTMLDivElement | null;
  actionPicker: HTMLDivElement | null;
  actionPickerList: HTMLDivElement | null;
  actionHitlPanel: HTMLDivElement | null;
  shortcutMenu: HTMLDivElement | null;
  commandRow: HTMLDivElement | null;
  commandRowBadge: HTMLSpanElement | null;
  queueBar: HTMLDivElement | null;
  responseMenu: HTMLDivElement | null;
  responseMenuCopyBtn: HTMLButtonElement | null;
  responseMenuNoteBtn: HTMLButtonElement | null;
  responseMenuForkBtn: HTMLButtonElement | null;
  responseMenuDeleteBtn: HTMLButtonElement | null;
  promptMenu: HTMLDivElement | null;
  promptMenuForkBtn: HTMLButtonElement | null;
  promptMenuDeleteBtn: HTMLButtonElement | null;
  exportMenu: HTMLDivElement | null;
  exportMenuCopyBtn: HTMLButtonElement | null;
  exportMenuNoteBtn: HTMLButtonElement | null;
  retryModelMenu: HTMLDivElement | null;
  status: HTMLElement | null;
  tokenUsageEl: HTMLElement | null;
  chatBox: HTMLDivElement | null;
  panelRoot: HTMLDivElement | null;
};

export function getPanelDomRefs(body: Element): PanelDomRefs {
  return {
    inputBox: body.querySelector("#paperpilot-input") as HTMLTextAreaElement | null,
    inputSection: body.querySelector(
      ".paperpilot-input-section",
    ) as HTMLDivElement | null,
    sendBtn: body.querySelector("#paperpilot-send") as HTMLButtonElement | null,
    cancelBtn: body.querySelector("#paperpilot-cancel") as HTMLButtonElement | null,
    modelBtn: body.querySelector(
      "#paperpilot-model-toggle",
    ) as HTMLButtonElement | null,
    modelSlot: body.querySelector(
      "#paperpilot-model-dropdown",
    ) as HTMLDivElement | null,
    modelMenu: body.querySelector("#paperpilot-model-menu") as HTMLDivElement | null,
    reasoningBtn: body.querySelector(
      "#paperpilot-reasoning-toggle",
    ) as HTMLButtonElement | null,
    runtimeModeBtn: body.querySelector(
      "#paperpilot-runtime-mode-toggle",
    ) as HTMLButtonElement | null,
    reasoningSlot: body.querySelector(
      "#paperpilot-reasoning-dropdown",
    ) as HTMLDivElement | null,
    reasoningMenu: body.querySelector(
      "#paperpilot-reasoning-menu",
    ) as HTMLDivElement | null,
    actionsRow: body.querySelector(".paperpilot-actions") as HTMLDivElement | null,
    actionsLeft: body.querySelector(
      ".paperpilot-actions-left",
    ) as HTMLDivElement | null,
    actionsRight: body.querySelector(
      ".paperpilot-actions-right",
    ) as HTMLDivElement | null,
    popoutBtn: body.querySelector("#paperpilot-popout") as HTMLButtonElement | null,
    settingsBtn: body.querySelector(
      "#paperpilot-settings",
    ) as HTMLButtonElement | null,
    exportBtn: body.querySelector("#paperpilot-export") as HTMLButtonElement | null,
    clearBtn: body.querySelector("#paperpilot-clear") as HTMLButtonElement | null,
    titleStatic: body.querySelector(
      "#paperpilot-title-static",
    ) as HTMLDivElement | null,
    historyBar: body.querySelector("#paperpilot-history-bar") as HTMLDivElement | null,
    historyNewBtn: body.querySelector(
      "#paperpilot-history-new",
    ) as HTMLButtonElement | null,
    historyNewMenu: body.querySelector(
      "#paperpilot-history-new-menu",
    ) as HTMLDivElement | null,
    historyNewOpenBtn: body.querySelector(
      "#paperpilot-history-new-open",
    ) as HTMLButtonElement | null,
    historyNewPaperBtn: body.querySelector(
      "#paperpilot-history-new-paper",
    ) as HTMLButtonElement | null,
    historyToggleBtn: body.querySelector(
      "#paperpilot-history-toggle",
    ) as HTMLButtonElement | null,
    historyModeIndicator: body.querySelector(
      "#paperpilot-history-toggle",
    ) as HTMLButtonElement | null,
    modeCapsule: body.querySelector("#paperpilot-mode-capsule") as HTMLElement | null,
    modeChipBtn: body.querySelector(
      "#paperpilot-mode-chip",
    ) as HTMLButtonElement | null,
    historyMenu: body.querySelector(
      "#paperpilot-history-menu",
    ) as HTMLDivElement | null,
    historyRowMenu: body.querySelector(
      "#paperpilot-history-row-menu",
    ) as HTMLDivElement | null,
    historyRowRenameBtn: body.querySelector(
      "#paperpilot-history-row-rename",
    ) as HTMLButtonElement | null,
    historyUndo: body.querySelector(
      "#paperpilot-history-undo",
    ) as HTMLDivElement | null,
    historyUndoText: body.querySelector(
      "#paperpilot-history-undo-text",
    ) as HTMLSpanElement | null,
    historyUndoBtn: body.querySelector(
      "#paperpilot-history-undo-btn",
    ) as HTMLButtonElement | null,
    topToast: body.querySelector("#paperpilot-top-toast") as HTMLDivElement | null,
    claudeSystemToggleBtn: body.querySelector(
      "#paperpilot-claude-system-toggle",
    ) as HTMLButtonElement | null,
    claudeSystemToggleIcon: body.querySelector(
      "#paperpilot-claude-system-toggle-icon",
    ) as HTMLSpanElement | null,
    selectTextBtn: body.querySelector(
      "#paperpilot-select-text",
    ) as HTMLButtonElement | null,
    screenshotBtn: body.querySelector(
      "#paperpilot-screenshot",
    ) as HTMLButtonElement | null,
    uploadBtn: body.querySelector(
      "#paperpilot-upload-file",
    ) as HTMLButtonElement | null,
    uploadInput: body.querySelector(
      "#paperpilot-upload-input",
    ) as HTMLInputElement | null,
    slashMenu: body.querySelector("#paperpilot-slash-menu") as HTMLDivElement | null,
    slashUploadOption: body.querySelector(
      "#paperpilot-slash-upload-option",
    ) as HTMLButtonElement | null,
    slashReferenceOption: body.querySelector(
      "#paperpilot-slash-reference-option",
    ) as HTMLButtonElement | null,
    slashPdfPageOption: body.querySelector(
      "#paperpilot-slash-pdf-page-option",
    ) as HTMLButtonElement | null,
    slashPdfMultiplePagesOption: body.querySelector(
      "#paperpilot-slash-pdf-multiple-pages-option",
    ) as HTMLButtonElement | null,
    imagePreview: body.querySelector(
      "#paperpilot-image-preview",
    ) as HTMLDivElement | null,
    contextPreviews: body.querySelector(
      "#paperpilot-context-previews",
    ) as HTMLDivElement | null,
    selectedContextList: body.querySelector(
      "#paperpilot-selected-context-list",
    ) as HTMLDivElement | null,
    previewStrip: body.querySelector(
      "#paperpilot-image-preview-strip",
    ) as HTMLDivElement | null,
    previewExpanded: body.querySelector(
      "#paperpilot-image-preview-expanded",
    ) as HTMLDivElement | null,
    previewSelected: body.querySelector(
      "#paperpilot-image-preview-selected",
    ) as HTMLDivElement | null,
    previewSelectedImg: body.querySelector(
      "#paperpilot-image-preview-selected-img",
    ) as HTMLImageElement | null,
    previewMeta: body.querySelector(
      "#paperpilot-image-preview-meta",
    ) as HTMLButtonElement | null,
    removeImgBtn: body.querySelector(
      "#paperpilot-remove-img",
    ) as HTMLButtonElement | null,
    filePreview: body.querySelector(
      "#paperpilot-file-context-preview",
    ) as HTMLDivElement | null,
    filePreviewMeta: body.querySelector(
      "#paperpilot-file-context-meta",
    ) as HTMLButtonElement | null,
    filePreviewExpanded: body.querySelector(
      "#paperpilot-file-context-expanded",
    ) as HTMLDivElement | null,
    filePreviewList: body.querySelector(
      "#paperpilot-file-context-list",
    ) as HTMLDivElement | null,
    filePreviewClear: body.querySelector(
      "#paperpilot-file-context-clear",
    ) as HTMLButtonElement | null,
    paperPreview: body.querySelector(
      "#paperpilot-paper-context-preview",
    ) as HTMLDivElement | null,
    paperPreviewList: body.querySelector(
      "#paperpilot-paper-context-list",
    ) as HTMLDivElement | null,
    paperPicker: body.querySelector(
      "#paperpilot-paper-picker",
    ) as HTMLDivElement | null,
    paperPickerList: body.querySelector(
      "#paperpilot-paper-picker-list",
    ) as HTMLDivElement | null,
    actionPicker: body.querySelector(
      "#paperpilot-action-picker",
    ) as HTMLDivElement | null,
    actionPickerList: body.querySelector(
      "#paperpilot-action-picker-list",
    ) as HTMLDivElement | null,
    actionHitlPanel: body.querySelector(
      "#paperpilot-action-hitl-panel",
    ) as HTMLDivElement | null,
    shortcutMenu: body.querySelector(
      "#paperpilot-shortcut-menu",
    ) as HTMLDivElement | null,
    commandRow: body.querySelector("#paperpilot-command-row") as HTMLDivElement | null,
    commandRowBadge: body.querySelector(
      "#paperpilot-command-row-badge",
    ) as HTMLSpanElement | null,
    queueBar: body.querySelector(
      "#paperpilot-queued-input-bar",
    ) as HTMLDivElement | null,
    responseMenu: body.querySelector(
      "#paperpilot-response-menu",
    ) as HTMLDivElement | null,
    responseMenuCopyBtn: body.querySelector(
      "#paperpilot-response-menu-copy",
    ) as HTMLButtonElement | null,
    responseMenuNoteBtn: body.querySelector(
      "#paperpilot-response-menu-note",
    ) as HTMLButtonElement | null,
    responseMenuForkBtn: body.querySelector(
      "#paperpilot-response-menu-fork",
    ) as HTMLButtonElement | null,
    responseMenuDeleteBtn: body.querySelector(
      "#paperpilot-response-menu-delete",
    ) as HTMLButtonElement | null,
    promptMenu: body.querySelector("#paperpilot-prompt-menu") as HTMLDivElement | null,
    promptMenuForkBtn: body.querySelector(
      "#paperpilot-prompt-menu-fork",
    ) as HTMLButtonElement | null,
    promptMenuDeleteBtn: body.querySelector(
      "#paperpilot-prompt-menu-delete",
    ) as HTMLButtonElement | null,
    exportMenu: body.querySelector("#paperpilot-export-menu") as HTMLDivElement | null,
    exportMenuCopyBtn: body.querySelector(
      "#paperpilot-export-copy",
    ) as HTMLButtonElement | null,
    exportMenuNoteBtn: body.querySelector(
      "#paperpilot-export-note",
    ) as HTMLButtonElement | null,
    retryModelMenu: body.querySelector(
      "#paperpilot-retry-model-menu",
    ) as HTMLDivElement | null,
    status: body.querySelector("#paperpilot-status") as HTMLElement | null,
    tokenUsageEl: body.querySelector("#paperpilot-token-usage") as HTMLElement | null,
    chatBox: body.querySelector("#paperpilot-chat-box") as HTMLDivElement | null,
    panelRoot: body.querySelector("#paperpilot-main") as HTMLDivElement | null,
  };
}
