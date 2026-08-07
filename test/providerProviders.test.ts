import { strict as assert } from "node:assert";
import { describe, it } from "mocha";
import {
  detectProviderPreset,
  getProviderPreset,
  PROVIDER_PRESETS,
} from "../src/utils/providerPresets";
import {
  normalizeModelProviderGroups,
  type ModelProviderGroup,
} from "../src/utils/modelProviders";
import {
  PROVIDER_PROTOCOL_SPECS,
  normalizeProviderProtocol,
} from "../src/utils/providerProtocol";
import {
  buildOllamaRequestBody,
  consumeOllamaStreamChunk,
  resolveOllamaEndpoint,
} from "../src/modules/contextPanel/chat";

const ollamaGroup = (id: string, apiBase: string): ModelProviderGroup => ({
  id,
  apiBase,
  apiKey: "",
  authMode: "api_key",
  providerProtocol: "openai_chat_compat",
  models: [
    {
      id: `${id}-model`,
      model: "llama3.2",
      temperature: 0.7,
      maxTokens: 4096,
    },
  ],
});

describe("Ollama provider configuration", () => {
  it("exposes Ollama as the only supported preset", () => {
    assert.deepEqual(
      PROVIDER_PRESETS.map((preset) => preset.id),
      ["ollama"],
    );
    assert.equal(detectProviderPreset("http://localhost:11434/v1"), "ollama");
    assert.equal(
      detectProviderPreset("https://api.openai.com/v1"),
      "customized",
    );
    assert.equal(
      getProviderPreset("ollama").defaultProtocol,
      "openai_chat_compat",
    );
  });

  it("normalizes away non-Ollama groups and keeps local groups first", () => {
    const groups = normalizeModelProviderGroups([
      {
        id: "remote",
        apiBase: "https://api.openai.com/v1",
        models: [],
      },
      ollamaGroup("local", "http://localhost:11434/v1"),
    ]);

    assert.deepEqual(
      groups.map((group) => group.id),
      ["local"],
    );
  });

  it("drops legacy remote groups when preferences are normalized", () => {
    const groups = normalizeModelProviderGroups([
      {
        id: "openai-legacy",
        apiBase: "https://api.openai.com/v1",
        apiKey: "must-not-survive",
        models: [{ id: "remote-model", model: "gpt-4" }],
      },
      ollamaGroup("local", "http://127.0.0.1:11434/v1"),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.id, "local");
    assert.equal(groups[0]?.apiKey, "");
  });

  it("normalizes unsupported protocols to Ollama chat", () => {
    assert.equal(
      normalizeProviderProtocol("responses_api"),
      "openai_chat_compat",
    );
    assert.deepEqual(
      PROVIDER_PROTOCOL_SPECS.map((spec) => spec.id),
      ["openai_chat_compat"],
    );
  });

  it("recognizes the native Ollama discovery endpoint", () => {
    const base = new URL(getProviderPreset("ollama").defaultApiBase);
    assert.equal(`${base.origin}/api/tags`, "http://localhost:11434/api/tags");
  });

  it("builds an OpenAI-compatible streaming vision request", () => {
    const body = buildOllamaRequestBody({
      model: "llama3.2",
      systemPrompt: "Be concise.",
      history: [
        {
          role: "user",
          text: "Previous question",
          timestamp: 1,
          screenshotImages: ["data:image/png;base64, cHJldmlvdXM="],
        },
        {
          role: "assistant",
          text: "Previous answer",
          timestamp: 2,
        },
      ],
      message: {
        role: "user",
        text: "Current question",
        timestamp: 3,
        screenshotImages: ["data:image/png;base64,Y3VycmVudA=="],
      },
      temperature: 0.4,
      maxTokens: 1024,
    });

    assert.equal(body.stream, true);
    assert.deepEqual(body.messages, [
      { role: "system", content: "Be concise." },
      {
        role: "user",
        content: [
          { type: "text", text: "Previous question" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64, cHJldmlvdXM=",
              detail: "high",
            },
          },
        ],
      },
      { role: "assistant", content: "Previous answer" },
      {
        role: "user",
        content: [
          { type: "text", text: "Current question" },
          {
            type: "image_url",
            image_url: {
              url: "data:image/png;base64,Y3VycmVudA==",
              detail: "high",
            },
          },
        ],
      },
    ]);
    assert.equal(body.temperature, 0.4);
    assert.equal(body.max_tokens, 1024);
  });

  it("resolves any Ollama base URL to the OpenAI-compatible chat endpoint", () => {
    assert.equal(
      resolveOllamaEndpoint("http://localhost:11434/v1"),
      "http://localhost:11434/v1/chat/completions",
    );
  });

  it("parses Ollama JSON lines across split network chunks", () => {
    const state = { buffer: "", result: "", finished: false };
    const deltas: string[] = [];

    consumeOllamaStreamChunk(state, '{"message":{"content":"Hel', (delta) =>
      deltas.push(delta),
    );
    consumeOllamaStreamChunk(
      state,
      'lo"},"done":false}\n{"message":{"content":"!"},"done":true}\n',
      (delta) => deltas.push(delta),
    );

    assert.deepEqual(deltas, ["Hello", "!"]);
    assert.equal(state.result, "Hello!");
    assert.equal(state.finished, true);
    assert.equal(state.buffer, "");
  });

  it("accepts SSE data prefixes and ignores malformed events", () => {
    const state = { buffer: "", result: "", finished: false };
    const deltas: string[] = [];

    consumeOllamaStreamChunk(
      state,
      'data: {"message":{"content":"ok"}}\ndata: not-json\ndata: [DONE]\n',
      (delta) => deltas.push(delta),
      true,
    );

    assert.deepEqual(deltas, ["ok"]);
    assert.equal(state.result, "ok");
    assert.equal(state.finished, true);
  });
});
