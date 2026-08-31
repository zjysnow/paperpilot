import { strict as assert } from "node:assert";
import {
  detectProviderPreset,
  getProviderPreset,
  providerSupportsResponsesEndpoint,
} from "../src/utils/providerPresets";
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
