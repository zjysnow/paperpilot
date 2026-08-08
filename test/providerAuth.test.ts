import { strict as assert } from "node:assert";
import { requiresProviderApiKey } from "../src/utils/providerAuth";

describe("provider API key requirements", function () {
  it("does not require a key for Ollama", function () {
    assert.equal(
      requiresProviderApiKey({ authMode: "api_key", presetId: "ollama" }),
      false,
    );
  });

  it("still requires keys for online API providers", function () {
    assert.equal(
      requiresProviderApiKey({ authMode: "api_key", presetId: "openai" }),
      true,
    );
  });
});
