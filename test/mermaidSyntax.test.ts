import { strict as assert } from "node:assert";
import mermaid from "mermaid";
import { describe, it } from "mocha";
import { normalizeMermaidFlowchartLabels } from "../src/modules/contextPanel/renderedMarkdown";

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

  it("quotes special characters in curly decision labels", async () => {
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
    const source = normalizeMermaidFlowchartLabels(
      [
        "flowchart TD",
        "  A[Conventional Models (e.g., GOG)] --> B{Option (e.g., GOG)}",
        "  B --> C[Done]",
      ].join("\n"),
    );

    assert.equal(
      source,
      [
        "flowchart TD",
        '  A["Conventional Models (e.g., GOG)"] --> B{"Option (e.g., GOG)"}',
        "  B --> C[Done]",
      ].join("\n"),
    );
  });

  it("normalizes smart quotes and prose labels", () => {
    const source = normalizeMermaidFlowchartLabels(
      [
        "flowchart TD",
        "  A[“Conventional Models”] --> B{OLED Displays Exhibit Crosstalk Effects}",
      ].join("\n"),
    );

    assert.equal(
      source,
      [
        "flowchart TD",
        '  A["Conventional Models"] --> B{"OLED Displays Exhibit Crosstalk Effects"}',
      ].join("\n"),
    );
  });
});
