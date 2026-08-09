import { strict as assert } from "node:assert";
import mermaid from "mermaid";
import { describe, it } from "mocha";

describe("Mermaid diagram syntax", () => {
  it("parses the flowchart shape produced by the diagram shortcut", async () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    const result = await mermaid.parse(
      [
        "flowchart TD",
        "  A --> B",
        "  B --> C",
        "  classDef problem fill:#f3f4f6,stroke:#4b5563,color:#111827;",
        "  class A problem;",
      ].join("\n"),
    );

    assert.equal(result.diagramType, "flowchart-v2");
  });
});
