import { strict as assert } from "node:assert";
import {
  getOrCreateZoteroMcpBearerToken,
  invokeRegisteredZoteroMcpEndpoint,
  registerMcpServer,
  registerScopedZoteroMcpScope,
  unregisterMcpServer,
  ZOTERO_MCP_AUTH_HEADER,
  ZOTERO_MCP_SCOPE_HEADER,
} from "../src/agent/mcp/server";
import { AgentToolRegistry } from "../src/agent/tools/registry";
import type { AgentToolDefinition } from "../src/agent/types";

function parseJsonRpcResponse(response: [number, string, string]) {
  return JSON.parse(response[2]) as Record<string, unknown>;
}

describe("Zotero MCP server", function () {
  const previousZotero = (globalThis as Record<string, unknown>).Zotero;
  const preferences = new Map<string, unknown>();
  const registry = new AgentToolRegistry();
  let learningExecutions = 0;

  before(function () {
    (globalThis as Record<string, unknown>).Zotero = {
      Prefs: {
        get: (key: string) => preferences.get(key),
        set: (key: string, value: unknown) => preferences.set(key, value),
      },
      Server: { Endpoints: {} },
      Items: { get: () => null },
    };
    const searchTool: AgentToolDefinition<Record<string, unknown>, unknown> = {
      spec: {
        name: "library_search",
        description: "Search the scoped library",
        inputSchema: { type: "object" },
        mutability: "read",
        requiresConfirmation: false,
      },
      validate: () => ({ ok: true, value: {} }),
      execute: async (_input, context) => ({
        content: { libraryID: context.request.libraryID },
      }),
    };
    const writeTool: AgentToolDefinition<Record<string, unknown>, unknown> = {
      spec: {
        name: "library_update",
        description: "Update the scoped library",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: true,
      },
      validate: () => ({ ok: true, value: {} }),
      createPendingAction: () => ({
        toolName: "library_update",
        title: "Update",
        description: "Update",
        confirmLabel: "Update",
        cancelLabel: "Cancel",
        fields: [],
      }),
      execute: async () => ({ content: { updated: true } }),
    };
    registry.register(searchTool);
    registry.register(writeTool);
    registry.register({
      spec: {
        name: "paper_learning",
        description: "Save or resume a learning record",
        inputSchema: { type: "object" },
        mutability: "write",
        requiresConfirmation: true,
        tier: "advanced",
      },
      validate: (args) => ({
        ok: true,
        value: args as { mode: "progress" | "resume" },
      }),
      shouldRequireConfirmation: (input) => input.mode !== "resume",
      createPendingAction: () => ({
        toolName: "paper_learning",
        title: "Save progress",
        confirmLabel: "Save",
        cancelLabel: "Cancel",
        fields: [],
      }),
      execute: async () => {
        learningExecutions += 1;
        return { content: { resumed: true } };
      },
    });
    registerMcpServer({
      toolRegistry: registry,
      zoteroGateway: {} as never,
    });
  });

  after(function () {
    unregisterMcpServer();
    (globalThis as Record<string, unknown>).Zotero = previousZotero;
  });

  function headers(scopeToken?: string): Record<string, string> {
    return {
      [ZOTERO_MCP_AUTH_HEADER]: `Bearer ${getOrCreateZoteroMcpBearerToken()}`,
      ...(scopeToken ? { [ZOTERO_MCP_SCOPE_HEADER]: scopeToken } : {}),
    };
  }

  async function invoke(
    method: string,
    params?: unknown,
    scopeToken?: string,
  ): Promise<[number, string, string]> {
    const response = await invokeRegisteredZoteroMcpEndpoint({
      method: "POST",
      data: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      headers: headers(scopeToken),
    });
    assert.ok(response);
    return response;
  }

  it("rejects unauthenticated requests", async function () {
    const response = await invokeRegisteredZoteroMcpEndpoint({
      method: "POST",
      data: "{}",
    });
    assert.deepEqual(response, [
      401,
      "application/json",
      JSON.stringify({ error: "unauthorized" }),
    ]);
  });

  it("requires valid scopes and keeps reads within the registered scope", async function () {
    const scope = registerScopedZoteroMcpScope({
      profileSignature: "profile-a",
      conversationKey: 7,
      libraryID: 42,
    });
    try {
      const invalid = parseJsonRpcResponse(
        await invoke("tools/list", undefined, "expired-token"),
      );
      assert.match(
        String((invalid.error as { message?: string }).message),
        /scope token is invalid or expired/i,
      );

      const response = parseJsonRpcResponse(
        await invoke(
          "tools/call",
          { name: "library_search", arguments: {} },
          scope.token,
        ),
      );
      const result = response.result as {
        content: Array<{ type: string; text: string }>;
      };
      assert.deepEqual(JSON.parse(result.content[0].text), {
        ok: true,
        result: { libraryID: 42 },
      });
    } finally {
      scope.clear();
    }
  });

  it("does not execute writes while no matching confirmation handler exists", async function () {
    const scope = registerScopedZoteroMcpScope({
      profileSignature: "profile-a",
      conversationKey: 8,
      libraryID: 42,
    });
    try {
      const response = parseJsonRpcResponse(
        await invoke(
          "tools/call",
          { name: "library_update", arguments: {} },
          scope.token,
        ),
      );
      const result = response.result as { isError?: boolean };
      assert.equal(result.isError, true);
    } finally {
      scope.clear();
    }
  });

  it("exposes learning for text scopes, permits resume, and gates learning writes", async function () {
    const scope = registerScopedZoteroMcpScope({
      profileSignature: "profile-a",
      conversationKey: 9,
      libraryID: 42,
    });
    try {
      const listed = parseJsonRpcResponse(
        await invoke("tools/list", undefined, scope.token),
      ).result as { tools: Array<{ name: string }> };
      assert.ok(listed.tools.some((tool) => tool.name === "paper_learning"));
      const before = learningExecutions;
      const denied = parseJsonRpcResponse(
        await invoke(
          "tools/call",
          { name: "paper_learning", arguments: { mode: "progress" } },
          scope.token,
        ),
      ).result as { isError?: boolean };
      assert.equal(denied.isError, true);
      assert.equal(learningExecutions, before);
      const resumed = parseJsonRpcResponse(
        await invoke(
          "tools/call",
          { name: "paper_learning", arguments: { mode: "resume" } },
          scope.token,
        ),
      ).result as { isError?: boolean };
      assert.notEqual(resumed.isError, true);
      assert.equal(learningExecutions, before + 1);
    } finally {
      scope.clear();
    }
  });

  it("hides and rejects learning filesystem access in direct-PDF scopes", async function () {
    const scope = registerScopedZoteroMcpScope({
      profileSignature: "profile-a",
      conversationKey: 10,
      libraryID: 42,
      pdfPaperContexts: [
        {
          itemId: 12,
          contextItemId: 34,
          title: "Raw paper",
          contentSourceMode: "pdf",
        },
      ],
    });
    try {
      const listed = parseJsonRpcResponse(
        await invoke("tools/list", undefined, scope.token),
      ).result as { tools: Array<{ name: string }> };
      assert.ok(!listed.tools.some((tool) => tool.name === "paper_learning"));
      const before = learningExecutions;
      const blocked = parseJsonRpcResponse(
        await invoke(
          "tools/call",
          { name: "paper_learning", arguments: { mode: "resume" } },
          scope.token,
        ),
      ).result as { isError?: boolean };
      assert.equal(blocked.isError, true);
      assert.equal(learningExecutions, before);
    } finally {
      scope.clear();
    }
  });
});
