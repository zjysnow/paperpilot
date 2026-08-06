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
});
