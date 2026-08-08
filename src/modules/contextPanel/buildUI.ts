import { createElement } from "../../utils/domHelpers";
import { t } from "../../utils/i18n";
import {
  PREFERENCES_PANE_ID,
  getSelectTextExpandedLabel,
  getScreenshotExpandedLabel,
  SCREENSHOT_COMPACT_LABEL,
  SELECT_TEXT_COMPACT_LABEL,
  formatFigureCountLabel,
  formatFileCountLabel,
} from "./constants";
import type { ActionDropdownSpec } from "./types";
import {
  getBaseSlashMenuItems,
  resolveSlashActionChatMode,
  type SlashBaseMenuItem,
} from "./slashMenuBehavior";
import {
  getPaperPortalBaseItemID,
  isPaperPortalItem,
  resolveActiveNoteSession,
  resolveDisplayConversationKind,
  resolvePreferredConversationSystem,
} from "./portalScope";
import { getConversationKey } from "./conversationIdentity";
import { createRuntimeSystemControls } from "./runtimeSystemControls";

function createActionDropdown(doc: Document, spec: ActionDropdownSpec) {
  const slot = createElement(
    doc,
    "div",
    `paperpilotaction-slot ${spec.slotClassName}`.trim(),
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
  // Clear this section body before rebuilding.
  if (typeof (body as any).replaceChildren === "function") {
    (body as any).replaceChildren();
  } else {
    body.textContent = "";
  }
  const doc = body.ownerDocument!;
  const hasItem = Boolean(item);
  const activeNoteSession = resolveActiveNoteSession(item);
  const displayConversationKind = resolveDisplayConversationKind(item);
  const isGlobalMode = displayConversationKind === "global";
  const isPaperMode = displayConversationKind === "paper";
  const conversationItemId = hasItem && item ? getConversationKey(item) : 0;
  const basePaperItemId =
    hasItem && item
      ? activeNoteSession?.parentItemId ||
        (isPaperPortalItem(item)
          ? getPaperPortalBaseItemID(item) || 0
          : item.isAttachment() && item.parentID
            ? item.parentID
            : isPaperMode
              ? item.id
              : 0)
      : 0;

  // Disable CSS scroll anchoring on the Zotero-provided panel body so that
  // Gecko doesn't fight with our programmatic scroll management.
  if (body instanceof (doc.defaultView?.HTMLElement || HTMLElement)) {
    const hostBody = body as HTMLElement;
    hostBody.style.overflowAnchor = "none";
    // Keep panel host width-bound: descendants (e.g., long KaTeX blocks)
    // must never raise the side panel's minimum width.
    hostBody.style.minWidth = "0";
    hostBody.style.width = "100%";
    hostBody.style.maxWidth = "100%";
    hostBody.style.overflowX = "hidden";
    hostBody.style.boxSizing = "border-box";
  }

  // Main container
  const container = createElement(doc, "div", "paperpilotpanel", {
    id: "paperpilot-main",
  });
  container.dataset.itemId =
    conversationItemId > 0 ? `${conversationItemId}` : "";
  container.dataset.libraryId = hasItem && item ? `${item.libraryID}` : "";
  container.dataset.conversationKind = activeNoteSession
    ? activeNoteSession.conversationKind
    : hasItem
      ? isGlobalMode
        ? "global"
        : "paper"
      : "";
  container.dataset.conversationSystem = resolvePreferredConversationSystem({
    item,
  });
  container.dataset.basePaperItemId =
    basePaperItemId > 0 ? `${basePaperItemId}` : "";
  container.dataset.noteKind = activeNoteSession?.noteKind || "";
  container.dataset.noteId = activeNoteSession?.noteId
    ? `${activeNoteSession.noteId}`
    : "";
  container.dataset.noteTitle = activeNoteSession?.title || "";
  container.dataset.noteParentItemId = activeNoteSession?.parentItemId
    ? `${activeNoteSession.parentItemId}`
    : "";

  // Header section
  const header = createElement(doc, "div", "paperpilotheader");
  const headerTop = createElement(doc, "div", "paperpilotheader-top");
  const headerInfo = createElement(doc, "div", "paperpilotheader-info");
  // const headerIcon = createElement(doc, "img", "paperpilotheader-icon", {
  //   alt: "LLM",
  //   src: iconUrl,
  // });
  // const title = createElement(doc, "div", "paperpilottitle", {
  //   textContent: "LLM Assistant",
  // });
  const title = createElement(doc, "div", "paperpilottitle", {
    id: "paperpilottitle-static",
    textContent: t("Paper Pilot"),
  });
  if (hasItem) {
    title.style.display = "none";
  }
  const historyBar = createElement(doc, "div", "paperpilothistory-bar", {
    id: "paperpilothistory-bar",
  });
  historyBar.style.display = hasItem ? "inline-flex" : "none";
  const historyNewBtn = createElement(doc, "button", "paperpilothistory-new", {
    id: "paperpilothistory-new",
    type: "button",
    textContent: "",
    title: t("Start a new chat"),
  });
  historyNewBtn.setAttribute("aria-label", t("Start a new chat"));
  historyNewBtn.style.display = "";

  // History toggle button (clock icon)
  const historyToggle = createElement(
    doc,
    "button",
    "paperpilothistory-toggle",
    {
      id: "paperpilothistory-toggle",
      type: "button",
      title: t("Conversation history"),
    },
  );
  historyToggle.setAttribute("aria-label", t("Conversation history"));
  historyToggle.setAttribute("aria-haspopup", "menu");
  historyToggle.setAttribute("aria-expanded", "false");
  historyToggle.style.display = "";

  const isStandaloneBody = (body as HTMLElement).dataset?.standalone === "true";
  const headerRuntimeControls = createElement(
    doc,
    "div",
    "paperpilotheader-runtime-controls",
    {
      id: "paperpilotheader-runtime-controls",
    },
  );

  // Mode chip: single pill showing current mode
  const modeSwitchWrap = createElement(doc, "div", "paperpilotmode-switch", {
    id: "paperpilotmode-capsule",
  });
  modeSwitchWrap.dataset.mode = hasItem && isGlobalMode ? "global" : "paper";

  const modeChipLabel = activeNoteSession
    ? activeNoteSession.conversationKind === "global"
      ? t("Library chat")
      : t("Paper chat")
    : isGlobalMode
      ? t("Library chat")
      : t("Paper chat");
  const modeChipBtn = createElement(doc, "button", "paperpilotmode-chip", {
    id: "paperpilotmode-chip",
    type: "button",
    textContent: modeChipLabel,
    title: modeChipLabel,
  });
  modeChipBtn.setAttribute("aria-label", modeChipLabel);

  modeSwitchWrap.append(modeChipBtn);

  const runtimeSystemControls = createRuntimeSystemControls(doc, {
    groupId: "paperpilotruntime-system-controls",
    groupClassName: "paperpilotpanel-runtime-system-controls",
    buttonClassName: "paperpilotpanel-runtime-system-toggle",
    buttonIds: {
      codex: "paperpilotcodex-system-toggle",
      claude_code: "paperpilotclaude-system-toggle",
    },
  });

  const claudeContextGauge = createElement(
    doc,
    "div",
    "paperpilotclaude-context-gauge",
    {
      id: "paperpilotclaude-context-gauge",
    },
  ) as HTMLDivElement;
  claudeContextGauge.style.display = "none";
  claudeContextGauge.setAttribute("aria-hidden", "true");

  headerRuntimeControls.append(
    modeSwitchWrap,
    runtimeSystemControls.group,
    claudeContextGauge,
  );
  historyBar.append(historyNewBtn, historyToggle, headerRuntimeControls);

  headerInfo.append(title, historyBar);
  headerTop.appendChild(headerInfo);

  const headerActions = createElement(doc, "div", "paperpilotheader-actions");
  const popoutBtn = createElement(
    doc,
    "button",
    "paperpilotbtn-icon paperpilotpopout-btn",
    {
      id: "paperpilotpopout",
      type: "button",
      title: t("Open in Window"),
    },
  );
  popoutBtn.setAttribute("aria-label", t("Open chat in a standalone window"));
  const settingsBtn = createElement(
    doc,
    "button",
    "paperpilotbtn-icon paperpilotsettings-btn",
    {
      id: "paperpilotsettings",
      type: "button",
      title: t("Settings"),
    },
  );
  settingsBtn.setAttribute("aria-label", t("Open plugin settings"));
  settingsBtn.dataset.preferencesPaneId = PREFERENCES_PANE_ID;
  const exportBtn = createElement(
    doc,
    "button",
    "paperpilotbtn-icon paperpilotexport-btn",
    {
      id: "paperpilotexport",
      type: "button",
      title: t("Export"),
      disabled: !hasItem,
    },
  );
  exportBtn.setAttribute("aria-label", t("Export"));
  const clearBtn = createElement(
    doc,
    "button",
    "paperpilotbtn-icon paperpilotclear-btn",
    {
      id: "paperpilotclear",
      type: "button",
      textContent: t("Clear"),
      title: t("Clear"),
    },
  );
  clearBtn.dataset.compact = "true";
  clearBtn.setAttribute("aria-label", t("Clear"));
  headerActions.append(popoutBtn, settingsBtn, exportBtn, clearBtn);
  headerTop.appendChild(headerActions);
  header.appendChild(headerTop);
  const historyMenu = createElement(doc, "div", "paperpilothistory-menu", {
    id: "paperpilothistory-menu",
  });
  historyMenu.style.display = "none";
  header.appendChild(historyMenu);

  const historyRowMenu = createElement(
    doc,
    "div",
    "paperpilothistory-row-menu",
    {
      id: "paperpilothistory-row-menu",
    },
  );
  historyRowMenu.style.display = "none";
  const historyRowRenameBtn = createElement(
    doc,
    "button",
    "paperpilothistory-row-menu-item",
    {
      id: "paperpilothistory-row-rename",
      type: "button",
      textContent: t("Rename"),
      title: t("Rename chat"),
    },
  );
  historyRowMenu.append(historyRowRenameBtn);
  header.appendChild(historyRowMenu);

  const historyUndo = createElement(doc, "div", "paperpilothistory-undo", {
    id: "paperpilothistory-undo",
  });
  historyUndo.style.display = "none";
  const historyUndoText = createElement(
    doc,
    "span",
    "paperpilothistory-undo-text",
    {
      id: "paperpilothistory-undo-text",
      textContent: "",
    },
  );
  const historyUndoBtn = createElement(
    doc,
    "button",
    "paperpilothistory-undo-btn",
    {
      id: "paperpilothistory-undo-btn",
      type: "button",
      textContent: t("Undo"),
      title: t("Restore deleted conversation"),
    },
  );
  historyUndo.append(historyUndoText, historyUndoBtn);
  header.appendChild(historyUndo);

  const topToast = createElement(doc, "div", "paperpilottop-toast", {
    id: "paperpilottop-toast",
    textContent: "",
  });
  topToast.style.display = "none";
  topToast.setAttribute("role", "status");
  topToast.setAttribute("aria-live", "polite");
  topToast.setAttribute("aria-hidden", "true");
  header.appendChild(topToast);

  container.appendChild(header);

  // Chat display area
  const chatShell = createElement(doc, "div", "paperpilotchat-shell", {
    id: "paperpilotchat-shell",
  });
  const chatBox = createElement(doc, "div", "paperpilotmessages", {
    id: "paperpilotchat-box",
  });
  chatShell.append(chatBox);
  if (isStandaloneBody) {
    const chatResizeHandle = createElement(
      doc,
      "div",
      "paperpilotstandalone-resize-handle",
    );
    chatResizeHandle.dataset.resizeTarget = "chat";
    chatResizeHandle.setAttribute("aria-hidden", "true");
    chatShell.appendChild(chatResizeHandle);
  }
  container.appendChild(chatShell);

  // Shortcuts row
  const shortcutsRow = createElement(doc, "div", "paperpilotshortcuts", {
    id: "paperpilotshortcuts",
  });
  container.appendChild(shortcutsRow);

  // Shortcut context menu
  const shortcutMenu = createElement(doc, "div", "paperpilotshortcut-menu", {
    id: "paperpilotshortcut-menu",
  });
  shortcutMenu.style.display = "none";
  const menuEditBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-menu-item",
    {
      id: "paperpilotshortcut-menu-edit",
      type: "button",
      textContent: t("Edit"),
    },
  );
  const menuDeleteBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-menu-item",
    {
      id: "paperpilotshortcut-menu-delete",
      type: "button",
      textContent: t("Delete"),
    },
  );
  const menuAddBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-menu-item",
    {
      id: "paperpilotshortcut-menu-add",
      type: "button",
      textContent: t("Add"),
    },
  );
  const menuMoveBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-menu-item",
    {
      id: "paperpilotshortcut-menu-move",
      type: "button",
      textContent: t("Move"),
    },
  );
  const menuResetBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-menu-item",
    {
      id: "paperpilotshortcut-menu-reset",
      type: "button",
      textContent: t("Reset"),
    },
  );
  shortcutMenu.append(
    menuEditBtn,
    menuDeleteBtn,
    menuAddBtn,
    menuMoveBtn,
    menuResetBtn,
  );
  container.appendChild(shortcutMenu);

  // Response context menu
  const responseMenu = createElement(doc, "div", "paperpilotresponse-menu", {
    id: "paperpilotresponse-menu",
  });
  responseMenu.style.display = "none";
  const responseMenuCopyBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotresponse-menu-copy",
      type: "button",
      textContent: t("Copy"),
    },
  );
  const responseMenuNoteBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotresponse-menu-note",
      type: "button",
      textContent: t("Save as note"),
    },
  );
  const responseMenuDeleteBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotresponse-menu-delete",
      type: "button",
      textContent: t("Delete this turn"),
      title: t("Delete this prompt and response"),
    },
  );
  const responseMenuForkBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotresponse-menu-fork",
      type: "button",
      textContent: t("Fork this turn"),
      title: t("Start a new chat from this turn"),
    },
  );
  responseMenu.append(
    responseMenuCopyBtn,
    responseMenuNoteBtn,
    responseMenuForkBtn,
    responseMenuDeleteBtn,
  );
  container.appendChild(responseMenu);

  // Prompt context menu
  const promptMenu = createElement(doc, "div", "paperpilotresponse-menu", {
    id: "paperpilotprompt-menu",
  });
  promptMenu.style.display = "none";
  const promptMenuDeleteBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotprompt-menu-delete",
      type: "button",
      textContent: t("Delete this turn"),
      title: t("Delete this prompt and response"),
    },
  );
  const promptMenuForkBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotprompt-menu-fork",
      type: "button",
      textContent: t("Fork this turn"),
      title: t("Start a new chat from this turn"),
    },
  );
  promptMenu.append(promptMenuForkBtn, promptMenuDeleteBtn);
  container.appendChild(promptMenu);

  // Export menu
  const exportMenu = createElement(doc, "div", "paperpilotresponse-menu", {
    id: "paperpilotexport-menu",
  });
  exportMenu.style.display = "none";
  const exportMenuCopyBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotexport-copy",
      type: "button",
      textContent: t("Copy chat as md"),
    },
  );
  const exportMenuNoteBtn = createElement(
    doc,
    "button",
    "paperpilotresponse-menu-item",
    {
      id: "paperpilotexport-note",
      type: "button",
      textContent: t("Save chat as note"),
    },
  );
  exportMenu.append(exportMenuCopyBtn, exportMenuNoteBtn);
  container.appendChild(exportMenu);

  const slashMenu = createElement(
    doc,
    "div",
    "paperpilotresponse-menu paperpilotslash-menu",
    {
      id: "paperpilotslash-menu",
    },
  );
  slashMenu.style.display = "none";
  const slashList = createElement(
    doc,
    "div",
    "paperpilotaction-picker-list",
    {},
  );
  const makeSlashItem = (id: string, title: string, desc: string) => {
    const btn = createElement(doc, "button", "paperpilotaction-picker-item", {
      id,
      type: "button",
      title: desc,
    });
    btn.setAttribute("data-slash-base-item", "true");
    const titleEl = createElement(
      doc,
      "span",
      "paperpilotaction-picker-title",
      {
        textContent: title,
      },
    );
    btn.append(titleEl);
    return btn;
  };
  const slashUploadBtn = makeSlashItem(
    "paperpilotslash-upload-option",
    t("Upload files"),
    t("Add documents or images"),
  );
  const slashReferenceBtn = makeSlashItem(
    "paperpilotslash-reference-option",
    t("Select references"),
    t("Add papers from your library"),
  );
  const slashPdfPageBtn = makeSlashItem(
    "paperpilotslash-pdf-page-option",
    t("Send current PDF page"),
    t("Capture the visible page as an image"),
  );
  const slashPdfMultiplePagesBtn = makeSlashItem(
    "paperpilotslash-pdf-multiple-pages-option",
    t("Send multiple PDF pages"),
    t("Select pages from the open PDF"),
  );
  const slashBaseButtons: Record<SlashBaseMenuItem, HTMLButtonElement> = {
    upload: slashUploadBtn,
    reference: slashReferenceBtn,
    pdfPage: slashPdfPageBtn,
    pdfMultiplePages: slashPdfMultiplePagesBtn,
  };
  slashList.append(
    ...getBaseSlashMenuItems(
      resolveSlashActionChatMode(displayConversationKind),
    ).map((entry) => slashBaseButtons[entry]),
  );
  slashMenu.append(slashList);
  // slashMenu is appended to composeArea below (after composeArea is created)

  // Retry model menu (opened from latest assistant retry action)
  const retryModelMenu = createElement(doc, "div", "paperpilotmodel-menu", {
    id: "paperpilotretry-model-menu",
  });
  retryModelMenu.style.display = "none";
  container.appendChild(retryModelMenu);

  // Input section
  const inputSection = createElement(doc, "div", "paperpilotinput-section");
  const contextPreviews = createElement(
    doc,
    "div",
    "paperpilotcontext-previews",
    {
      id: "paperpilotcontext-previews",
    },
  );
  const runtimeModeBtn = createElement(
    doc,
    "button",
    "paperpilotcontext-agent-toggle paperpilotagent-process-summary",
    {
      id: "paperpilotruntime-mode-toggle",
      type: "button",
      title: t("Switch to Agent mode"),
      disabled: !hasItem,
    },
  );
  runtimeModeBtn.setAttribute("aria-label", t("Switch to Agent mode"));
  runtimeModeBtn.setAttribute("aria-pressed", "false");
  const runtimeModeIndicator = createElement(
    doc,
    "span",
    "paperpilotagent-toggle-indicator",
  );
  runtimeModeIndicator.setAttribute("aria-hidden", "true");
  const runtimeModeLabel = createElement(
    doc,
    "span",
    "paperpilotagent-toggle-label paperpilotagent-process-summary-label",
    {
      textContent: t("Agent mode"),
    },
  );
  runtimeModeBtn.append(runtimeModeIndicator, runtimeModeLabel);
  contextPreviews.appendChild(runtimeModeBtn);
  const selectedContextList = createElement(
    doc,
    "div",
    "paperpilotselected-context-list",
    {
      id: "paperpilotselected-context-list",
    },
  );
  selectedContextList.style.display = "none";

  const paperPreview = createElement(
    doc,
    "div",
    "paperpilotpaper-context-inline",
    {
      id: "paperpilotpaper-context-preview",
    },
  );
  paperPreview.style.display = "none";
  const paperPreviewList = createElement(
    doc,
    "div",
    "paperpilotpaper-context-inline-list",
    {
      id: "paperpilotpaper-context-list",
    },
  );
  paperPreview.append(paperPreviewList);
  contextPreviews.appendChild(paperPreview);
  contextPreviews.appendChild(selectedContextList);

  // Image preview area (shows selected screenshot)
  const imagePreview = createElement(doc, "div", "paperpilotimage-preview", {
    id: "paperpilotimage-preview",
  });
  imagePreview.style.display = "none";

  const imagePreviewMeta = createElement(
    doc,
    "button",
    "paperpilotimage-preview-meta",
    {
      id: "paperpilotimage-preview-meta",
      type: "button",
      textContent: formatFigureCountLabel(0),
      title: t("Expand figures"),
    },
  );
  const imagePreviewHeader = createElement(
    doc,
    "div",
    "paperpilotimage-preview-header",
    {
      id: "paperpilotimage-preview-header",
    },
  );
  const removeImgBtn = createElement(
    doc,
    "button",
    "paperpilotremove-img-btn",
    {
      id: "paperpilotremove-img",
      type: "button",
      textContent: "×",
      title: t("Clear selected screenshots"),
    },
  );
  removeImgBtn.setAttribute("aria-label", t("Clear selected screenshots"));
  imagePreviewHeader.append(imagePreviewMeta, removeImgBtn);

  const imagePreviewExpanded = createElement(
    doc,
    "div",
    "paperpilotimage-preview-expanded",
    {
      id: "paperpilotimage-preview-expanded",
    },
  );
  const previewStrip = createElement(
    doc,
    "div",
    "paperpilotimage-preview-strip",
    {
      id: "paperpilotimage-preview-strip",
    },
  );
  const previewLargeWrap = createElement(
    doc,
    "div",
    "paperpilotimage-preview-selected",
    {
      id: "paperpilotimage-preview-selected",
    },
  );
  const previewLargeImg = createElement(
    doc,
    "img",
    "paperpilotimage-preview-selected-img",
    {
      id: "paperpilotimage-preview-selected-img",
      alt: t("Selected screenshot preview"),
    },
  ) as HTMLImageElement;
  previewLargeWrap.appendChild(previewLargeImg);

  imagePreviewExpanded.append(previewStrip, previewLargeWrap);
  imagePreview.append(imagePreviewHeader, imagePreviewExpanded);
  contextPreviews.appendChild(imagePreview);

  const filePreview = createElement(doc, "div", "paperpilotimage-preview", {
    id: "paperpilotfile-context-preview",
  });
  filePreview.style.display = "none";
  const filePreviewMeta = createElement(
    doc,
    "button",
    "paperpilotimage-preview-meta paperpilotfile-context-meta",
    {
      id: "paperpilotfile-context-meta",
      type: "button",
      textContent: formatFileCountLabel(0),
      title: t("Expand files"),
    },
  );
  const filePreviewHeader = createElement(
    doc,
    "div",
    "paperpilotimage-preview-header",
    {
      id: "paperpilotfile-context-header",
    },
  );
  const filePreviewClear = createElement(
    doc,
    "button",
    "paperpilotremove-img-btn",
    {
      id: "paperpilotfile-context-clear",
      type: "button",
      textContent: "×",
      title: t("Clear uploaded files"),
    },
  );
  filePreviewHeader.append(filePreviewMeta, filePreviewClear);
  const filePreviewExpanded = createElement(
    doc,
    "div",
    "paperpilotimage-preview-expanded paperpilotfile-context-expanded",
    {
      id: "paperpilotfile-context-expanded",
    },
  );
  const filePreviewList = createElement(
    doc,
    "div",
    "paperpilotfile-context-list",
    {
      id: "paperpilotfile-context-list",
    },
  );
  filePreviewExpanded.append(filePreviewList);
  filePreview.append(filePreviewHeader, filePreviewExpanded);
  contextPreviews.appendChild(filePreview);

  const paperPicker = createElement(doc, "div", "paperpilotpaper-picker", {
    id: "paperpilotpaper-picker",
  });
  paperPicker.style.display = "none";
  const paperPickerList = createElement(
    doc,
    "div",
    "paperpilotpaper-picker-list",
    {
      id: "paperpilotpaper-picker-list",
    },
  );
  paperPickerList.setAttribute("role", "listbox");
  paperPicker.appendChild(paperPickerList);
  inputSection.appendChild(paperPicker);

  inputSection.appendChild(contextPreviews);

  const composeArea = createElement(doc, "div", "paperpilotcompose-area", {
    id: "paperpilotcompose-area",
  });
  inputSection.appendChild(composeArea);

  const actionPicker = createElement(doc, "div", "paperpilotaction-picker", {
    id: "paperpilotaction-picker",
  });
  actionPicker.style.display = "none";
  const actionPickerList = createElement(
    doc,
    "div",
    "paperpilotaction-picker-list",
    {
      id: "paperpilotaction-picker-list",
    },
  );
  actionPickerList.setAttribute("role", "listbox");
  actionPicker.appendChild(actionPickerList);
  composeArea.appendChild(actionPicker);
  composeArea.appendChild(slashMenu);

  const actionHitlPanel = createElement(
    doc,
    "div",
    "paperpilotaction-hitl-panel",
    {
      id: "paperpilotaction-hitl-panel",
    },
  );
  actionHitlPanel.style.display = "none";
  composeArea.appendChild(actionHitlPanel);

  // Command row — shows active skill/action badge above textarea
  // Uses the exact same chip DOM as paper context chips
  const commandRow = createElement(
    doc,
    "div",
    "paperpilotcommand-row paperpilotselected-context",
    { id: "paperpilotcommand-row" },
  );
  const commandRowHeader = createElement(
    doc,
    "div",
    "paperpilotimage-preview-header paperpilotselected-context-header paperpilotpaper-context-chip-header",
  );
  const commandRowLabel = createElement(
    doc,
    "span",
    "paperpilotpaper-context-chip-label",
    { id: "paperpilotcommand-row-badge" },
  );
  const commandRowClear = createElement(
    doc,
    "button",
    "paperpilotremove-img-btn paperpilotpaper-context-clear",
    {
      type: "button",
      textContent: "\u00d7",
      title: t("Clear"),
    },
  );
  commandRowHeader.appendChild(commandRowLabel);
  commandRowHeader.appendChild(commandRowClear);
  commandRow.appendChild(commandRowHeader);
  composeArea.appendChild(commandRow);

  const queueBar = createElement(doc, "div", "paperpilotqueued-input-bar", {
    id: "paperpilotqueued-input-bar",
  });
  queueBar.style.display = "none";
  composeArea.appendChild(queueBar);

  const inputBox = createElement(doc, "textarea", "paperpilotinput", {
    id: "paperpilotinput",
    placeholder: hasItem
      ? isGlobalMode
        ? t("Ask anything... Type / for actions, @ to add papers")
        : t("Ask about this paper... Type / for actions, @ to add papers")
      : t("Open a PDF first"),
    disabled: !hasItem,
  });
  if (isStandaloneBody) {
    const inputResizeWrap = createElement(
      doc,
      "div",
      "paperpilotstandalone-input-resize-wrap",
    );
    const inputResizeHandle = createElement(
      doc,
      "div",
      "paperpilotstandalone-resize-handle",
    );
    inputResizeHandle.dataset.resizeTarget = "input";
    inputResizeHandle.setAttribute("aria-hidden", "true");
    inputResizeWrap.append(inputBox, inputResizeHandle);
    composeArea.appendChild(inputResizeWrap);
  } else {
    composeArea.appendChild(inputBox);
  }

  // Actions row
  const actionsRow = createElement(doc, "div", "paperpilotactions");
  const actionsLeft = createElement(doc, "div", "paperpilotactions-left");
  const actionsRight = createElement(doc, "div", "paperpilotactions-right");

  const selectTextBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-secondary paperpilotselect-text-btn paperpilotaction-icon-only",
    {
      id: "paperpilotselect-text",
      textContent: SELECT_TEXT_COMPACT_LABEL,
      title: t("Include selected reader text"),
      disabled: !hasItem,
    },
  );
  selectTextBtn.setAttribute("aria-label", getSelectTextExpandedLabel());
  const selectTextSlot = createElement(doc, "div", "paperpilotaction-slot");
  selectTextSlot.appendChild(selectTextBtn);

  // Screenshot button
  const screenshotBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-secondary paperpilotscreenshot-btn paperpilotaction-icon-only",
    {
      id: "paperpilotscreenshot",
      textContent: SCREENSHOT_COMPACT_LABEL,
      title: t("Select figure screenshot"),
      disabled: !hasItem,
    },
  );
  screenshotBtn.setAttribute("aria-label", getScreenshotExpandedLabel());
  const screenshotSlot = createElement(doc, "div", "paperpilotaction-slot");
  screenshotSlot.appendChild(screenshotBtn);

  const uploadBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-secondary paperpilotupload-file-btn paperpilotslash-menu-btn",
    {
      id: "paperpilotupload-file",
      type: "button",
      textContent: "/",
      title: t("Slash commands"),
      disabled: !hasItem,
    },
  );
  uploadBtn.setAttribute("aria-haspopup", "menu");
  uploadBtn.setAttribute("aria-expanded", "false");
  uploadBtn.setAttribute("aria-label", t("Slash commands"));
  const uploadInput = createElement(doc, "input", "", {
    id: "paperpilotupload-input",
    type: "file",
  }) as HTMLInputElement;
  uploadInput.multiple = true;
  uploadInput.style.display = "none";
  const uploadSlot = createElement(doc, "div", "paperpilotaction-slot");
  uploadSlot.append(uploadBtn, uploadInput);

  const { slot: modelDropdown } = createActionDropdown(doc, {
    slotId: "paperpilotmodel-dropdown",
    slotClassName: "paperpilotmodel-dropdown",
    buttonId: "paperpilotmodel-toggle",
    buttonClassName:
      "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-secondary paperpilotmodel-btn",
    buttonText: "Model: ...",
    menuId: "paperpilotmodel-menu",
    menuClassName: "paperpilotmodel-menu",
    disabled: !hasItem,
  });

  const { slot: reasoningDropdown } = createActionDropdown(doc, {
    slotId: "paperpilotreasoning-dropdown",
    slotClassName: "paperpilotreasoning-dropdown",
    buttonId: "paperpilotreasoning-toggle",
    buttonClassName:
      "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-secondary paperpilotreasoning-btn",
    buttonText: t("Reasoning"),
    menuId: "paperpilotreasoning-menu",
    menuClassName: "paperpilotreasoning-menu",
    disabled: !hasItem,
  });

  const sendBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-primary paperpilotsend-btn",
    {
      id: "paperpilotsend",
      type: "button",
      textContent: t("Send"),
      title: t("Send"),
      disabled: !hasItem,
    },
  );
  const cancelBtn = createElement(
    doc,
    "button",
    "paperpilotshortcut-btn paperpilotaction-btn paperpilotaction-btn-danger paperpilotsend-btn paperpilotcancel-btn",
    {
      id: "paperpilotcancel",
      type: "button",
      textContent: t("Cancel"),
    },
  );
  cancelBtn.style.display = "none";
  const sendSlot = createElement(doc, "div", "paperpilotaction-slot");
  sendSlot.append(sendBtn, cancelBtn);

  const statusBar = createElement(doc, "div", "paperpilotstatus-bar");
  const statusLine = createElement(doc, "div", "paperpilotstatus", {
    id: "paperpilotstatus",
    textContent: hasItem
      ? isGlobalMode
        ? t("No active paper context. Type / to add papers.")
        : t("Ready")
      : t("Select an item or open a PDF"),
  });
  const tokenUsage = createElement(doc, "span", "paperpilottoken-usage", {
    id: "paperpilottoken-usage",
  });
  statusBar.append(statusLine, tokenUsage);

  actionsLeft.append(
    uploadSlot,
    selectTextSlot,
    screenshotSlot,
    modelDropdown,
    reasoningDropdown,
  );
  // Hide PDF-reader-specific buttons in standalone library chat
  if (isStandaloneBody && isGlobalMode) {
    selectTextSlot.style.display = "none";
    screenshotSlot.style.display = "none";
  }
  actionsRight.append(sendSlot);
  actionsRow.append(actionsLeft, actionsRight);
  composeArea.appendChild(actionsRow);
  container.appendChild(inputSection);
  container.appendChild(statusBar);
  body.appendChild(container);
}

export { buildUI };
