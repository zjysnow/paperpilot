import { strict as assert } from "node:assert";
import { parseToolArgumentsJson } from "../src/agent/toolArgumentDiagnostics";

describe("tool argument JSON repair", function () {
  it("repairs unescaped multiline content without evaluating it", function () {
    const raw =
      '{"action":"write","filePath":"/tmp/example.py","content":"line one\nline two\tindented"}';

    assert.deepEqual(parseToolArgumentsJson(raw), {
      action: "write",
      filePath: "/tmp/example.py",
      content: "line one\nline two\tindented",
    });
  });

  it("rejects malformed syntax that cannot be repaired safely", function () {
    assert.equal(
      parseToolArgumentsJson('{"action":"write","content":"unterminated}'),
      null,
    );
  });

  it("repairs an unescaped quote inside a trailing file content value", function () {
    const raw =
      '{"action":"write","filePath":"/tmp/validate_data.py","content":"print("ready")\nsettings = {"seed": 7}"}';

    assert.deepEqual(parseToolArgumentsJson(raw), {
      action: "write",
      filePath: "/tmp/validate_data.py",
      content: 'print("ready")\nsettings = {"seed": 7}',
    });
  });

  it("repairs unescaped content before trailing file arguments", function () {
    const raw =
      '{"action":"write","content":"print("ready")\nsettings = {"seed": 7}","filePath":"/tmp/validate_data.py","allowOverwrite":true}';

    assert.deepEqual(parseToolArgumentsJson(raw), {
      action: "write",
      content: 'print("ready")\nsettings = {"seed": 7}',
      filePath: "/tmp/validate_data.py",
      allowOverwrite: true,
    });
  });

  it("repairs a malformed content value ending in a backslash", function () {
    const raw = String.raw`{"action":"write","content":"path = 'C:\temp'\","filePath":"/tmp/example.py"}`;

    assert.deepEqual(parseToolArgumentsJson(raw), {
      action: "write",
      content: "path = 'C:\\temp'\\",
      filePath: "/tmp/example.py",
    });
  });

  it("repairs content inside a fenced JSON tool argument", function () {
    const raw = `\`\`\`json
{"action":"write","filePath":"/tmp/example.py","content":"print("ready")
settings = {"seed": 7}"}
\`\`\``;

    assert.deepEqual(parseToolArgumentsJson(raw), {
      action: "write",
      filePath: "/tmp/example.py",
      content: 'print("ready")\nsettings = {"seed": 7}',
    });
  });
});
