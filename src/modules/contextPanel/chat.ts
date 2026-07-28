import { HTML_NS } from "../../utils/domHelpers";
import {
  t,
  getWelcomeHtml,
  // getWebChatWelcomeHtml,
  getStandaloneLibraryChatStartPageHtml,
  getPaperChatStartPageHtml,
  getNoteEditingStartPageHtml,
} from "../../utils/i18n";

import {
  PERSISTED_HISTORY_LIMIT,
  MAX_FULL_TEXT_PAPER_CONTEXTS,
  MAX_SELECTED_IMAGES,
  formatFigureCountLabel,
  formatPaperCountLabel,
} from "./constants";


import type {
  ConversationSystem,
  GeneratedChatImage,
  QuoteCitation,
} from "../../shared/types";

import { toFileUrl } from "../../utils/pathFileUrl";

import type {
  Message,
  ChatRuntimeMode,
  // ReasoningProviderKind,
  // ReasoningOption,
  // ReasoningLevelSelection,
  AdvancedModelParams,
  ChatAttachment,
  CollectionContextRef,
  NoteContextRef,
  TagContextRef,
  SelectedTextContext,
  SelectedTextSource,
  PaperContextRef,
  PaperContextSendMode,
  // ContextAssemblyStrategy,
  ResolvedContextSource,
} from "./types";


import {
  selectedModelCache,
  activeContextPanels,
  activeContextPanelStateSync,
  nextRequestId,
  isRequestPending,
  selectedRuntimeModeCache,
  loadedConversationKeys,
  chatHistory,
  loadingConversationTasks,
  setResponseMenuTarget,
} from "./state";

import {
  sanitizeText,
  formatTime,
  setStatus,
  setTokenUsage,
  getSelectedTextWithinBubble,
  getAttachmentTypeLabel,
  buildQuestionWithSelectedTextContexts,
  buildModelPromptWithFileContext,
  resolvePromptText,
} from "./textUtils";

import {
  normalizeSelectedTextNoteContexts,
  normalizeSelectedTextPaperContexts as normalizeSelectedTextPaperContextEntries,
  normalizeSelectedTextSources,
  normalizePaperContextRefs,
  normalizeCollectionContextRefs,
  normalizeTagContextRefs,
  normalizeAttachmentContentHash,
} from "./normalizers";

import {
  getBoolPref,
  getStringPref,
} from "./prefHelpers";

import {
  isGlobalPortalItem,
  // resolveActiveNoteSession,
  resolveConversationBaseItem,
  resolveConversationSystemForItem,
  resolveDisplayConversationKind,
} from "./portalScope";

import { getConversationKey } from "./conversationIdentity";

import {
  formatPaperCitationLabel,
  formatPaperSourceLabel,
  resolvePaperContextDisplayRef,
  resolvePaperContextRefFromAttachment,
  resolvePaperContextRefFromItem,
  type PaperContextDisplayCache,
} from "./paperAttribution";

export { getConversationKey } from "./conversationIdentity";

import {
  applyChatScrollSnapshot,
  buildChatScrollSnapshot,
  buildFollowBottomScrollSnapshot,
  cancelFollowBottomCatchup,
  consumePendingChatScrollRestore,
  getChatScrollSnapshot,
  hasActiveFollowBottomCatchupRequest,
  persistChatScrollSnapshotForConversationKey,
  requestFollowBottomCatchup,
  setFollowBottomChatScrollSnapshot,
  withScrollGuard,
} from "./chatScrollSnapshots";

export {
  isScrollUpdateSuspended,
  withScrollGuard,
} from "./chatScrollSnapshots";


const blockedConversationLoadKeys = new Set<number>();


export type LatestRetryPair = {
  userIndex: number;
  userMessage: Message;
  assistantMessage: Message;
};

const followBottomStabilizers = new Map<
  number,
  { rafId: number | null; timeoutId: number | null }
>();

export function findLatestRetryPair(
  history: Message[],
): LatestRetryPair | null {
  for (let i = history.length - 1; i >= 1; i--) {
    if (history[i]?.role !== "assistant") continue;
    if (history[i - 1]?.role !== "user") return null;
    return {
      userIndex: i - 1,
      userMessage: history[i - 1],
      assistantMessage: history[i],
    };
  }
  return null;
}


function getUserBubbleElement(wrapper: HTMLElement): HTMLDivElement | null {
  const children = Array.from(wrapper.children) as HTMLElement[];
  for (const child of children) {
    if (
      child.classList.contains("paperpilot-bubble") &&
      child.classList.contains("user")
    ) {
      return child as HTMLDivElement;
    }
  }
  return null;
}


function normalizeSelectedTexts(
  selectedTexts: unknown,
  legacySelectedText?: unknown,
): string[] {
  const normalize = (value: unknown): string => {
    if (typeof value !== "string") return "";
    return sanitizeText(value).trim();
  };
  if (Array.isArray(selectedTexts)) {
    return selectedTexts.map((value) => normalize(value)).filter(Boolean);
  }
  const legacy = normalize(legacySelectedText);
  return legacy ? [legacy] : [];
}


export async function ensureConversationLoaded(
    item: Zotero.Item,
): Promise<void> {
    const conversationKey = getConversationKey(item);
    const conversationSystem = resolveConversationSystemForItem(item);
    // if (isEffectiveWebChatRequest(item)) {
    //     isolateWebChatConversationKey(
    //     conversationKey,
    //     !webChatIsolatedConversationKeys.has(conversationKey),
    //     );
    //     conversationForkLinks.delete(conversationKey);
    //     return;
    // }
    // if (webChatIsolatedConversationKeys.delete(conversationKey)) {
    //     chatHistory.delete(conversationKey);
    //     loadedConversationKeys.delete(conversationKey);
    //     conversationForkLinks.delete(conversationKey);
    // }

    // if (loadedConversationKeys.has(conversationKey)) {
    //     await loadConversationForkLinkCache(conversationKey);
    //     return;
    // }
    // if (
    //     chatHistory.has(conversationKey) &&
    //     !blockedConversationLoadKeys.has(conversationKey)
    // ) {
    //     await loadConversationForkLinkCache(conversationKey);
    //     loadedConversationKeys.add(conversationKey);
    //     return;
    // }
    // if (blockedConversationLoadKeys.has(conversationKey)) {
    //     chatHistory.delete(conversationKey);
    //     conversationForkLinks.delete(conversationKey);
    //     blockedConversationLoadKeys.delete(conversationKey);
    // }

    const existingTask = loadingConversationTasks.get(conversationKey);
    if (existingTask) {
        await existingTask;
        return;
    }

    const task = (async () => {
        let shouldMarkLoaded = false;
        try {
            // const validScope = await validateConversationScopeForItem({
            //     item,
            //     conversationKey,
            //     conversationSystem,
            // });
            // if (!validScope) {
            //     blockedConversationLoadKeys.add(conversationKey);
            //     chatHistory.set(conversationKey, []);
            //     // conversationForkLinks.delete(conversationKey);
            //     return;
            // }
            // const storedMessages = await loadStoredConversationByKey(
            //     conversationKey,
            //     PERSISTED_HISTORY_LIMIT,
            //     conversationSystem,
            // );
            // if (
            //     webChatIsolatedConversationKeys.has(conversationKey) ||
            //     isEffectiveWebChatRequest(item)
            // ) {
            //     isolateWebChatConversationKey(conversationKey, false);
            //     shouldMarkLoaded = true;
            //     return;
            // }
            // if (!storedMessagesMatchActivePaper(item, storedMessages)) {
            //     ztoolkit.log(
            //     `Paper Pilot: Refused to render conversation ${conversationKey} because stored paper contexts do not include the active paper.`,
            //     );
            //     blockedConversationLoadKeys.add(conversationKey);
            //     chatHistory.set(conversationKey, []);
            //     conversationForkLinks.delete(conversationKey);
            //     return;
            // }
            // const panelMessages = storedMessages.map((message) =>
            //     toPanelMessage(message),
            // );
            // const latestAssistantWithContext = [...storedMessages]
            //     .reverse()
            //     .find(
            //     (message) =>
            //         message.role === "assistant" &&
            //         typeof message.contextTokens === "number",
            //     );
            // if (latestAssistantWithContext?.contextTokens) {
            //     setContextUsageSnapshot(conversationKey, {
            //     contextTokens: latestAssistantWithContext.contextTokens,
            //     contextWindow: latestAssistantWithContext.contextWindow,
            //     estimated: true,
            //     source: "persisted",
            //     });
            // }
            // blockedConversationLoadKeys.delete(conversationKey);
            // chatHistory.set(conversationKey, panelMessages);
            // await loadConversationForkLinkCache(conversationKey);
            // shouldMarkLoaded = true;
            // } catch (err) {
            // ztoolkit.log("LLM: Failed to load chat history", err);
            // if (!chatHistory.has(conversationKey)) {
            //     chatHistory.set(conversationKey, []);
            // }
            // conversationForkLinks.delete(conversationKey);
            shouldMarkLoaded = true;
        } finally {
            if (shouldMarkLoaded) {
                loadedConversationKeys.add(conversationKey);
            } else {
                loadedConversationKeys.delete(conversationKey);
            }
            loadingConversationTasks.delete(conversationKey);
        }
    })();

    loadingConversationTasks.set(conversationKey, task);
    await task;
}


export function syncUserContextAlignmentWidths(body: Element): void {
  const chatBox = body.querySelector("#paperpilot-chat-box") as HTMLDivElement | null;
  if (!chatBox) return;
  const wrappers = Array.from(
    chatBox.querySelectorAll(
      ".paperpilot-message-wrapper.user.paperpilot-user-context-aligned",
    ),
  ) as HTMLDivElement[];
  for (const wrapper of wrappers) {
    const bubble = getUserBubbleElement(wrapper);
    if (!bubble) {
      wrapper.style.removeProperty("--paperpilot-user-bubble-width");
      continue;
    }
    const bubbleWidth = Math.round(bubble.getBoundingClientRect().width);
    if (bubbleWidth > 0) {
      wrapper.style.setProperty("--paperpilot-user-bubble-width", `${bubbleWidth}px`);
    } else {
      wrapper.style.removeProperty("--paperpilot-user-bubble-width");
    }
  }
}

function getMessageSelectedTexts(message: Message): string[] {
  return normalizeSelectedTexts(message.selectedTexts, message.selectedText);
}


function normalizeSelectedTextPaperContextsByIndex(
  selectedTextPaperContexts: unknown,
  count: number,
): (PaperContextRef | undefined)[] {
  return normalizeSelectedTextPaperContextEntries(
    selectedTextPaperContexts,
    count,
    {
      sanitizeText,
    },
  );
}

function normalizePaperContexts(paperContexts: unknown): PaperContextRef[] {
  return normalizePaperContextRefs(paperContexts, { sanitizeText });
}

function normalizeCollectionContexts(
  collectionContexts: unknown,
): CollectionContextRef[] {
  return normalizeCollectionContextRefs(collectionContexts, { sanitizeText });
}

function normalizeTagContexts(tagContexts: unknown): TagContextRef[] {
  return normalizeTagContextRefs(tagContexts, { sanitizeText });
}


function getMessageSelectedTextExpandedIndex(
  message: Message,
  count: number,
): number {
  if (count <= 0) return -1;
  const rawIndex = message.selectedTextExpandedIndex;
  if (typeof rawIndex === "number" && Number.isFinite(rawIndex)) {
    const normalized = Math.floor(rawIndex);
    if (normalized >= 0 && normalized < count) return normalized;
  }
  if (message.selectedTextExpanded === true) return 0;
  return -1;
}

export function refreshChat(body: Element, item?: Zotero.Item | null) {
  const chatBox = body.querySelector("#paperpilot-chat-box") as HTMLDivElement | null;
  if (!chatBox) return;
  const doc = body.ownerDocument!;
  // setPromptMenuTarget(null);
  const paperContextDisplayCache: PaperContextDisplayCache = new Map();
  const resolvePaperContextForCardDisplay = (
    paperContext: PaperContextRef,
  ): PaperContextRef =>
    resolvePaperContextDisplayRef(paperContext, paperContextDisplayCache);

  if (!item) {
    chatBox.innerHTML = `
      <div class="paperpilot-welcome">
        <div class="paperpilot-welcome-icon paperpilot-context-svg-icon paperpilot-context-icon-paper" aria-hidden="true"></div>
        <div class="paperpilot-welcome-text">Select an item or open a PDF to start.</div>
      </div>
    `;
    const tokenUsageEl = body.querySelector(
      "#paperpilot-token-usage",
    ) as HTMLElement | null;
    if (tokenUsageEl) tokenUsageEl.style.display = "none";
    return;
  }

  const conversationKey = getConversationKey(item);
  // Sync token counter for this conversation
  const tokenUsageEl = body.querySelector(
    "#paperpilot-token-usage",
  ) as HTMLElement | null;
  const panelRoot = body.querySelector("#paperpilot-main") as HTMLDivElement | null;
  const isGlobalConversation =
    isGlobalPortalItem(item) ||
    panelRoot?.dataset.conversationKind === "global";
  const mutateChatWithScrollGuard = (fn: () => void) => {
    // withScrollGuard(chatBox, conversationKey, fn);
  };
  const pendingRestoreSnapshot = consumePendingChatScrollRestore(
    conversationKey,
    body,
  );
  const cachedSnapshot = getChatScrollSnapshot(conversationKey);
  const baselineSnapshot = hasActiveFollowBottomCatchupRequest(conversationKey)
    ? buildFollowBottomScrollSnapshot(chatBox)
    : pendingRestoreSnapshot
      ? pendingRestoreSnapshot
      : cachedSnapshot
        ? cachedSnapshot
        : buildChatScrollSnapshot(chatBox);
  const history = chatHistory.get(conversationKey) || [];
  // const forkLink = conversationForkLinks.get(conversationKey) || null;
  // if (tokenUsageEl) {
  //   const snapshot = contextUsageSnapshots.get(conversationKey);
  //   const liveSnapshot =
  //     snapshot && snapshot.source !== "persisted" ? snapshot : undefined;
  //   const recomputedSnapshot = liveSnapshot
  //     ? undefined
  //     : estimateHistoryContextUsageSnapshot(item, history);
  //   renderContextUsageSnapshot(
  //     body,
  //     tokenUsageEl,
  //     liveSnapshot || recomputedSnapshot || snapshot,
  //   );
  // }

  if (history.length === 0) {
    // [webchat] Show webchat-specific welcome instead of generic instructions
    // const effectiveRequestConfig = resolveEffectiveRequestConfig({ item });
    const isStandalone =
      panelRoot?.dataset?.standalone === "true" ||
      (body as HTMLElement).dataset?.standalone === "true";
    // const isNoteEditing = !!resolveActiveNoteSession(item);
    if (isStandalone && isGlobalConversation) {
      chatBox.innerHTML = getStandaloneLibraryChatStartPageHtml();
      if (panelRoot) panelRoot.dataset.startPageActive = "true";
    } else {
      chatBox.innerHTML = getPaperChatStartPageHtml();
      if (panelRoot) panelRoot.dataset.startPageActive = "true";
    }
    return;
  }

  // Animate transition from start page to chat mode
  const wasStartPage = panelRoot?.dataset.startPageActive === "true";
  if (wasStartPage && panelRoot) {
    panelRoot.classList.add("paperpilot-start-page-transitioning");
    delete panelRoot.dataset.startPageActive;
    const win = body.ownerDocument?.defaultView;
    if (win) {
      win.setTimeout(() => {
        panelRoot.classList.remove("paperpilot-start-page-transitioning");
      }, 450);
    }
  }
  chatBox.innerHTML = "";

  const latestRetryPair = findLatestRetryPair(history);
  const latestAssistantIndex = latestRetryPair
    ? latestRetryPair.userIndex + 1
    : -1;
  // [webchat] Resolve provider protocol once for editability checks
  // const renderProviderProtocol = resolveEffectiveRequestConfig({
  //   item,
  // }).providerProtocol;
  const conversationIsIdle = !history.some((m) => m.streaming);
  for (const [index, msg] of history.entries()) {
    const isUser = msg.role === "user";
    const assistantPairMsg = history[index + 1];
    const hasAssistantPair = isUser && assistantPairMsg?.role === "assistant";
    // const canEditUserPrompt = canEditUserPromptTurn({
    //   isUser,
    //   hasItem: Boolean(item),
    //   conversationIsIdle,
    //   assistantPair: assistantPairMsg,
    //   providerProtocol: renderProviderProtocol,
    // });
    // const isInlineEditBubble = Boolean(
    //   canEditUserPrompt &&
    //   inlineEditTarget?.conversationKey === conversationKey &&
    //   inlineEditTarget.userTimestamp === msg.timestamp,
    // );
    let hasUserContext = false;
    const wrapper = doc.createElement("div") as HTMLDivElement;
    wrapper.className = `paperpilot-message-wrapper ${isUser ? "user" : "assistant"}`;
    wrapper.dataset.messageRole = msg.role;
    wrapper.dataset.messageTimestamp = `${Math.floor(
      Number(msg.timestamp) || 0,
    )}`;
    if (!isUser && msg.compactMarker) {
      wrapper.classList.add("paperpilot-compact-marker-wrapper");
    }

    const bubble = doc.createElement("div") as HTMLDivElement;
    bubble.className = `paperpilot-bubble ${isUser ? "user" : "assistant"}`;
    let inlineEditEl: HTMLElement | null = null;

    if (isUser) {
      const contextBadgesRow = doc.createElement("div") as HTMLDivElement;
      contextBadgesRow.className = "paperpilot-user-context-badges";
      let hasContextBadge = false;

      const screenshotImages = Array.isArray(msg.screenshotImages)
        ? msg.screenshotImages.filter(
            (entry) =>
              Boolean(entry) && !entry.startsWith("data:application/pdf"),
          )
        : [];
      let screenshotExpanded: HTMLDivElement | null = null;
      let papersExpanded: HTMLDivElement | null = null;
      let collectionsExpanded: HTMLDivElement | null = null;
      let tagsExpanded: HTMLDivElement | null = null;
      let filesExpanded: HTMLDivElement | null = null;
      const selectedTexts = getMessageSelectedTexts(msg);
      const selectedTextSources = normalizeSelectedTextSources(
        msg.selectedTextSources,
        selectedTexts.length,
      );
      const selectedTextPaperContexts =
        normalizeSelectedTextPaperContextsByIndex(
          msg.selectedTextPaperContexts,
          selectedTexts.length,
        );
      const hasScreenshotContext = screenshotImages.length > 0;
      const hasSelectedTextContext = selectedTexts.length > 0;
      const selectedCollectionContexts = normalizeCollectionContexts(
        msg.selectedCollectionContexts,
      );
      const selectedTagContexts = normalizeTagContexts(msg.selectedTagContexts);
      hasUserContext =
        hasScreenshotContext ||
        hasSelectedTextContext ||
        selectedCollectionContexts.length > 0 ||
        selectedTagContexts.length > 0;
      if (hasScreenshotContext) {
        const screenshotBar = doc.createElementNS(
          HTML_NS,
          "button",
        ) as HTMLButtonElement;
        screenshotBar.type = "button";
        screenshotBar.className = "paperpilot-user-screenshots-bar";

        // const screenshotIcon = createContextIcon(
        //   doc,
        //   "image",
        //   "paperpilot-user-screenshots-icon",
        // );

        const screenshotLabel = doc.createElement("span") as HTMLSpanElement;
        screenshotLabel.className = "paperpilot-user-screenshots-label";
        screenshotLabel.textContent = formatFigureCountLabel(
          screenshotImages.length,
        );

        // screenshotBar.append(screenshotIcon, screenshotLabel);
        screenshotBar.append(screenshotLabel);

        const screenshotExpandedEl = doc.createElement("div") as HTMLDivElement;
        screenshotExpandedEl.className = "paperpilot-user-screenshots-expanded";
        screenshotExpanded = screenshotExpandedEl;

        const thumbStrip = doc.createElement("div") as HTMLDivElement;
        thumbStrip.className = "paperpilot-user-screenshots-thumbs";

        const previewWrap = doc.createElement("div") as HTMLDivElement;
        previewWrap.className = "paperpilot-user-screenshots-preview";
        const previewImg = doc.createElement("img") as HTMLImageElement;
        previewImg.className = "paperpilot-user-screenshots-preview-img";
        previewImg.alt = "Screenshot preview";
        previewWrap.appendChild(previewImg);

        const thumbButtons: HTMLButtonElement[] = [];
        screenshotImages.forEach((imageUrl, index) => {
          const thumbBtn = doc.createElementNS(
            HTML_NS,
            "button",
          ) as HTMLButtonElement;
          thumbBtn.type = "button";
          thumbBtn.className = "paperpilot-user-screenshot-thumb";
          thumbBtn.title = `Screenshot ${index + 1}`;

          const thumbImg = doc.createElement("img") as HTMLImageElement;
          thumbImg.className = "paperpilot-user-screenshot-thumb-img";
          thumbImg.src = imageUrl;
          thumbImg.alt = `Screenshot ${index + 1}`;
          thumbBtn.appendChild(thumbImg);

          const activateScreenshotThumb = (e: Event) => {
            const mouse = e as MouseEvent;
            if (typeof mouse.button === "number" && mouse.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            mutateChatWithScrollGuard(() => {
              msg.screenshotActiveIndex = index;
              if (!msg.screenshotExpanded) {
                msg.screenshotExpanded = true;
              }
              applyScreenshotState();
            });
          };
          thumbBtn.addEventListener("mousedown", activateScreenshotThumb);
          thumbBtn.addEventListener("click", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
          });
          thumbBtn.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            activateScreenshotThumb(e);
          });
          thumbButtons.push(thumbBtn);
          thumbStrip.appendChild(thumbBtn);
        });

        screenshotExpandedEl.append(thumbStrip, previewWrap);

        const applyScreenshotState = () => {
          const expanded = Boolean(msg.screenshotExpanded);
          let activeIndex =
            typeof msg.screenshotActiveIndex === "number"
              ? Math.floor(msg.screenshotActiveIndex)
              : 0;
          if (activeIndex < 0 || activeIndex >= screenshotImages.length) {
            activeIndex = 0;
            msg.screenshotActiveIndex = 0;
          }
          screenshotBar.classList.toggle("expanded", expanded);
          screenshotBar.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false",
          );
          screenshotExpandedEl.hidden = !expanded;
          screenshotExpandedEl.style.display = expanded ? "flex" : "none";
          previewImg.src = screenshotImages[activeIndex];
          thumbButtons.forEach((btn, index) => {
            btn.classList.toggle("active", index === activeIndex);
          });
          screenshotBar.title = expanded
            ? "Collapse figures"
            : "Expand figures";
        };

        const toggleScreenshotsExpanded = () => {
          mutateChatWithScrollGuard(() => {
            msg.screenshotExpanded = !msg.screenshotExpanded;
            applyScreenshotState();
          });
        };
        applyScreenshotState();
        screenshotBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          toggleScreenshotsExpanded();
        });
        screenshotBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        screenshotBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleScreenshotsExpanded();
        });

        contextBadgesRow.appendChild(screenshotBar);
        hasContextBadge = true;
      }

      if (selectedCollectionContexts.length) {
        const collectionsBar = doc.createElementNS(
          HTML_NS,
          "button",
        ) as HTMLButtonElement;
        collectionsBar.type = "button";
        collectionsBar.className =
          "paperpilot-user-papers-bar paperpilot-user-collections-bar";

        // const collectionsIcon = createContextIcon(
        //   doc,
        //   "collection",
        //   "paperpilot-user-papers-icon",
        // );

        const collectionsLabel = doc.createElement("span") as HTMLSpanElement;
        collectionsLabel.className = "paperpilot-user-papers-label";
        collectionsLabel.textContent =
          selectedCollectionContexts.length === 1
            ? "Collection"
            : "Collections";
        collectionsLabel.title = selectedCollectionContexts
          .map((entry) => entry.name)
          .join("\n");
        // collectionsBar.append(collectionsIcon, collectionsLabel);
        collectionsBar.append(collectionsLabel);

        const collectionsExpandedEl = doc.createElement(
          "div",
        ) as HTMLDivElement;
        collectionsExpandedEl.className =
          "paperpilot-user-papers-expanded paperpilot-user-collections-expanded";
        collectionsExpanded = collectionsExpandedEl;
        const collectionsList = doc.createElement("div") as HTMLDivElement;
        collectionsList.className =
          "paperpilot-user-papers-list paperpilot-user-collections-list";
        for (const collectionContext of selectedCollectionContexts) {
          const collectionItem = doc.createElement("div") as HTMLDivElement;
          collectionItem.className =
            "paperpilot-user-papers-item paperpilot-user-collections-item";

          const collectionTitle = doc.createElement("span") as HTMLSpanElement;
          collectionTitle.className = "paperpilot-user-papers-item-title";
          collectionTitle.textContent = collectionContext.name;
          collectionTitle.title = collectionContext.name;

          const collectionMeta = doc.createElement("span") as HTMLSpanElement;
          collectionMeta.className = "paperpilot-user-papers-item-meta";
          collectionMeta.textContent = `collectionId=${collectionContext.collectionId}`;
          collectionMeta.title = collectionMeta.textContent;

          collectionItem.append(collectionTitle, collectionMeta);
          collectionsList.appendChild(collectionItem);
        }
        collectionsExpandedEl.appendChild(collectionsList);

        const applyCollectionsState = () => {
          const expanded = Boolean(msg.collectionContextsExpanded);
          collectionsBar.classList.toggle("expanded", expanded);
          collectionsBar.setAttribute(
            "aria-expanded",
            expanded ? "true" : "false",
          );
          collectionsExpandedEl.hidden = !expanded;
          collectionsExpandedEl.style.display = expanded ? "block" : "none";
          collectionsBar.title = expanded
            ? "Collapse collections"
            : "Expand collections";
        };
        const toggleCollectionsExpanded = () => {
          msg.collectionContextsExpanded = !msg.collectionContextsExpanded;
          applyCollectionsState();
        };
        applyCollectionsState();
        collectionsBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          toggleCollectionsExpanded();
        });
        collectionsBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        collectionsBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleCollectionsExpanded();
        });

        contextBadgesRow.appendChild(collectionsBar);
        hasContextBadge = true;
      }

      if (selectedTagContexts.length) {
        const tagsBar = doc.createElementNS(
          HTML_NS,
          "button",
        ) as HTMLButtonElement;
        tagsBar.type = "button";
        tagsBar.className = "paperpilot-user-papers-bar paperpilot-user-tags-bar";

        // const tagsIcon = createContextIcon(doc, "tag", "paperpilot-user-papers-icon");
        const tagsLabel = doc.createElement("span") as HTMLSpanElement;
        tagsLabel.className = "paperpilot-user-papers-label";
        tagsLabel.textContent =
          selectedTagContexts.length === 1 ? "Tag" : "Tags";
        tagsLabel.title = selectedTagContexts
          .map((entry) => entry.name)
          .join("\n");
        // tagsBar.append(tagsIcon, tagsLabel);
        tagsBar.append(tagsLabel);

        const tagsExpandedEl = doc.createElement("div") as HTMLDivElement;
        tagsExpandedEl.className =
          "paperpilot-user-papers-expanded paperpilot-user-tags-expanded";
        tagsExpanded = tagsExpandedEl;
        const tagsList = doc.createElement("div") as HTMLDivElement;
        tagsList.className = "paperpilot-user-papers-list paperpilot-user-tags-list";
        for (const tagContext of selectedTagContexts) {
          const tagItem = doc.createElement("div") as HTMLDivElement;
          tagItem.className = "paperpilot-user-papers-item paperpilot-user-tags-item";

          const tagTitle = doc.createElement("span") as HTMLSpanElement;
          tagTitle.className = "paperpilot-user-papers-item-title";
          tagTitle.textContent = tagContext.name;
          tagTitle.title = tagContext.name;

          const tagMeta = doc.createElement("span") as HTMLSpanElement;
          tagMeta.className = "paperpilot-user-papers-item-meta";
          tagMeta.textContent = tagContext.scope
            ? `tagScope=${tagContext.scope}`
            : "tag";
          tagMeta.title = tagMeta.textContent;

          tagItem.append(tagTitle, tagMeta);
          tagsList.appendChild(tagItem);
        }
        tagsExpandedEl.appendChild(tagsList);

        const applyTagsState = () => {
          const expanded = Boolean(msg.tagContextsExpanded);
          tagsBar.classList.toggle("expanded", expanded);
          tagsBar.setAttribute("aria-expanded", expanded ? "true" : "false");
          tagsExpandedEl.hidden = !expanded;
          tagsExpandedEl.style.display = expanded ? "block" : "none";
          tagsBar.title = expanded ? "Collapse tags" : "Expand tags";
        };
        const toggleTagsExpanded = () => {
          msg.tagContextsExpanded = !msg.tagContextsExpanded;
          applyTagsState();
        };
        applyTagsState();
        tagsBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          toggleTagsExpanded();
        });
        tagsBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        tagsBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleTagsExpanded();
        });

        contextBadgesRow.appendChild(tagsBar);
        hasContextBadge = true;
      }

      const paperContexts = normalizePaperContexts(msg.paperContexts);
      hasUserContext = hasUserContext || paperContexts.length > 0;
      if (paperContexts.length) {
        const displayPaperContexts = paperContexts.map(
          resolvePaperContextForCardDisplay,
        );
        const papersBar = doc.createElementNS(
          HTML_NS,
          "button",
        ) as HTMLButtonElement;
        papersBar.type = "button";
        papersBar.className = "paperpilot-user-papers-bar";

        // const papersIcon = createContextIcon(
        //   doc,
        //   "paper",
        //   "paperpilot-user-papers-icon",
        // );

        const papersLabel = doc.createElement("span") as HTMLSpanElement;
        papersLabel.className = "paperpilot-user-papers-label";
        papersLabel.textContent = formatPaperCountLabel(paperContexts.length);
        papersLabel.title = displayPaperContexts
          .map((entry) => entry.title)
          .join("\n");
        // papersBar.append(papersIcon, papersLabel);
        papersBar.append(papersLabel);

        const papersExpandedEl = doc.createElement("div") as HTMLDivElement;
        papersExpandedEl.className = "paperpilot-user-papers-expanded";
        papersExpanded = papersExpandedEl;
        const papersList = doc.createElement("div") as HTMLDivElement;
        papersList.className = "paperpilot-user-papers-list";
        for (const paperContext of displayPaperContexts) {
          const paperItem = doc.createElement("div") as HTMLDivElement;
          paperItem.className = "paperpilot-user-papers-item";

          const paperTitle = doc.createElement("span") as HTMLSpanElement;
          paperTitle.className = "paperpilot-user-papers-item-title";
          paperTitle.textContent = paperContext.title;
          paperTitle.title = paperContext.title;

          const paperMeta = doc.createElement("span") as HTMLSpanElement;
          paperMeta.className = "paperpilot-user-papers-item-meta";
          const metaParts = [
            paperContext.firstCreator || "",
            paperContext.year || "",
          ].filter(Boolean);
          paperMeta.textContent = metaParts.join(" · ") || "Supplemental paper";
          paperMeta.title = paperMeta.textContent;

          const attachmentTitle = paperContext.attachmentTitle || "";
          const paperAttachment = doc.createElement("span") as HTMLSpanElement;
          paperAttachment.className = "paperpilot-user-papers-item-attachment";
          paperAttachment.textContent = attachmentTitle;
          paperAttachment.title = attachmentTitle;

          paperItem.append(paperTitle, paperMeta);
          if (attachmentTitle) {
            paperItem.appendChild(paperAttachment);
          }
          papersList.appendChild(paperItem);
        }
        papersExpandedEl.appendChild(papersList);

        const applyPapersState = () => {
          const expanded = Boolean(msg.paperContextsExpanded);
          papersBar.classList.toggle("expanded", expanded);
          papersBar.setAttribute("aria-expanded", expanded ? "true" : "false");
          papersExpandedEl.hidden = !expanded;
          papersExpandedEl.style.display = expanded ? "block" : "none";
          papersBar.title = expanded ? "Collapse papers" : "Expand papers";
        };
        const togglePapersExpanded = () => {
          msg.paperContextsExpanded = !msg.paperContextsExpanded;
          applyPapersState();
        };
        applyPapersState();
        papersBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          togglePapersExpanded();
        });
        papersBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        papersBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          togglePapersExpanded();
        });

        contextBadgesRow.appendChild(papersBar);
        hasContextBadge = true;
      }

      const fileAttachments = Array.isArray(msg.attachments)
        ? msg.attachments.filter(
            (entry) =>
              entry &&
              typeof entry === "object" &&
              entry.category !== "image" &&
              typeof entry.name === "string" &&
              // Exclude PDF-paper attachments (shown under paper context instead)
              !(
                typeof entry.id === "string" &&
                entry.id.startsWith("pdf-paper-")
              ),
          )
        : [];
      hasUserContext = hasUserContext || fileAttachments.length > 0;
      if (fileAttachments.length) {
        const filesBar = doc.createElementNS(
          HTML_NS,
          "button",
        ) as HTMLButtonElement;
        filesBar.type = "button";
        filesBar.className = "paperpilot-user-files-bar";

        // const filesIcon = createContextIcon(doc, "file", "paperpilot-user-files-icon");

        const filesLabel = doc.createElement("span") as HTMLSpanElement;
        filesLabel.className = "paperpilot-user-files-label";
        filesLabel.textContent = `Files (${fileAttachments.length})`;
        filesLabel.title = fileAttachments.map((f) => f.name).join("\n");

        // filesBar.append(filesIcon, filesLabel);
        filesBar.append(filesLabel);

        const filesExpandedEl = doc.createElement("div") as HTMLDivElement;
        filesExpandedEl.className = "paperpilot-user-files-expanded";
        filesExpanded = filesExpandedEl;
        const filesList = doc.createElement("div") as HTMLDivElement;
        filesList.className = "paperpilot-user-files-list";

        for (const attachment of fileAttachments) {
          const canOpen = Boolean(toFileUrl(attachment.storedPath));
          const fileItem = (
            canOpen
              ? doc.createElementNS(HTML_NS, "button")
              : doc.createElement("div")
          ) as HTMLButtonElement | HTMLDivElement;
          fileItem.className = "paperpilot-user-files-item";
          if (canOpen) {
            fileItem.classList.add("paperpilot-user-files-item-openable");
            (fileItem as HTMLButtonElement).type = "button";
            (fileItem as HTMLButtonElement).title = `Open ${attachment.name}`;
            fileItem.addEventListener("mousedown", (e: Event) => {
              const mouse = e as MouseEvent;
              if (mouse.button !== 0) return;
              mouse.preventDefault();
              mouse.stopPropagation();
              // openStoredAttachmentFromMessage(attachment);
            });
            fileItem.addEventListener("click", (e: Event) => {
              e.preventDefault();
              e.stopPropagation();
            });
            fileItem.addEventListener("keydown", (event: Event) => {
              const keyEvent = event as KeyboardEvent;
              if (keyEvent.key !== "Enter" && keyEvent.key !== " ") return;
              keyEvent.preventDefault();
              keyEvent.stopPropagation();
              // openStoredAttachmentFromMessage(attachment);
            });
          }

          const fileType = doc.createElement("span") as HTMLSpanElement;
          fileType.className = "paperpilot-user-files-item-type";
          fileType.textContent = getAttachmentTypeLabel(attachment);
          fileType.title = attachment.mimeType || attachment.category || "file";

          const fileInfo = doc.createElement("div") as HTMLDivElement;
          fileInfo.className = "paperpilot-user-files-item-text";

          const fileName = doc.createElement("span") as HTMLSpanElement;
          fileName.className = "paperpilot-user-files-item-name";
          fileName.textContent = attachment.name;
          fileName.title = attachment.name;

          const fileMeta = doc.createElement("span") as HTMLSpanElement;
          fileMeta.className = "paperpilot-user-files-item-meta";
          fileMeta.textContent = `${attachment.mimeType || "application/octet-stream"} · ${(attachment.sizeBytes / 1024 / 1024).toFixed(2)} MB`;

          fileInfo.append(fileName, fileMeta);
          fileItem.append(fileType, fileInfo);
          filesList.appendChild(fileItem);
        }
        filesExpandedEl.appendChild(filesList);

        const applyFilesState = () => {
          const expanded = Boolean(msg.attachmentsExpanded);
          filesBar.classList.toggle("expanded", expanded);
          filesBar.setAttribute("aria-expanded", expanded ? "true" : "false");
          filesExpandedEl.hidden = !expanded;
          filesExpandedEl.style.display = expanded ? "block" : "none";
          filesBar.title = expanded ? "Collapse files" : "Expand files";
        };
        const toggleFilesExpanded = () => {
          msg.attachmentsExpanded = !msg.attachmentsExpanded;
          applyFilesState();
        };
        applyFilesState();
        filesBar.addEventListener("mousedown", (e: Event) => {
          const mouse = e as MouseEvent;
          if (mouse.button !== 0) return;
          mouse.preventDefault();
          mouse.stopPropagation();
          toggleFilesExpanded();
        });
        filesBar.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        filesBar.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          toggleFilesExpanded();
        });

        contextBadgesRow.appendChild(filesBar);
        hasContextBadge = true;
      }

      if (hasContextBadge) {
        wrapper.appendChild(contextBadgesRow);
      }
      if (screenshotExpanded) {
        wrapper.appendChild(screenshotExpanded);
      }
      if (collectionsExpanded) {
        wrapper.appendChild(collectionsExpanded);
      }
      if (tagsExpanded) {
        wrapper.appendChild(tagsExpanded);
      }
      if (papersExpanded) {
        wrapper.appendChild(papersExpanded);
      }
      if (filesExpanded) {
        wrapper.appendChild(filesExpanded);
      }

      if (hasSelectedTextContext) {
        let selectedTextExpandedIndex = getMessageSelectedTextExpandedIndex(
          msg,
          selectedTexts.length,
        );
        const syncSelectedTextExpandedState = () => {
          msg.selectedTextExpandedIndex = selectedTextExpandedIndex;
          msg.selectedTextExpanded = selectedTextExpandedIndex === 0;
        };
        syncSelectedTextExpandedState();
        const applySelectedTextStates: Array<() => void> = [];
        const renderSelectedTextStates = () => {
          for (const applyState of applySelectedTextStates) {
            applyState();
          }
        };

        selectedTexts.forEach((selectedText, contextIndex) => {
          const selectedSource = selectedTextSources[contextIndex] || "pdf";
          const selectedTextPaperContext =
            selectedTextPaperContexts[contextIndex];
          const selectedTextPaperLabel =
            isGlobalConversation &&
            selectedSource === "pdf" &&
            selectedTextPaperContext
              ? formatPaperCitationLabel(selectedTextPaperContext)
              : "";
          const selectedBar = doc.createElementNS(
            HTML_NS,
            "button",
          ) as HTMLButtonElement;
          selectedBar.type = "button";
          selectedBar.className = "paperpilot-user-selected-text";
          selectedBar.dataset.contextSource = selectedSource;

          // const selectedIcon = createSelectedTextSourceIcon(
          //   doc,
          //   selectedSource,
          //   "paperpilot-user-selected-text-icon",
          // );

          const selectedContent = doc.createElement("span") as HTMLSpanElement;
          selectedContent.className = "paperpilot-user-selected-text-content";
          selectedContent.textContent = selectedTextPaperLabel
            ? `${selectedTextPaperLabel} - ${selectedText}`
            : selectedText;

          const selectedExpanded = doc.createElement("div") as HTMLDivElement;
          selectedExpanded.className = "paperpilot-user-selected-text-expanded";
          selectedExpanded.textContent = selectedTextPaperLabel
            ? `${selectedTextPaperLabel}\n\n${selectedText}`
            : selectedText;

          // selectedBar.append(selectedIcon, selectedContent);
          selectedBar.append(selectedContent);
          const applySelectedTextState = () => {
            const expanded = selectedTextExpandedIndex === contextIndex;
            selectedBar.classList.toggle("expanded", expanded);
            selectedBar.setAttribute(
              "aria-expanded",
              expanded ? "true" : "false",
            );
            selectedExpanded.hidden = !expanded;
            selectedExpanded.style.display = expanded ? "block" : "none";
            selectedBar.title = expanded
              ? "Collapse selected text"
              : "Expand selected text";
          };
          const toggleSelectedTextExpanded = () => {
            mutateChatWithScrollGuard(() => {
              selectedTextExpandedIndex =
                selectedTextExpandedIndex === contextIndex ? -1 : contextIndex;
              syncSelectedTextExpandedState();
              renderSelectedTextStates();
            });
          };
          applySelectedTextStates.push(applySelectedTextState);
          selectedBar.addEventListener("mousedown", (e: Event) => {
            const mouse = e as MouseEvent;
            if (mouse.button !== 0) return;
            mouse.preventDefault();
            mouse.stopPropagation();
            toggleSelectedTextExpanded();
          });
          selectedBar.addEventListener("click", (e: Event) => {
            e.preventDefault();
            e.stopPropagation();
          });
          selectedBar.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            e.stopPropagation();
            toggleSelectedTextExpanded();
          });
          wrapper.appendChild(selectedBar);
          wrapper.appendChild(selectedExpanded);
        });
        renderSelectedTextStates();
      }
      const hasPromptTurnPair = Boolean(assistantPairMsg?.role === "assistant");
      const canDeletePromptTurn = Boolean(
        hasPromptTurnPair && !assistantPairMsg?.streaming,
      );
      // if (isInlineEditBubble) {
      //   inlineEditEl = buildInlineEditWidget(
      //     doc,
      //     body,
      //     item,
      //     msg,
      //     assistantPairMsg!,
      //     conversationKey,
      //   );
      // } else {
      //   renderUserBubbleContent(bubble, sanitizeText(msg.text || ""), doc);
      //   if (canEditUserPrompt) {
      //     bubble.classList.add("paperpilot-bubble-editable");
      //     bubble.addEventListener("click", (e: Event) => {
      //       if ((e.target as Element | null)?.closest("a, button")) return;
      //       e.preventDefault();
      //       e.stopPropagation();
      //       const win = body.ownerDocument?.defaultView;
      //       if (!win) return;
      //       try {
      //         syncComposeContextForInlineEdit(body, item, msg);
      //       } catch (syncErr) {
      //         ztoolkit.log(
      //           "LLM: Failed to sync compose context for inline edit",
      //           syncErr,
      //         );
      //       }
      //       setInlineEditTarget({
      //         conversationKey,
      //         userTimestamp: msg.timestamp,
      //         assistantTimestamp: Math.floor(assistantPairMsg!.timestamp),
      //         currentText: msg.text || "",
      //       });
      //       win.setTimeout(() => refreshChat(body, item), 0);
      //     });
      //   }
      // }
      if (hasPromptTurnPair) {
        bubble.addEventListener("contextmenu", (e: Event) => {
          const me = e as MouseEvent;
          me.preventDefault();
          me.stopPropagation();
          if (typeof me.stopImmediatePropagation === "function") {
            me.stopImmediatePropagation();
          }
          const promptMenu = body.querySelector(
            "#paperpilot-prompt-menu",
          ) as HTMLDivElement | null;
          const responseMenu = body.querySelector(
            "#paperpilot-response-menu",
          ) as HTMLDivElement | null;
          const exportMenu = body.querySelector(
            "#paperpilot-export-menu",
          ) as HTMLDivElement | null;
          const retryModelMenu = body.querySelector(
            "#paperpilot-retry-model-menu",
          ) as HTMLDivElement | null;
          const promptMenuDeleteBtn = promptMenu?.querySelector(
            "#paperpilot-prompt-menu-delete",
          ) as HTMLButtonElement | null;
          const promptMenuForkBtn = promptMenu?.querySelector(
            "#paperpilot-prompt-menu-fork",
          ) as HTMLButtonElement | null;
          if (!promptMenu) return;
          // const canForkPromptTurn =
          //   canDeletePromptTurn &&
          //   canShowForkActionForAssistantTurn(
          //     body,
          //     item,
          //     conversationKey,
          //     assistantPairMsg?.timestamp,
          //     assistantPairMsg,
          //   );
          // if (promptMenuDeleteBtn) {
          //   promptMenuDeleteBtn.disabled = !canDeletePromptTurn;
          // }
          // if (promptMenuForkBtn) {
          //   promptMenuForkBtn.disabled = !canForkPromptTurn;
          //   promptMenuForkBtn.style.display = canForkPromptTurn ? "" : "none";
          // }
          if (!canDeletePromptTurn) return;
          if (responseMenu) responseMenu.style.display = "none";
          if (exportMenu) exportMenu.style.display = "none";
          if (retryModelMenu) {
            retryModelMenu.classList.remove("paperpilot-model-menu-open");
            retryModelMenu.style.display = "none";
          }
          setResponseMenuTarget(null);
          // setPromptMenuTarget({
          //   item,
          //   conversationKey,
          //   userTimestamp: Math.floor(msg.timestamp),
          //   assistantTimestamp: hasPromptTurnPair
          //     ? Math.floor(assistantPairMsg?.timestamp || 0)
          //     : 0,
          //   editable: false,
          // });
          // positionMenuAtPointer(body, promptMenu, me.clientX, me.clientY);
        });
      }
    } else {
      const hasModelName = Boolean(msg.modelName?.trim());
      // const generatedImages = normalizeGeneratedChatImages(msg.generatedImages);
      // const hasGeneratedImages = generatedImages.length > 0;
      const hasAnswerText = Boolean(msg.text) || Boolean(msg.compactMarker);
      const previousUserMessage =
        index > 0 && history[index - 1]?.role === "user"
          ? history[index - 1]
          : null;

      // const agentRunId = msg.agentRunId?.trim();
      // const hasCachedTrace = agentRunId
      //   ? agentRunTraceCache.has(agentRunId)
      //   : false;
      // const cachedTraceEvents = agentRunId
      //   ? getCachedAgentRunEvents(agentRunId)
      //   : [];
      // const traceEvents = cachedTraceEvents.length
      //   ? cachedTraceEvents
      //   : msg.pendingAgentTraceEvents || [];
      // let agentUsesInterleavedText = false;
      // const agentTraceEl =
      //   msg.runMode === "agent" && !msg.compactMarker
      //     ? renderAgentTrace({
      //         doc,
      //         message: msg,
      //         userMessage: previousUserMessage,
      //         events: traceEvents,
      //         onTraceMissing:
      //           agentRunId && !hasCachedTrace
      //             ? () => {
      //                 void ensureAgentRunTraceLoaded(agentRunId, body, item);
      //               }
      //             : undefined,
      //         onInterleavedText: () => {
      //           agentUsesInterleavedText = true;
      //         },
      //       })
      //     : null;
      // if (hasAnswerText && !agentUsesInterleavedText) {
      //   const safeText = buildAssistantDisplayMarkdownForRender(msg);
      //   if (msg.streaming) bubble.classList.add("streaming");
      //   if (msg.compactMarker) {
      //     renderCompactMarkerInto(
      //       bubble,
      //       safeText ||
      //         (msg.streaming ? "Compacting context..." : "Context compacted"),
      //       doc,
      //       Boolean(msg.streaming),
      //     );
      //   } else
      //     try {
      //       renderRenderedMarkdownInto(bubble, safeText, doc, {
      //         onAsyncContentRendered: () => {
      //           stabilizeFollowBottomAfterAsyncChatContent(
      //             body,
      //             conversationKey,
      //             chatBox,
      //           );
      //         },
      //       });
      //     } catch (err) {
      //       ztoolkit.log("LLM render error:", err);
      //       bubble.textContent = safeText;
      //     }
      // }

      const bubbleHeaderNodes: HTMLElement[] = [];

      if (hasModelName && !msg.compactMarker) {
        const modelHeader = doc.createElement("div") as HTMLDivElement;
        modelHeader.className = "paperpilot-model-header";

        const modelName = doc.createElement("div") as HTMLDivElement;
        modelName.className = "paperpilot-model-name";
        // modelName.textContent = formatDisplayModelName(
        //   msg.modelName,
        //   msg.modelProviderLabel,
        //   {
        //     suppressProviderPrefix:
        //       resolveConversationSystemForItem(item) === "claude_code",
        //   },
        // );
        modelHeader.appendChild(modelName);

        // if (!hasAnswerText && msg.streaming && isClaudeStreamingConversation) {
        //   const roseLoader = doc.createElement("span") as HTMLSpanElement;
        //   roseLoader.className = "paperpilot-rose-loader paperpilot-rose-loader-inline";
        //   mountClaudeRoseThreeLoader(
        //     roseLoader,
        //     msg.waitingAnimationStartedAt || msg.timestamp || Date.now(),
        //   );
        //   modelHeader.appendChild(roseLoader);
        // }

        bubbleHeaderNodes.push(modelHeader);
      }

      const hasReasoningSummary = Boolean(msg.reasoningSummary?.trim());
      const hasReasoningDetails = Boolean(msg.reasoningDetails?.trim());
      const showTopReasoningPanel =
        (hasReasoningSummary || hasReasoningDetails); // && msg.runMode !== "agent";
      if (showTopReasoningPanel) {
        const details = doc.createElement("details") as HTMLDetailsElement;
        details.className = "paperpilot-agent-reasoning";
        details.open = Boolean(msg.reasoningOpen);

        const summary = doc.createElement("summary") as HTMLElement;
        summary.className = "paperpilot-agent-reasoning-summary";
        summary.textContent = "Thinking";
        const toggleReasoning = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          mutateChatWithScrollGuard(() => {
            const next = !msg.reasoningOpen;
            msg.reasoningOpen = next;
            details.open = next;
            // setLastReasoningExpanded(next);
          });
        };
        summary.addEventListener("mousedown", toggleReasoning);
        summary.addEventListener("click", (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
        });
        summary.addEventListener("keydown", (e: KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            toggleReasoning(e);
          }
        });
        details.appendChild(summary);

        const bodyWrap = doc.createElement("div") as HTMLDivElement;
        bodyWrap.className = "paperpilot-agent-reasoning-body";

        if (hasReasoningSummary) {
          const summaryBlock = doc.createElement("div") as HTMLDivElement;
          summaryBlock.className = "paperpilot-agent-reasoning-block";
          const label = doc.createElement("div") as HTMLDivElement;
          label.className = "paperpilot-agent-reasoning-label";
          label.textContent = "Summary";
          const text = doc.createElement("div") as HTMLDivElement;
          text.className = "paperpilot-agent-reasoning-text";
          // const reasoningSummaryText = buildAssistantDisplayMarkdownForRender({
          //   text: msg.reasoningSummary || "",
          //   quoteCitations: msg.quoteCitations,
          // });
          // try {
          //   renderRenderedMarkdownInto(text, reasoningSummaryText, doc);
          // } catch (err) {
          //   ztoolkit.log("LLM reasoning render error:", err);
          //   text.textContent = reasoningSummaryText;
          // }
          summaryBlock.append(label, text);
          bodyWrap.appendChild(summaryBlock);
        }

        if (hasReasoningDetails) {
          const detailsBlock = doc.createElement("div") as HTMLDivElement;
          detailsBlock.className = "paperpilot-agent-reasoning-block";
          const label = doc.createElement("div") as HTMLDivElement;
          label.className = "paperpilot-agent-reasoning-label";
          label.textContent = "Details";
          const text = doc.createElement("div") as HTMLDivElement;
          text.className = "paperpilot-agent-reasoning-text";
          // const reasoningDetailsText = buildAssistantDisplayMarkdownForRender({
          //   text: msg.reasoningDetails || "",
          //   quoteCitations: msg.quoteCitations,
          // });
          // try {
          //   renderRenderedMarkdownInto(text, reasoningDetailsText, doc);
          // } catch (err) {
          //   ztoolkit.log("LLM reasoning render error:", err);
          //   text.textContent = reasoningDetailsText;
          // }
          detailsBlock.append(label, text);
          bodyWrap.appendChild(detailsBlock);
        }

        details.appendChild(bodyWrap);
        bubbleHeaderNodes.push(details);
      }

      // if (agentTraceEl) {
      //   bubbleHeaderNodes.push(agentTraceEl);
      // }

      for (let i = bubbleHeaderNodes.length - 1; i >= 0; i -= 1) {
        bubble.insertBefore(bubbleHeaderNodes[i], bubble.firstChild);
      }

      // if (hasGeneratedImages) {
      //   renderAssistantGeneratedImagesInto(bubble, generatedImages, doc, {
      //     onImageLoaded: () => {
      //       stabilizeFollowBottomAfterAsyncChatContent(
      //         body,
      //         conversationKey,
      //         chatBox,
      //       );
      //     },
      //     onImageActionStatus: (message, level) => {
      //       const status = body.querySelector(
      //         "#paperpilot-status",
      //       ) as HTMLElement | null;
      //       if (status) setStatus(status, message, level);
      //     },
      //   });
      // }

      // decorateCompletedAssistantCitationLinks({
      //   body,
      //   panelItem: item,
      //   bubble,
      //   assistantMessage: msg,
      //   pairedUserMessage: previousUserMessage,
      // });

      // if (
      //   !hasAnswerText &&
      //   !hasGeneratedImages &&
      //   !(msg.streaming && isClaudeStreamingConversation)
      // ) {
      //   const typing = doc.createElement("div") as HTMLDivElement;
      //   typing.className = "paperpilot-typing";
      //   typing.innerHTML =
      //     '<span class="paperpilot-typing-dot"></span><span class="paperpilot-typing-dot"></span><span class="paperpilot-typing-dot"></span>';
      //   bubble.appendChild(typing);
      // }

      // if (!msg.compactMarker) {
      //   attachAssistantResponseContextMenu({
      //     body,
      //     doc,
      //     bubble,
      //     item,
      //     message: msg,
      //     pairedUserMessage: previousUserMessage,
      //     conversationKey,
      //   });
      // }
    }

    const meta = doc.createElement("div") as HTMLDivElement;
    meta.className = "paperpilot-message-meta";

    const time = doc.createElement("span") as HTMLSpanElement;
    time.className = "paperpilot-message-time";
    time.textContent = formatTime(msg.timestamp);
    meta.appendChild(time);
    // if (isUser && shouldShowUserFooterCopyAction(msg)) {
    //   const actions = doc.createElement("div") as HTMLDivElement;
    //   actions.className = "paperpilot-message-actions";
    //   appendUserMessageCopyAction({
    //     body,
    //     doc,
    //     actions,
    //     message: msg,
    //   });
    //   if (actions.childElementCount > 0) {
    //     meta.appendChild(actions);
    //   }
    // }
    // if (!isUser && shouldShowAssistantFooterActions(msg)) {
    //   const pairedUserForActions =
    //     index > 0 && history[index - 1]?.role === "user"
    //       ? history[index - 1]
    //       : null;
    //   const actionContent = resolveAssistantResponseMenuContent(msg);
    //   const actionConversationKey = conversationKey;
    //   const actionUserTimestamp =
    //     pairedUserForActions?.role === "user"
    //       ? Math.floor(pairedUserForActions.timestamp)
    //       : 0;
    //   const actionAssistantTimestamp = Math.floor(msg.timestamp);
    //   const actionResponseTarget = buildAssistantResponseActionTarget({
    //     item,
    //     message: msg,
    //     pairedUserMessage: pairedUserForActions,
    //     conversationKey: actionConversationKey,
    //   });
    //   const actionDeleteTarget = buildAssistantResponseDeleteTarget({
    //     item,
    //     message: msg,
    //     pairedUserMessage: pairedUserForActions,
    //     conversationKey: actionConversationKey,
    //     contentTarget: actionResponseTarget,
    //   });
    //   const actions = doc.createElement("div") as HTMLDivElement;
    //   actions.className = "paperpilot-message-actions";

    //   if (
    //     index === latestAssistantIndex &&
    //     msg.text.trim() &&
    //     msg.runMode !== "agent" &&
    //     renderProviderProtocol !== "web_sync" // [webchat] no retry in webchat mode
    //   ) {
    //     appendMessageMetaActionButton({
    //       body,
    //       doc,
    //       actions,
    //       className: "paperpilot-message-action-retry paperpilot-retry-latest",
    //       title: "Retry response with another model",
    //     });
    //   }

    //   if (actionContent && actionUserTimestamp > 0) {
    //     appendMessageMetaActionButton({
    //       body,
    //       doc,
    //       actions,
    //       className: "paperpilot-message-action-copy",
    //       title: "Copy response",
    //       responseAction: "copy",
    //       responseTarget: actionResponseTarget,
    //       conversationKey: actionConversationKey,
    //       userTimestamp: actionUserTimestamp,
    //       assistantTimestamp: actionAssistantTimestamp,
    //     });
    //     appendMessageMetaActionButton({
    //       body,
    //       doc,
    //       actions,
    //       className: "paperpilot-message-action-note",
    //       title: "Save as note",
    //       responseAction: "note",
    //       responseTarget: actionResponseTarget,
    //       conversationKey: actionConversationKey,
    //       userTimestamp: actionUserTimestamp,
    //       assistantTimestamp: actionAssistantTimestamp,
    //     });
    //   }

    //   const canShowForkAction =
    //     actionUserTimestamp > 0 &&
    //     canShowForkActionForAssistantTurn(
    //       body,
    //       item,
    //       conversationKey,
    //       actionAssistantTimestamp,
    //       msg,
    //     );
    //   if (canShowForkAction) {
    //     appendMessageMetaActionButton({
    //       body,
    //       doc,
    //       actions,
    //       className: "paperpilot-message-action-fork",
    //       title: "Fork this turn",
    //       responseAction: "fork",
    //       responseTarget: actionDeleteTarget,
    //       conversationKey: actionConversationKey,
    //       userTimestamp: actionUserTimestamp,
    //       assistantTimestamp: actionAssistantTimestamp,
    //     });
    //   }
    //   if (actionUserTimestamp > 0) {
    //     appendMessageMetaActionButton({
    //       body,
    //       doc,
    //       actions,
    //       className: "paperpilot-message-action-delete",
    //       title: "Delete this turn",
    //       responseAction: "delete",
    //       responseTarget: actionDeleteTarget,
    //       conversationKey: actionConversationKey,
    //       userTimestamp: actionUserTimestamp,
    //       assistantTimestamp: actionAssistantTimestamp,
    //     });
    //   }

    //   if (actions.childElementCount > 0) {
    //     meta.appendChild(actions);
    //   }
    // }

    // // [webchat] Collect status row data — rendered after meta, below the timestamp
    // let webchatStatusRow: HTMLDivElement | null = null;
    // if (!isUser) {
    //   const webchatStateLabel = getWebChatRunStateLabel(msg);
    //   if (webchatStateLabel) {
    //     webchatStatusRow = doc.createElement("div") as HTMLDivElement;
    //     webchatStatusRow.className = "paperpilot-message-webchat-status-row";

    //     const status = doc.createElement("span") as HTMLSpanElement;
    //     status.className = "paperpilot-message-webchat-status";
    //     status.textContent = webchatStateLabel;
    //     webchatStatusRow.appendChild(status);

    //     // [webchat] Refresh icon — re-scrape current ChatGPT conversation
    //     const refreshBtn = doc.createElementNS(
    //       HTML_NS,
    //       "button",
    //     ) as HTMLButtonElement;
    //     refreshBtn.className = "paperpilot-message-webchat-refresh";
    //     refreshBtn.textContent = "\u21BB";
    //     refreshBtn.title = "Re-fetch this conversation from webchat";
    //     refreshBtn.addEventListener("click", async () => {
    //       refreshBtn.disabled = true;
    //       try {
    //         const { refreshCurrentConversation } =
    //           await import("../../webchat/client");
    //         const { getRelayBaseUrl } =
    //           await import("../../webchat/relayServer");
    //         const scraped = await refreshCurrentConversation(
    //           getRelayBaseUrl(),
    //           msg.webchatChatUrl || null,
    //           msg.webchatChatId || null,
    //         );
    //         if (scraped.length > 0) {
    //           const refreshed: Message[] = scraped.map((m) => ({
    //             role: (m.kind === "user" ? "user" : "assistant") as
    //               | "user"
    //               | "assistant",
    //             text: m.text || "",
    //             timestamp: Date.now(),
    //             modelName:
    //               m.kind === "bot" ? msg.modelName || "chatgpt.com" : undefined,
    //             modelProviderLabel: m.kind === "bot" ? "WebChat" : undefined,
    //             reasoningDetails: m.thinking || undefined,
    //           }));
    //           chatHistory.set(conversationKey, refreshed);
    //           refreshChat(body, item);
    //         } else {
    //           refreshBtn.title =
    //             "No messages found — chat site may be on a different page";
    //           setTimeout(() => {
    //             refreshBtn.title = "Re-fetch this conversation from webchat";
    //             refreshBtn.disabled = false;
    //           }, 2000);
    //         }
    //       } catch {
    //         refreshBtn.title = "Refresh failed";
    //         setTimeout(() => {
    //           refreshBtn.title = "Re-fetch this conversation from webchat";
    //           refreshBtn.disabled = false;
    //         }, 2000);
    //       }
    //     });
    //     webchatStatusRow.appendChild(refreshBtn);
    //   }
    // }

    if (isUser && inlineEditEl) {
      wrapper.appendChild(inlineEditEl);
    } else {
      wrapper.appendChild(bubble);
    }
    wrapper.appendChild(meta);
    // if (webchatStatusRow) wrapper.appendChild(webchatStatusRow);
    chatBox.appendChild(wrapper);
    // if (
    //   forkLink &&
    //   !isUser &&
    //   Number(msg.timestamp) === forkLink.targetAnchorAssistantTimestamp
    // ) {
    //   const markerWrapper = doc.createElement("div") as HTMLDivElement;
    //   markerWrapper.className =
    //     "paperpilot-message-wrapper paperpilot-fork-source-marker-wrapper";
    //   const markerBubble = doc.createElement("div") as HTMLDivElement;
    //   markerBubble.className = "paperpilot-bubble";
    //   renderForkSourceMarkerInto(markerBubble, body, doc, forkLink);
    //   markerWrapper.appendChild(markerBubble);
    //   chatBox.appendChild(markerWrapper);
    // }
    if (isUser && hasUserContext) {
      wrapper.classList.add("paperpilot-user-context-aligned");
    }
  }

  syncUserContextAlignmentWidths(body);

  applyChatScrollSnapshot(chatBox, baselineSnapshot);
  persistChatScrollSnapshotForConversationKey(conversationKey, chatBox);
  if (baselineSnapshot.mode === "followBottom") {
    // scheduleFollowBottomStabilization(body, conversationKey, chatBox);
  } else {
    const win = body.ownerDocument?.defaultView;
    const active = followBottomStabilizers.get(conversationKey);
    if (active && win) {
      if (typeof active.rafId === "number") {
        win.cancelAnimationFrame(active.rafId);
      }
      if (typeof active.timeoutId === "number") {
        win.clearTimeout(active.timeoutId);
      }
      followBottomStabilizers.delete(conversationKey);
    }
  }
}

