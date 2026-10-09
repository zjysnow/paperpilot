import { strict as assert } from "node:assert";
import { BUILTIN_SKILL_FILES } from "../src/agent/skills";
import { initUserSkills, loadUserSkills } from "../src/agent/skills/userSkills";
import { getCanonicalSkillFilePath } from "../src/agent/skills/nativeSkillPaths";

describe("user Skill initialization and loading", function () {
  const globals = globalThis as typeof globalThis & {
    Zotero?: unknown;
    IOUtils?: unknown;
  };
  const previousZotero = globals.Zotero;
  const previousIO = globals.IOUtils;
  const files = new Map<string, Uint8Array>();
  const directories = new Set<string>();
  const preferences = new Map<string, unknown>();
  const messages: string[] = [];
  const parent = (path: string) => path.slice(0, path.lastIndexOf("/"));

  beforeEach(function () {
    files.clear();
    directories.clear();
    preferences.clear();
    messages.length = 0;
    globals.Zotero = {
      DataDirectory: { dir: "/fixture/zotero" },
      Profile: { dir: "/fixture/profile" },
      Prefs: {
        get: (key: string) => preferences.get(key),
        set: (key: string, value: unknown) => preferences.set(key, value),
      },
      debug: (message: string) => messages.push(message),
    };
    globals.IOUtils = {
      exists: async (path: string) => files.has(path) || directories.has(path),
      read: async (path: string) => {
        const bytes = files.get(path);
        if (!bytes) throw new Error(`File not found: ${path}`);
        return bytes;
      },
      write: async (path: string, bytes: Uint8Array) => {
        files.set(path, bytes);
        return bytes.length;
      },
      makeDirectory: async (path: string) => {
        for (let current = path; current; current = parent(current)) {
          directories.add(current);
        }
      },
      getChildren: async (path: string) =>
        [...directories, ...files.keys()].filter(
          (child) => parent(child) === path,
        ),
      remove: async (path: string) => {
        files.delete(path);
        directories.delete(path);
      },
    };
  });

  afterEach(function () {
    globals.Zotero = previousZotero;
    globals.IOUtils = previousIO;
  });

  it("seeds and loads explicit-only learning Skills without regex patterns", async function () {
    await initUserSkills();
    for (const id of ["paper-guide", "paper-tutor"]) {
      assert.ok(
        files.has(getCanonicalSkillFilePath(id)),
        `${id} was not seeded`,
      );
    }
    const loaded = await loadUserSkills();
    for (const id of ["paper-guide", "paper-tutor"]) {
      const skill = loaded.find((entry) => entry.id === id);
      assert.ok(
        skill,
        `${id} was written to disk but rejected by the runtime loader`,
      );
      assert.equal(skill.activation, "manual");
      assert.equal(skill.patterns.length, 0);
      assert.equal(skill.source, "system");
    }
    assert.ok(loaded.some((entry) => entry.id === "paper-replication"));
    assert.equal(loaded.length, Object.keys(BUILTIN_SKILL_FILES).length);
  });

  it("preserves customized learning Skills and intentional deletions", async function () {
    await initUserSkills();
    const path = getCanonicalSkillFilePath("paper-tutor");
    const customized =
      new TextDecoder().decode(files.get(path)) +
      "\nMy custom teaching rule.\n";
    files.set(path, new TextEncoder().encode(customized));
    files.delete(getCanonicalSkillFilePath("paper-guide"));
    await initUserSkills();
    const loaded = await loadUserSkills();
    const tutor = loaded.find((entry) => entry.id === "paper-tutor");
    assert.ok(tutor);
    assert.equal(tutor.source, "customized");
    assert.match(tutor.instruction, /My custom teaching rule/);
    assert.equal(
      loaded.some((entry) => entry.id === "paper-guide"),
      false,
    );
  });

  it("upgrades an unmodified previously seeded guide to the new teaching contract", async function () {
    const shipped = BUILTIN_SKILL_FILES["paper-guide.md"];
    const previous = shipped
      .replace("version: 3", "version: 1")
      .replace(
        /## Default chat deliverable[\s\S]*?(?=## Read and explain)/,
        "",
      );
    try {
      BUILTIN_SKILL_FILES["paper-guide.md"] = previous;
      await initUserSkills();
    } finally {
      BUILTIN_SKILL_FILES["paper-guide.md"] = shipped;
    }
    await initUserSkills();
    const guide = (await loadUserSkills()).find(
      (entry) => entry.id === "paper-guide",
    );
    assert.ok(guide);
    assert.equal(guide.version, 3);
    assert.equal(guide.source, "system");
    assert.match(guide.instruction, /Default chat deliverable/);
    assert.match(
      guide.instruction,
      /central mechanism\s+AND the main supporting evidence/,
    );
  });

  it("still rejects automatic Skills missing required match patterns", async function () {
    await initUserSkills();
    const path = getCanonicalSkillFilePath("invalid-auto");
    directories.add(parent(path));
    files.set(
      path,
      new TextEncoder().encode(
        "---\nid: invalid-auto\nactivation: auto\n---\nAutomatic instruction without patterns.",
      ),
    );
    const loaded = await loadUserSkills();
    assert.equal(
      loaded.some((entry) => entry.id === "invalid-auto"),
      false,
    );
    assert.ok(
      messages.some((entry) => entry.includes("Skipping invalid skill file")),
    );
  });
});
