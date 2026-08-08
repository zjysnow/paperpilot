import { strict as assert } from "node:assert";
import { requiresProviderApiKey } from "../src/utils/providerAuth";

describe("provider API key requirements", function () {
  it("does not require a key for local OpenAI-compatible servers", function () {
    assert.equal(
      requiresProviderApiKey({
        authMode: "api_key",
        presetId: "local_openai_compatible",
      }),
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
