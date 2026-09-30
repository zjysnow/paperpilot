import { strict as assert } from "node:assert";
import { buildToolResultTraceInfo } from "../src/modules/contextPanel/agentTrace/toolResultTraceInfo";

describe("tool result trace details", function () {
  it("shows captured diagnostics for a failed command", function () {
    const info = buildToolResultTraceInfo("run_command", {
      type: "tool_result",
      callId: "command-1",
      name: "run_command",
      ok: false,
      content: {
        exitCode: 2,
        stdout: "checked data directory",
        stderr: "missing required input.csv",
        command: "python validate_data.py",
      },
    });

    assert.deepEqual(info?.details, [
      { label: "Exit code", value: "2", kind: "text" },
      {
        label: "Standard output",
        value: "checked data directory",
        kind: "code",
      },
      {
        label: "Standard error",
        value: "missing required input.csv",
        kind: "code",
      },
    ]);
  });

  it("explains when a failed command produced no captured output", function () {
    const info = buildToolResultTraceInfo("run_command", {
      type: "tool_result",
      callId: "command-2",
      name: "run_command",
      ok: false,
      content: {
        exitCode: -1,
        stdout: "",
        stderr: "",
        command: "python validate_data.py",
      },
    });

    assert.deepEqual(info?.details, [
      { label: "Exit code", value: "-1", kind: "text" },
      {
        label: "Diagnostic",
        value: "The command failed without captured stdout or stderr.",
        kind: "text",
      },
    ]);
  });
});
