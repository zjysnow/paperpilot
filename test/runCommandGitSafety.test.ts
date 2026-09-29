import { strict as assert } from "node:assert";
import { createRunCommandTool } from "../src/agent/tools/write/runCommand";
import type { AgentToolContext } from "../src/agent/types";

describe("run command Git safety", function () {
  it("normalizes common command aliases emitted by compatible models", function () {
    const tool = createRunCommandTool();
    for (const input of [
      { cmd: "pwd" },
      { shell_command: "git status --short" },
      { shellCommand: "git log -1 --oneline" },
    ]) {
      const validated = tool.validate(input);
      assert.equal(validated.ok, true);
      if (validated.ok) {
        assert.equal(
          validated.value.command,
          "cmd" in input
            ? input.cmd
            : "shell_command" in input
              ? input.shell_command
              : input.shellCommand,
        );
      }
    }
  });

  it("requires confirmation before initializing and committing a repository", async function () {
    const tool = createRunCommandTool();
    const validated = tool.validate({
      command: "git init && git add -A && git commit -m 'Initial commit'",
    });

    assert.equal(validated.ok, true);
    if (!validated.ok) return;
    const context: AgentToolContext = {
      request: {
        conversationKey: 1,
        mode: "agent",
        userText: "",
        metadata: {},
      },
      item: null,
      currentAnswerText: "",
      modelName: "test",
    };
    assert.equal(
      await tool.shouldRequireConfirmation?.(validated.value, context),
      true,
    );
  });
});
