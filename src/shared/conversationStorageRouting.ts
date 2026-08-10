import type { ConversationSystem } from "./types";

export function resolveConversationStorageSystem(params: {
  conversationKey: number;
  conversationSystem?: ConversationSystem | null;
}): ConversationSystem {
  // Removed provider backends are migrated into the built-in conversation store.
  void params.conversationKey;
  void params.conversationSystem;
  return "upstream";
}
