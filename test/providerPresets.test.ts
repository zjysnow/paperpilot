import { strict as assert } from "node:assert";
import {
  detectProviderPreset,
  getProviderPreset,
  providerSupportsResponsesEndpoint,
} from "../src/utils/providerPresets";

describe("Ollama provider preset", function () {
  it("provides an OpenAI-compatible default", function () {
    assert.equal(
      getProviderPreset("ollama").defaultApiBase,
      "http://127.0.0.1:11434/v1",
    );
  });

  it("detects Ollama by loopback port", function () {
    assert.equal(detectProviderPreset("http://localhost:11434/v1"), "ollama");
  });

  it("does not classify cloud or unrelated local ports as a local runtime", function () {
    assert.equal(detectProviderPreset("https://api.openai.com/v1"), "openai");
    assert.equal(
      detectProviderPreset("http://127.0.0.1:11435/v1"),
      "customized",
    );
    assert.equal(
      providerSupportsResponsesEndpoint("http://127.0.0.1:11434/v1"),
      true,
    );
  });
});

describe("GitHub Copilot provider preset", function () {
  it("detects the Copilot API and keeps it on the chat-compatible protocol", function () {
    assert.equal(
      detectProviderPreset("https://api.githubcopilot.com"),
      "copilot",
    );
    assert.equal(
      getProviderPreset("copilot").defaultProtocol,
      "openai_chat_compat",
    );
  });
});
