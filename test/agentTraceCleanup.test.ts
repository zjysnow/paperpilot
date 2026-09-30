import { strict as assert } from "node:assert";
import { clearAgentRunTraces } from "../src/agent/store/traceStore";

describe("agent trace cleanup", function () {
  it("deletes a conversation's trace rows and exported trace files", async function () {
    const previousZotero = (globalThis as Record<string, unknown>).Zotero;
    const previousIOUtils = (globalThis as Record<string, unknown>).IOUtils;
    const queries: Array<{ sql: string; params?: unknown[] }> = [];
    const removedPaths: string[] = [];
    (globalThis as Record<string, unknown>).Zotero = {
      DataDirectory: { dir: "/zotero-data" },
      Profile: { dir: "/zotero-profile" },
      DB: {
        queryAsync: async (sql: string, params?: unknown[]) => {
          queries.push({ sql, params });
          if (sql.includes("SELECT run_id")) {
            return [{ runId: "run-a" }, { runId: "run-b" }];
          }
          return [];
        },
        executeTransaction: async (callback: () => Promise<void>) => callback(),
      },
    };
    (globalThis as Record<string, unknown>).IOUtils = {
      remove: async (path: string) => {
        removedPaths.push(path);
      },
    };

    try {
      await clearAgentRunTraces(42);
      assert.deepEqual(
        queries
          .filter((entry) => entry.sql.includes("DELETE"))
          .map((entry) => entry.params),
        [[42], [42]],
      );
      assert.deepEqual(removedPaths, [
        "/zotero-data/agent-runtime/profile-fbe120e9/.debug/trace-debug/run-a.json",
        "/zotero-data/agent-runtime/profile-fbe120e9/.debug/trace-debug/run-b.json",
      ]);
    } finally {
      (globalThis as Record<string, unknown>).Zotero = previousZotero;
      (globalThis as Record<string, unknown>).IOUtils = previousIOUtils;
    }
  });
});
