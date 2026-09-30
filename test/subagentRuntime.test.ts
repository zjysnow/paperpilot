import { strict as assert } from "node:assert";
import { AgentRuntime } from "../src/agent/runtime";
import { AgentToolRegistry } from "../src/agent/tools/registry";
import { BUILTIN_SKILL_FILES, setUserSkills } from "../src/agent/skills";
import { parseSkill } from "../src/agent/skills/skillLoader";
import { validateSubagentTaskInput } from "../src/agent/tools/subagentTask";
import type {
  AgentModelAdapter,
  AgentStepParams,
} from "../src/agent/model/adapter";
import type {
  AgentModelCapabilities,
  AgentModelStep,
  AgentRuntimeRequest,
  AgentToolDefinition,
} from "../src/agent/types";

const capabilities: AgentModelCapabilities = {
  streaming: false,
  toolCalls: true,
  contentInputs: { images: false, pdfDocuments: false, nativeFiles: false },
  fileInputs: false,
  reasoning: false,
};

function createAdapter(steps: AgentModelStep[]): AgentModelAdapter {
  return {
    getCapabilities: () => capabilities,
    supportsTools: () => true,
    runStep: async () => {
      const step = steps.shift();
      if (!step) throw new Error("Unexpected model step");
      return step;
    },
  };
}

describe("subagent runtime", function () {
  beforeEach(function () {
    setUserSkills([parseSkill(BUILTIN_SKILL_FILES["paper-replication.md"])]);
    const preferences = new Map<string, unknown>([
      ["extensions.zotero.paperpilot.enableSubagents", true],
    ]);
    (globalThis as Record<string, unknown>).Zotero = {
      DB: {
        async queryAsync() {
          return [];
        },
        async executeTransaction(callback: () => Promise<void>) {
          await callback();
        },
      },
      Prefs: {
        get: (key: string) => preferences.get(key),
        set: (key: string, value: unknown) => preferences.set(key, value),
      },
    };
    (globalThis as Record<string, unknown>).ztoolkit = { log: () => undefined };
  });

  afterEach(function () {
    setUserSkills([]);
  });

  it("uses the selected model request in an isolated, read-only subagent", async function () {
    const registry = new AgentToolRegistry();
    const writeTool: AgentToolDefinition<Record<string, unknown>, unknown> = {
      spec: {
        name: "file_io",
        description: "write",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({
        ok: true,
        value: value as Record<string, unknown>,
      }),
      execute: async () => ({ error: "must not run" }),
    };
    registry.register(writeTool);
    const observedSubagentParams: AgentStepParams[] = [];
    const events: import("../src/agent/types").AgentEvent[] = [];
    let factoryCalls = 0;
    const runtime = new AgentRuntime({
      registry,
      adapterFactory: (modelRequest) => {
        factoryCalls += 1;
        if (factoryCalls === 2) {
          assert.equal(modelRequest.model, "chosen-local-model");
          assert.equal(modelRequest.apiBase, "http://localhost:11434/v1");
          assert.equal(modelRequest.providerProtocol, "openai_chat_compat");
          assert.deepEqual(modelRequest.history, []);
          return {
            ...createAdapter([
              {
                kind: "final",
                text: "The implementation uses AdamW and needs CSV data.",
              },
            ]),
            runStep: async (params) => {
              observedSubagentParams.push(params);
              await params.onTextDelta?.(
                "The implementation uses AdamW and needs CSV data.",
              );
              return {
                kind: "final",
                text: "The implementation uses AdamW and needs CSV data.",
              };
            },
          };
        }
        return createAdapter([
          {
            kind: "tool_calls",
            calls: [
              {
                id: "delegate-1",
                name: "subagent_task",
                arguments: {
                  title: "Implementation data requirements",
                  task: "Inspect the implementation and identify data requirements.",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "delegate-1",
                  name: "subagent_task",
                  arguments: {
                    title: "Implementation data requirements",
                    task: "Inspect the implementation and identify data requirements.",
                  },
                },
              ],
            },
          },
          { kind: "final", text: "I will use the subagent findings." },
        ]);
      },
    });

    const result = await runtime.runTurn({
      request: {
        conversationKey: 501,
        mode: "agent",
        userText: "Review the project.",
        model: "chosen-local-model",
        apiBase: "http://localhost:11434/v1",
        providerProtocol: "openai_chat_compat",
        forcedSkillIds: ["paper-replication"],
        history: [{ role: "user", content: "Do not copy this history." }],
        selectedPaperContexts: [
          {
            itemId: 7,
            contextItemId: 8,
            title: "Selected Paper",
          },
        ],
        fullTextPaperContexts: [
          {
            itemId: 9,
            contextItemId: 10,
            title: "Full Text Paper",
          },
        ],
      },
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.kind, "completed");
    assert.equal(result.text, "I will use the subagent findings.");
    assert.equal(observedSubagentParams.length, 1);
    assert.equal(
      observedSubagentParams[0].tools.some((tool) => tool.name === "file_io"),
      false,
    );
    assert.equal(
      observedSubagentParams[0].messages.some(
        (message) =>
          typeof message.content === "string" &&
          message.content.includes("Do not copy this history."),
      ),
      false,
    );
    assert.deepEqual(observedSubagentParams[0].request.selectedPaperContexts, [
      {
        itemId: 7,
        contextItemId: 8,
        title: "Selected Paper",
      },
    ]);
    assert.deepEqual(observedSubagentParams[0].request.fullTextPaperContexts, [
      {
        itemId: 9,
        contextItemId: 10,
        title: "Full Text Paper",
      },
    ]);
    assert.equal(
      observedSubagentParams[0].messages.some(
        (message) =>
          typeof message.content === "string" &&
          message.content.includes("Selected Paper") &&
          message.content.includes("Full Text Paper") &&
          message.content.includes("paper_read"),
      ),
      true,
    );
    assert.equal(
      observedSubagentParams[0].messages.some(
        (message) =>
          typeof message.content === "string" &&
          message.content.includes("Skill: paper-replication") &&
          message.content.includes("Paper replication workflow"),
      ),
      true,
    );
    const subagentEvents = events.filter((event) =>
      event.type.startsWith("subagent_"),
    );
    assert.deepEqual(
      subagentEvents.map((event) => event.type),
      ["subagent_started", "subagent_output_delta", "subagent_completed"],
    );
    const completed = subagentEvents[2];
    const started = subagentEvents[0];
    assert.equal(started.type, "subagent_started");
    if (started.type === "subagent_started") {
      assert.equal(started.title, "1. Implementation data requirements");
      assert.equal(started.callId, "delegate-1");
      assert.deepEqual(
        started.paperContexts.map((paper) => paper.title),
        ["Selected Paper", "Full Text Paper"],
      );
    }
    assert.equal(completed.type, "subagent_completed");
    if (completed.type === "subagent_completed") {
      assert.equal(completed.title, "1. Implementation data requirements");
      assert.equal(completed.callId, "delegate-1");
      assert.equal(completed.model, "chosen-local-model");
      assert.match(completed.summary, /AdamW/);
    }
  });

  it("keeps separate subagent instances when a model reuses a tool call ID", async function () {
    const events: import("../src/agent/types").AgentEvent[] = [];
    let factoryCalls = 0;
    const runtime = new AgentRuntime({
      registry: new AgentToolRegistry(),
      adapterFactory: () => {
        factoryCalls += 1;
        if (factoryCalls > 1) {
          return createAdapter([
            {
              kind: "final",
              text: `Subagent report ${factoryCalls - 1}`,
            },
          ]);
        }
        return createAdapter([
          {
            kind: "tool_calls",
            calls: [
              {
                id: "reused-delegate-id",
                name: "subagent_task",
                arguments: {
                  title: "First check",
                  task: "Inspect the first requirement.",
                },
              },
              {
                id: "reused-delegate-id",
                name: "subagent_task",
                arguments: {
                  title: "Second check",
                  task: "Inspect the second requirement.",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [],
            },
          },
          { kind: "final", text: "Both checks are complete." },
        ]);
      },
    });

    const result = await runtime.runTurn({
      request: {
        conversationKey: 502,
        mode: "agent",
        userText: "Review these two requirements.",
        model: "chosen-local-model",
      },
      onEvent: (event) => events.push(event),
    });

    assert.equal(result.kind, "completed");
    const started = events.filter(
      (
        event,
      ): event is Extract<
        import("../src/agent/types").AgentEvent,
        { type: "subagent_started" }
      > => event.type === "subagent_started",
    );
    const completed = events.filter(
      (
        event,
      ): event is Extract<
        import("../src/agent/types").AgentEvent,
        { type: "subagent_completed" }
      > => event.type === "subagent_completed",
    );
    assert.equal(started.length, 2);
    assert.equal(completed.length, 2);
    assert.deepEqual(
      started.map((event) => event.callId),
      ["reused-delegate-id", "reused-delegate-id"],
    );
    assert.notEqual(started[0].taskId, started[1].taskId);
    assert.deepEqual(
      completed.map((event) => event.taskId),
      started.map((event) => event.taskId),
    );
  });

  it("rejects local workspace tasks before starting an incapable subagent", function () {
    const result = validateSubagentTaskInput({
      title: "Audit workspace",
      task: "Inspect /Users/albert/Workspace/crosstalk-lcd, list its file tree, and report Git status.",
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /main Agent.*file_io or run_command/i);
    }
  });
});
