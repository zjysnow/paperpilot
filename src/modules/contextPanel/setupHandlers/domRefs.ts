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
  runtimeSystemControls: HTMLDivElement | null;
  codexSystemToggleBtn: HTMLButtonElement | null;
  claudeSystemToggleBtn: HTMLButtonElement | null;
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
  retryModelMenu: HTMLDivElement | null;
  status: HTMLElement | null;
  tokenUsageEl: HTMLElement | null;
  chatBox: HTMLDivElement | null;
  panelRoot: HTMLDivElement | null;
};

export function getPanelDomRefs(body: Element): PanelDomRefs {
  return {
    inputBox: body.querySelector(
      "#paperpilotinput",
    ) as HTMLTextAreaElement | null,
    inputSection: body.querySelector(
      ".paperpilotinput-section",
    ) as HTMLDivElement | null,
    sendBtn: body.querySelector("#paperpilotsend") as HTMLButtonElement | null,
    cancelBtn: body.querySelector(
      "#paperpilotcancel",
    ) as HTMLButtonElement | null,
    modelBtn: body.querySelector(
      "#paperpilotmodel-toggle",
    ) as HTMLButtonElement | null,
    modelSlot: body.querySelector(
      "#paperpilotmodel-dropdown",
    ) as HTMLDivElement | null,
    modelMenu: body.querySelector(
      "#paperpilotmodel-menu",
    ) as HTMLDivElement | null,
    reasoningBtn: body.querySelector(
      "#paperpilotreasoning-toggle",
    ) as HTMLButtonElement | null,
    runtimeModeBtn: body.querySelector(
      "#paperpilotruntime-mode-toggle",
    ) as HTMLButtonElement | null,
    reasoningSlot: body.querySelector(
      "#paperpilotreasoning-dropdown",
    ) as HTMLDivElement | null,
    reasoningMenu: body.querySelector(
      "#paperpilotreasoning-menu",
    ) as HTMLDivElement | null,
    actionsRow: body.querySelector(
      ".paperpilotactions",
    ) as HTMLDivElement | null,
    actionsLeft: body.querySelector(
      ".paperpilotactions-left",
    ) as HTMLDivElement | null,
    actionsRight: body.querySelector(
      ".paperpilotactions-right",
    ) as HTMLDivElement | null,
    popoutBtn: body.querySelector(
      "#paperpilotpopout",
    ) as HTMLButtonElement | null,
    settingsBtn: body.querySelector(
      "#paperpilotsettings",
    ) as HTMLButtonElement | null,
    exportBtn: body.querySelector(
      "#paperpilotexport",
    ) as HTMLButtonElement | null,
    clearBtn: body.querySelector(
      "#paperpilotclear",
    ) as HTMLButtonElement | null,
    titleStatic: body.querySelector(
      "#paperpilottitle-static",
    ) as HTMLDivElement | null,
    historyBar: body.querySelector(
      "#paperpilothistory-bar",
    ) as HTMLDivElement | null,
    historyNewBtn: body.querySelector(
      "#paperpilothistory-new",
    ) as HTMLButtonElement | null,
    historyNewMenu: body.querySelector(
      "#paperpilothistory-new-menu",
    ) as HTMLDivElement | null,
    historyNewOpenBtn: body.querySelector(
      "#paperpilothistory-new-open",
    ) as HTMLButtonElement | null,
    historyNewPaperBtn: body.querySelector(
      "#paperpilothistory-new-paper",
    ) as HTMLButtonElement | null,
    historyToggleBtn: body.querySelector(
      "#paperpilothistory-toggle",
    ) as HTMLButtonElement | null,
    historyModeIndicator: body.querySelector(
      "#paperpilothistory-toggle",
    ) as HTMLButtonElement | null,
    modeCapsule: body.querySelector(
      "#paperpilotmode-capsule",
    ) as HTMLElement | null,
    modeChipBtn: body.querySelector(
      "#paperpilotmode-chip",
    ) as HTMLButtonElement | null,
    historyMenu: body.querySelector(
      "#paperpilothistory-menu",
    ) as HTMLDivElement | null,
    historyRowMenu: body.querySelector(
      "#paperpilothistory-row-menu",
    ) as HTMLDivElement | null,
    historyRowRenameBtn: body.querySelector(
      "#paperpilothistory-row-rename",
    ) as HTMLButtonElement | null,
    historyUndo: body.querySelector(
      "#paperpilothistory-undo",
    ) as HTMLDivElement | null,
    historyUndoText: body.querySelector(
      "#paperpilothistory-undo-text",
    ) as HTMLSpanElement | null,
    historyUndoBtn: body.querySelector(
      "#paperpilothistory-undo-btn",
    ) as HTMLButtonElement | null,
    topToast: body.querySelector(
      "#paperpilottop-toast",
    ) as HTMLDivElement | null,
    runtimeSystemControls: body.querySelector(
      "#paperpilotruntime-system-controls",
    ) as HTMLDivElement | null,
    codexSystemToggleBtn: body.querySelector(
      "#paperpilotcodex-system-toggle",
    ) as HTMLButtonElement | null,
    claudeSystemToggleBtn: body.querySelector(
      "#paperpilotclaude-system-toggle",
    ) as HTMLButtonElement | null,
    selectTextBtn: body.querySelector(
      "#paperpilotselect-text",
    ) as HTMLButtonElement | null,
    screenshotBtn: body.querySelector(
      "#paperpilotscreenshot",
    ) as HTMLButtonElement | null,
    uploadBtn: body.querySelector(
      "#paperpilotupload-file",
    ) as HTMLButtonElement | null,
    uploadInput: body.querySelector(
      "#paperpilotupload-input",
    ) as HTMLInputElement | null,
    slashMenu: body.querySelector(
      "#paperpilotslash-menu",
    ) as HTMLDivElement | null,
    slashUploadOption: body.querySelector(
      "#paperpilotslash-upload-option",
    ) as HTMLButtonElement | null,
    slashReferenceOption: body.querySelector(
      "#paperpilotslash-reference-option",
    ) as HTMLButtonElement | null,
    slashPdfPageOption: body.querySelector(
      "#paperpilotslash-pdf-page-option",
    ) as HTMLButtonElement | null,
    slashPdfMultiplePagesOption: body.querySelector(
      "#paperpilotslash-pdf-multiple-pages-option",
    ) as HTMLButtonElement | null,
    imagePreview: body.querySelector(
      "#paperpilotimage-preview",
    ) as HTMLDivElement | null,
    contextPreviews: body.querySelector(
      "#paperpilotcontext-previews",
    ) as HTMLDivElement | null,
    selectedContextList: body.querySelector(
      "#paperpilotselected-context-list",
    ) as HTMLDivElement | null,
    previewStrip: body.querySelector(
      "#paperpilotimage-preview-strip",
    ) as HTMLDivElement | null,
    previewExpanded: body.querySelector(
      "#paperpilotimage-preview-expanded",
    ) as HTMLDivElement | null,
    previewSelected: body.querySelector(
      "#paperpilotimage-preview-selected",
    ) as HTMLDivElement | null,
    previewSelectedImg: body.querySelector(
      "#paperpilotimage-preview-selected-img",
    ) as HTMLImageElement | null,
    previewMeta: body.querySelector(
      "#paperpilotimage-preview-meta",
    ) as HTMLButtonElement | null,
    removeImgBtn: body.querySelector(
      "#paperpilotremove-img",
    ) as HTMLButtonElement | null,
    filePreview: body.querySelector(
      "#paperpilotfile-context-preview",
    ) as HTMLDivElement | null,
    filePreviewMeta: body.querySelector(
      "#paperpilotfile-context-meta",
    ) as HTMLButtonElement | null,
    filePreviewExpanded: body.querySelector(
      "#paperpilotfile-context-expanded",
    ) as HTMLDivElement | null,
    filePreviewList: body.querySelector(
      "#paperpilotfile-context-list",
    ) as HTMLDivElement | null,
    filePreviewClear: body.querySelector(
      "#paperpilotfile-context-clear",
    ) as HTMLButtonElement | null,
    paperPreview: body.querySelector(
      "#paperpilotpaper-context-preview",
    ) as HTMLDivElement | null,
    paperPreviewList: body.querySelector(
      "#paperpilotpaper-context-list",
    ) as HTMLDivElement | null,
    paperPicker: body.querySelector(
      "#paperpilotpaper-picker",
    ) as HTMLDivElement | null,
    paperPickerList: body.querySelector(
      "#paperpilotpaper-picker-list",
    ) as HTMLDivElement | null,
    actionPicker: body.querySelector(
      "#paperpilotaction-picker",
    ) as HTMLDivElement | null,
    actionPickerList: body.querySelector(
      "#paperpilotaction-picker-list",
    ) as HTMLDivElement | null,
    actionHitlPanel: body.querySelector(
      "#paperpilotaction-hitl-panel",
    ) as HTMLDivElement | null,
    shortcutMenu: body.querySelector(
      "#paperpilotshortcut-menu",
    ) as HTMLDivElement | null,
    commandRow: body.querySelector(
      "#paperpilotcommand-row",
    ) as HTMLDivElement | null,
    commandRowBadge: body.querySelector(
      "#paperpilotcommand-row-badge",
    ) as HTMLSpanElement | null,
    queueBar: body.querySelector(
      "#paperpilotqueued-input-bar",
    ) as HTMLDivElement | null,
    responseMenu: body.querySelector(
      "#paperpilotresponse-menu",
    ) as HTMLDivElement | null,
    responseMenuCopyBtn: body.querySelector(
      "#paperpilotresponse-menu-copy",
    ) as HTMLButtonElement | null,
    responseMenuNoteBtn: body.querySelector(
      "#paperpilotresponse-menu-note",
    ) as HTMLButtonElement | null,
    responseMenuForkBtn: body.querySelector(
      "#paperpilotresponse-menu-fork",
    ) as HTMLButtonElement | null,
    responseMenuDeleteBtn: body.querySelector(
      "#paperpilotresponse-menu-delete",
    ) as HTMLButtonElement | null,
    promptMenu: body.querySelector(
      "#paperpilotprompt-menu",
    ) as HTMLDivElement | null,
    promptMenuForkBtn: body.querySelector(
      "#paperpilotprompt-menu-fork",
    ) as HTMLButtonElement | null,
    promptMenuDeleteBtn: body.querySelector(
      "#paperpilotprompt-menu-delete",
    ) as HTMLButtonElement | null,
    retryModelMenu: body.querySelector(
      "#paperpilotretry-model-menu",
    ) as HTMLDivElement | null,
    status: body.querySelector("#paperpilotstatus") as HTMLElement | null,
    tokenUsageEl: body.querySelector(
      "#paperpilottoken-usage",
    ) as HTMLElement | null,
    chatBox: body.querySelector("#paperpilotchat-box") as HTMLDivElement | null,
    panelRoot: body.querySelector("#paperpilot-main") as HTMLDivElement | null,
  };
}
