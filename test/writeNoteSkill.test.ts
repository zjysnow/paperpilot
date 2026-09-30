import { strict as assert } from "node:assert";
import { BUILTIN_SKILL_FILES } from "../src/agent/skills";
import { parseSkill } from "../src/agent/skills/skillLoader";

describe("write note skill", function () {
  const raw = BUILTIN_SKILL_FILES["write-note.md"];
  const skill = parseSkill(raw);

  it("ships a research-ready file-note schema", function () {
    assert.equal(skill.id, "write-note");
    assert.match(skill.instruction, /zotero_item_key/);
    assert.match(skill.instruction, /itemKey.*zoteroItemKey/s);
    assert.match(skill.instruction, /status: reading/);
    assert.match(skill.instruction, /project_path/);
    assert.match(
      skill.instruction,
      /inbox.*reading.*understood.*candidate.*reproducing.*reproduced.*blocked.*archived/s,
    );
    assert.match(skill.instruction, /Tag namespaces/);
    assert.match(skill.instruction, /Evidence and Open Questions/);
    assert.match(skill.instruction, /Evidence: section, page, figure\/table/);
    assert.match(skill.instruction, /Numerical claims require a source anchor/);
    assert.match(skill.instruction, /Reproduction/);
    assert.match(skill.instruction, /Template for concept notes/);
    assert.match(skill.instruction, /## Supported By/);
    assert.doesNotMatch(skill.instruction, /LLM[- ]for[- ]Zotero/i);
  });

  it("preserves Zotero notes without YAML frontmatter", function () {
    assert.match(
      skill.instruction,
      /Zotero notes.*omit the YAML frontmatter block/i,
    );
  });
});
