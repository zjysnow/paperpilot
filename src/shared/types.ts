/**
 * Shared domain types used by the context panel and related runtime helpers.
 * This file has zero imports — all types are pure data shapes.
 */

export type ConversationSystem = "upstream";

/** A Zotero collection selected as context scope. */
export type CollectionContextRef = {
  collectionId: number;
  name: string;
  libraryID: number;
};

/** A Zotero note (item note or standalone) selected as a reference context. */
export type NoteContextRef = {
  libraryID: number;
  noteItemKey: string;
  noteItemId?: number;
  parentItemId?: number;
  parentItemKey?: string;
  noteKind: "item" | "standalone";
  title: string;
};

export type PaperContentSourceMode =
  "text" | "mineru" | "pdf" | "markdown" | "html" | "txt" | "docx";

export type PaperContextRef = {
  itemId: number;
  contextItemId: number;
  contentSourceMode?: PaperContentSourceMode;
  citationKey?: string;
  title: string;
  attachmentTitle?: string;
  firstCreator?: string;
  year?: string;
  /** Full path to durable MinerU text metadata plus PDF figure crop cache. */
  mineruCacheDir?: string;
};

export type SelectedTextSource = "pdf" | "model" | "note" | "note-edit";

/** A Zotero tag or tag scope selected as context scope. */
export type TagContextRef = {
  name: string;
  libraryID: number;
  normalizedName?: string;
  scope?: "allTagged" | "untagged";
  includeAutomatic?: boolean;
};

export type ActiveNoteSession = {
  noteKind: "item" | "standalone";
  // noteId: number;
  libraryID: number;
  title: string;
  parentItemId?: number;
  conversationKind: "paper" | "global";
};

export type QuoteCitation = {
  id: string;
  quoteText: string;
  displayQuoteText?: string;
  citationLabel: string;
  sourceMatchText?: string;
  sourceMatchKind?:
    | "trusted"
    | "exact"
    | "ellipsis-segment"
    | "raw-prefix"
    | "raw-suffix"
    | "raw-middle"
    | "progressive"
    | "selected-text"
    | "normalized-span";
  sourceMatchSource?: "context-text" | "pdf-page-text";
  sourceSectionLabel?: string;
  sourceChunkKind?: string;
  contextItemId?: number;
  itemId?: number;
  /** Best-effort zero-based PDF page hint for fast initial quote navigation. */
  pageHintIndex?: number;
  /** Best-effort printed page label from Zotero/PDF metadata. */
  pageHintLabel?: string;
};

export type ChatAttachmentCategory =
  "image" | "pdf" | "markdown" | "code" | "text" | "file";

export type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  category: ChatAttachmentCategory;
  imageDataUrl?: string;
  textContent?: string;
  storedPath?: string;
  contentHash?: string;
  creatorLabel?: string;
  year?: string;
};

export type GeneratedChatImage = {
  id: string;
  label?: string;
  path?: string;
  src?: string;
  revisedPrompt?: string;
};

export type ModelInputMode = "text_only" | "vision_allowed";

export type AdvancedModelParams = {
  temperature: number;
  maxTokens: number;
  inputTokenCap?: number;
  inputMode?: ModelInputMode;
};

/** A non-PDF, non-note file attachment (image/figure or other file) selected as reference context. */
export type OtherContextRef = {
  contextItemId: number;
  parentItemId?: number;
  title: string;
  contentType: string;
  refKind: "figure" | "other";
};
