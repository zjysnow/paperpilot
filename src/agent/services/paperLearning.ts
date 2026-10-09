import type { QuoteCitation } from "../../shared/types";
import { validateObject } from "../tools/shared";

export type LearningSource = {
  itemId: number;
  contextItemId: number;
  title: string;
  coverage: string;
  missing: string[];
  fingerprint?: string;
  itemKey?: string;
  attachmentKey?: string;
  libraryID?: number;
};

export type GuidePoint = {
  kind: "author" | "inference" | "background" | "analogy";
  text: string;
  evidence: string[];
};

export type GuideVisual = {
  kind: "method" | "empirical" | "argument";
  title: string;
  nodes: Array<{ id: string; label: GuidePoint }>;
  edges: Array<{ from: string; to: string; label: GuidePoint }>;
};

export type PaperGuide = {
  version: 1;
  title: string;
  language: "en" | "zh";
  source: LearningSource;
  evidence: Array<{ id: string; quote: string; chunkIndex: number }>;
  thread: GuidePoint[];
  sections: Array<{
    id: string;
    title: string;
    learningGoal: string;
    points: GuidePoint[];
    visual?: GuideVisual;
  }>;
};

export type LearningProgress = {
  version: 1;
  source: LearningSource;
  target: string;
  location: string;
  explained: string[];
  understanding: Array<{
    point: string;
    status: "explained_unverified" | "partial" | "mastered";
    answer: string;
    reason: string;
  }>;
  gaps: string[];
  nextEntry: string;
};

export const MAX_LEARNING_RECORD_CHARS = 80_000;

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, field: string): Record<string, unknown> {
  requireValue(validateObject(value), `${field} must be an object`);
  return value;
}

function text(value: unknown, field: string, allowEmpty = false): string {
  requireValue(
    typeof value === "string" &&
      (allowEmpty || value.trim().length > 0) &&
      value.length <= 12_000,
    `${field} must be ${allowEmpty ? "a" : "a nonempty"} string of at most 12000 characters`,
  );
  return value;
}

function list(value: unknown, field: string, min = 0, max = 100): unknown[] {
  requireValue(
    Array.isArray(value) && value.length >= min && value.length <= max,
    `${field} must contain ${min}–${max} entries`,
  );
  return value;
}

function strings(value: unknown, field: string): string[] {
  return list(value, field).map((entry) => text(entry, field));
}

function integer(value: unknown, field: string, min = 1): number {
  requireValue(
    typeof value === "number" && Number.isSafeInteger(value) && value >= min,
    `${field} must be an integer >= ${min}`,
  );
  return value;
}

function identifier(value: unknown, field: string): string {
  const id = text(value, field);
  requireValue(/^[A-Za-z][A-Za-z0-9_-]{0,99}$/.test(id), `${field} is invalid`);
  return id;
}

function source(value: unknown): LearningSource {
  const raw = object(value, "source");
  return {
    itemId: integer(raw.itemId, "source.itemId"),
    contextItemId: integer(raw.contextItemId, "source.contextItemId"),
    title: text(raw.title, "source.title"),
    coverage: text(raw.coverage, "source.coverage"),
    missing: strings(raw.missing, "source.missing"),
    ...(raw.fingerprint !== undefined
      ? { fingerprint: text(raw.fingerprint, "source.fingerprint") }
      : {}),
    ...(raw.itemKey !== undefined
      ? { itemKey: text(raw.itemKey, "source.itemKey") }
      : {}),
    ...(raw.attachmentKey !== undefined
      ? { attachmentKey: text(raw.attachmentKey, "source.attachmentKey") }
      : {}),
    ...(raw.libraryID !== undefined
      ? { libraryID: integer(raw.libraryID, "source.libraryID") }
      : {}),
  };
}

function record(value: unknown): Record<string, unknown> {
  const raw = object(value, "record");
  requireValue(raw.version === 1, "Unsupported learning record version");
  requireValue(
    JSON.stringify(raw).length <= MAX_LEARNING_RECORD_CHARS,
    `Learning record exceeds ${MAX_LEARNING_RECORD_CHARS} characters`,
  );
  return raw;
}

export function parsePaperGuide(value: unknown): PaperGuide {
  const raw = record(value);
  requireValue(
    raw.language === "en" || raw.language === "zh",
    "language must be en or zh",
  );
  const evidenceIds = new Set<string>();
  const evidence = list(raw.evidence, "evidence", 1).map((entry) => {
    const item = object(entry, "evidence entry");
    const id = identifier(item.id, "evidence.id");
    requireValue(!evidenceIds.has(id), `Duplicate evidence ID: ${id}`);
    evidenceIds.add(id);
    return {
      id,
      quote: text(item.quote, "evidence.quote"),
      chunkIndex: integer(item.chunkIndex, "evidence.chunkIndex", 0),
    };
  });
  const point = (entry: unknown): GuidePoint => {
    const item = object(entry, "point");
    const kind = item.kind;
    requireValue(
      kind === "author" ||
        kind === "inference" ||
        kind === "background" ||
        kind === "analogy",
      "point.kind must be author, inference, background, or analogy",
    );
    const refs = strings(item.evidence, "point.evidence");
    requireValue(
      refs.every((id) => evidenceIds.has(id)),
      "Point references unknown evidence",
    );
    requireValue(
      (kind !== "author" && kind !== "inference") || refs.length > 0,
      "Author claims and inferences require evidence",
    );
    return { kind, text: text(item.text, "point.text"), evidence: refs };
  };
  const sectionIds = new Set<string>();
  const sections = list(raw.sections, "sections", 1, 30).map((entry) => {
    const item = object(entry, "section");
    const id = identifier(item.id, "section.id");
    requireValue(!sectionIds.has(id), `Duplicate section ID: ${id}`);
    sectionIds.add(id);
    let visual: GuideVisual | undefined;
    if (item.visual !== undefined) {
      const v = object(item.visual, "visual");
      const kind = v.kind;
      requireValue(
        kind === "method" || kind === "empirical" || kind === "argument",
        "visual.kind must be method, empirical, or argument",
      );
      const nodeIds = new Set<string>();
      const nodes = list(v.nodes, "visual.nodes", 2, 12).map((entry) => {
        const node = object(entry, "node");
        const nodeId = identifier(node.id, "node.id");
        requireValue(!nodeIds.has(nodeId), `Duplicate node ID: ${nodeId}`);
        nodeIds.add(nodeId);
        return { id: nodeId, label: point(node.label) };
      });
      const edges = list(v.edges, "visual.edges", 1, 24).map((entry) => {
        const edge = object(entry, "edge");
        const from = text(edge.from, "edge.from");
        const to = text(edge.to, "edge.to");
        requireValue(
          nodeIds.has(from) && nodeIds.has(to) && from !== to,
          "Edge endpoints must name distinct supplied nodes",
        );
        return { from, to, label: point(edge.label) };
      });
      requireValue(
        nodes.every((node) =>
          edges.some((edge) => edge.from === node.id || edge.to === node.id),
        ),
        "Every visual node must participate in an explicit relationship",
      );
      visual = { kind, title: text(v.title, "visual.title"), nodes, edges };
    }
    return {
      id,
      title: text(item.title, "section.title"),
      learningGoal: text(item.learningGoal, "section.learningGoal"),
      points: list(item.points, "section.points", 1).map(point),
      ...(visual ? { visual } : {}),
    };
  });
  requireValue(
    sections.some((section) => section.visual),
    "A paper guide requires at least one connected mechanism, study-design, or argument visual",
  );
  return {
    version: 1,
    title: text(raw.title, "title"),
    language: raw.language,
    source: source(raw.source),
    evidence,
    thread: list(raw.thread, "thread", 1).map(point),
    sections,
  };
}

export function parseLearningProgress(value: unknown): LearningProgress {
  const raw = record(value);
  const understanding = list(raw.understanding, "understanding").map(
    (entry): LearningProgress["understanding"][number] => {
      const item = object(entry, "understanding entry");
      const status = item.status;
      requireValue(
        status === "explained_unverified" ||
          status === "partial" ||
          status === "mastered",
        "Invalid understanding status",
      );
      const answer = text(item.answer, "understanding.answer", true);
      requireValue(
        status === "explained_unverified" || answer.trim().length > 0,
        "Partial/mastered understanding requires a supporting answer",
      );
      return {
        point: text(item.point, "understanding.point"),
        status,
        answer,
        reason: text(item.reason, "understanding.reason"),
      };
    },
  );
  return {
    version: 1,
    source: source(raw.source),
    target: text(raw.target, "target"),
    location: text(raw.location, "location"),
    explained: strings(raw.explained, "explained"),
    understanding,
    gaps: strings(raw.gaps, "gaps"),
    nextEntry: text(raw.nextEntry, "nextEntry"),
  };
}

export function verifyGuideEvidence(
  guide: PaperGuide,
  chunks: readonly string[],
): void {
  for (const evidence of guide.evidence) {
    requireValue(
      chunks[evidence.chunkIndex]?.includes(evidence.quote),
      `Evidence ${evidence.id} is not a literal quote in source chunk ${evidence.chunkIndex}`,
    );
  }
}

export function verifyLearningSource(
  saved: LearningSource,
  current: LearningSource,
): void {
  requireValue(
    saved.itemId === current.itemId &&
      saved.contextItemId === current.contextItemId &&
      (!saved.itemKey || saved.itemKey === current.itemKey) &&
      (!saved.attachmentKey || saved.attachmentKey === current.attachmentKey) &&
      (!saved.libraryID || saved.libraryID === current.libraryID),
    "Learning record belongs to a different paper or attachment",
  );
  requireValue(
    saved.fingerprint && saved.fingerprint === current.fingerprint,
    "Learning source is missing or changed; reread the source and start a reviewed learning record",
  );
}

export type GuideEvidenceCitation = {
  evidenceId: string;
  citation: QuoteCitation;
};
