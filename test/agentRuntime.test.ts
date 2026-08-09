import { strict as assert } from "node:assert";
import { AgentRuntime } from "../src/agent/runtime";
import { AgentToolRegistry } from "../src/agent/tools/registry";
import type {
  AgentModelCapabilities,
  AgentModelStep,
  AgentPendingAction,
  AgentRuntimeRequest,
  AgentToolDefinition,
} from "../src/agent/types";
import type {
  AgentModelAdapter,
  AgentStepParams,
} from "../src/agent/model/adapter";

const db = {
  async queryAsync() {
    return [];
  },
  async executeTransaction(callback: () => Promise<void>) {
    await callback();
  },
};

(globalThis as Record<string, unknown>).Zotero = {
  DB: db,
  Prefs: { get: () => false },
};
(globalThis as Record<string, unknown>).ztoolkit = {
  log: () => undefined,
};

const capabilities: AgentModelCapabilities = {
  streaming: false,
  toolCalls: true,
  contentInputs: {
    images: false,
    pdfDocuments: false,
    nativeFiles: false,
  },
  fileInputs: false,
  reasoning: false,
};

function request(): AgentRuntimeRequest {
  return {
    conversationKey: 1,
    mode: "agent",
    userText: "test",
    model: "test-model",
    providerProtocol: "openai_chat_compat",
    apiBase: "https://example.test/v1",
  };
}

function action(): AgentPendingAction {
  return {
    toolName: "write_test",
    title: "Write test",
    confirmLabel: "Approve",
    cancelLabel: "Cancel",
    fields: [],
  };
}

function adapter(
  runStep: (params: AgentStepParams) => Promise<AgentModelStep>,
): AgentModelAdapter {
  return {
    getCapabilities: () => capabilities,
    supportsTools: () => true,
    runStep,
  };
}

function runtime(
  modelAdapter: AgentModelAdapter,
  tool?: AgentToolDefinition,
): AgentRuntime {
  const registry = new AgentToolRegistry();
  if (tool) registry.register(tool);
  return new AgentRuntime({
    registry,
    adapterFactory: () => modelAdapter,
    now: () => 1,
  });
}

describe("AgentRuntime outcomes", function () {
  it("returns a failed outcome when the prompt budget cannot be satisfied", async function () {
    const result = await runtime(
      adapter(async () => ({ kind: "final", text: "unused" })),
    ).runTurn({
      request: {
        ...request(),
        advanced: { inputTokenCap: 1 },
      },
    });

    assert.equal(result.kind, "failed");
    assert.match(result.text, /context|prompt|budget/i);
  });

  it("keeps a successful final response successful", async function () {
    const result = await runtime(
      adapter(async () => ({ kind: "final", text: "done" })),
    ).runTurn({ request: request() });

    assert.deepEqual(result, {
      kind: "completed",
      runId: result.runId,
      text: "done",
      usedFallback: false,
    });
  });

  it("returns a failed outcome after repeated tool errors", async function () {
    const result = await runtime(
      adapter(async () => ({
        kind: "tool_calls",
        calls: [
          { id: `missing-${Date.now()}`, name: "missing", arguments: {} },
        ],
        assistantMessage: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "missing", name: "missing", arguments: {} }],
        },
      })),
    ).runTurn({ request: request() });

    assert.equal(result.kind, "failed");
    assert.match(result.text, /tool errors/i);
  });

  it("releases a pending confirmation when the turn is aborted", async function () {
    let confirmationRequestId = "";
    let resolved = false;
    const tool: AgentToolDefinition = {
      spec: {
        name: "write_test",
        description: "test",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: true,
      },
      validate: () => ({ ok: true, value: {} }),
      createPendingAction: async () => action(),
      execute: async () => ({ ok: true }),
    };
    const controller = new AbortController();
    const run = runtime(
      adapter(async () => ({
        kind: "tool_calls",
        calls: [{ id: "call-1", name: "write_test", arguments: {} }],
        assistantMessage: {
          role: "assistant",
          content: "",
          tool_calls: [{ id: "call-1", name: "write_test", arguments: {} }],
        },
      })),
      tool,
    ).runTurn({
      request: request(),
      signal: controller.signal,
      onEvent: (event) => {
        if (event.type === "confirmation_required") {
          confirmationRequestId = event.requestId;
          controller.abort();
        }
        if (event.type === "confirmation_resolved") resolved = true;
      },
    });

    await assert.rejects(run, /Aborted/);
    assert.notEqual(confirmationRequestId, "");
    assert.equal(resolved, true);
  });
});
