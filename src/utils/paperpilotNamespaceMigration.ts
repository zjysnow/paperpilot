import { config } from "../../package.json";
import { joinLocalPath } from "./localPath";
import { parseSkill } from "../agent/skills/skillLoader";
import {
  getCanonicalSkillDir,
  getCanonicalSkillFilePath,
  getCanonicalUserSkillsDir,
  getSkillStorageBaseDir,
  NATIVE_SKILL_FILE_NAME,
} from "../agent/skills/nativeSkillPaths";
import {
  MANAGED_BEGIN_MARKER,
  MANAGED_END_MARKER,
} from "../agent/skills/managedBlock";

// Old names are confined to this upgrade bridge, never used by active stores.
const LEGACY_TABLE_PREFIX = "llm_for_zotero_";
const LEGACY_SKILL_DIRECTORY = "llm-for-zotero";
const LEGACY_BEGIN_MARKER = "<!-- LLM-FOR-ZOTERO:MANAGED-BEGIN -->";
const LEGACY_END_MARKER = "<!-- LLM-FOR-ZOTERO:MANAGED-END -->";

type MigrationDatabase = {
  queryAsync: (sql: string, params?: unknown[]) => Promise<unknown>;
  executeTransaction: <T>(callback: () => Promise<T>) => Promise<T>;
};

type SchemaObject = {
  type: string;
  name: string;
  sql: string | null;
};

function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export async function migratePaperpilotDatabaseNamespace(
  db: MigrationDatabase = Zotero.DB,
): Promise<void> {
  await db.executeTransaction(async () => {
    const objects = (await db.queryAsync(
      "SELECT type, name, sql FROM sqlite_master WHERE type IN ('table', 'index')",
    )) as SchemaObject[];
    const legacyObjects = objects.filter((entry) =>
      entry.name.startsWith(LEGACY_TABLE_PREFIX),
    );
    const names = new Set(objects.map((entry) => entry.name));
    for (const entry of legacyObjects) {
      const target = `paperpilot_${entry.name.slice(LEGACY_TABLE_PREFIX.length)}`;
      if (names.has(target)) {
        throw new Error(
          `Paper Pilot namespace migration conflict: ${target} already exists. No legacy data was changed.`,
        );
      }
    }

    for (const entry of legacyObjects.filter(
      (entry) => entry.type === "table",
    )) {
      const target = `paperpilot_${entry.name.slice(LEGACY_TABLE_PREFIX.length)}`;
      await db.queryAsync(
        `ALTER TABLE ${quoteIdentifier(entry.name)} RENAME TO ${quoteIdentifier(target)}`,
      );
    }

    // Re-read index SQL after SQLite has rewritten its table references.
    const indexes = (await db.queryAsync(
      "SELECT type, name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL",
    )) as SchemaObject[];
    for (const entry of indexes) {
      if (!entry.name.startsWith(LEGACY_TABLE_PREFIX) || !entry.sql) continue;
      const target = `paperpilot_${entry.name.slice(LEGACY_TABLE_PREFIX.length)}`;
      await db.queryAsync(`DROP INDEX ${quoteIdentifier(entry.name)}`);
      await db.queryAsync(entry.sql.replace(entry.name, target));
    }
  });
}

export function migratePaperpilotPreferences(): void {
  const keys = [
    ["extensions.zotero.llmForZotero.skillBodyHashes", "skillBodyHashes"],
    [
      "extensions.zotero.llmForZotero.seededBuiltinSkills",
      "seededBuiltinSkills",
    ],
    ["extensions.zotero.llmforzotero.pdftoppmPath", "pdftoppmPath"],
    [
      "extensions.zotero.llmforzotero.popplerPdftoppmPath",
      "popplerPdftoppmPath",
    ],
    ["llmforzotero.pdftoppmPath", "pdftoppmPath"],
  ];
  for (const [source, key] of keys) {
    const target = `${config.prefsPrefix}.${key}`;
    if (Zotero.Prefs.get(target, true) !== undefined) continue;
    const value = Zotero.Prefs.get(source, true);
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      Zotero.Prefs.set(target, value, true);
    }
  }
}

type SkillMigrationIO = {
  exists?: (path: string) => Promise<boolean>;
  read?: (path: string) => Promise<Uint8Array | ArrayBuffer>;
  write?: (path: string, data: Uint8Array) => Promise<number>;
  getChildren?: (path: string) => Promise<string[]>;
  makeDirectory?: (
    path: string,
    options?: { createAncestors?: boolean; ignoreExisting?: boolean },
  ) => Promise<void>;
};

function migrateSkillMarkers(raw: string): string {
  if (raw.includes(MANAGED_BEGIN_MARKER)) return raw;
  const begin = raw.indexOf(LEGACY_BEGIN_MARKER);
  const end = raw.indexOf(LEGACY_END_MARKER);
  if (begin < 0 || end <= begin) return raw;
  return (
    raw.slice(0, begin) +
    MANAGED_BEGIN_MARKER +
    raw.slice(begin + LEGACY_BEGIN_MARKER.length, end) +
    MANAGED_END_MARKER +
    raw.slice(end + LEGACY_END_MARKER.length)
  );
}

export async function migratePaperpilotSkills(
  io: SkillMigrationIO,
  obsoleteFilenames: ReadonlySet<string>,
  obsoleteIDs: ReadonlySet<string>,
): Promise<string[]> {
  if (
    !io.exists ||
    !io.read ||
    !io.write ||
    !io.getChildren ||
    !io.makeDirectory
  )
    return [];
  const migrationKey = `${config.prefsPrefix}.migrationSkillNamespaceV1Done`;
  if (Zotero.Prefs.get(migrationKey, true)) return [];
  const migrated: string[] = [];
  const legacyDir = joinLocalPath(
    getSkillStorageBaseDir(),
    LEGACY_SKILL_DIRECTORY,
    "skills",
  );
  if (await io.exists(legacyDir)) {
    for (const path of await io.getChildren(legacyDir)) {
      const filename = path.split(/[/\\]/).pop() || "";
      if (!filename.endsWith(".md") || obsoleteFilenames.has(filename))
        continue;
      const raw = new TextDecoder().decode(await io.read(path));
      const skill = parseSkill(raw);
      if (
        skill.id === "unknown" ||
        !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(skill.id) ||
        obsoleteIDs.has(skill.id)
      ) {
        Zotero.debug(`[Paper Pilot] Skipping invalid legacy skill: ${path}`);
        continue;
      }
      const target = getCanonicalSkillFilePath(skill.id);
      if (await io.exists(target)) continue;
      await io.makeDirectory(getCanonicalSkillDir(skill.id), {
        createAncestors: true,
        ignoreExisting: true,
      });
      await io.write(
        target,
        new TextEncoder().encode(migrateSkillMarkers(raw)),
      );
      migrated.push(filename);
    }
  }

  const canonicalDir = getCanonicalUserSkillsDir();
  if (await io.exists(canonicalDir)) {
    for (const child of await io.getChildren(canonicalDir)) {
      const path = joinLocalPath(child, NATIVE_SKILL_FILE_NAME);
      if (!(await io.exists(path))) continue;
      const raw = new TextDecoder().decode(await io.read(path));
      const next = migrateSkillMarkers(raw);
      if (next !== raw) await io.write(path, new TextEncoder().encode(next));
    }
  }
  Zotero.Prefs.set(migrationKey, true, true);
  return migrated;
}
