import { strict as assert } from "node:assert";
import {
  DifyClient,
  discoverDifyAppMetadata,
  extractDifyAppMetadata,
  getDifyConfig,
  getDifyBackends,
  getDifyChatApps,
  isDifyChatEntryId,
  resolveDifyChatBackend,
  resolveDifyChatApiKey,
  setDifyConfig,
  syncDifyMarkdownNote,
} from "../src/utils/dify";
import { getRuntimeModelEntries } from "../src/utils/modelProviders";

function useFakeZoteroPrefs(): void {
  const values = new Map<string, unknown>();
  (globalThis as any).Zotero = {
    Prefs: {
      get: (key: string) => values.get(key),
      set: (key: string, value: unknown) => values.set(key, value),
    },
  };
}

describe("Dify integration", function () {
  it("persists and normalizes configuration in Zotero preferences", function () {
    useFakeZoteroPrefs();
    setDifyConfig({
      baseUrl: "https://dify.example/v1/",
      apiKey: " secret ",
      user: "",
      appKeys: { chat: "chat-key" },
    });
    assert.deepEqual(getDifyConfig(), {
      baseUrl: "https://dify.example/v1",
      apiKey: "secret",
      user: "",
      appKeys: { chat: "chat-key" },
      chatApps: [{ id: "legacy", appKey: "chat-key" }],
    });
  });

  it("invokes chat and dataset document endpoints with typed payloads", async function () {
    const calls: Array<{ url: string; init: any }> = [];
    const fetcher = async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ id: "doc-1", answer: "ok" }),
        text: async () => "",
      };
    };
    const client = new DifyClient(
      {
        baseUrl: "https://dify.example/v1",
        apiKey: "dataset-key",
        user: "zotero",
        appKeys: { chat: "chat-key" },
      },
      fetcher,
    );
    await client.invokeChat("hello", { inputs: { context: "md" } });
    await client.createDocument("ds/1", { name: "note.md", text: "# Note" });
    await client.updateDocument("ds/1", "doc/1", {
      name: "note.md",
      text: "# Updated",
    });
    await client.deleteDocument("ds/1", "doc/1");
    assert.equal(calls[0].url, "https://dify.example/v1/chat-messages");
    assert.equal(
      calls[0].init.headers.Authorization.endsWith("chat-key"),
      true,
    );
    assert.deepEqual(JSON.parse(calls[0].init.body), {
      inputs: { context: "md" },
      query: "hello",
      response_mode: "blocking",
      user: "zotero",
    });
    assert.equal(
      calls[1].url,
      "https://dify.example/v1/datasets/ds%2F1/document/create-by-text",
    );
    assert.equal(
      calls[2].url,
      "https://dify.example/v1/datasets/ds%2F1/documents/doc%2F1/update-by-text",
    );
    assert.equal(calls[3].init.method, "DELETE");
  });

  it("uses an app key for connection tests and syncs a note lifecycle", async function () {
    const calls: Array<{ url: string; init: any }> = [];
    const fetcher = async (url: string, init: any) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ id: "doc-2" }),
        text: async () => "",
      };
    };
    const client = new DifyClient(
      {
        baseUrl: "https://dify.example/v1",
        apiKey: "",
        user: "zotero",
        appKeys: { chat: "chat-key" },
      },
      fetcher,
    );

    await client.testConnection();
    const created = await syncDifyMarkdownNote(client, {
      datasetId: "dataset",
      noteId: "note-1",
      name: "note.md",
      markdown: "# Note",
    });
    const deleted = await syncDifyMarkdownNote(client, {
      datasetId: "dataset",
      documentId: created.documentId,
      noteId: "note-1",
      name: "note.md",
      markdown: "",
      deleted: true,
    });

    assert.equal(calls[0].url, "https://dify.example/v1/info");
    assert.equal(
      calls[0].init.headers.Authorization.endsWith("chat-key"),
      true,
    );
    assert.deepEqual(created, { action: "created", documentId: "doc-2" });
    assert.deepEqual(deleted, { action: "deleted" });
  });

  it("explains a local network failure instead of showing an empty HTTP error", async function () {
    const client = new DifyClient(
      {
        baseUrl: "http://127.0.0.1/v1",
        apiKey: "",
        user: "zotero",
        appKeys: { chat: "chat-key" },
      },
      async () => ({
        ok: false,
        status: 0,
        statusText: "",
        json: async () => ({}),
        text: async () => "",
      }),
    );

    await assert.rejects(
      () => client.testConnection(),
      /Unable to connect to Dify/,
    );
  });

  it("exposes each configured chat robot as its own runtime entry with a stable, distinct entry id", function () {
    useFakeZoteroPrefs();
    setDifyConfig({
      baseUrl: "https://dify.example/v1",
      apiKey: "",
      user: "paperpilot",
      chatApps: [
        { id: "bot-a", name: "Research Bot", appKey: "key-a" },
        { id: "bot-b", appKey: "key-b" },
        // Entries without an app key are kept for editing but never exposed
        // as a runtime entry.
        { id: "bot-c", name: "Unfinished", appKey: "" },
      ],
      chatAppMetadata: { "bot-b": { name: "Fetched Bot Name" } },
    });

    const entries = getRuntimeModelEntries().filter(
      (entry) => entry.providerLabel === "Dify",
    );
    assert.equal(entries.length, 2);
    assert.deepEqual(entries.map((entry) => entry.entryId).sort(), [
      "dify-chat-bot-a",
      "dify-chat-bot-b",
    ]);
    assert.notEqual(entries[0].entryId, entries[1].entryId);
    assert(
      entries.every((entry) => entry.entryId !== "dify-chat"),
      "new-format chat robots must not reuse the bare legacy entry id",
    );

    const botA = entries.find((entry) => entry.entryId === "dify-chat-bot-a");
    assert.equal(botA?.apiKey, "key-a");
    assert.equal(botA?.displayModelLabel, "Research Bot");

    const botB = entries.find((entry) => entry.entryId === "dify-chat-bot-b");
    assert.equal(botB?.apiKey, "key-b");
    // No user-set name: falls back to the /info-fetched Dify app name.
    assert.equal(botB?.displayModelLabel, "Fetched Bot Name");
  });

  it("keeps chat robots isolated by backend at runtime", function () {
    useFakeZoteroPrefs();
    setDifyConfig({
      baseUrl: "https://primary.example/v1",
      apiKey: "",
      user: "paperpilot",
      backends: [
        {
          id: "primary",
          name: "Primary Dify",
          baseUrl: "https://primary.example/v1",
          apiKey: "",
          user: "paperpilot",
          chatApps: [{ id: "research", appKey: "primary-key" }],
        },
        {
          id: "secondary",
          name: "Secondary Dify",
          baseUrl: "https://secondary.example/v1",
          apiKey: "",
          user: "paperpilot",
          chatApps: [{ id: "research", appKey: "secondary-key" }],
        },
      ],
    });

    const entries = getRuntimeModelEntries().filter(
      (entry) =>
        entry.entryId === "dify-chat-primary--research" ||
        entry.entryId === "dify-chat-secondary--research",
    );
    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((entry) => [entry.entryId, entry.apiBase, entry.apiKey]),
      [
        [
          "dify-chat-primary--research",
          "https://primary.example/v1",
          "primary-key",
        ],
        [
          "dify-chat-secondary--research",
          "https://secondary.example/v1",
          "secondary-key",
        ],
      ],
    );
    assert.equal(entries[0]?.providerLabel, "Primary Dify");
    assert.equal(entries[1]?.providerLabel, "Secondary Dify");
    assert.equal(
      resolveDifyChatBackend("dify-chat-secondary--research").baseUrl,
      "https://secondary.example/v1",
    );
    assert.equal(getDifyBackends(getDifyConfig()).length, 2);
  });

  it("keeps an explicitly emptied chat robot list empty instead of re-migrating the legacy chat key", function () {
    useFakeZoteroPrefs();
    setDifyConfig({
      baseUrl: "https://dify.example/v1",
      apiKey: "",
      user: "paperpilot",
      appKeys: { chat: "legacy-key" },
      chatApps: [],
    });
    assert.deepEqual(getDifyConfig().chatApps, []);
    assert.equal(
      getRuntimeModelEntries().some((entry) => entry.providerLabel === "Dify"),
      false,
    );
  });

  it("resolves the Dify chat app key that matches a runtime entry id", function () {
    const config = {
      baseUrl: "https://dify.example/v1",
      apiKey: "",
      user: "paperpilot",
      appKeys: { chat: "fallback-key" },
      chatApps: [
        { id: "legacy", appKey: "fallback-key" },
        { id: "bot-a", appKey: "key-a" },
      ],
    };
    assert.equal(isDifyChatEntryId("dify-chat"), true);
    assert.equal(isDifyChatEntryId("dify-chat-bot-a"), true);
    assert.equal(isDifyChatEntryId("some-other-model"), false);
    assert.equal(isDifyChatEntryId(undefined), false);

    assert.equal(resolveDifyChatApiKey("dify-chat", config), "fallback-key");
    assert.equal(resolveDifyChatApiKey("dify-chat-bot-a", config), "key-a");
    // Unknown chat entry id falls back to the legacy single chat key.
    assert.equal(
      resolveDifyChatApiKey("dify-chat-unknown", config),
      "fallback-key",
    );
    assert.equal(resolveDifyChatApiKey(undefined, config), "fallback-key");
  });

  it("exposes a configured chat app as a selectable runtime entry", function () {
    useFakeZoteroPrefs();
    setDifyConfig({
      baseUrl: "https://dify.example/v1",
      apiKey: "",
      user: "paperpilot",
      appKeys: { chat: "chat-key" },
      appMetadata: { chat: { name: "My Bot", mode: "chat" } },
    });
    const entry = getRuntimeModelEntries().find(
      (candidate) => candidate.entryId === "dify-chat",
    );
    assert.equal(entry?.providerLabel, "Dify");
    assert.equal(entry?.apiKey, "chat-key");
    assert.equal(entry?.displayModelLabel, "My Bot");
  });

  it("extracts and persists metadata for each configured app key and chat robot", async function () {
    assert.deepEqual(
      extractDifyAppMetadata({
        name: "My Bot",
        mode: "chat",
        description: "A helpful bot",
        icon: "https://example/icon.png",
      }),
      {
        name: "My Bot",
        mode: "chat",
        description: "A helpful bot",
        icon: "https://example/icon.png",
      },
    );
    useFakeZoteroPrefs();
    const config = {
      baseUrl: "https://dify.example/v1",
      apiKey: "",
      user: "paperpilot",
      appKeys: { chat: "chat-key", workflow: "workflow-key" },
      chatApps: [
        { id: "bot-a", appKey: "key-a" },
        { id: "bot-b", appKey: "key-b" },
      ],
    } as const;
    let requestCount = 0;
    const responseNames = ["Chat Bot", "Flow", "Bot A", "Bot B"];
    const client = new DifyClient(config, async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ name: responseNames[requestCount++] }),
      text: async () => "",
    }));
    const refreshed = await discoverDifyAppMetadata(client, config);
    assert.equal(refreshed.appMetadata?.chat?.name, "Chat Bot");
    assert.equal(refreshed.appMetadata?.workflow?.name, "Flow");
    assert.equal(refreshed.chatAppMetadata?.["bot-a"]?.name, "Bot A");
    assert.equal(refreshed.chatAppMetadata?.["bot-b"]?.name, "Bot B");
    assert.equal(getDifyConfig().appMetadata?.chat?.name, "Chat Bot");
    assert.equal(getDifyChatApps(getDifyConfig())[0]?.appKey, "key-a");
  });
});
