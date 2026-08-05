import { createElement } from "../../utils/domHelpers";
import { t } from "../../utils/i18n";
import {
  PREFERENCES_PANE_ID,
  getSelectTextExpandedLabel,
  getScreenshotExpandedLabel,
  SCREENSHOT_COMPACT_LABEL,
  SELECT_TEXT_COMPACT_LABEL,
  UPLOAD_FILE_EXPANDED_LABEL,
  formatFigureCountLabel,
  formatFileCountLabel,
} from "./constants";
import { renderPaperModeContext, renderPaperModeShortcuts } from "./paperModePresentation";

import type { ActionDropdownSpec } from "./types";

import {
  getPaperPortalBaseItemID,
  isPaperPortalItem,
  // resolveActiveNoteSession,
  resolveDisplayConversationKind,
  resolvePreferredConversationSystem,
} from "./portalScope";
import { getConversationKey } from "./conversationIdentity";

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
    // Clear this section body before rebuilding.
    if (typeof (body as any).replaceChildren === "function") {
        (body as any).replaceChildren();
    } else {
        body.textContent = "";
    }
    const doc = body.ownerDocument!;
    const hasItem = Boolean(item);
    // const activeNoteSession = resolveActiveNoteSession(item);
    const displayConversationKind = resolveDisplayConversationKind(item);
    const isGlobalMode = displayConversationKind === "global";
    const isPaperMode = displayConversationKind === "paper";
    const conversationItemId = hasItem && item ? getConversationKey(item) : 0;
    const basePaperItemId =
        hasItem && item
        ? // activeNoteSession?.parentItemId ||
            (isPaperPortalItem(item)
            ? getPaperPortalBaseItemID(item) || 0
            : item.isAttachment() && item.parentID
                ? item.parentID
                : isPaperMode
                ? item.id
                : 0)
        : 0;
    const hasPaperContext = basePaperItemId > 0;

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
    const container = createElement(doc, "div", "paperpilot-panel", { id: "paperpilot-main" });
    container.dataset.itemId =
        conversationItemId > 0 ? `${conversationItemId}` : "";
    container.dataset.libraryId = hasItem && item ? `${item.libraryID}` : "";
    // container.dataset.conversationKind = activeNoteSession
    //     ? activeNoteSession.conversationKind
    //     : hasItem
    //     ? isGlobalMode
    //         ? "global"
    //         : "paper"
    //     : "";
    container.dataset.conversationSystem = resolvePreferredConversationSystem({
        item,
    });
    container.dataset.basePaperItemId =
        basePaperItemId > 0 ? `${basePaperItemId}` : "";
    // container.dataset.noteKind = activeNoteSession?.noteKind || "";
    // container.dataset.noteId = activeNoteSession?.noteId
    //     ? `${activeNoteSession.noteId}`
    //     : "";
    // container.dataset.noteTitle = activeNoteSession?.title || "";
    // container.dataset.noteParentItemId = activeNoteSession?.parentItemId
    //     ? `${activeNoteSession.parentItemId}`
    //     : "";

    // Header section
    const header = createElement(doc, "div", "paperpilot-header");
    const headerTop = createElement(doc, "div", "paperpilot-header-top");
    const headerInfo = createElement(doc, "div", "paperpilot-header-info");
    // const headerIcon = createElement(doc, "img", "paperpilot-header-icon", {
    //   alt: "LLM",
    //   src: iconUrl,
    // });
    // const title = createElement(doc, "div", "paperpilot-title", {
    //   textContent: "LLM Assistant",
    // });
    const title = createElement(doc, "div", "paperpilot-title", {
        id: "paperpilot-title-static",
        textContent: t("Paper Pilot"),
    });
    if (hasItem) {
        title.style.display = "none";
    }
    const historyBar = createElement(doc, "div", "paperpilot-history-bar", {
        id: "paperpilot-history-bar",
    });
    historyBar.style.display = hasItem ? "inline-flex" : "none";
    const historyNewBtn = createElement(doc, "button", "paperpilot-history-new", {
        id: "paperpilot-history-new",
        type: "button",
        textContent: "",
        title: t("Start a new chat"),
    });
    historyNewBtn.setAttribute("aria-label", t("Start a new chat"));
    historyNewBtn.style.display = "";

    // History toggle button (clock icon)
    const historyToggle = createElement(doc, "button", "paperpilot-history-toggle", {
        id: "paperpilot-history-toggle",
        type: "button",
        title: t("Conversation history"),
    });
    historyToggle.setAttribute("aria-label", t("Conversation history"));
    historyToggle.setAttribute("aria-haspopup", "menu");
    historyToggle.setAttribute("aria-expanded", "false");
    historyToggle.style.display = "";

    const isStandaloneBody = (body as HTMLElement).dataset?.standalone === "true";
    const headerModeControls = createElement(
        doc,
        "div",
        "paperpilot-header-mode-controls",
        {
        id: "paperpilot-header-mode-controls",
        },
    );

    // Mode chip: single pill showing current mode
    const modeSwitchWrap = createElement(doc, "div", "paperpilot-mode-switch", {
        id: "paperpilot-mode-capsule",
    });
    modeSwitchWrap.dataset.mode = hasItem && isGlobalMode ? "global" : "paper";

    // const modeChipLabel = activeNoteSession
    //     ? activeNoteSession.conversationKind === "global"
    //     ? t("Library chat")
    //     : t("Paper chat")
    //     : isGlobalMode
    //     ? t("Library chat")
    //     : t("Paper chat");
    const modeChipLabel = isGlobalMode ? t("Library chat") : t("Paper chat");
    const modeChipBtn = createElement(doc, "button", "paperpilot-mode-chip", {
        id: "paperpilot-mode-chip",
        type: "button",
        textContent: modeChipLabel,
        title: modeChipLabel,
    });
    modeChipBtn.setAttribute("aria-label", modeChipLabel);

    modeSwitchWrap.append(modeChipBtn);

    headerModeControls.append(modeSwitchWrap);
    historyBar.append(historyNewBtn, historyToggle, headerModeControls);

    headerInfo.append(title, historyBar);
    headerTop.appendChild(headerInfo);

    const headerActions = createElement(doc, "div", "paperpilot-header-actions");
    const popoutBtn = createElement(
        doc,
        "button",
        "paperpilot-btn-icon paperpilot-popout-btn",
        {
        id: "paperpilot-popout",
        type: "button",
        title: t("Open in Window"),
        },
    );
    popoutBtn.setAttribute("aria-label", t("Open chat in a standalone window"));
    const settingsBtn = createElement(
        doc,
        "button",
        "paperpilot-btn-icon paperpilot-settings-btn",
        {
        id: "paperpilot-settings",
        type: "button",
        title: t("Settings"),
        },
    );
    settingsBtn.setAttribute("aria-label", t("Open plugin settings"));
    settingsBtn.dataset.preferencesPaneId = PREFERENCES_PANE_ID;
    const exportBtn = createElement(doc, "button", "paperpilot-btn-icon", {
        id: "paperpilot-export",
        type: "button",
        textContent: "⤓",
        title: t("Export"),
        disabled: !hasItem,
    });
    const clearBtn = createElement(doc, "button", "paperpilot-btn-icon", {
        id: "paperpilot-clear",
        type: "button",
        textContent: t("Clear"),
    });
    headerActions.append(popoutBtn, settingsBtn, exportBtn, clearBtn);
    headerTop.appendChild(headerActions);
    header.appendChild(headerTop);
    const historyMenu = createElement(doc, "div", "paperpilot-history-menu", {
        id: "paperpilot-history-menu",
    });
    historyMenu.style.display = "none";
    header.appendChild(historyMenu);

    const historyRowMenu = createElement(doc, "div", "paperpilot-history-row-menu", {
        id: "paperpilot-history-row-menu",
    });
    historyRowMenu.style.display = "none";
    const historyRowRenameBtn = createElement(
        doc,
        "button",
        "paperpilot-history-row-menu-item",
        {
        id: "paperpilot-history-row-rename",
        type: "button",
        textContent: t("Rename"),
        title: t("Rename chat"),
        },
    );
    historyRowMenu.append(historyRowRenameBtn);
    header.appendChild(historyRowMenu);

    const historyUndo = createElement(doc, "div", "paperpilot-history-undo", {
        id: "paperpilot-history-undo",
    });
    historyUndo.style.display = "none";
    const historyUndoText = createElement(doc, "span", "paperpilot-history-undo-text", {
        id: "paperpilot-history-undo-text",
        textContent: "",
    });
    const historyUndoBtn = createElement(doc, "button", "paperpilot-history-undo-btn", {
        id: "paperpilot-history-undo-btn",
        type: "button",
        textContent: t("Undo"),
        title: t("Restore deleted conversation"),
    });
    historyUndo.append(historyUndoText, historyUndoBtn);
    header.appendChild(historyUndo);

    const topToast = createElement(doc, "div", "paperpilot-top-toast", {
        id: "paperpilot-top-toast",
        textContent: "",
    });
    topToast.style.display = "none";
    topToast.setAttribute("role", "status");
    topToast.setAttribute("aria-live", "polite");
    topToast.setAttribute("aria-hidden", "true");
    header.appendChild(topToast);

    container.appendChild(header);

    const paperModeContext = createElement(
        doc,
        "div",
        "paperpilot-paper-mode-context",
        { id: "paperpilot-paper-mode-context" },
    );

    // Paper-mode shortcuts sit above the composer, like the upstream panel.
    const shortcutsRow = createElement(doc, "div", "paperpilot-shortcuts", {
        id: "paperpilot-shortcuts",
    });

    // Chat display area
    const chatShell = createElement(doc, "div", "paperpilot-chat-shell", {
        id: "paperpilot-chat-shell",
    });
    const chatBox = createElement(doc, "div", "paperpilot-messages", {
        id: "paperpilot-chat-box",
    });
    chatShell.append(chatBox);
    container.appendChild(chatShell);
    container.appendChild(shortcutsRow);

    // Shortcut context menu
    const shortcutMenu = createElement(doc, "div", "paperpilot-shortcut-menu", {
        id: "paperpilot-shortcut-menu",
    });
    shortcutMenu.style.display = "none";
    const menuEditBtn = createElement(doc, "button", "paperpilot-shortcut-menu-item", {
        id: "paperpilot-shortcut-menu-edit",
        type: "button",
        textContent: t("Edit"),
    });
    const menuDeleteBtn = createElement(doc, "button", "paperpilot-shortcut-menu-item", {
        id: "paperpilot-shortcut-menu-delete",
        type: "button",
        textContent: t("Delete"),
    });
    const menuAddBtn = createElement(doc, "button", "paperpilot-shortcut-menu-item", {
        id: "paperpilot-shortcut-menu-add",
        type: "button",
        textContent: t("Add"),
    });
    const menuMoveBtn = createElement(doc, "button", "paperpilot-shortcut-menu-item", {
        id: "paperpilot-shortcut-menu-move",
        type: "button",
        textContent: t("Move"),
    });
    const menuResetBtn = createElement(doc, "button", "paperpilot-shortcut-menu-item", {
        id: "paperpilot-shortcut-menu-reset",
        type: "button",
        textContent: t("Reset"),
    });
    shortcutMenu.append(
        menuEditBtn,
        menuDeleteBtn,
        menuAddBtn,
        menuMoveBtn,
        menuResetBtn,
    );
    container.appendChild(shortcutMenu);

    // Response context menu
    const responseMenu = createElement(doc, "div", "paperpilot-response-menu", {
        id: "paperpilot-response-menu",
    });
    responseMenu.style.display = "none";
    const responseMenuCopyBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-response-menu-copy",
        type: "button",
        textContent: t("Copy"),
        },
    );
    const responseMenuNoteBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-response-menu-note",
        type: "button",
        textContent: t("Save as note"),
        },
    );
    const responseMenuDeleteBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-response-menu-delete",
        type: "button",
        textContent: t("Delete this turn"),
        title: t("Delete this prompt and response"),
        },
    );
    const responseMenuForkBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-response-menu-fork",
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
    const promptMenu = createElement(doc, "div", "paperpilot-response-menu", {
        id: "paperpilot-prompt-menu",
    });
    promptMenu.style.display = "none";
    const promptMenuDeleteBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-prompt-menu-delete",
        type: "button",
        textContent: t("Delete this turn"),
        title: t("Delete this prompt and response"),
        },
    );
    const promptMenuForkBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-prompt-menu-fork",
        type: "button",
        textContent: t("Fork this turn"),
        title: t("Start a new chat from this turn"),
        },
    );
    promptMenu.append(promptMenuForkBtn, promptMenuDeleteBtn);
    container.appendChild(promptMenu);

    // Export menu
    const exportMenu = createElement(doc, "div", "paperpilot-response-menu", {
        id: "paperpilot-export-menu",
    });
    exportMenu.style.display = "none";
    const exportMenuCopyBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-export-copy",
        type: "button",
        textContent: t("Copy chat as md"),
        },
    );
    const exportMenuNoteBtn = createElement(
        doc,
        "button",
        "paperpilot-response-menu-item",
        {
        id: "paperpilot-export-note",
        type: "button",
        textContent: t("Save chat as note"),
        },
    );
    exportMenu.append(exportMenuCopyBtn, exportMenuNoteBtn);
    container.appendChild(exportMenu);

    const slashMenu = createElement(
        doc,
        "div",
        "paperpilot-response-menu paperpilot-slash-menu",
        {
        id: "paperpilot-slash-menu",
        },
    );
    slashMenu.style.display = "none";
    const slashList = createElement(doc, "div", "paperpilot-action-picker-list", {});
    const makeSlashItem = (id: string, title: string, desc: string) => {
        const btn = createElement(doc, "button", "paperpilot-action-picker-item", {
        id,
        type: "button",
        title: desc,
        });
        btn.setAttribute("data-slash-base-item", "true");
        const titleEl = createElement(doc, "span", "paperpilot-action-picker-title", {
        textContent: title,
        });
        btn.append(titleEl);
        return btn;
    };
    const slashUploadBtn = makeSlashItem(
        "paperpilot-slash-upload-option",
        t("Upload files"),
        t("Add documents or images"),
    );
    const slashReferenceBtn = makeSlashItem(
        "paperpilot-slash-reference-option",
        t("Select references"),
        t("Add papers from your library"),
    );
    const slashPdfPageBtn = makeSlashItem(
        "paperpilot-slash-pdf-page-option",
        t("Send current PDF page"),
        t("Capture the visible page as an image"),
    );
    const slashPdfMultiplePagesBtn = makeSlashItem(
        "paperpilot-slash-pdf-multiple-pages-option",
        t("Send multiple PDF pages"),
        t("Select pages from the open PDF"),
    );
    // const slashBaseButtons: Record<SlashBaseMenuItem, HTMLButtonElement> = {
    //     upload: slashUploadBtn,
    //     reference: slashReferenceBtn,
    //     pdfPage: slashPdfPageBtn,
    //     pdfMultiplePages: slashPdfMultiplePagesBtn,
    // };
    // slashList.append(
    //     ...getBaseSlashMenuItems(
    //     resolveSlashActionChatMode(displayConversationKind),
    //     ).map((entry) => slashBaseButtons[entry]),
    // );
    // slashMenu.append(slashList);
    // slashMenu is appended to composeArea below (after composeArea is created)

    // Retry model menu (opened from latest assistant retry action)
    const retryModelMenu = createElement(doc, "div", "paperpilot-model-menu", {
        id: "paperpilot-retry-model-menu",
    });
    retryModelMenu.style.display = "none";
    container.appendChild(retryModelMenu);

    // Input section
    const inputSection = createElement(doc, "div", "paperpilot-input-section");
    const contextPreviews = createElement(doc, "div", "paperpilot-context-previews", {
        id: "paperpilot-context-previews",
    });
    contextPreviews.appendChild(paperModeContext);
    const selectedContextList = createElement(
        doc,
        "div",
        "paperpilot-selected-context-list",
        {
        id: "paperpilot-selected-context-list",
        },
    );
    selectedContextList.style.display = "none";
    contextPreviews.appendChild(selectedContextList);

    const paperPreview = createElement(doc, "div", "paperpilot-paper-context-inline", {
        id: "paperpilot-paper-context-preview",
    });
    paperPreview.style.display = "none";
    const paperPreviewList = createElement(
        doc,
        "div",
        "paperpilot-paper-context-inline-list",
        {
        id: "paperpilot-paper-context-list",
        },
    );
    paperPreview.append(paperPreviewList);
    contextPreviews.appendChild(paperPreview);

    // Image preview area (shows selected screenshot)
    const imagePreview = createElement(doc, "div", "paperpilot-image-preview", {
        id: "paperpilot-image-preview",
    });
    imagePreview.style.display = "none";

    const imagePreviewMeta = createElement(
        doc,
        "button",
        "paperpilot-image-preview-meta",
        {
        id: "paperpilot-image-preview-meta",
        type: "button",
        textContent: formatFigureCountLabel(0),
        title: t("Expand figures"),
        },
    );
    const imagePreviewHeader = createElement(
        doc,
        "div",
        "paperpilot-image-preview-header",
        {
        id: "paperpilot-image-preview-header",
        },
    );
    const removeImgBtn = createElement(doc, "button", "paperpilot-remove-img-btn", {
        id: "paperpilot-remove-img",
        type: "button",
        textContent: "×",
        title: t("Clear selected screenshots"),
    });
    removeImgBtn.setAttribute("aria-label", t("Clear selected screenshots"));
    imagePreviewHeader.append(imagePreviewMeta, removeImgBtn);

    const imagePreviewExpanded = createElement(
        doc,
        "div",
        "paperpilot-image-preview-expanded",
        {
        id: "paperpilot-image-preview-expanded",
        },
    );
    const previewStrip = createElement(doc, "div", "paperpilot-image-preview-strip", {
        id: "paperpilot-image-preview-strip",
    });
    const previewLargeWrap = createElement(
        doc,
        "div",
        "paperpilot-image-preview-selected",
        {
        id: "paperpilot-image-preview-selected",
        },
    );
    const previewLargeImg = createElement(
        doc,
        "img",
        "paperpilot-image-preview-selected-img",
        {
        id: "paperpilot-image-preview-selected-img",
        alt: t("Selected screenshot preview"),
        },
    ) as HTMLImageElement;
    previewLargeWrap.appendChild(previewLargeImg);

    imagePreviewExpanded.append(previewStrip, previewLargeWrap);
    imagePreview.append(imagePreviewHeader, imagePreviewExpanded);
    contextPreviews.appendChild(imagePreview);

    const filePreview = createElement(doc, "div", "paperpilot-image-preview", {
        id: "paperpilot-file-context-preview",
    });
    filePreview.style.display = "none";
    const filePreviewMeta = createElement(
        doc,
        "button",
        "paperpilot-image-preview-meta paperpilot-file-context-meta",
        {
        id: "paperpilot-file-context-meta",
        type: "button",
        textContent: formatFileCountLabel(0),
        title: t("Expand files"),
        },
    );
    const filePreviewHeader = createElement(
        doc,
        "div",
        "paperpilot-image-preview-header",
        {
        id: "paperpilot-file-context-header",
        },
    );
    const filePreviewClear = createElement(doc, "button", "paperpilot-remove-img-btn", {
        id: "paperpilot-file-context-clear",
        type: "button",
        textContent: "×",
        title: t("Clear uploaded files"),
    });
    filePreviewHeader.append(filePreviewMeta, filePreviewClear);
    const filePreviewExpanded = createElement(
        doc,
        "div",
        "paperpilot-image-preview-expanded paperpilot-file-context-expanded",
        {
        id: "paperpilot-file-context-expanded",
        },
    );
    const filePreviewList = createElement(doc, "div", "paperpilot-file-context-list", {
        id: "paperpilot-file-context-list",
    });
    filePreviewExpanded.append(filePreviewList);
    filePreview.append(filePreviewHeader, filePreviewExpanded);
    contextPreviews.appendChild(filePreview);

    const paperPicker = createElement(doc, "div", "paperpilot-paper-picker", {
        id: "paperpilot-paper-picker",
    });
    paperPicker.style.display = "none";
    const paperPickerList = createElement(doc, "div", "paperpilot-paper-picker-list", {
        id: "paperpilot-paper-picker-list",
    });
    paperPickerList.setAttribute("role", "listbox");
    paperPicker.appendChild(paperPickerList);
    inputSection.appendChild(paperPicker);

    inputSection.appendChild(contextPreviews);

    const composeArea = createElement(doc, "div", "paperpilot-compose-area", {
        id: "paperpilot-compose-area",
    });
    inputSection.appendChild(composeArea);

    const actionPicker = createElement(doc, "div", "paperpilot-action-picker", {
        id: "paperpilot-action-picker",
    });
    actionPicker.style.display = "none";
    const actionPickerList = createElement(doc, "div", "paperpilot-action-picker-list", {
        id: "paperpilot-action-picker-list",
    });
    actionPickerList.setAttribute("role", "listbox");
    actionPicker.appendChild(actionPickerList);
    composeArea.appendChild(actionPicker);
    composeArea.appendChild(slashMenu);

    const actionHitlPanel = createElement(doc, "div", "paperpilot-action-hitl-panel", {
        id: "paperpilot-action-hitl-panel",
    });
    actionHitlPanel.style.display = "none";
    composeArea.appendChild(actionHitlPanel);

    // Command row — shows active skill/action badge above textarea
    // Uses the exact same chip DOM as paper context chips
    const commandRow = createElement(
        doc,
        "div",
        "paperpilot-command-row paperpilot-selected-context",
        { id: "paperpilot-command-row" },
    );
    const commandRowHeader = createElement(
        doc,
        "div",
        "paperpilot-image-preview-header paperpilot-selected-context-header paperpilot-paper-context-chip-header",
    );
    const commandRowLabel = createElement(
        doc,
        "span",
        "paperpilot-paper-context-chip-label",
        { id: "paperpilot-command-row-badge" },
    );
    const commandRowClear = createElement(
        doc,
        "button",
        "paperpilot-remove-img-btn paperpilot-paper-context-clear",
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

    const queueBar = createElement(doc, "div", "paperpilot-queued-input-bar", {
        id: "paperpilot-queued-input-bar",
    });
    queueBar.style.display = "none";
    composeArea.appendChild(queueBar);

    const inputBox = createElement(doc, "textarea", "paperpilot-input", {
        id: "paperpilot-input",
        placeholder: hasItem
        ? isGlobalMode
            ? t("Ask anything... Type / for actions, @ to add papers")
            : t("Ask about this paper... Type / for actions, @ to add papers")
        : t("Open a PDF first"),
        disabled: !hasItem,
    });
    composeArea.appendChild(inputBox);

    // Actions row
    const actionsRow = createElement(doc, "div", "paperpilot-actions");
    const actionsLeft = createElement(doc, "div", "paperpilot-actions-left");
    const actionsRight = createElement(doc, "div", "paperpilot-actions-right");

    const selectTextBtn = createElement(
        doc,
        "button",
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-secondary paperpilot-select-text-btn paperpilot-action-icon-only",
        {
        id: "paperpilot-select-text",
        textContent: SELECT_TEXT_COMPACT_LABEL,
        title: t("Include selected reader text"),
        disabled: !hasItem,
        },
    );
    selectTextBtn.setAttribute("aria-label", getSelectTextExpandedLabel());
    const selectTextSlot = createElement(doc, "div", "paperpilot-action-slot");
    selectTextSlot.appendChild(selectTextBtn);

    // Screenshot button
    const screenshotBtn = createElement(
        doc,
        "button",
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-secondary paperpilot-screenshot-btn paperpilot-action-icon-only",
        {
        id: "paperpilot-screenshot",
        textContent: SCREENSHOT_COMPACT_LABEL,
        title: t("Select figure screenshot"),
        disabled: !hasItem,
        },
    );
    screenshotBtn.setAttribute("aria-label", getScreenshotExpandedLabel());
    const screenshotSlot = createElement(doc, "div", "paperpilot-action-slot");
    screenshotSlot.appendChild(screenshotBtn);

    const uploadBtn = createElement(
        doc,
        "button",
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-secondary paperpilot-upload-file-btn paperpilot-slash-menu-btn",
        {
        id: "paperpilot-upload-file",
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
        id: "paperpilot-upload-input",
        type: "file",
    }) as HTMLInputElement;
    uploadInput.multiple = true;
    uploadInput.style.display = "none";
    const uploadSlot = createElement(doc, "div", "paperpilot-action-slot");
    uploadSlot.append(uploadBtn, uploadInput);

    const {
        slot: modelDropdown,
        button: modelBtn,
        menu: modelMenu,
    } = createActionDropdown(doc, {
        slotId: "paperpilot-model-dropdown",
        slotClassName: "paperpilot-model-dropdown",
        buttonId: "paperpilot-model-toggle",
        buttonClassName:
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-secondary paperpilot-model-btn",
        buttonText: "Model: ...",
        menuId: "paperpilot-model-menu",
        menuClassName: "paperpilot-model-menu",
        disabled: !hasItem,
    });

    const {
        slot: reasoningDropdown,
        button: reasoningBtn,
        menu: reasoningMenu,
    } = createActionDropdown(doc, {
        slotId: "paperpilot-reasoning-dropdown",
        slotClassName: "paperpilot-reasoning-dropdown",
        buttonId: "paperpilot-reasoning-toggle",
        buttonClassName:
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-secondary paperpilot-reasoning-btn",
        buttonText: t("Reasoning"),
        menuId: "paperpilot-reasoning-menu",
        menuClassName: "paperpilot-reasoning-menu",
        disabled: !hasItem,
    });

    const sendBtn = createElement(
        doc,
        "button",
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-primary paperpilot-send-btn",
        {
        id: "paperpilot-send",
        textContent: t("Send"),
        title: t("Send"),
        disabled: !hasItem,
        },
    );
    const cancelBtn = createElement(
        doc,
        "button",
        "paperpilot-shortcut-btn paperpilot-action-btn paperpilot-action-btn-danger paperpilot-send-btn paperpilot-cancel-btn",
        {
        id: "paperpilot-cancel",
        textContent: t("Cancel"),
        },
    );
    cancelBtn.style.display = "none";
    const sendSlot = createElement(doc, "div", "paperpilot-action-slot");
    sendSlot.append(sendBtn, cancelBtn);

    const statusBar = createElement(doc, "div", "paperpilot-status-bar");
    const statusLine = createElement(doc, "div", "paperpilot-status", {
        id: "paperpilot-status",
        textContent: hasItem
        ? isGlobalMode
            ? t("No active paper context. Type / to add papers.")
            : t("Ready")
        : t("Select an item or open a PDF"),
    });
    const tokenUsage = createElement(doc, "span", "paperpilot-token-usage", {
        id: "paperpilot-token-usage",
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
    renderPaperModeContext(container, item);
    renderPaperModeShortcuts(container, isPaperMode && hasItem);
}


export { buildUI };
