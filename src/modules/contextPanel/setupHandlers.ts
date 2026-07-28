



/** Monotonic counter incremented every time setupHandlers rebuilds a panel. */
let setupHandlersGeneration = 0;


export type ContextPreviewRenderMetrics = {
  previousHeight: number;
  nextHeight: number;
};

export type SetupHandlersHooks = {
  startWithFreshConversation?: boolean;
  onConversationHistoryChanged?: () => void;
  onDefaultContextRendered?: () => void;
  onContextPreviewRendered?: (metrics: ContextPreviewRenderMetrics) => void;
  // onWebChatModeChanged?: (isWebChat: boolean) => void;
  prepareItemsAsDefaultContextTarget?: () =>
    | Promise<boolean | void>
    | boolean
    | void;
  /** Called by standalone to clear force-new-chat intent before loading a session. */
  // clearWebChatNewChatIntent?: () => void;
  /** Called by standalone to resolve the currently selected model consistently. */
  getCurrentModelName?: () => string | null;
};


export function setupHandlers(
  body: Element,
  initialItem?: Zotero.Item | null,
  hooks?: SetupHandlersHooks,
) {
    
}

