import { strict as assert } from "node:assert";
import { sanitizeRenderedMermaidSvgWithReason } from "../src/modules/contextPanel/mermaidSvg";

describe("Mermaid SVG sanitization", function () {
  const maxChars = 10_000;

  it("accepts representative Mermaid SVG output", function () {
    const result = sanitizeRenderedMermaidSvgWithReason(
      '<svg viewBox="0 0 10 10"><g><path d="M0 0"/></g><foreignObject><div><br></div></foreignObject></svg>',
      maxChars,
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.match(
        result.svg,
        /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/,
      );
      assert.match(result.svg, /<br\/>/);
    }
  });

  for (const [name, svg, reason] of [
    [
      "event handlers",
      '<svg onload="alert(1)"></svg>',
      "event handler attributes are not allowed",
    ],
    [
      "JavaScript URLs",
      '<svg><use href="javascript:alert(1)"/></svg>',
      "javascript URLs are not allowed",
    ],
    [
      "external links",
      '<svg><use href="https://example.com/icon"/></svg>',
      "href must reference an internal fragment",
    ],
    [
      "external CSS",
      '<svg><style>@import url("https://example.com/style.css");</style></svg>',
      "CSS @import is not allowed",
    ],
    [
      "external CSS URLs",
      "<svg><style>path { fill: url(https://example.com/fill); }</style></svg>",
      "external CSS url() is not allowed",
    ],
    [
      "script elements",
      "<svg><script>alert(1)</script></svg>",
      "unsafe SVG tag: script",
    ],
    [
      "unsupported elements",
      "<svg><math></math></svg>",
      "unsupported SVG tag: math",
    ],
    [
      "incomplete markup",
      "<svg><path/></svg><svg></svg>",
      "rendered output is not a complete SVG",
    ],
  ] as const) {
    it(`rejects ${name}`, function () {
      const result = sanitizeRenderedMermaidSvgWithReason(svg, maxChars);
      assert.deepEqual(result, { ok: false, reason });
    });
  }
});
