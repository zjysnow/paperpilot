import { strict as assert } from "node:assert";
import { AgentRuntime } from "../src/agent/runtime";
import { AgentToolRegistry } from "../src/agent/tools/registry";
import { setUserSkills } from "../src/agent/skills";
import { parseSkill } from "../src/agent/skills/skillLoader";
import { getReplicationPythonExecutable } from "../src/utils/replicationEnvironmentConfig";
import type { AgentModelAdapter } from "../src/agent/model/adapter";
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

const preferences = new Map<string, unknown>();

function request(
  userText = "Please reproduce this paper in my workspace.",
): AgentRuntimeRequest {
  return {
    conversationKey: 99,
    mode: "agent",
    userText,
    model: "local-test",
    providerProtocol: "openai_chat_compat",
    apiBase: "http://localhost:11434/v1",
    item: {
      getField: (field: string) =>
        field === "shortTitle" ? "Paper Workspace" : "",
    } as Zotero.Item,
  };
}

function adapter(steps: AgentModelStep[]): AgentModelAdapter {
  return {
    getCapabilities: () => capabilities,
    supportsTools: () => true,
    runStep: async () => {
      const step = steps.shift();
      if (!step) throw new Error("Unexpected extra model step");
      return step;
    },
  };
}

describe("paper replication project writes", function () {
  beforeEach(function () {
    preferences.clear();
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
    (globalThis as Record<string, unknown>).ztoolkit = {
      log: () => undefined,
    };
    preferences.set(
      "extensions.zotero.paperpilot.workspaceDirectory",
      "/workspace",
    );
    preferences.set(
      "extensions.zotero.paperpilot.replicationPythonEnvironment",
      "",
    );
    setUserSkills([
      parseSkill(`---
id: paper-replication
description: test
version: 1
contexts: single-paper
activation: both
match: /reproduce|ready|continue|复现/i
---
test`),
    ]);
  });

  it("corrects a local model that finishes without writing project files", async function () {
    const writes: string[] = [];
    const commands: string[] = [];
    const fileTool: AgentToolDefinition<{
      action: string;
      filePath: string;
      content: string;
    }> = {
      spec: {
        name: "file_io",
        description: "write files",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({ ok: true, value: value as never }),
      execute: async (input) => {
        writes.push(input.filePath);
        return { action: input.action, filePath: input.filePath };
      },
    };
    const registry = new AgentToolRegistry();
    registry.register(fileTool);
    registry.register({
      spec: {
        name: "run_command",
        description: "run command",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({ ok: true, value: value as { command: string } }),
      execute: async (input) => {
        commands.push(input.command);
        return input.command.includes("find")
          ? {
              exitCode: 128,
              stderr: "fatal: not a git repository (or any of the parent directories): .git",
            }
          : { exitCode: 0 };
      },
    });

    const runtime = new AgentRuntime({
      registry,
      adapterFactory: () =>
        adapter([
          { kind: "final", text: "I created the project." },
          {
            kind: "tool_calls",
            calls: [
              {
                id: "inspect-project",
                name: "run_command",
                arguments: {
                  command:
                    'find "/workspace/Paper Workspace" -maxdepth 2 -print && git -C "/workspace/Paper Workspace" status --short 2>&1 || true',
                },
              },
              {
                id: "write-project",
                name: "file_io",
                arguments: {
                  action: "write",
                  filePath: "/workspace/Paper Workspace/src/main.py",
                  content: "def main():\n    pass\n",
                },
              },
              {
                id: "commit-project",
                name: "run_command",
                arguments: {
                  command:
                    "git init && git add src/main.py && git commit -m 'Initial paper replication'",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "inspect-project",
                  name: "run_command",
                  arguments: {
                    command:
                      'find "/workspace/Paper Workspace" -maxdepth 2 -print && git -C "/workspace/Paper Workspace" status --short 2>&1 || true',
                  },
                },
                {
                  id: "write-project",
                  name: "file_io",
                  arguments: {
                    action: "write",
                    filePath: "/workspace/Paper Workspace/src/main.py",
                    content: "def main():\n    pass\n",
                  },
                },
                {
                  id: "commit-project",
                  name: "run_command",
                  arguments: {
                    command:
                      "git init && git add src/main.py && git commit -m 'Initial paper replication'",
                  },
                },
              ],
            },
          },
          { kind: "final", text: "Project prepared." },
        ]),
    });

    let approvalRequested = false;
    const result = await runtime.runTurn({
      request: request(),
      onEvent: (event) => {
        if (event.type !== "confirmation_required") return;
        if (event.action.toolName !== "paper_replication_workspace") return;
        approvalRequested = true;
        runtime.resolveConfirmation(event.requestId, true);
      },
    });

    assert.equal(result.kind, "completed");
    assert.equal(result.text, "Project prepared.");
    assert.equal(approvalRequested, true);
    assert.deepEqual(writes, ["/workspace/Paper Workspace/src/main.py"]);
    assert.deepEqual(commands, [
      'find "/workspace/Paper Workspace" -maxdepth 2 -print && git -C "/workspace/Paper Workspace" status --short 2>&1 || true',
      "git init && git add src/main.py && git commit -m 'Initial paper replication'",
    ]);
  });

  it("automatically delegates replication evidence summaries when subagents are enabled", async function () {
    preferences.set("extensions.zotero.paperpilot.enableSubagents", true);
    const writes: string[] = [];
    const registry = new AgentToolRegistry();
    registry.register({
      spec: {
        name: "file_io",
        description: "write files",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({
        ok: true,
        value: value as { action: string; filePath: string; content: string },
      }),
      execute: async (input) => {
        writes.push(input.filePath);
        return { action: input.action, filePath: input.filePath };
      },
    });
    const runtime = new AgentRuntime({
      registry,
      adapterFactory: () =>
        adapter([
          {
            kind: "tool_calls",
            calls: [
              {
                id: "write-before-subtasks",
                name: "file_io",
                arguments: {
                  action: "write",
                  filePath: "/workspace/Paper Workspace/src/main.py",
                  content: "print('unexpected')",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "write-before-subtasks",
                  name: "file_io",
                  arguments: {
                    action: "write",
                    filePath: "/workspace/Paper Workspace/src/main.py",
                    content: "print('unexpected')",
                  },
                },
              ],
            },
          },
          { kind: "final", text: "I need to delegate the analysis first." },
        ]),
    });
    let orchestrationError = "";
    let completedSubagents = 0;
    const result = await runtime.runTurn({
      request: request(),
      onEvent: (event) => {
        if (
          event.type === "confirmation_required" &&
          event.action.toolName === "paper_replication_workspace"
        ) {
          runtime.resolveConfirmation(event.requestId, false);
          return;
        }
        if (
          event.type === "tool_error" &&
          typeof event.error === "string" &&
          event.error.includes("orchestration requires")
        ) {
          orchestrationError = event.error;
        }
        if (event.type === "subagent_completed") {
          completedSubagents += 1;
        }
      },
    });

    assert.equal(result.kind, "completed");
    assert.deepEqual(writes, []);
    assert.equal(completedSubagents, 3);
    assert.equal(orchestrationError, "");
  });

  it("ends safely when project preparation approval is denied", async function () {
    const runtime = new AgentRuntime({
      registry: new AgentToolRegistry(),
      adapterFactory: () =>
        adapter([{ kind: "final", text: "I will prepare the project." }]),
    });

    const result = await runtime.runTurn({
      request: request(),
      onEvent: (event) => {
        if (
          event.type === "confirmation_required" &&
          event.action.toolName === "paper_replication_workspace"
        ) {
          runtime.resolveConfirmation(event.requestId, false);
        }
      },
    });

    assert.equal(result.kind, "completed");
    assert.match(result.text, /cancelled/i);
  });

  it("validates ready data before running an experiment and recording results", async function () {
    preferences.set(
      "extensions.zotero.paperpilot.replicationPythonEnvironment",
      "/replication-env",
    );
    const python = `"${getReplicationPythonExecutable()}"`;
    const fileCalls: Array<{ action: string; filePath: string }> = [];
    const commands: string[] = [];
    const registry = new AgentToolRegistry();
    registry.register({
      spec: {
        name: "file_io",
        description: "read and write files",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) =>
        ({
          ok: true,
          value: value as {
            action: string;
            filePath: string;
            content?: string;
          },
        }) as const,
      execute: async (input) => {
        fileCalls.push({ action: input.action, filePath: input.filePath });
        return {
          action: input.action,
          filePath: input.filePath,
          ...(input.action === "read" ? { text: "{}" } : {}),
        };
      },
    });
    registry.register({
      spec: {
        name: "run_command",
        description: "run command",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({ ok: true, value: value as { command: string } }),
      execute: async (input) => {
        commands.push(input.command);
        return { exitCode: 0 };
      },
    });
    const runtime = new AgentRuntime({
      registry,
      adapterFactory: () =>
        adapter([
          { kind: "final", text: "I will start the experiment now." },
          {
            kind: "tool_calls",
            calls: [
              {
                id: "read-state",
                name: "file_io",
                arguments: {
                  action: "read",
                  filePath:
                    "/workspace/Paper Workspace/paperpilot-replication.json",
                },
              },
              {
                id: "validate-data",
                name: "run_command",
                arguments: {
                  command: "python scripts/validate_data.py --data data",
                },
              },
              {
                id: "run-experiment",
                name: "run_command",
                arguments: {
                  command: "python -m src.train --config config/default.yaml",
                },
              },
              {
                id: "write-results",
                name: "file_io",
                arguments: {
                  action: "write",
                  filePath:
                    "/workspace/Paper Workspace/docs/EXPERIMENT_RESULTS.md",
                  content: "# Experiment results",
                },
              },
              {
                id: "commit-results",
                name: "run_command",
                arguments: {
                  command:
                    "git add docs/EXPERIMENT_RESULTS.md && git commit -m 'Record experiment results'",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "read-state",
                  name: "file_io",
                  arguments: {
                    action: "read",
                    filePath:
                      "/workspace/Paper Workspace/paperpilot-replication.json",
                  },
                },
                {
                  id: "validate-data",
                  name: "run_command",
                  arguments: {
                    command: "python scripts/validate_data.py --data data",
                  },
                },
                {
                  id: "run-experiment",
                  name: "run_command",
                  arguments: {
                    command: "python -m src.train --config config/default.yaml",
                  },
                },
                {
                  id: "write-results",
                  name: "file_io",
                  arguments: {
                    action: "write",
                    filePath:
                      "/workspace/Paper Workspace/docs/EXPERIMENT_RESULTS.md",
                    content: "# Experiment results",
                  },
                },
                {
                  id: "commit-results",
                  name: "run_command",
                  arguments: {
                    command:
                      "git add docs/EXPERIMENT_RESULTS.md && git commit -m 'Record experiment results'",
                  },
                },
              ],
            },
          },
          { kind: "final", text: "Experiment completed with valid data." },
        ]),
    });

    const result = await runtime.runTurn({
      request: request("My data is ready. Please continue the experiment."),
    });

    assert.equal(result.kind, "completed");
    assert.equal(result.text, "Experiment completed with valid data.");
    assert.deepEqual(fileCalls, [
      {
        action: "read",
        filePath: "/workspace/Paper Workspace/paperpilot-replication.json",
      },
      {
        action: "read",
        filePath: "/workspace/Paper Workspace/paperpilot-replication.json",
      },
      {
        action: "write",
        filePath: "/workspace/Paper Workspace/docs/EXPERIMENT_RESULTS.md",
      },
    ]);
    assert.deepEqual(commands, [
      `${python} scripts/validate_data.py --data data`,
      `${python} -m src.train --config config/default.yaml`,
      "git add docs/EXPERIMENT_RESULTS.md && git commit -m 'Record experiment results'",
    ]);
  });

  it("blocks experiments when the prepared data fails validation", async function () {
    const commands: string[] = [];
    const writes: string[] = [];
    const registry = new AgentToolRegistry();
    registry.register({
      spec: {
        name: "file_io",
        description: "read and write files",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) =>
        ({
          ok: true,
          value: value as {
            action: string;
            filePath: string;
            content?: string;
          },
        }) as const,
      execute: async (input) => {
        if (input.action === "write") writes.push(input.filePath);
        return {
          action: input.action,
          filePath: input.filePath,
          ...(input.action === "read" ? { text: "{}" } : {}),
        };
      },
    });
    registry.register({
      spec: {
        name: "run_command",
        description: "run command",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({ ok: true, value: value as { command: string } }),
      execute: async (input) => {
        commands.push(input.command);
        return {
          exitCode: input.command.includes("validate_data") ? 1 : 0,
        };
      },
    });
    const runtime = new AgentRuntime({
      registry,
      adapterFactory: () =>
        adapter([
          {
            kind: "tool_calls",
            calls: [
              {
                id: "read-state",
                name: "file_io",
                arguments: {
                  action: "read",
                  filePath:
                    "/workspace/Paper Workspace/paperpilot-replication.json",
                },
              },
              {
                id: "validate-data",
                name: "run_command",
                arguments: {
                  command: "python scripts/validate_data.py --data data",
                },
              },
              {
                id: "blocked-experiment",
                name: "run_command",
                arguments: {
                  command: "python -m src.train --config config/default.yaml",
                },
              },
              {
                id: "write-validation",
                name: "file_io",
                arguments: {
                  action: "write",
                  filePath:
                    "/workspace/Paper Workspace/docs/DATA_VALIDATION.md",
                  content: "# Data validation failed",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "read-state",
                  name: "file_io",
                  arguments: {
                    action: "read",
                    filePath:
                      "/workspace/Paper Workspace/paperpilot-replication.json",
                  },
                },
                {
                  id: "validate-data",
                  name: "run_command",
                  arguments: {
                    command: "python scripts/validate_data.py --data data",
                  },
                },
                {
                  id: "blocked-experiment",
                  name: "run_command",
                  arguments: {
                    command: "python -m src.train --config config/default.yaml",
                  },
                },
                {
                  id: "write-validation",
                  name: "file_io",
                  arguments: {
                    action: "write",
                    filePath:
                      "/workspace/Paper Workspace/docs/DATA_VALIDATION.md",
                    content: "# Data validation failed",
                  },
                },
              ],
            },
          },
          {
            kind: "final",
            text: "Data validation failed; experiment not run.",
          },
        ]),
    });

    const result = await runtime.runTurn({
      request: request("数据已经准备好，请继续复现实验。"),
    });

    assert.equal(result.kind, "completed");
    assert.equal(result.text, "Data validation failed; experiment not run.");
    assert.deepEqual(commands, ["python scripts/validate_data.py --data data"]);
    assert.deepEqual(writes, [
      "/workspace/Paper Workspace/docs/DATA_VALIDATION.md",
    ]);
  });

  it("reads persisted state before correcting a continuation that ends early", async function () {
    const fileCalls: Array<{ action: string; filePath: string }> = [];
    const commands: string[] = [];
    const registry = new AgentToolRegistry();
    registry.register({
      spec: {
        name: "file_io",
        description: "read and write files",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) =>
        ({
          ok: true,
          value: value as {
            action: string;
            filePath: string;
            content?: string;
          },
        }) as const,
      execute: async (input) => {
        fileCalls.push({ action: input.action, filePath: input.filePath });
        return {
          action: input.action,
          filePath: input.filePath,
          ...(input.action === "read"
            ? { text: '{"phase":"awaiting_data"}' }
            : {}),
        };
      },
    });
    registry.register({
      spec: {
        name: "run_command",
        description: "run command",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: false,
      },
      validate: (value) => ({ ok: true, value: value as { command: string } }),
      execute: async (input) => {
        commands.push(input.command);
        return { exitCode: 1, stderr: "data directory is missing" };
      },
    });
    const runtime = new AgentRuntime({
      registry,
      adapterFactory: () =>
        adapter([
          { kind: "final", text: "I will continue." },
          {
            kind: "tool_calls",
            calls: [
              {
                id: "validate-data",
                name: "run_command",
                arguments: {
                  command: "python scripts/validate_data.py --data data",
                },
              },
              {
                id: "write-validation",
                name: "file_io",
                arguments: {
                  action: "write",
                  filePath:
                    "/workspace/Paper Workspace/docs/DATA_VALIDATION.md",
                  content: "# Data validation failed",
                },
              },
            ],
            assistantMessage: {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "validate-data",
                  name: "run_command",
                  arguments: {
                    command: "python scripts/validate_data.py --data data",
                  },
                },
                {
                  id: "write-validation",
                  name: "file_io",
                  arguments: {
                    action: "write",
                    filePath:
                      "/workspace/Paper Workspace/docs/DATA_VALIDATION.md",
                    content: "# Data validation failed",
                  },
                },
              ],
            },
          },
          {
            kind: "final",
            text: "The persisted state is awaiting data; validation failed.",
          },
        ]),
    });

    const result = await runtime.runTurn({
      request: request("数据已经准备好，请继续复现实验。"),
    });

    assert.equal(result.kind, "completed");
    assert.equal(
      result.text,
      "The persisted state is awaiting data; validation failed.",
    );
    assert.deepEqual(fileCalls, [
      {
        action: "read",
        filePath: "/workspace/Paper Workspace/paperpilot-replication.json",
      },
      {
        action: "write",
        filePath: "/workspace/Paper Workspace/docs/DATA_VALIDATION.md",
      },
    ]);
    assert.deepEqual(commands, ["python scripts/validate_data.py --data data"]);
  });
});
