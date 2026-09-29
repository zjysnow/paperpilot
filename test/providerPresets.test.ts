import { strict as assert } from "node:assert";
import {
  detectProviderPreset,
  getProviderPreset,
  providerSupportsResponsesEndpoint,
} from "../src/utils/providerPresets";
import { normalizeProviderProtocolForAuthMode } from "../src/utils/providerProtocol";
import { resolveProviderTransportEndpoint } from "../src/utils/providerTransport";
import {
  resolveMineruSourceOptionState,
  resolvePaperPdfSupportForConversation,
} from "../src/modules/contextPanel/setupHandlers/controllers/paperSourceOptionsController";

describe("local OpenAI-compatible provider preset", function () {
  it("provides an OpenAI-compatible default", function () {
    assert.equal(
      getProviderPreset("local_openai_compatible").defaultApiBase,
      "http://127.0.0.1:11434/v1",
    );
  });

  it("detects the default local server by loopback port", function () {
    assert.equal(
      detectProviderPreset("http://localhost:11434/v1"),
      "local_openai_compatible",
    );
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
  it("routes all Copilot models through the Responses API", function () {
    assert.equal(
      detectProviderPreset("https://api.githubcopilot.com"),
      "copilot",
    );
    assert.equal(getProviderPreset("copilot").defaultProtocol, "responses_api");
    assert.equal(
      providerSupportsResponsesEndpoint("https://api.githubcopilot.com"),
      true,
    );
    for (const model of ["gpt-5.6-luna", "gpt-4.1", "claude-sonnet-4.5"]) {
      assert.equal(
        normalizeProviderProtocolForAuthMode({
          authMode: "copilot_auth",
          apiBase: "https://api.githubcopilot.com",
          protocol: "openai_chat_compat",
          model,
        }),
        "responses_api",
      );
    }
    assert.equal(
      resolveProviderTransportEndpoint({
        authMode: "copilot_auth",
        apiBase: "https://api.githubcopilot.com",
        protocol: "responses_api",
        model: "gpt-5.6-luna",
      }),
      "https://api.githubcopilot.com/responses",
    );
  });
});

describe("MinerU paper source selection", function () {
  it("keeps MinerU as an explicit source choice instead of changing PDF support globally", function () {
    assert.equal(
      resolvePaperPdfSupportForConversation({ basePdfSupport: "none" }),
      "none",
    );
    assert.deepEqual(
      resolveMineruSourceOptionState({
        hasUsableMineru: false,
        itemStatus: { status: "idle" },
      }),
      { state: "idle", action: "start", hideTextSource: false },
    );
    assert.deepEqual(
      resolveMineruSourceOptionState({
        hasUsableMineru: false,
        itemStatus: { status: "cached" },
      }),
      { state: "cached", action: "select", hideTextSource: false },
    );
  });
});
