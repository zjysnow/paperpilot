import { strict as assert } from "node:assert";
import { BUILTIN_SKILL_FILES } from "../src/agent/skills";
import { matchesSkill, parseSkill } from "../src/agent/skills/skillLoader";

describe("paper replication skill", function () {
  const raw = BUILTIN_SKILL_FILES["paper-replication.md"];
  const skill = parseSkill(raw);

  it("ships a resumable paper-replication workflow", function () {
    assert.equal(skill.id, "paper-replication");
    assert.equal(skill.activation, "both");
    assert.match(skill.instruction, /paperpilot-replication\.json/);
    assert.match(skill.instruction, /EVIDENCE\.md/);
    assert.match(skill.instruction, /DATA_REQUIREMENTS\.md/);
    assert.match(skill.instruction, /EXPERIMENT_RESULTS\.md/);
    assert.match(skill.instruction, /EXPERIMENT_LOG\.md/);
  });

  it("matches English and Chinese replication requests", function () {
    assert.equal(
      matchesSkill(skill, {
        userText: "Please reproduce this paper in my workspace.",
      }),
      true,
    );
    assert.equal(
      matchesSkill(skill, { userText: "请帮我复现这篇论文并准备实验。" }),
      true,
    );
  });
});
