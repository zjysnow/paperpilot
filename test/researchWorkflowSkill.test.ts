import { strict as assert } from "node:assert";
import { BUILTIN_SKILL_FILES } from "../src/agent/skills";
import { matchesSkill, parseSkill } from "../src/agent/skills/skillLoader";

describe("research workflow skill", function () {
  const raw = BUILTIN_SKILL_FILES["research-workflow.md"];
  const skill = parseSkill(raw);

  it("ships a cross-tool research workflow", function () {
    assert.equal(skill.id, "research-workflow");
    assert.equal(skill.activation, "both");
    assert.match(skill.instruction, /Zotero owns bibliographic metadata/);
    assert.match(skill.instruction, /configured notes directory/);
    assert.match(skill.instruction, /Workspace Directory/);
    assert.match(skill.instruction, /data validation before training/i);
  });

  it("matches English and Chinese workflow setup requests", function () {
    assert.equal(
      matchesSkill(skill, {
        userText: "Help me set up a Zotero Obsidian VS Code workflow.",
      }),
      true,
    );
    assert.equal(
      matchesSkill(skill, {
        userText: "帮我配置论文阅读和复现工作流。",
      }),
      true,
    );
  });
});
