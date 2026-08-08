import { strict as assert } from "node:assert";
import {
  buildProviderTransportHeaders,
  resolveProviderTransportEndpoint,
} from "../src/utils/providerTransport";

describe("local provider transport", function () {
  it("uses chat completions for Ollama", function () {
    const apiBase = "http://127.0.0.1:11434/v1";
    assert.equal(
      resolveProviderTransportEndpoint({
        protocol: "openai_chat_compat",
        apiBase,
        model: "local-model",
      }),
      `${apiBase}/chat/completions`,
    );
  });

  it("uses the Responses endpoint for the Ollama Copilot protocol", function () {
    const apiBase = "http://127.0.0.1:11434/v1";
    assert.equal(
      resolveProviderTransportEndpoint({
        protocol: "responses_api",
        apiBase,
        model: "qwen3.5",
      }),
      `${apiBase}/responses`,
    );
  });

  it("does not send an authorization header when the local key is empty", function () {
    assert.deepEqual(
      buildProviderTransportHeaders({
        protocol: "openai_chat_compat",
        apiKey: "",
        apiBase: "http://127.0.0.1:11434/v1",
      }),
      { "Content-Type": "application/json" },
    );
  });

  it("never sends an authorization header to Ollama", function () {
    assert.deepEqual(
      buildProviderTransportHeaders({
        protocol: "openai_chat_compat",
        apiKey: "stale-online-key",
        apiBase: "http://localhost:11434/v1",
      }),
      { "Content-Type": "application/json" },
    );
  });

  it("adds an authorization header when a local gateway requires a key", function () {
    assert.equal(
      buildProviderTransportHeaders({
        protocol: "openai_chat_compat",
        apiKey: "local-secret",
      }).Authorization,
      "Bearer local-secret",
    );
  });
});
