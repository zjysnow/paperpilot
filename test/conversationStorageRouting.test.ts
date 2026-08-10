import { strict as assert } from "node:assert";
import { resolveConversationStorageSystem } from "../src/shared/conversationStorageRouting";

describe("conversation storage routing", function () {
  it("migrates removed provider systems to the upstream store", function () {
    assert.equal(
      resolveConversationStorageSystem({
        conversationKey: 3_000_000_001,
        conversationSystem: "claude_code",
      }),
      "upstream",
    );
    assert.equal(
      resolveConversationStorageSystem({
        conversationKey: 3_000_000_002,
        conversationSystem: "codex",
      }),
      "upstream",
    );
  });
});
