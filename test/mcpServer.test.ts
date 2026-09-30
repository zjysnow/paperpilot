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
});
