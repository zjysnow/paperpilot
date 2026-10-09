import { strict as assert } from "node:assert";
import {
  MAX_LEARNING_RECORD_CHARS,
  parsePaperGuide,
  parseLearningProgress,
  verifyGuideEvidence,
  verifyLearningSource,
  type GuideEvidenceCitation,
  type PaperGuide,
  type LearningProgress,
} from "../src/agent/services/paperLearning";
import { renderPaperGuide } from "../src/agent/services/paperGuideRenderer";
import { createPaperLearningTool } from "../src/agent/tools/write/paperLearning";
import { AgentToolRegistry } from "../src/agent/tools/registry";
import { popUndoEntry, clearUndoStack } from "../src/agent/store/undoStore";
import { BUILTIN_SKILL_FILES } from "../src/agent/skills";
import { parseSkill } from "../src/agent/skills/skillLoader";
import {
  resolveSkillRouting,
  resolveSkillDirectiveText,
} from "../src/agent/skills/routing";
import { shouldContinuePaperTutor } from "../src/agent/skills/tutorContinuity";
import type { AgentToolContext } from "../src/agent/types";
import type { PdfContext } from "../src/modules/contextPanel/types";

const quote =
  "The experiment compares the proposed mechanism against the baseline under fixed conditions.";

function guide(): PaperGuide {
  const point = {
    kind: "author" as const,
    text: "The mechanism changes the intermediate representation.",
    evidence: ["e1"],
  };
  return {
    version: 1,
    title: "A source-grounded reading guide",
    language: "en",
    source: {
      itemId: 12,
      contextItemId: 34,
      title: "Mechanism Study",
      coverage: "Methods and results actually read",
      missing: ["Appendix not reviewed"],
    },
    evidence: [{ id: "e1", quote, chunkIndex: 0 }],
    thread: [point],
    sections: [
      {
        id: "mechanism",
        title: "How does it work?",
        learningGoal: "Trace the central mechanism",
        points: [point],
        visual: {
          kind: "method",
          title: "Central pipeline",
          nodes: [
            { id: "input", label: point },
            { id: "output", label: point },
          ],
          edges: [{ from: "input", to: "output", label: point }],
        },
      },
    ],
  };
}

function progress(): LearningProgress {
  return {
    version: 1,
    source: guide().source,
    target: "Trace the central mechanism",
    location: "Methods, first paragraph",
    explained: ["Intermediate representation"],
    understanding: [
      {
        point: "Role of the intermediate representation",
        status: "explained_unverified",
        answer: "",
        reason: "No reasoning answer yet",
      },
    ],
    gaps: ["Why the next step needs it"],
    nextEntry: "Check the downstream effect",
  };
}

function citations(): GuideEvidenceCitation[] {
  return [
    {
      evidenceId: "e1",
      citation: {
        id: "Q_native",
        quoteText: quote,
        citationLabel: "(Author, 2025)",
        itemId: 12,
        contextItemId: 34,
      },
    },
  ];
}

describe("paper learning contracts and offline rendering", function () {
  it("validates method, empirical and theoretical guides without inventing connections", function () {
    for (const kind of ["method", "empirical", "argument"] as const) {
      const g = guide();
      g.sections[0].visual!.kind = kind;
      assert.equal(parsePaperGuide(g).sections[0].visual?.kind, kind);
      verifyGuideEvidence(g, [quote]);
      const html = renderPaperGuide(g, citations());
      assert.match(html, /<svg/);
      assert.match(html, /marker-end="url\(#arrow-0\)"/);
      assert.match(html, /input → output/);
      assert.match(html, /\/paper-tutor/);
      assert.match(html, /Appendix not reviewed/);
    }
  });

  it("rejects unsupported versions, detached claims, duplicate IDs and malformed graphs", function () {
    assert.throws(() => parsePaperGuide({ ...guide(), version: 2 }), /version/);
    const detached = guide();
    detached.thread[0].evidence = [];
    assert.throws(() => parsePaperGuide(detached), /require evidence/);
    detached.thread[0].evidence = ["missing"];
    assert.throws(() => parsePaperGuide(detached), /unknown evidence/);
    const duplicate = guide();
    duplicate.evidence.push({ ...duplicate.evidence[0] });
    assert.throws(() => parsePaperGuide(duplicate), /Duplicate evidence/);
    const malformed = guide();
    malformed.sections[0].visual!.edges[0].to = "unknown";
    assert.throws(() => parsePaperGuide(malformed), /endpoints/);
    const unconnected = guide();
    unconnected.sections[0].visual!.nodes.push({
      id: "orphan",
      label: unconnected.thread[0],
    });
    assert.throws(() => parsePaperGuide(unconnected), /explicit relationship/);
    const noVisual = guide();
    delete noVisual.sections[0].visual;
    assert.throws(
      () => parsePaperGuide(noVisual),
      /requires at least one connected/,
    );
  });

  it("checks literal quotes against the actual chunk, not model-supplied source text", function () {
    assert.throws(
      () => verifyGuideEvidence(guide(), ["Different source"]),
      /not a literal quote/,
    );
    const g = guide();
    g.evidence[0].chunkIndex = 5;
    assert.throws(() => verifyGuideEvidence(g, [quote]), /chunk 5/);
    assert.throws(
      () =>
        parsePaperGuide({
          ...guide(),
          evidence: [{ id: "e1", quote, chunkIndex: -1 }],
        }),
      /integer/,
    );
  });

  it("requires answer evidence for partial/mastered records and preserves unverified status", function () {
    assert.equal(
      parseLearningProgress(progress()).understanding[0].status,
      "explained_unverified",
    );
    for (const status of ["partial", "mastered"] as const) {
      const p = progress();
      p.understanding[0].status = status;
      assert.throws(() => parseLearningProgress(p), /supporting answer/);
      p.understanding[0].answer =
        "Step one supplies the representation consumed by step two.";
      assert.equal(parseLearningProgress(p).understanding[0].status, status);
    }
  });

  it("bounds records and refuses changed or different sources", function () {
    const p = progress();
    assert.throws(
      () =>
        parseLearningProgress({
          ...p,
          extra: "x".repeat(MAX_LEARNING_RECORD_CHARS),
        }),
      /exceeds/,
    );
    const saved = { ...p.source, fingerprint: "version-a" };
    verifyLearningSource(saved, { ...saved });
    assert.throws(
      () => verifyLearningSource(saved, { ...saved, itemId: 99 }),
      /different paper/,
    );
    assert.throws(
      () => verifyLearningSource(saved, { ...saved, fingerprint: "version-b" }),
      /changed/,
    );
    assert.throws(
      () => verifyLearningSource(p.source, saved),
      /missing or changed/,
    );
  });

  it("renders offline MathML, escapes model content, and embeds reusable structured data", function () {
    const g = guide();
    g.title = "</script><img src=x onerror=alert(1)>";
    g.thread[0].text = "Scale by \\(1/\\sqrt{d}\\). <script>bad()</script>";
    const html = renderPaperGuide(g, citations());
    assert.match(html, /<math/);
    assert.doesNotMatch(html, /<img src=x|<script>bad/);
    assert.match(html, /&lt;script&gt;bad/);
    assert.match(html, /\\u003c\/script>/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@font-face/);
    assert.match(html, /evidence-Q_native/);
    assert.match(html, /element\.open = true/);
    const payload =
      /<script type="application\/json" id="paperpilot-guide">([\s\S]*?)<\/script>/.exec(
        html,
      );
    assert.ok(payload);
    assert.equal(JSON.parse(payload[1]).guide.title, g.title);
    assert.throws(() => renderPaperGuide(g, []), /Missing native citation/);
    g.thread[0].text = "\\(\\badCommand\\)";
    assert.throws(
      () => renderPaperGuide(g, citations()),
      /Undefined control sequence/,
    );
  });
});

describe("learning Skills and Tutor continuity", function () {
  const skills = [
    "simple-paper-qa.md",
    "evidence-based-qa.md",
    "paper-guide.md",
    "paper-tutor.md",
  ].map((name) => parseSkill(BUILTIN_SKILL_FILES[name]));
  const paperContext = {
    itemId: 12,
    contextItemId: 34,
    title: "Mechanism Study",
  };

  it("ships manual Skills and keeps ordinary summaries lightweight", function () {
    for (const id of ["paper-guide", "paper-tutor"]) {
      const skill = skills.find((entry) => entry.id === id)!;
      assert.equal(skill.activation, "manual");
      assert.deepEqual(skill.contexts, ["single-paper"]);
      assert.equal(
        resolveSkillDirectiveText(`/${id} Explain this paper`, skills)
          .forcedSkillId,
        id,
      );
    }
    const result = resolveSkillRouting(
      {
        userText: "Summarize this paper",
        selectedPaperContexts: [paperContext],
      },
      skills,
      ["simple-paper-qa", "paper-guide", "paper-tutor"],
    );
    assert.deepEqual(result.matchedSkillIds, ["simple-paper-qa"]);
  });

  it("suppresses conflicting lightweight read budgets only for explicit learning", function () {
    const result = resolveSkillRouting(
      {
        userText: "Explain this paper and how its mechanism works",
        forcedSkillIds: ["paper-guide"],
        selectedPaperContexts: [paperContext],
      },
      skills,
      ["simple-paper-qa", "evidence-based-qa"],
    );
    assert.deepEqual(result.matchedSkillIds, ["paper-guide"]);
    const both = resolveSkillRouting(
      {
        userText: "Explain this paper",
        forcedSkillIds: ["paper-guide", "simple-paper-qa"],
      },
      skills,
      [],
    );
    assert.ok(both.matchedSkillIds.includes("simple-paper-qa"));
  });

  it("continues teaching for answers but exits after pause or another Skill", function () {
    const history = [
      {
        role: "user" as const,
        content: "Context\n\nUser request:\n$paper-tutor\nTeach the mechanism",
      },
      {
        role: "assistant" as const,
        content: "Which step supplies this representation?",
      },
      { role: "user" as const, content: "The projection step." },
    ];
    assert.equal(shouldContinuePaperTutor(history), true);
    assert.equal(shouldContinuePaperTutor(history, ["write-note"]), false);
    assert.equal(
      shouldContinuePaperTutor([
        ...history,
        { role: "user", content: "暂停并保存进度" },
      ]),
      false,
    );
    assert.equal(
      shouldContinuePaperTutor([
        { role: "user", content: "$paper-tutor\nPause and save progress." },
      ]),
      false,
    );
    assert.equal(
      shouldContinuePaperTutor([
        ...history,
        { role: "user", content: "$paper-guide\nCreate a guide" },
      ]),
      false,
    );
    assert.equal(
      shouldContinuePaperTutor([
        { role: "assistant", content: "$paper-tutor" },
      ]),
      false,
    );
    assert.equal(shouldContinuePaperTutor([]), false);
  });

  it("continues a menu-selected Tutor and exits after another menu selection", function () {
    const history = [
      {
        role: "user" as const,
        content: "User request:\nTeach the mechanism.",
        forcedSkillIds: ["paper-tutor"],
      },
      { role: "user" as const, content: "The projection step." },
    ];
    assert.equal(shouldContinuePaperTutor(history), true);
    assert.equal(
      shouldContinuePaperTutor([
        ...history,
        {
          role: "user",
          content: "User request:\nCreate a guide.",
          forcedSkillIds: ["paper-guide"],
        },
      ]),
      false,
    );
    assert.equal(
      shouldContinuePaperTutor([
        ...history,
        {
          role: "user",
          content: "User request:\nPause and save progress.",
          forcedSkillIds: ["paper-tutor"],
        },
      ]),
      false,
    );
  });
});

describe("paper_learning tool persistence and approval", function () {
  const globals = globalThis as typeof globalThis & { IOUtils?: unknown };
  const previousIO = globals.IOUtils;
  const files = new Map<string, string>();
  let chunks: string[];
  let fingerprint: string;
  let readable: boolean;
  const paperContext = {
    itemId: 12,
    contextItemId: 34,
    title: "Mechanism Study",
    firstCreator: "Author",
    year: "2025",
  };
  const tool = createPaperLearningTool({
    pdfService: {
      async ensurePaperContext(): Promise<PdfContext | undefined> {
        if (!readable) return undefined;
        return {
          title: paperContext.title,
          chunks,
          chunkMeta: chunks.map((text, chunkIndex) => ({
            chunkIndex,
            text,
            normalizedText: text,
            chunkKind: "methods",
            sectionLabel: "Methods",
            sourceFingerprint: fingerprint,
          })),
          chunkStats: [],
          docFreq: {},
          avgChunkLength: 0,
          fullLength: chunks.join("").length,
        };
      },
    },
    zoteroGateway: {
      resolvePaperContextTarget: ({ itemId, contextItemId }) =>
        itemId === 12 && contextItemId === 34 ? paperContext : null,
      getItem: (id) =>
        ({
          id,
          key: id === 12 ? "PAPERKEY" : "PDFKEY",
          libraryID: 1,
        }) as Zotero.Item,
    },
  });
  const registry = new AgentToolRegistry();
  registry.register(tool);
  const context = (): AgentToolContext => ({
    request: {
      conversationKey: 301,
      mode: "agent",
      userText: "Save learning progress",
      libraryID: 1,
      selectedPaperContexts: [paperContext],
    },
    item: null,
    currentAnswerText: "",
    modelName: "test",
  });

  it("rejects external MCP database checkpoints instead of silently losing staged state", async function () {
    const input = tool.validate({ mode: "progress", record: progress() });
    assert.equal(input.ok, true);
    if (!input.ok) throw new Error(input.error);
    await assert.rejects(
      tool.execute(input.value, context()),
      /managed Agent turn/,
    );
  });

  beforeEach(function () {
    chunks = [quote];
    fingerprint = "source-v1";
    readable = true;
    files.clear();
    clearUndoStack(301);
    globals.IOUtils = {
      exists: async (path: string) => files.has(path),
      read: async (path: string) => {
        if (!files.has(path)) throw new Error("File not found");
        return new TextEncoder().encode(files.get(path)!);
      },
      write: async (path: string, bytes: Uint8Array) =>
        files.set(path, new TextDecoder().decode(bytes)),
      makeDirectory: async () => undefined,
      remove: async (path: string) => files.delete(path),
    };
  });
  after(function () {
    globals.IOUtils = previousIO;
    clearUndoStack(301);
  });

  async function save(
    mode: "guide" | "progress",
    filePath: string,
    record: PaperGuide | LearningProgress,
  ) {
    const prepared = await registry.prepareExecution(
      {
        id: "learning-save",
        name: "paper_learning",
        arguments: { mode, filePath, record },
      },
      context(),
    );
    assert.equal(prepared.kind, "confirmation");
    if (prepared.kind !== "confirmation")
      throw new Error("Expected write confirmation");
    assert.equal(files.size, 0);
    return prepared.execute();
  }

  it("rejects wrong extensions, relative paths and model-supplied overwrite permission", function () {
    assert.equal(
      tool.validate({
        mode: "progress",
        filePath: "./progress.json",
        record: progress(),
      }).ok,
      false,
    );
    assert.equal(
      tool.validate({
        mode: "guide",
        filePath: "/workspace/guide.json",
        record: guide(),
      }).ok,
      false,
    );
    const input = tool.validate({
      mode: "progress",
      filePath: "/workspace/progress.json",
      record: progress(),
      allowOverwrite: true,
    });
    assert.ok(input.ok);
    if (input.ok && input.value.mode !== "resume")
      assert.equal(input.value.allowOverwrite, undefined);
  });

  it("exports a source-checked guide with native quotes after approval and supports undo", async function () {
    const execution = await save("guide", "/workspace/guide.html", guide());
    assert.equal(execution.result.ok, true);
    const content = execution.result.content as {
      quoteCitations: Array<{ id: string }>;
      source: { fingerprint: string };
    };
    assert.equal(content.source.fingerprint, "source-v1");
    assert.match(content.quoteCitations[0].id, /^Q_/);
    assert.match(files.get("/workspace/guide.html")!, /<svg/);
    assert.equal(
      execution.result.artifacts?.[0].storedPath,
      "/workspace/guide.html",
    );
    await popUndoEntry(301)!.revert();
    assert.equal(files.has("/workspace/guide.html"), false);
  });

  it("saves identity-bound progress and resumes it in another conversation without upgrading status", async function () {
    const execution = await save(
      "progress",
      "/workspace/progress.json",
      progress(),
    );
    assert.equal(execution.result.ok, true);
    const saved = JSON.parse(files.get("/workspace/progress.json")!);
    assert.equal(saved.source.itemKey, "PAPERKEY");
    assert.equal(saved.source.attachmentKey, "PDFKEY");
    assert.equal(saved.source.fingerprint, "source-v1");
    const ctx = context();
    ctx.request.conversationKey = 999;
    const prepared = await registry.prepareExecution(
      {
        id: "resume",
        name: "paper_learning",
        arguments: { mode: "resume", filePath: "/workspace/progress.json" },
      },
      ctx,
    );
    assert.equal(prepared.kind, "result");
    if (prepared.kind !== "result") return;
    assert.equal(prepared.execution.result.ok, true);
    const resumed = prepared.execution.result.content as {
      progress: LearningProgress;
      guidance: string;
    };
    assert.equal(
      resumed.progress.understanding[0].status,
      "explained_unverified",
    );
    assert.match(resumed.guidance, /Reread/);
  });

  it("reports unavailable or changed source, wrong selections and corrupt records without changing saved progress", async function () {
    await save("progress", "/workspace/progress.json", progress());
    const before = files.get("/workspace/progress.json");
    const resume = async (ctx = context()) => {
      const prepared = await registry.prepareExecution(
        {
          id: "resume",
          name: "paper_learning",
          arguments: { mode: "resume", filePath: "/workspace/progress.json" },
        },
        ctx,
      );
      assert.equal(prepared.kind, "result");
      if (prepared.kind !== "result")
        throw new Error("Unexpected confirmation");
      return prepared.execution.result;
    };
    fingerprint = "source-v2";
    assert.equal((await resume()).ok, false);
    readable = false;
    assert.match(
      JSON.stringify((await resume()).content),
      /No readable source/,
    );
    readable = true;
    const ctx = context();
    ctx.request.selectedPaperContexts = [{ ...paperContext, itemId: 77 }];
    assert.match(
      JSON.stringify((await resume(ctx)).content),
      /Select the learning record/,
    );
    assert.equal(files.get("/workspace/progress.json"), before);
    files.set("/workspace/progress.json", "{not JSON");
    assert.equal((await resume()).ok, false);
    files.set(
      "/workspace/progress.json",
      "x".repeat(MAX_LEARNING_RECORD_CHARS + 50),
    );
    assert.match(JSON.stringify((await resume()).content), /truncated/);
  });

  it("rejects fabricated evidence and invalid math before creating files", async function () {
    chunks = ["Unrelated text"];
    const execution = await save("guide", "/workspace/guide.html", guide());
    assert.equal(execution.result.ok, false);
    assert.equal(files.size, 0);
    chunks = [quote];
    const invalid = guide();
    invalid.thread[0].text = "\\(\\badCommand\\)";
    assert.equal(
      (await save("guide", "/workspace/guide.html", invalid)).result.ok,
      false,
    );
    assert.equal(files.size, 0);
  });

  it("refuses to overwrite progress for another target and restores reviewed updates with undo", async function () {
    await save("progress", "/workspace/progress.json", progress());
    const before = files.get("/workspace/progress.json")!;
    const different = progress();
    different.target = "A different concept";
    const prepared = await registry.prepareExecution(
      {
        id: "update",
        name: "paper_learning",
        arguments: {
          mode: "progress",
          filePath: "/workspace/progress.json",
          record: different,
        },
      },
      context(),
    );
    assert.equal(prepared.kind, "confirmation");
    if (prepared.kind !== "confirmation") return;
    assert.equal((await prepared.execute()).result.ok, false);
    assert.equal(files.get("/workspace/progress.json"), before);
    const updated = progress();
    updated.gaps = [];
    const next = await registry.prepareExecution(
      {
        id: "update",
        name: "paper_learning",
        arguments: {
          mode: "progress",
          filePath: "/workspace/progress.json",
          record: updated,
        },
      },
      context(),
    );
    if (next.kind !== "confirmation")
      throw new Error("Expected overwrite confirmation");
    assert.equal((await next.execute()).result.ok, true);
    assert.deepEqual(
      JSON.parse(files.get("/workspace/progress.json")!).gaps,
      [],
    );
    await popUndoEntry(301)!.revert();
    assert.equal(files.get("/workspace/progress.json"), before);
  });

  it("keeps denied writes and failed filesystem operations explicit", async function () {
    const prepared = await registry.prepareExecution(
      {
        id: "deny",
        name: "paper_learning",
        arguments: {
          mode: "progress",
          filePath: "/workspace/progress.json",
          record: progress(),
        },
      },
      context(),
    );
    if (prepared.kind !== "confirmation")
      throw new Error("Expected confirmation");
    assert.equal(prepared.deny().result.ok, false);
    assert.equal(files.size, 0);
    globals.IOUtils = {
      exists: async () => false,
      read: async () => {
        throw new Error("File not found");
      },
      write: async () => {
        throw new Error("Write denied");
      },
    };
    assert.equal(
      (await save("progress", "/workspace/progress.json", progress())).result
        .ok,
      false,
    );
    assert.equal(files.size, 0);
  });
});
