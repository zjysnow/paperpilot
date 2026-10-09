import {
  parseLearningProgress,
  verifyLearningSource,
  type LearningProgress,
} from "../services/paperLearning";
import type { LearningNoteBinding } from "../services/learningNoteSync";
import type { AgentRuntimeRequest } from "../types";

import type { LearningMode } from "../../shared/types";
export type { LearningMode } from "../../shared/types";
type Db = {
  queryAsync(sql: string, params?: unknown[]): Promise<unknown>;
  executeTransaction(callback: () => Promise<void>): Promise<unknown>;
};
export type LearningCheckpoint = {
  progress: LearningProgress;
  revision: number;
};
const modes = new Map<number, LearningMode>();
const modeSaves = new Map<number, Promise<void>>();
const pending = new WeakMap<
  AgentRuntimeRequest,
  Map<string, LearningCheckpoint>
>();
const pendingBindings = new WeakMap<
  AgentRuntimeRequest,
  { sourceKey: string; binding: LearningNoteBinding }
>();
const managedTurns = new WeakSet<AgentRuntimeRequest>();
let initializedDb: Db | undefined;
let initialization: Promise<void> | undefined;

function database(): Db {
  const db = (globalThis as typeof globalThis & { Zotero?: { DB?: Db } }).Zotero
    ?.DB;
  if (!db) throw new Error("Learning state database is unavailable");
  return db;
}

async function ready(): Promise<Db> {
  const db = database();
  if (db !== initializedDb) {
    initializedDb = db;
    initialization = undefined;
    modes.clear();
  }
  if (!initialization) {
    initialization = (async () => {
      await db.queryAsync(
        "CREATE TABLE IF NOT EXISTS paperpilot_learning_modes (conversation_key INTEGER PRIMARY KEY, mode TEXT NOT NULL)",
      );
      await db.queryAsync(
        "CREATE TABLE IF NOT EXISTS paperpilot_learning_progress (source_key TEXT NOT NULL, target TEXT NOT NULL, item_id INTEGER NOT NULL, attachment_id INTEGER NOT NULL, progress_json TEXT NOT NULL, revision INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(source_key, target))",
      );
      await db.queryAsync(
        "CREATE TABLE IF NOT EXISTS paperpilot_learning_notes (source_key TEXT PRIMARY KEY, file_path TEXT NOT NULL, managed_block TEXT NOT NULL)",
      );
    })().catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  }
  await initialization;
  return db;
}

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value))
    throw new Error("Learning database returned invalid rows");
  return value.map((row: unknown) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error("Learning database returned an invalid row");
    }
    return row as Record<string, unknown>;
  });
}

export function learningSourceKey(source: LearningProgress["source"]): string {
  if (
    !source.libraryID ||
    !source.itemKey ||
    !source.attachmentKey ||
    !source.fingerprint
  ) {
    throw new Error(
      "Learning state needs verified paper and attachment identity",
    );
  }
  return `${source.libraryID}:${source.itemKey}:${source.attachmentKey}`;
}

export function getCachedLearningMode(conversationKey: number): LearningMode {
  return modes.get(conversationKey) || "normal";
}

export async function loadLearningMode(
  conversationKey: number,
): Promise<LearningMode> {
  if (!Number.isSafeInteger(conversationKey))
    throw new Error("Invalid learning conversation");
  await modeSaves.get(conversationKey);
  const db = await ready();
  const cached = modes.get(conversationKey);
  if (cached) return cached;
  const result = rows(
    await db.queryAsync(
      "SELECT mode FROM paperpilot_learning_modes WHERE conversation_key = ?",
      [conversationKey],
    ),
  );
  const updated = modes.get(conversationKey);
  if (updated) return updated;
  const value = result[0]?.mode ?? "normal";
  if (value !== "normal" && value !== "guide" && value !== "tutor") {
    throw new Error("Stored learning mode is invalid");
  }
  modes.set(conversationKey, value);
  return value;
}

export async function setLearningMode(
  conversationKey: number,
  mode: LearningMode,
): Promise<void> {
  if (!Number.isSafeInteger(conversationKey))
    throw new Error("Invalid learning conversation");
  if (mode !== "normal" && mode !== "guide" && mode !== "tutor")
    throw new Error("Invalid learning mode");
  const previous = modeSaves.get(conversationKey);
  const operation = (async () => {
    await previous;
    const db = await ready();
    await db.queryAsync(
      "INSERT INTO paperpilot_learning_modes (conversation_key, mode) VALUES (?, ?) ON CONFLICT(conversation_key) DO UPDATE SET mode = excluded.mode",
      [conversationKey, mode],
    );
    modes.set(conversationKey, mode);
  })();
  modeSaves.set(conversationKey, operation);
  try {
    await operation;
  } finally {
    if (modeSaves.get(conversationKey) === operation)
      modeSaves.delete(conversationKey);
  }
}

export async function loadLearningProgressForPaper(
  itemId: number,
  attachmentId: number,
): Promise<LearningProgress[]> {
  const db = await ready();
  return rows(
    await db.queryAsync(
      "SELECT progress_json FROM paperpilot_learning_progress WHERE item_id = ? AND attachment_id = ? ORDER BY updated_at DESC, target",
      [itemId, attachmentId],
    ),
  ).map((row) => {
    if (typeof row.progress_json !== "string")
      throw new Error("Stored learning progress is invalid");
    return parseLearningProgress(JSON.parse(row.progress_json));
  });
}

export async function loadLearningProgressBySourceKey(
  sourceKey: string,
): Promise<LearningProgress[]> {
  const db = await ready();
  return rows(
    await db.queryAsync(
      "SELECT progress_json FROM paperpilot_learning_progress WHERE source_key = ? ORDER BY updated_at DESC, target",
      [sourceKey],
    ),
  ).map((row) => {
    if (typeof row.progress_json !== "string")
      throw new Error("Stored learning progress is invalid");
    return parseLearningProgress(JSON.parse(row.progress_json));
  });
}

export async function stageLearningProgress(
  request: AgentRuntimeRequest,
  progress: LearningProgress,
): Promise<void> {
  const normalized = parseLearningProgress(progress);
  const sourceKey = learningSourceKey(normalized.source);
  const db = await ready();
  const result = rows(
    await db.queryAsync(
      "SELECT revision, progress_json FROM paperpilot_learning_progress WHERE source_key = ? AND target = ?",
      [sourceKey, normalized.target],
    ),
  );
  if (result[0]) {
    if (typeof result[0].progress_json !== "string")
      throw new Error("Stored learning progress is invalid");
    verifyLearningSource(
      parseLearningProgress(JSON.parse(result[0].progress_json)).source,
      normalized.source,
    );
  }
  const revision = result[0]?.revision ?? 0;
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  ) {
    throw new Error("Stored learning revision is invalid");
  }
  const checkpoints =
    pending.get(request) || new Map<string, LearningCheckpoint>();
  const key = JSON.stringify([sourceKey, normalized.target]);
  const existing = checkpoints.get(key);
  checkpoints.set(key, {
    progress: normalized,
    revision: existing?.revision ?? revision,
  });
  pending.set(request, checkpoints);
}

export function hasLearningCheckpoint(request: AgentRuntimeRequest): boolean {
  return Boolean(pending.get(request)?.size);
}

export function beginLearningTurn(request: AgentRuntimeRequest): void {
  managedTurns.add(request);
}

export function isManagedLearningTurn(request: AgentRuntimeRequest): boolean {
  return managedTurns.has(request);
}

export function clearLearningModeCache(): void {
  modes.clear();
}

export function discardLearningCheckpoint(request: AgentRuntimeRequest): void {
  managedTurns.delete(request);
  pending.delete(request);
  pendingBindings.delete(request);
}

export async function commitLearningCheckpoint(
  request: AgentRuntimeRequest,
): Promise<LearningProgress[]> {
  const checkpoints = [...(pending.get(request)?.values() || [])];
  if (!checkpoints.length) return [];
  const db = await ready();
  await db.executeTransaction(async () => {
    for (const { progress, revision } of checkpoints) {
      const key = learningSourceKey(progress.source);
      const actual = rows(
        await db.queryAsync(
          "SELECT revision FROM paperpilot_learning_progress WHERE source_key = ? AND target = ?",
          [key, progress.target],
        ),
      );
      if ((actual[0]?.revision ?? 0) !== revision) {
        throw new Error(
          "Learning state changed in another conversation; reload progress before updating",
        );
      }
      await db.queryAsync(
        "INSERT INTO paperpilot_learning_progress (source_key, target, item_id, attachment_id, progress_json, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(source_key, target) DO UPDATE SET progress_json = excluded.progress_json, revision = excluded.revision, updated_at = excluded.updated_at, item_id = excluded.item_id, attachment_id = excluded.attachment_id",
        [
          key,
          progress.target,
          progress.source.itemId,
          progress.source.contextItemId,
          JSON.stringify(progress),
          revision + 1,
          Date.now(),
        ],
      );
    }
  });
  pending.delete(request);
  return checkpoints.map((entry) => entry.progress);
}

export async function loadLearningNoteBinding(
  sourceKey: string,
): Promise<LearningNoteBinding | null> {
  const db = await ready();
  const row = rows(
    await db.queryAsync(
      "SELECT file_path, managed_block FROM paperpilot_learning_notes WHERE source_key = ?",
      [sourceKey],
    ),
  )[0];
  if (!row) return null;
  if (
    typeof row.file_path !== "string" ||
    typeof row.managed_block !== "string"
  ) {
    throw new Error("Stored learning note binding is invalid");
  }
  return { filePath: row.file_path, managedBlock: row.managed_block };
}

export async function saveLearningNoteBinding(
  sourceKey: string,
  binding: LearningNoteBinding,
): Promise<void> {
  const db = await ready();
  await db.queryAsync(
    "INSERT INTO paperpilot_learning_notes (source_key, file_path, managed_block) VALUES (?, ?, ?) ON CONFLICT(source_key) DO UPDATE SET file_path = excluded.file_path, managed_block = excluded.managed_block",
    [sourceKey, binding.filePath, binding.managedBlock],
  );
}

export function stageLearningNoteBinding(
  request: AgentRuntimeRequest,
  sourceKey: string,
  binding: LearningNoteBinding,
): void {
  pendingBindings.set(request, { sourceKey, binding });
}

export function takeLearningNoteBinding(
  request: AgentRuntimeRequest,
): { sourceKey: string; binding: LearningNoteBinding } | undefined {
  const binding = pendingBindings.get(request);
  pendingBindings.delete(request);
  return binding;
}
