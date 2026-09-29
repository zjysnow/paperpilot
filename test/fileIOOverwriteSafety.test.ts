import { strict as assert } from "node:assert";
import { createFileIOTool } from "../src/agent/tools/write/fileIO";
import type { AgentToolContext } from "../src/agent/types";

function context(): AgentToolContext {
  return {
    request: {
      conversationKey: 1,
      mode: "agent",
      userText: "",
      metadata: {},
    },
    item: null,
    currentAnswerText: "",
    modelName: "test",
  };
}

describe("file I/O overwrite safety", function () {
  it("requires confirmation when a readable file exists despite a false exists result", async function () {
    const previous = (globalThis as { IOUtils?: unknown }).IOUtils;
    (globalThis as { IOUtils?: unknown }).IOUtils = {
      exists: async () => false,
      read: async () => new TextEncoder().encode("existing file"),
    };
    try {
      const tool = createFileIOTool();
      const validated = tool.validate({
        action: "write",
        filePath: "/workspace/src/gamut_mapping.py",
        content: "replacement",
      });
      assert.equal(validated.ok, true);
      if (!validated.ok) return;
      assert.equal(
        await tool.shouldRequireConfirmation?.(validated.value, context()),
        true,
      );
    } finally {
      (globalThis as { IOUtils?: unknown }).IOUtils = previous;
    }
  });
});
