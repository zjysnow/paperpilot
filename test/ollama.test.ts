import { strict as assert } from "node:assert";
import {
  fetchOllamaModelNames,
  resolveOllamaTagsEndpoint,
} from "../src/utils/ollama";

describe("Ollama model discovery", function () {
  it("resolves the tags endpoint outside the OpenAI-compatible path", function () {
    assert.equal(
      resolveOllamaTagsEndpoint("http://127.0.0.1:11434/v1"),
      "http://127.0.0.1:11434/api/tags",
    );
  });

  it("returns unique model names from Ollama tags", async function () {
    const names = await fetchOllamaModelNames(
      async () =>
        new Response(
          JSON.stringify({
            models: [
              { name: "llama3.2:latest" },
              { name: "qwen2.5:7b" },
              { name: "llama3.2:latest" },
            ],
          }),
          { status: 200 },
        ),
      "http://localhost:11434/v1",
    );
    assert.deepEqual(names, ["llama3.2:latest", "qwen2.5:7b"]);
  });
});
