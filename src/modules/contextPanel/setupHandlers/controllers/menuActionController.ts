import { t } from "../../../../utils/i18n";
import { isGlobalPortalItem } from "../../portalScope";

import { positionMenuBelowButton } from "../../menuPositioning";

import { setStatus } from "../../textUtils";
import type {
  ConversationSystem,
  GeneratedChatImage,
  QuoteCitation,
} from "../../../../shared/types";
import type { ChatRuntimeMode, Message, PaperContextRef } from "../../types";
import { setResponseActionRunner } from "../../state";



export type ResponseMenuTarget = {
  item: Zotero.Item;
  contentText: string;
  queryText?: string;
  modelName: string;
  conversationKey?: number;
  userTimestamp?: number;
  assistantTimestamp?: number;
  paperContexts?: PaperContextRef[];
  quoteCitations?: QuoteCitation[];
  generatedImages?: GeneratedChatImage[];
} | null;




type ResponseActionKind = "copy" | "note" | "fork" | "delete";

type ResponseTurnReference = {
  conversationKey: number;
  userTimestamp: number;
  assistantTimestamp: number;
};

type PromptMenuTarget = {
  item: Zotero.Item;
  conversationKey: number;
  userTimestamp: number;
  assistantTimestamp: number;
  editable?: boolean;
} | null;

type MenuActionControllerDeps = {
  body: Element;
  status: HTMLElement | null;
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
  exportBtn: HTMLButtonElement | null;
  popoutBtn: HTMLButtonElement | null;
  settingsBtn: HTMLButtonElement | null;
  preferencesPaneId: string;
  getItem: () => Zotero.Item | null;
  // getResponseMenuTarget: () => ResponseMenuTarget;
  // getPromptMenuTarget: () => PromptMenuTarget;
  getCurrentLibraryID: () => number;
  getConversationSystem: () => ConversationSystem;
  getCurrentRuntimeModeForItem: (item: Zotero.Item) => ChatRuntimeMode | null;
  isGlobalMode: () => boolean;
  ensureConversationLoaded: (item: Zotero.Item) => Promise<void>;
  getConversationKey: (item: Zotero.Item) => number;
  // getHistory: (conversationKey: number) => Message[];
  // resolveActiveNoteSession: (item: Zotero.Item) => { noteKind?: string } | null;
  closeResponseMenu: () => void;
  closePromptMenu: () => void;
  closeExportMenu: () => void;
  closeRetryModelMenu: () => void;
  closeSlashMenu: () => void;
  closeHistoryNewMenu: () => void;
  closeHistoryMenu: () => void;
  queueTurnDeletion: (target: {
    conversationKey: number;
    userTimestamp: number;
    assistantTimestamp: number;
  }) => Promise<void>;
  forkConversationFromTurn: (target: {
    item: Zotero.Item;
    conversationKey: number;
    userTimestamp: number;
    assistantTimestamp: number;
  }) => Promise<void>;
  logError: (message: string, error: unknown) => void;
};




function stopFloatingMenuPropagation(menu: HTMLDivElement): void {
  menu.addEventListener("pointerdown", (e: Event) => {
    e.stopPropagation();
  });
  menu.addEventListener("mousedown", (e: Event) => {
    e.stopPropagation();
  });
  menu.addEventListener("contextmenu", (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  });
}

function parsePositiveFiniteNumber(value: unknown): number {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}


function normalizeResponseTurnReference(
  input: Partial<ResponseTurnReference> | null | undefined,
): ResponseTurnReference | null {
  const conversationKey = parsePositiveFiniteNumber(input?.conversationKey);
  const userTimestamp = parsePositiveFiniteNumber(input?.userTimestamp);
  const assistantTimestamp = parsePositiveFiniteNumber(
    input?.assistantTimestamp,
  );
  if (!conversationKey || !userTimestamp || !assistantTimestamp) return null;
  return { conversationKey, userTimestamp, assistantTimestamp };
}



function findResponseTurnPair(
  history: Message[],
  reference: ResponseTurnReference,
): { userMessage: Message; assistantMessage: Message } | null {
  for (let index = 0; index < history.length - 1; index += 1) {
    const userMessage = history[index];
    const assistantMessage = history[index + 1];
    if (
      userMessage?.role !== "user" ||
      assistantMessage?.role !== "assistant"
    ) {
      continue;
    }
    if (
      Math.floor(userMessage.timestamp) === reference.userTimestamp &&
      Math.floor(assistantMessage.timestamp) === reference.assistantTimestamp
    ) {
      return { userMessage, assistantMessage };
    }
  }
  return null;
}




async function copyResponseTarget(
  deps: MenuActionControllerDeps,
  target: ResponseMenuTarget,
  setStatusMessage: (
    message: string,
    level: "ready" | "warning" | "error",
  ) => void,
): Promise<void> {
  if (!target) return;
  // if (target.contentText.trim()) {
  //   await copyRenderedMarkdownToClipboard(
  //     deps.body,
  //     target.contentText,
  //     target.quoteCitations,
  //   );
  //   setStatusMessage(t("Copied response"), "ready");
  // } else if (target.generatedImages?.length) {
  //   const result = await copyGeneratedImageToClipboard(
  //     deps.body,
  //     target.generatedImages[0]!,
  //   );
  //   setStatusMessage(
  //     result === "image" ? "Copied image" : "Copied image source",
  //     "ready",
  //   );
  // }
}



async function queueResponseTurnDeletion(
  deps: MenuActionControllerDeps,
  reference: Partial<ResponseTurnReference> | null | undefined,
  setStatusMessage: (
    message: string,
    level: "ready" | "warning" | "error",
  ) => void,
): Promise<void> {
  const normalized = normalizeResponseTurnReference(reference);
  const item = deps.getItem();
  if (!normalized || !item) return;
  if (deps.getConversationKey(item) !== normalized.conversationKey) {
    setStatusMessage(t("Delete target changed"), "error");
    return;
  }
  // const pair = findResponseTurnPair(
  //   deps.getHistory(normalized.conversationKey),
  //   normalized,
  // );
  // if (!pair) {
  //   setStatusMessage(t("No deletable turn found"), "error");
  //   return;
  // }
  // if (pair.assistantMessage.streaming) {
  //   setStatusMessage(t("Cannot delete while generating"), "ready");
  //   return;
  // }
  await deps.queueTurnDeletion(normalized);
}


function normalizeTurnTarget(
  target: Pick<
    NonNullable<ResponseMenuTarget | PromptMenuTarget>,
    "item" | "conversationKey" | "userTimestamp" | "assistantTimestamp"
  > | null,
): {
  item: Zotero.Item;
  conversationKey: number;
  userTimestamp: number;
  assistantTimestamp: number;
} | null {
  if (!target?.item) return null;
  const conversationKey = parsePositiveFiniteNumber(target.conversationKey);
  const userTimestamp = parsePositiveFiniteNumber(target.userTimestamp);
  const assistantTimestamp = parsePositiveFiniteNumber(
    target.assistantTimestamp,
  );
  if (!conversationKey || !userTimestamp || !assistantTimestamp) return null;
  return {
    item: target.item,
    conversationKey,
    userTimestamp,
    assistantTimestamp,
  };
}


export async function runResponseMenuAction(
  deps: MenuActionControllerDeps,
  action: ResponseActionKind,
  target: ResponseMenuTarget,
  setStatusMessage: (
    message: string,
    level: "ready" | "warning" | "error",
  ) => void,
): Promise<void> {
  try {
    if (action === "copy") {
      await copyResponseTarget(deps, target, setStatusMessage);
      return;
    }
    // if (action === "note") {
    //   await saveResponseTargetAsNote(deps, target, setStatusMessage);
    //   return;
    // }
    if (action === "fork") {
      const normalized = normalizeTurnTarget(target);
      if (!normalized) {
        setStatusMessage(t("No forkable turn found"), "error");
        return;
      }
      await deps.forkConversationFromTurn(normalized);
      return;
    }
    await queueResponseTurnDeletion(deps, target, setStatusMessage);
  } catch (err) {
    deps.logError("Response action failed:", err);
    setStatusMessage(t("Response action failed"), "error");
  }
}





export function attachMenuActionController(
  deps: MenuActionControllerDeps,
): void {
  const setStatusMessage = (
    message: string,
    level: "ready" | "warning" | "error",
  ) => {
    if (deps.status) setStatus(deps.status, message, level);
  };

  setResponseActionRunner(deps.body, (action, target) =>
    runResponseMenuAction(deps, action, target, setStatusMessage),
  );

  if (
    deps.responseMenu &&
    deps.responseMenuCopyBtn &&
    deps.responseMenuNoteBtn &&
    !deps.responseMenu.dataset.listenerAttached
  ) {
    deps.responseMenu.dataset.listenerAttached = "true";
    stopFloatingMenuPropagation(deps.responseMenu);
    deps.responseMenuCopyBtn.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // const target = deps.getResponseMenuTarget();
      deps.closeResponseMenu();
      // await runResponseMenuAction(deps, "copy", target, setStatusMessage);
    });
    deps.responseMenuNoteBtn.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // const target = deps.getResponseMenuTarget();
      deps.closeResponseMenu();
      // await runResponseMenuAction(deps, "note", target, setStatusMessage);
    });
    deps.responseMenuDeleteBtn?.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // const target = deps.getResponseMenuTarget();
      deps.closeResponseMenu();
      // await runResponseMenuAction(deps, "delete", target, setStatusMessage);
    });
    deps.responseMenuForkBtn?.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // const target = deps.getResponseMenuTarget();
      deps.closeResponseMenu();
      // await runResponseMenuAction(deps, "fork", target, setStatusMessage);
    });
  }

  if (deps.promptMenu && !deps.promptMenu.dataset.listenerAttached) {
    deps.promptMenu.dataset.listenerAttached = "true";
    stopFloatingMenuPropagation(deps.promptMenu);
    deps.promptMenuDeleteBtn?.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // const target = deps.getPromptMenuTarget();
      deps.closePromptMenu();
      // if (!target || !deps.getItem()) return;
      // if (
      //   !Number.isFinite(target.userTimestamp) ||
      //   target.userTimestamp <= 0 ||
      //   !Number.isFinite(target.assistantTimestamp) ||
      //   target.assistantTimestamp <= 0
      // ) {
      //   setStatusMessage(t("No deletable turn found"), "error");
      //   return;
      // }
      // await deps.queueTurnDeletion({
      //   conversationKey: Math.floor(target.conversationKey),
      //   userTimestamp: Math.floor(target.userTimestamp),
      //   assistantTimestamp: Math.floor(target.assistantTimestamp),
      // });
    });
    deps.promptMenuForkBtn?.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      // const target = normalizeTurnTarget(deps.getPromptMenuTarget());
      deps.closePromptMenu();
      // if (!target) {
      //   setStatusMessage(t("No forkable turn found"), "error");
      //   return;
      // }
      try {
        // await deps.forkConversationFromTurn(target);
      } catch (err) {
        deps.logError("Fork conversation failed:", err);
        setStatusMessage(t("Failed to fork conversation"), "error");
      }
    });
  }

  if (
    deps.exportMenu &&
    deps.exportMenuCopyBtn &&
    deps.exportMenuNoteBtn &&
    !deps.exportMenu.dataset.listenerAttached
  ) {
    deps.exportMenu.dataset.listenerAttached = "true";
    stopFloatingMenuPropagation(deps.exportMenu);
    deps.exportMenuCopyBtn.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const item = deps.getItem();
      if (!item) return;
      await deps.ensureConversationLoaded(item);
      const conversationKey = deps.getConversationKey(item);
      // const payload = buildChatHistoryNotePayload(
      //   deps.getHistory(conversationKey),
      // );
      // if (!payload.noteText) {
      //   setStatusMessage(t("No chat history detected."), "ready");
      //   deps.closeExportMenu();
      //   return;
      // }
      // await copyTextToClipboard(deps.body, payload.noteText);
      setStatusMessage(t("Copied chat as md"), "ready");
      deps.closeExportMenu();
    });
    deps.exportMenuNoteBtn.addEventListener("click", async (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      const currentItem = deps.getItem();
      const currentLibraryID = deps.getCurrentLibraryID();
      deps.closeExportMenu();
      if (!currentItem) return;
      try {
        await deps.ensureConversationLoaded(currentItem);
        const conversationKey = deps.getConversationKey(currentItem);
        // const history = deps.getHistory(conversationKey);
        // const payload = buildChatHistoryNotePayload(history);
        // if (!payload.noteText) {
        //   setStatusMessage(t("No chat history detected."), "ready");
        //   return;
        // }
        // if (deps.isGlobalMode()) {
        //   await createStandaloneNoteFromChatHistory(currentLibraryID, history, {
        //     figureRender: buildNoteFigureRenderOptions(deps),
        //   });
        // } else {
        //   await createNoteFromChatHistory(currentItem, history, {
        //     figureRender: buildNoteFigureRenderOptions(deps),
        //   });
        // }
        setStatusMessage(t("Saved chat history to new note"), "ready");
      } catch (err) {
        deps.logError("Save chat history note failed:", err);
        setStatusMessage(t("Failed to save chat history"), "error");
      }
    });
  }

  deps.exportBtn?.addEventListener("click", (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const item = deps.getItem();
    const exportBtn = deps.exportBtn;
    const exportMenu = deps.exportMenu;
    if (!exportBtn || exportBtn.disabled || !exportMenu || !item) return;
    deps.closeRetryModelMenu();
    deps.closeSlashMenu();
    deps.closeResponseMenu();
    deps.closePromptMenu();
    deps.closeHistoryNewMenu();
    deps.closeHistoryMenu();
    if (exportMenu.style.display !== "none") {
      deps.closeExportMenu();
      return;
    }
    positionMenuBelowButton(deps.body, exportMenu, exportBtn);
  });

  deps.popoutBtn?.addEventListener("click", (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const {
        isStandaloneWindowActive,
        openStandaloneChat,
      } = require("../../standaloneWindow");
      const item = deps.getItem();
      if (isStandaloneWindowActive()) {
        addon.data.standaloneWindow?.close();
      } else {
        openStandaloneChat({
          initialItem: item,
          initialConversationSystem: deps.getConversationSystem(),
          initialRuntimeMode: item
            ? deps.getCurrentRuntimeModeForItem(item)
            : null,
          sourceBody: deps.body,
        });
      }
    } catch (err) {
      deps.logError("LLM: Failed to toggle standalone window", err);
    }
  });

  deps.settingsBtn?.addEventListener("click", (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      deps.closeRetryModelMenu();
      deps.closeSlashMenu();
      deps.closeResponseMenu();
      deps.closePromptMenu();
      deps.closeHistoryNewMenu();
      deps.closeHistoryMenu();
      deps.closeExportMenu();
      const paneId =
        deps.settingsBtn?.dataset.preferencesPaneId || deps.preferencesPaneId;
      Zotero.Utilities.Internal.openPreferences(paneId);
    } catch (error) {
      deps.logError("Paper Pilot: Failed to open plugin preferences", error);
      setStatusMessage(t("Could not open plugin settings"), "error");
    }
  });
}