import { strict as assert } from "node:assert";
import {
  commitLearningCheckpoint,
  discardLearningCheckpoint,
  hasLearningCheckpoint,
  loadLearningMode,
  loadLearningProgressForPaper,
  setLearningMode,
  stageLearningProgress,
} from "../src/agent/store/learningStore";
import type { AgentRuntimeRequest } from "../src/agent/types";
import type { LearningProgress } from "../src/agent/services/paperLearning";
import { AgentRuntime } from "../src/agent/runtime";
import { AgentToolRegistry } from "../src/agent/tools/registry";
import { createPaperLearningTool } from "../src/agent/tools/write/paperLearning";
import {
  BUILTIN_SKILL_FILES,
  getAllSkills,
  setUserSkills,
} from "../src/agent/skills";
import { parseSkill } from "../src/agent/skills/skillLoader";
import type { AgentModelAdapter } from "../src/agent/model/adapter";
import { setLearningNoteSyncEnabled } from "../src/utils/learningNoteSyncConfig";

function createLearningDbFixture() {
  const modes = new Map<number, string>();
  const progress = new Map<
    string,
    {
      progress_json: string;
      revision: number;
      item_id: number;
      attachment_id: number;
      updated_at: number;
    }
  >();
  const notes = new Map<string, { file_path: string; managed_block: string }>();
  const queries: string[] = [];
  let fail = false;
  const db = {
    async queryAsync(sql: string, params: unknown[] = []) {
      if (!sql.includes("paperpilot_learning_")) return [];
      queries.push(sql);
      if (fail) throw new Error("Database write unavailable");
      if (sql.startsWith("CREATE ")) return [];
      if (sql.startsWith("SELECT mode"))
        return modes.has(Number(params[0]))
          ? [{ mode: modes.get(Number(params[0])) }]
          : [];
      if (sql.startsWith("INSERT INTO paperpilot_learning_modes")) {
        modes.set(Number(params[0]), String(params[1]));
        return [];
      }
      if (sql.startsWith("SELECT revision")) {
        const entry = progress.get(JSON.stringify([params[0], params[1]]));
        return entry ? [{ ...entry }] : [];
      }
      if (sql.startsWith("INSERT INTO paperpilot_learning_progress")) {
        progress.set(JSON.stringify([params[0], params[1]]), {
          item_id: Number(params[2]),
          attachment_id: Number(params[3]),
          progress_json: String(params[4]),
          revision: Number(params[5]),
          updated_at: Number(params[6]),
        });
        return [];
      }
      if (sql.startsWith("SELECT progress_json")) {
        return [...progress.entries()]
          .filter(([key, entry]) =>
            sql.includes("item_id =")
              ? entry.item_id === params[0] && entry.attachment_id === params[1]
              : JSON.parse(key)[0] === params[0],
          )
          .map(([, entry]) => ({ ...entry }))
          .sort((a, b) => b.updated_at - a.updated_at);
      }
      if (sql.startsWith("SELECT file_path"))
        return notes.has(String(params[0]))
          ? [notes.get(String(params[0]))]
          : [];
      if (sql.startsWith("INSERT INTO paperpilot_learning_notes")) {
        notes.set(String(params[0]), {
          file_path: String(params[1]),
          managed_block: String(params[2]),
        });
        return [];
      }
      throw new Error(`Unexpected learning query: ${sql}`);
    },
    async executeTransaction(callback: () => Promise<void>) {
      const snapshot = new Map(progress);
      try {
        await callback();
      } catch (error) {
        progress.clear();
        for (const [key, entry] of snapshot) progress.set(key, entry);
        throw error;
      }
    },
  };
  return {
    db,
    progress,
    modes,
    notes,
    queries,
    setFailure: (value: boolean) => {
      fail = value;
    },
  };
}

function learningProgressFixture(): LearningProgress {
  return {
    version: 1,
    source: {
      itemId: 12,
      contextItemId: 34,
      title: "Mechanism",
      coverage: "Mechanism passage",
      missing: [],
      libraryID: 1,
      itemKey: "PAPERKEY",
      attachmentKey: "PDFKEY12",
      fingerprint: "source-v1",
    },
    target: "Understand the intermediate representation",
    location: "Mechanism passage",
    explained: ["Input is transformed into a representation."],
    understanding: [
      {
        point: "Representation",
        status: "explained_unverified",
        answer: "",
        reason: "The user has not demonstrated this point.",
      },
    ],
    gaps: ["Why the next stage needs this representation"],
    nextEntry: "Trace the next stage",
  };
}

function learningRequestFixture(): AgentRuntimeRequest {
  return {
    conversationKey: 321,
    mode: "agent",
    userText: "Explain the mechanism",
    selectedPaperContexts: [
      { itemId: 12, contextItemId: 34, title: "Mechanism" },
    ],
  };
}

describe("database learning state", function () {
  const globals = globalThis as typeof globalThis & { Zotero?: unknown };
  const previous = globals.Zotero;
  let fixture: ReturnType<typeof createLearningDbFixture>;
  beforeEach(function () {
    fixture = createLearningDbFixture();
    globals.Zotero = { DB: fixture.db };
  });
  afterEach(function () {
    globals.Zotero = previous;
  });

  it("persists independent conversation modes and defaults new conversations to Normal", async function () {
    assert.equal(await loadLearningMode(1), "normal");
    await setLearningMode(1, "tutor");
    await setLearningMode(2, "guide");
    assert.equal(await loadLearningMode(1), "tutor");
    assert.equal(await loadLearningMode(2), "guide");
    assert.deepEqual(
      [...fixture.modes],
      [
        [1, "tutor"],
        [2, "guide"],
      ],
    );
    await setLearningMode(1, "normal");
    assert.equal(await loadLearningMode(1), "normal");
  });

  it("waits for pending mode saves so immediate retries cannot read a stale selection", async function () {
    assert.equal(await loadLearningMode(1), "normal");
    const first = setLearningMode(1, "guide");
    const second = setLearningMode(1, "tutor");
    const reading = loadLearningMode(1);
    await Promise.all([first, second]);
    assert.equal(await reading, "tutor");
    assert.equal(fixture.modes.get(1), "tutor");
  });

  describe("automatic learning rounds", function () {
    const globals = globalThis as typeof globalThis & {
      Zotero?: unknown;
      IOUtils?: unknown;
    };
    const oldZotero = globals.Zotero;
    const oldIO = globals.IOUtils;
    let fixture: ReturnType<typeof createLearningDbFixture>;
    let preferences: Map<string, unknown>;
    let previousSkills: ReturnType<typeof getAllSkills>;
    beforeEach(function () {
      fixture = createLearningDbFixture();
      preferences = new Map();
      globals.Zotero = {
        DB: fixture.db,
        Prefs: {
          get: (key: string) => preferences.get(key),
          set: (key: string, value: unknown) => preferences.set(key, value),
        },
      };
      globals.IOUtils = undefined;
      previousSkills = getAllSkills();
      setUserSkills(
        ["paper-guide.md", "paper-tutor.md"].map((key) =>
          parseSkill(BUILTIN_SKILL_FILES[key]),
        ),
      );
    });
    afterEach(function () {
      globals.Zotero = oldZotero;
      globals.IOUtils = oldIO;
      setUserSkills(previousSkills);
    });

    function makeRuntime(runStep: AgentModelAdapter["runStep"]): AgentRuntime {
      const registry = new AgentToolRegistry();
      registry.register(
        createPaperLearningTool({
          zoteroGateway: {
            resolvePaperContextTarget: () => ({
              itemId: 12,
              contextItemId: 34,
              title: "Mechanism",
            }),
            getItem: (id) =>
              ({
                id,
                key: id === 12 ? "PAPERKEY" : "PDFKEY12",
                libraryID: 1,
              }) as Zotero.Item,
          },
          pdfService: {
            async ensurePaperContext() {
              const text =
                "Input is transformed into an intermediate representation.";
              return {
                title: "Mechanism",
                chunks: [text],
                chunkMeta: [
                  {
                    chunkIndex: 0,
                    text,
                    normalizedText: text,
                    chunkKind: "methods",
                    sectionLabel: "Methods",
                    sourceFingerprint: "source-v1",
                  },
                ],
                chunkStats: [],
                docFreq: {},
                avgChunkLength: text.length,
                fullLength: text.length,
              };
            },
          },
        }),
      );
      return new AgentRuntime({
        registry,
        adapterFactory: () => ({
          getCapabilities: () => ({
            streaming: false,
            toolCalls: true,
            fileInputs: false,
            reasoning: false,
          }),
          supportsTools: () => true,
          runStep,
        }),
      });
    }

    function checkpointStep() {
      const progress = learningProgressFixture();
      const call = {
        id: "checkpoint",
        name: "paper_learning",
        arguments: { mode: "progress", record: progress },
      };
      return {
        kind: "tool_calls" as const,
        calls: [call],
        assistantMessage: {
          role: "assistant" as const,
          content: "",
          tool_calls: [call],
        },
      };
    }

    it("forces the selected mode, restores progress, and commits without a path or approval", async function () {
      let step = 0;
      const agent = makeRuntime(async () =>
        ++step === 1
          ? checkpointStep()
          : { kind: "final", text: "Source-grounded explanation." },
      );
      const request = {
        ...learningRequestFixture(),
        learningMode: "guide" as const,
        forcedSkillIds: ["paper-tutor"],
      };
      const result = await agent.runTurn({
        request,
        onEvent: (event) => {
          if (event.type === "confirmation_required")
            assert.fail("Database state must not ask for file approval");
        },
      });
      assert.equal(result.kind, "completed");
      assert.deepEqual(request.forcedSkillIds, ["paper-guide"]);
      assert.equal(fixture.progress.size, 1, fixture.queries.join("\n"));
      assert.equal(hasLearningCheckpoint(request), false);
      let inspected = false;
      step = 0;
      const resumed = makeRuntime(async (params) => {
        if (!inspected) {
          const content = params.messages
            .filter((message) => message.role === "tool")
            .map((message) => message.content)
            .join("\n");
          assert.match(content, /Understand the intermediate representation/);
          inspected = true;
        }
        return ++step === 1
          ? checkpointStep()
          : { kind: "final", text: "Continued teaching." };
      });
      assert.equal(
        (
          await resumed.runTurn({
            request: {
              ...learningRequestFixture(),
              conversationKey: 999,
              learningMode: "tutor",
            },
          })
        ).kind,
        "completed",
      );
      assert.equal([...fixture.progress.values()][0].revision, 2);
    });

    it("Normal clears learning forces and does not resume or checkpoint", async function () {
      let calls = 0;
      const request = {
        ...learningRequestFixture(),
        learningMode: "normal" as const,
        forcedSkillIds: ["paper-tutor"],
      };
      const result = await makeRuntime(async (params) => {
        calls++;
        assert.doesNotMatch(
          params.messages
            .filter((message) => message.role === "system")
            .map((message) => String(message.content))
            .join("\n"),
          /### Skill: paper-(guide|tutor)/,
        );
        return { kind: "final", text: "Ordinary answer." };
      }).runTurn({ request });
      assert.equal(result.kind, "completed");
      assert.deepEqual(request.forcedSkillIds, []);
      assert.equal(calls, 1);
      assert.equal(fixture.progress.size, 0);
    });

    it("reports an absent checkpoint instead of claiming autosave succeeded", async function () {
      let calls = 0;
      const result = await makeRuntime(async () => {
        calls++;
        return { kind: "final", text: "Uncheckpointed answer." };
      }).runTurn({
        request: { ...learningRequestFixture(), learningMode: "tutor" },
      });
      assert.equal(result.kind, "failed");
      assert.match(result.text, /not saved/);
      assert.equal(calls, 2);
      assert.equal(fixture.progress.size, 0);
    });

    it("does not commit staged progress when the model fails before completing", async function () {
      let calls = 0;
      const request = {
        ...learningRequestFixture(),
        learningMode: "tutor" as const,
      };
      await assert.rejects(
        makeRuntime(async () => {
          if (++calls === 1) return checkpointStep();
          throw new Error("Model stream interrupted");
        }).runTurn({ request }),
        /interrupted/,
      );
      assert.equal(fixture.progress.size, 0);
      assert.equal(hasLearningCheckpoint(request), false);
    });

    it("preserves primary database progress and surfaces optional note sync failure", async function () {
      preferences.set(
        "extensions.zotero.paperpilot.obsidianVaultPath",
        "/vault",
      );
      preferences.set("extensions.zotero.paperpilot.obsidianTargetFolder", "");
      setLearningNoteSyncEnabled(true);
      let calls = 0;
      const result = await makeRuntime(async () =>
        ++calls === 1
          ? checkpointStep()
          : { kind: "final", text: "Explanation." },
      ).runTurn({
        request: { ...learningRequestFixture(), learningMode: "tutor" },
      });
      assert.equal(result.kind, "completed");
      assert.match(result.text, /note synchronization failed/);
      assert.equal(fixture.progress.size, 1);
    });

    it("does not commit when an adapter returns a final answer after cancellation", async function () {
      let calls = 0;
      const controller = new AbortController();
      const request = {
        ...learningRequestFixture(),
        learningMode: "tutor" as const,
      };
      const result = await makeRuntime(async () => {
        if (++calls === 1) return checkpointStep();
        controller.abort();
        return { kind: "final", text: "Late model answer." };
      }).runTurn({ request, signal: controller.signal });
      assert.equal(result.kind, "failed");
      assert.match(result.text, /cancelled/);
      assert.equal(fixture.progress.size, 0);
      assert.equal(hasLearningCheckpoint(request), false);
    });

    it("surfaces database commit failure as a failed learning round", async function () {
      let calls = 0;
      const result = await makeRuntime(async () => {
        if (++calls === 1) return checkpointStep();
        fixture.setFailure(true);
        return { kind: "final", text: "Explanation." };
      }).runTurn({
        request: { ...learningRequestFixture(), learningMode: "guide" },
      });
      assert.equal(result.kind, "failed");
      assert.match(result.text, /could not be saved/);
      assert.equal(fixture.progress.size, 0);
    });
  });

  it("stages changes until completion and discards interrupted turns", async function () {
    const request = learningRequestFixture();
    await stageLearningProgress(request, learningProgressFixture());
    assert.equal(hasLearningCheckpoint(request), true);
    assert.deepEqual(await loadLearningProgressForPaper(12, 34), []);
    discardLearningCheckpoint(request);
    assert.equal(hasLearningCheckpoint(request), false);
    assert.deepEqual(await commitLearningCheckpoint(request), []);
    await stageLearningProgress(request, learningProgressFixture());
    assert.equal((await commitLearningCheckpoint(request)).length, 1);
    assert.equal(
      (await loadLearningProgressForPaper(12, 34))[0].understanding[0].status,
      "explained_unverified",
    );
  });

  it("restores source-bound goals across conversations and preserves unrelated goals", async function () {
    for (const target of ["Goal A", "Goal B"]) {
      const request = learningRequestFixture();
      await stageLearningProgress(request, {
        ...learningProgressFixture(),
        target,
      });
      await commitLearningCheckpoint(request);
    }
    const next = { ...learningRequestFixture(), conversationKey: 999 };
    await stageLearningProgress(next, {
      ...learningProgressFixture(),
      target: "Goal A",
      nextEntry: "Updated step",
    });
    await commitLearningCheckpoint(next);
    const records = await loadLearningProgressForPaper(12, 34);
    assert.equal(records.length, 2);
    assert.equal(
      records.find((entry) => entry.target === "Goal A")?.nextEntry,
      "Updated step",
    );
    assert.deepEqual(await loadLearningProgressForPaper(12, 35), []);
  });

  it("detects concurrent changes instead of overwriting another conversation", async function () {
    const first = learningRequestFixture();
    const second = { ...learningRequestFixture(), conversationKey: 999 };
    await stageLearningProgress(first, learningProgressFixture());
    await stageLearningProgress(second, {
      ...learningProgressFixture(),
      nextEntry: "Stale change",
    });
    await commitLearningCheckpoint(first);
    await assert.rejects(
      commitLearningCheckpoint(second),
      /another conversation/,
    );
    assert.equal(
      (await loadLearningProgressForPaper(12, 34))[0].nextEntry,
      "Trace the next stage",
    );
  });

  it("rejects changed sources and propagates database failures", async function () {
    const request = learningRequestFixture();
    await stageLearningProgress(request, learningProgressFixture());
    await commitLearningCheckpoint(request);
    const changed = learningProgressFixture();
    changed.source.fingerprint = "source-v2";
    await assert.rejects(stageLearningProgress(request, changed), /changed/);
    fixture.setFailure(true);
    await assert.rejects(setLearningMode(321, "guide"), /unavailable/);
    await assert.rejects(
      stageLearningProgress(request, learningProgressFixture()),
      /unavailable/,
    );
  });

  it("rejects corrupt stored state and missing stable identity", async function () {
    const missing = learningProgressFixture();
    delete missing.source.attachmentKey;
    await assert.rejects(
      stageLearningProgress(learningRequestFixture(), missing),
      /identity/,
    );
    await stageLearningProgress(
      learningRequestFixture(),
      learningProgressFixture(),
    );
    const corrupt = learningRequestFixture();
    await stageLearningProgress(corrupt, learningProgressFixture());
    await commitLearningCheckpoint(corrupt);
    const entry = [...fixture.progress.values()][0];
    entry.progress_json = "{broken";
    await assert.rejects(
      loadLearningProgressForPaper(12, 34),
      /JSON|Unexpected/,
    );
  });
});
