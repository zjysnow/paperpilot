import { HTML_NS } from "../../utils/domHelpers";
import {
  t,
  getWelcomeHtml,
  // getWebChatWelcomeHtml,
  getStandaloneLibraryChatStartPageHtml,
  getPaperChatStartPageHtml,
  getNoteEditingStartPageHtml,
} from "../../utils/i18n";
import { renderZoteroRichTextInto } from "./markdownRenderer";

import {
  MAX_FULL_TEXT_PAPER_CONTEXTS,
  MAX_SELECTED_IMAGES,
  PERSISTED_HISTORY_LIMIT,
  formatAttachmentKindCountLabel,
  formatFigureCountLabel,
  formatPaperCountLabel,
} from "./constants";
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

import type {
  ConversationSystem,
  GeneratedChatImage,
  QuoteCitation,
} from "../../shared/types";
import type { RuntimeModelEntry } from "../../utils/modelProviders";

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
  getSelectedModelEntryForItem,
  setStringPref,
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

type SendQuestionOptions = {
  body: Element;
  item: Zotero.Item;
  message: Message;
  modelEntry?: RuntimeModelEntry;
};

type ChatMessageContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

function chatContentToOllamaText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) =>
      part &&
      typeof part === "object" &&
      "text" in part &&
      typeof part.text === "string"
        ? part.text
        : "[image attachment]",
    )
    .join("\n");
}

const activeSendRequests = new Map<number, { abort: () => void }>();
const CHAT_HISTORY_PREF_KEY = "conversationHistory";
const MAX_CHAT_HISTORY_PREF_LENGTH = 750_000;
let chatHistoryHydrated = false;

function persistableMessage(message: Message): Message {
  return {
    role: message.role,
    text: message.text,
    timestamp: message.timestamp,
    runMode: "chat",
    selectedTexts: message.selectedTexts?.map((text) => text.slice(0, 8000)),
    selectedTextSources: message.selectedTextSources,
    attachments: message.attachments?.map((attachment) => ({
      ...attachment,
      textContent: attachment.textContent?.slice(0, 24000),
      imageDataUrl: undefined,
    })),
    modelName: message.modelName,
    modelEntryId: message.modelEntryId,
    modelProviderLabel: message.modelProviderLabel,
  };
}

export function persistChatHistory(): void {
  const serialized = Object.fromEntries(
    [...chatHistory.entries()].map(([key, messages]) => [
      String(key),
      messages
        .filter((message) => !message.streaming)
        .slice(-PERSISTED_HISTORY_LIMIT)
        .map(persistableMessage),
    ]),
  );
  let value = JSON.stringify(serialized);
  if (value.length > MAX_CHAT_HISTORY_PREF_LENGTH) {
    for (const key of Object.keys(serialized)) {
      serialized[key] = serialized[key].slice(-10);
    }
    value = JSON.stringify(serialized);
  }
  if (value.length > MAX_CHAT_HISTORY_PREF_LENGTH) {
    ztoolkit.log(
      "Paper Pilot: Chat history exceeds the Zotero preference size limit; skipping persistence",
    );
    return;
  }
  try {
    setStringPref(CHAT_HISTORY_PREF_KEY, value);
  } catch (error) {
    ztoolkit.log(
      "Paper Pilot: Failed to persist chat history; preference value was too large",
      error,
    );
  }
}

function hydrateChatHistory(): void {
  if (chatHistoryHydrated) return;
  chatHistoryHydrated = true;
  const raw = getStringPref(CHAT_HISTORY_PREF_KEY);
  if (!raw.trim()) return;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    for (const [key, value] of Object.entries(parsed)) {
      const conversationKey = Number(key);
      if (!Number.isFinite(conversationKey) || conversationKey <= 0) continue;
      if (!Array.isArray(value)) continue;
      const messages = value.filter((message): message is Message =>
        Boolean(
          message &&
          typeof message === "object" &&
          ((message as Message).role === "user" ||
            (message as Message).role === "assistant") &&
          typeof (message as Message).text === "string" &&
          Number.isFinite(Number((message as Message).timestamp)),
        ),
      );
      if (messages.length) {
        chatHistory.set(Math.floor(conversationKey), messages);
      }
    }
  } catch (error) {
    ztoolkit.log("Paper Pilot: Failed to restore chat history", error);
  }
}

function setSendControls(body: Element, sending: boolean): void {
  const sendButton = body.querySelector(
    "#paperpilot-send",
  ) as HTMLButtonElement | null;
  const cancelButton = body.querySelector(
    "#paperpilot-cancel",
  ) as HTMLButtonElement | null;
  if (sendButton) {
    sendButton.style.display = sending ? "none" : "";
    sendButton.disabled = sending;
  }
  if (cancelButton) {
    cancelButton.style.display = sending ? "" : "none";
  }
}

function getSelectedTextContext(message: Message): string {
  const selectedText = (message.selectedTexts || [])
    .map((text) => text.trim())
    .filter(Boolean);
  return selectedText.length
    ? `Selected text:\n${selectedText.join("\n\n")}`
    : "";
}

function buildUserPrompt(message: Message): string {
  const withAttachments = buildModelPromptWithFileContext(
    message.text,
    message.attachments || [],
  );
  const selectedTextContext = getSelectedTextContext(message);
  return selectedTextContext
    ? `${withAttachments}\n\n${selectedTextContext}`
    : withAttachments;
}

function buildChatContent(message: Message): string | ChatMessageContentPart[] {
  const prompt = buildUserPrompt(message);
  const parts: ChatMessageContentPart[] = [{ type: "text", text: prompt }];
  for (const image of message.screenshotImages || []) {
    if (image.trim()) {
      parts.push({ type: "image_url", image_url: { url: image } });
    }
  }
  for (const attachment of message.attachments || []) {
    if (attachment.imageDataUrl?.trim()) {
      parts.push({
        type: "image_url",
        image_url: { url: attachment.imageDataUrl },
      });
    }
  }
  return parts.length === 1 ? prompt : parts;
}

function extractStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const value = payload as {
    type?: unknown;
    delta?: unknown;
    message?: { content?: unknown };
    choices?: Array<{ delta?: { content?: unknown } }>;
  };
  if (
    value.type === "response.output_text.delta" &&
    typeof value.delta === "string"
  ) {
    return value.delta;
  }
  if (typeof value.message?.content === "string") {
    return value.message.content;
  }
  const content = value.choices?.[0]?.delta?.content;
  return typeof content === "string" ? content : "";
}

type ProviderStreamState = {
  buffer: string;
  result: string;
  finished: boolean;
};

function consumeProviderStreamChunk(
  state: ProviderStreamState,
  chunk: string,
  onDelta: (text: string) => void,
  flush = false,
): void {
  state.buffer += chunk;
  const lines = state.buffer.split(/\r?\n/);
  state.buffer = flush ? "" : lines.pop() || "";
  if (flush && state.buffer) lines.push(state.buffer);
  for (const line of lines) {
    const trimmed = line.trim();
    const data = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;
    if (!data) continue;
    if (data === "[DONE]") {
      state.finished = true;
      continue;
    }
    try {
      const delta = extractStreamDelta(JSON.parse(data));
      if (delta) {
        state.result += delta;
        onDelta(delta);
      }
    } catch (error) {
      ztoolkit.log(
        "Paper Pilot: Ignored malformed provider stream event",
        error,
      );
    }
  }
}

export async function sendQuestion(
  options: SendQuestionOptions,
): Promise<void> {
  const conversationKey = getConversationKey(options.item);
  if (activeSendRequests.has(conversationKey)) return;
  const entry =
    options.modelEntry || getSelectedModelEntryForItem(options.item.id);
  if (!entry) {
    const status = options.body.querySelector(
      "#paperpilot-status",
    ) as HTMLElement | null;
    if (status) {
      setStatus(
        status,
        "No model is configured. Open Settings to add one.",
        "error",
      );
    }
    return;
  }
  let canceller: (() => void) | null = null;
  activeSendRequests.set(conversationKey, { abort: () => canceller?.() });
  setSendControls(options.body, true);
  const assistant: Message = {
    role: "assistant",
    text: "",
    timestamp: Date.now(),
    streaming: true,
    runMode: "chat",
    modelName: entry.model,
    modelEntryId: entry.entryId,
    modelProviderLabel: entry.providerLabel,
  };
  const history = chatHistory.get(conversationKey) || [];
  chatHistory.set(conversationKey, [...history, assistant]);
  persistChatHistory();
  refreshChat(options.body, options.item);
  persistChatHistory();
  try {
    const endpoint = `${new URL(entry.apiBase).origin}/api/chat`;
    ztoolkit.log(
      "Paper Pilot: sending model request",
      entry.providerLabel,
      entry.model,
      endpoint,
    );
    const priorMessages = history
      .filter((message) => !message.streaming)
      .map((message) => ({
        role: message.role,
        content: buildChatContent(message),
      }));
    const systemPrompt = getStringPref("systemPrompt").trim();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (entry.apiKey.trim()) {
      headers.Authorization = `Bearer ${entry.apiKey.trim()}`;
    }
    const requestBody = {
      model: entry.model,
      stream: true,
      think: false,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        ...priorMessages.map((message) => ({
          role: message.role,
          content: chatContentToOllamaText(message.content),
        })),
        {
          role: "user",
          content: chatContentToOllamaText(buildChatContent(options.message)),
        },
      ],
      options: {
        temperature: entry.advanced.temperature,
        num_predict: entry.advanced.maxTokens,
      },
    };
    ztoolkit.log("Paper Pilot: Making HTTP request to", endpoint);
    {
      const streamState: ProviderStreamState = {
        buffer: "",
        result: "",
        finished: false,
      };
      let processedResponseLength = 0;
      const xhr = await Zotero.HTTP.request("POST", endpoint, {
        body: JSON.stringify(requestBody),
        headers,
        timeout: 0,
        successCodes: false,
        requestObserver: (request: XMLHttpRequest) => {
          request.onprogress = () => {
            const nextText = request.responseText.slice(
              processedResponseLength,
            );
            processedResponseLength = request.responseText.length;
            consumeProviderStreamChunk(streamState, nextText, (delta) => {
              assistant.text += delta;
              refreshChat(options.body, options.item);
            });
          };
        },
        cancellerReceiver: (cancelFunc: () => void) => {
          canceller = cancelFunc;
        },
      });
      const remainingText = xhr.responseText.slice(processedResponseLength);
      consumeProviderStreamChunk(
        streamState,
        remainingText,
        (delta) => {
          assistant.text += delta;
          refreshChat(options.body, options.item);
        },
        true,
      );
      if (!streamState.result && !assistant.text) {
        throw new Error("Empty response from model");
      }
    }
    assistant.streaming = false;
    if (!assistant.text.trim()) {
      assistant.text = "The model returned an empty response.";
    }
    refreshChat(options.body, options.item);
    persistChatHistory();
  } catch (error) {
    assistant.streaming = false;
    assistant.text =
      error instanceof DOMException && error.name === "AbortError"
        ? "Request cancelled."
        : `Error: ${error instanceof Error ? error.message : String(error)}`;
    refreshChat(options.body, options.item);
    const status = options.body.querySelector(
      "#paperpilot-status",
    ) as HTMLElement | null;
    if (status) {
      setStatus(status, assistant.text, "error");
    }
  } finally {
    activeSendRequests.delete(conversationKey);
    setSendControls(options.body, false);
  }
}

export function cancelQuestion(item: Zotero.Item): boolean {
  const controller = activeSendRequests.get(getConversationKey(item));
  if (!controller) return false;
  controller.abort();
  return true;
}

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
  hydrateChatHistory();
  const conversationKey = getConversationKey(item);

  const existingTask = loadingConversationTasks.get(conversationKey);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    try {
      if (!chatHistory.has(conversationKey)) {
        chatHistory.set(conversationKey, []);
      }
    } finally {
      loadedConversationKeys.add(conversationKey);
      loadingConversationTasks.delete(conversationKey);
    }
  })();

  loadingConversationTasks.set(conversationKey, task);
  await task;
}

export function syncUserContextAlignmentWidths(body: Element): void {
  const chatBox = body.querySelector(
    "#paperpilot-chat-box",
  ) as HTMLDivElement | null;
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
      wrapper.style.setProperty(
        "--paperpilot-user-bubble-width",
        `${bubbleWidth}px`,
      );
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

function isPdfChatAttachment(attachment: ChatAttachment): boolean {
  const name = attachment.name.trim().toLowerCase();
  const mimeType = attachment.mimeType.trim().toLowerCase();
  return (
    attachment.category === "pdf" ||
    mimeType === "application/pdf" ||
    name.endsWith(".pdf")
  );
}

function isImageChatAttachment(attachment: ChatAttachment): boolean {
  return (
    attachment.category === "image" ||
    attachment.mimeType.trim().toLowerCase().startsWith("image/")
  );
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
  const chatBox = body.querySelector(
    "#paperpilot-chat-box",
  ) as HTMLDivElement | null;
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
  const panelRoot = body.querySelector(
    "#paperpilot-main",
  ) as HTMLDivElement | null;
  const isGlobalConversation =
    isGlobalPortalItem(item) ||
    panelRoot?.dataset.conversationKind === "global";
  const mutateChatWithScrollGuard = (fn: () => void) => {
    withScrollGuard(chatBox, conversationKey, fn);
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
        tagsBar.className =
          "paperpilot-user-papers-bar paperpilot-user-tags-bar";

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
        tagsList.className =
          "paperpilot-user-papers-list paperpilot-user-tags-list";
        for (const tagContext of selectedTagContexts) {
          const tagItem = doc.createElement("div") as HTMLDivElement;
          tagItem.className =
            "paperpilot-user-papers-item paperpilot-user-tags-item";

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
      const chatAttachments = Array.isArray(msg.attachments)
        ? msg.attachments.filter(
            (entry): entry is ChatAttachment =>
              Boolean(entry) &&
              typeof entry === "object" &&
              typeof entry.name === "string" &&
              typeof entry.mimeType === "string" &&
              typeof entry.category === "string",
          )
        : [];
      const paperAttachments = chatAttachments.filter(
        (entry) =>
          isPdfChatAttachment(entry) && !entry.id.startsWith("pdf-paper-"),
      );
      const imageAttachments = chatAttachments.filter(isImageChatAttachment);
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

      const appendAttachmentKindBadge = (
        kind: "Paper" | "Image",
        attachments: ChatAttachment[],
        className: string,
      ) => {
        if (!attachments.length) return;
        const badge = doc.createElementNS(
          HTML_NS,
          "button",
        ) as HTMLButtonElement;
        badge.type = "button";
        badge.className = className;
        badge.setAttribute(
          "aria-label",
          formatAttachmentKindCountLabel(kind, attachments.length),
        );
        badge.title = attachments.map((entry) => entry.name).join("\n");
        const label = doc.createElement("span");
        label.className =
          kind === "Paper"
            ? "paperpilot-user-papers-label"
            : "paperpilot-user-screenshots-label";
        label.textContent = formatAttachmentKindCountLabel(
          kind,
          attachments.length,
        );
        badge.appendChild(label);
        contextBadgesRow.appendChild(badge);
        hasContextBadge = true;
        hasUserContext = true;
      };

      appendAttachmentKindBadge(
        "Paper",
        paperAttachments,
        "paperpilot-user-papers-bar paperpilot-user-attachment-kind-bar",
      );
      appendAttachmentKindBadge(
        "Image",
        imageAttachments,
        "paperpilot-user-screenshots-bar paperpilot-user-attachment-kind-bar",
      );

      const fileAttachments = chatAttachments.filter(
        (entry) => !isPdfChatAttachment(entry) && !isImageChatAttachment(entry),
      );
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
      // Render the prompt directly so it remains visible even when optional
      // editing actions are unavailable.
      const userText = doc.createElement("div") as HTMLDivElement;
      userText.className = "paperpilot-message-text";
      userText.style.whiteSpace = "pre-wrap";
      userText.style.overflowWrap = "anywhere";
      userText.textContent = sanitizeText(msg.text || "");
      bubble.appendChild(userText);
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
        modelName.textContent = msg.modelName || "Assistant";
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
      const showTopReasoningPanel = hasReasoningSummary || hasReasoningDetails; // && msg.runMode !== "agent";
      if (showTopReasoningPanel) {
        const details = doc.createElement("details") as HTMLDetailsElement;
        details.className = "paperpilot-reasoning";
        details.open = Boolean(msg.reasoningOpen);

        const summary = doc.createElement("summary") as HTMLElement;
        summary.className = "paperpilot-reasoning-summary";
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
        bodyWrap.className = "paperpilot-reasoning-body";

        if (hasReasoningSummary) {
          const summaryBlock = doc.createElement("div") as HTMLDivElement;
          summaryBlock.className = "paperpilot-reasoning-block";
          const label = doc.createElement("div") as HTMLDivElement;
          label.className = "paperpilot-reasoning-label";
          label.textContent = "Summary";
          const text = doc.createElement("div") as HTMLDivElement;
          text.className = "paperpilot-reasoning-text";
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
          detailsBlock.className = "paperpilot-reasoning-block";
          const label = doc.createElement("div") as HTMLDivElement;
          label.className = "paperpilot-reasoning-label";
          label.textContent = "Details";
          const text = doc.createElement("div") as HTMLDivElement;
          text.className = "paperpilot-reasoning-text";
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

      if (msg.text) {
        const answerText = doc.createElement("div") as HTMLDivElement;
        answerText.className = "paperpilot-message-text";
        try {
          renderZoteroRichTextInto(answerText, sanitizeText(msg.text), doc);
        } catch (error) {
          ztoolkit.log(
            "Markdown render error, falling back to plain text:",
            error,
          );
          answerText.style.whiteSpace = "pre-wrap";
          answerText.style.overflowWrap = "anywhere";
          answerText.textContent = sanitizeText(msg.text);
        }
        bubble.appendChild(answerText);
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
