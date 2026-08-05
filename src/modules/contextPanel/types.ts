import type { ContextAttachmentSupport } from "./contextAttachmentTypes";

import {
  CollectionContextRef,
  // NoteContextRef,
  PaperContentSourceMode,
  PaperContextRef,
  SelectedTextSource,
  TagContextRef,
  ActiveNoteSession,
  QuoteCitation,
  ChatAttachment,
  GeneratedChatImage,
  AdvancedModelParams,
  OtherContextRef,
  NoteContextRef,
} from "../../shared/types";

export type {
  CollectionContextRef,
  // NoteContextRef,
  PaperContentSourceMode,
  PaperContextRef,
  SelectedTextSource,
  TagContextRef,
  ActiveNoteSession,
  QuoteCitation,
  ChatAttachment,
  GeneratedChatImage,
  AdvancedModelParams,
  OtherContextRef,
  NoteContextRef,
} from "../../shared/types"

export type SelectedTextContext = {
  text: string;
  source: SelectedTextSource;
  paperContext?: PaperContextRef;
  contextItemId?: number;
  pageIndex?: number;
  pageLabel?: string;
};

export type ActionDropdownSpec = {
  slotId: string;
  slotClassName: string;
  buttonId: string;
  buttonClassName: string;
  buttonText: string;
  menuId: string;
  menuClassName: string;
  disabled?: boolean;
};


export type ChatRuntimeMode = "chat";
export type PaperContextSendMode = "retrieval" | "full-next" | "full-sticky";


export type GlobalPortalItem = {
  __paperpilotGlobalPortalItem: true;
  id: number;
  libraryID: number;
  parentID?: number;
  attachmentContentType?: string;
  isAttachment: () => boolean;
  getAttachments: () => number[];
  getField: (field: string) => string;
  isRegularItem: () => boolean;
};

export type PaperPortalItem = {
  __paperpilotPaperPortalItem: true;
  __paperpilotPaperPortalBaseItemID: number;
  __paperpilotPaperPortalSessionVersion: number;
  id: number;
  libraryID: number;
  parentID?: number;
  attachmentContentType?: string;
  isAttachment: () => boolean;
  getAttachments: () => number[];
  getField: (field: string) => string;
  isRegularItem: () => boolean;
};

export type ZoteroTabsState = {
  selectedID?: string | number;
  selectedType?: string;
  _tabs?: Array<{ id?: string | number; type?: string; data?: any }>;
};


export interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  runMode?: "chat";
  selectedText?: string;
  selectedTextExpanded?: boolean;
  selectedTexts?: string[];
  selectedTextSources?: SelectedTextSource[];
  selectedTextPaperContexts?: (PaperContextRef | undefined)[];
  // selectedTextNoteContexts?: (NoteContextRef | undefined)[];
  selectedTextExpandedIndex?: number;
  screenshotImages?: string[];
  paperContexts?: PaperContextRef[];
  fullTextPaperContexts?: PaperContextRef[];
  citationPaperContexts?: PaperContextRef[];
  quoteCitations?: QuoteCitation[];
  pinnedPaperContexts?: PaperContextRef[];
  selectedCollectionContexts?: CollectionContextRef[];
  selectedTagContexts?: TagContextRef[];
  /** Skill IDs explicitly selected via slash command for this turn. */
  forcedSkillIds?: string[];
  collectionContextsExpanded?: boolean;
  tagContextsExpanded?: boolean;
  paperContextsExpanded?: boolean;
  attachments?: ChatAttachment[];
  modelAttachments?: ChatAttachment[];
  generatedImages?: GeneratedChatImage[];
  attachmentsExpanded?: boolean;
  attachmentActiveIndex?: number;
  screenshotExpanded?: boolean;
  screenshotActiveIndex?: number;
  modelName?: string;
  modelEntryId?: string;
  modelProviderLabel?: string;
  streaming?: boolean;
  pendingFinalText?: string;
  waitingAnimationStartedAt?: number;
  reasoningSummary?: string;
  reasoningDetails?: string;
  reasoningOpen?: boolean;
  webchatRunState?: "done" | "incomplete" | "error";
  webchatCompletionReason?:
    | "settled"
    | "forced_cancel"
    | "timeout"
    | "error"
    | null;
  webchatChatUrl?: string;
  webchatChatId?: string;
  compactMarker?: boolean;
  runtimeMarkerText?: string;
  modelSwitchMarkerText?: string;
}


export type ResolvedContextSource = {
  contextItem: Zotero.Item | null;
  paperContext?: PaperContextRef | null;
  support?: ContextAttachmentSupport | null;
  statusText: string;
  sourceKind?:
    | "none"
    | "note"
    | "active-reader"
    | "selected-child"
    | "direct-attachment"
    | "first-child"
    | "best-attachment";
  ownerItem?: Zotero.Item | null;
  rawItem?: Zotero.Item | null;
  ownerItemId?: number;
  contextItemId?: number;
  supportKind?: "pdf" | "text";
  contentSourceMode?: PaperContentSourceMode;
  requiresAsyncResolution?: boolean;
  isAsyncFinal?: boolean;
};



export type ContextSourceLifecycleState = {
  rawItem: Zotero.Item | null;
  ownerItem: Zotero.Item | null;
  contextItem: Zotero.Item | null;
  rawItemId: number;
  ownerItemId: number;
  contextItemId: number;
  sourceKind: NonNullable<ResolvedContextSource["sourceKind"]>;
  supportKind?: "pdf" | "text";
  contentSourceMode?: PaperContentSourceMode;
  requiresAsyncResolution: boolean;
  isAsyncFinal: boolean;
};
