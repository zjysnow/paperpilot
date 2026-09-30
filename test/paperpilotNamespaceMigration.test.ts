import { strict as assert } from "node:assert";
import { DatabaseSync } from "node:sqlite";
import {
  migratePaperpilotDatabaseNamespace,
  migratePaperpilotPreferences,
  migratePaperpilotSkills,
} from "../src/utils/paperpilotNamespaceMigration";
import {
  getCanonicalSkillFilePath,
  getCanonicalUserSkillsDir,
} from "../src/agent/skills/nativeSkillPaths";
import {
  extractManagedBlock,
  hashSkillForUpgrade,
  MANAGED_BEGIN_MARKER,
  MANAGED_END_MARKER,
  spliceManagedBlock,
} from "../src/agent/skills/managedBlock";

function createDatabase() {
  const sqlite = new DatabaseSync(":memory:");
  const db = {
    async queryAsync(sql: string, params: unknown[] = []) {
      const values = params.map((value) => {
        if (
          value === null ||
          typeof value === "string" ||
          typeof value === "number"
        )
          return value;
        throw new Error("Unsupported test database parameter");
      });
      const statement = sqlite.prepare(sql);
      return statement.columns().length
        ? statement.all(...values)
        : statement.run(...values);
    },
    async executeTransaction<T>(callback: () => Promise<T>): Promise<T> {
      sqlite.exec("BEGIN");
      try {
        const result = await callback();
        sqlite.exec("COMMIT");
        return result;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { sqlite, db };
}

describe("Paper Pilot namespace migration", function () {
  it("preserves every store and index, including unique constraints and foreign keys", async function () {
    const { sqlite, db } = createDatabase();
    try {
      const stores = [
        "chat_messages",
        "global_conversations",
        "paper_conversations",
        "conversation_registry",
        "conversation_registry_legacy_keyed",
        "conversation_fork_links",
        "conversation_schema_migrations",
        "conversation_search_index",
        "attachment_blobs",
        "attachment_refs",
        "agent_memory",
        "agent_runs",
        "agent_run_events",
        "agent_transcript",
        "agent_tool_result_handles",
        "agent_coverage",
        "agent_evidence",
      ];
      for (const store of stores) {
        sqlite.exec(`
          CREATE TABLE llm_for_zotero_${store} (id INTEGER PRIMARY KEY, value TEXT);
          INSERT INTO llm_for_zotero_${store} VALUES (42, '${store}');
          CREATE UNIQUE INDEX llm_for_zotero_${store}_idx
            ON llm_for_zotero_${store} (value);
        `);
      }
      sqlite.exec(`
        CREATE TABLE unrelated (id INTEGER PRIMARY KEY,
          run_id INTEGER REFERENCES llm_for_zotero_agent_runs(id));
        INSERT INTO unrelated VALUES (1, 42);
      `);
      await migratePaperpilotDatabaseNamespace(db);
      for (const store of stores) {
        assert.equal(
          sqlite.prepare(`SELECT value FROM paperpilot_${store}`).get()?.value,
          store,
        );
        assert.throws(() =>
          sqlite.exec(
            `INSERT INTO paperpilot_${store} VALUES (43, '${store}')`,
          ),
        );
      }
      assert.deepEqual(sqlite.prepare("PRAGMA foreign_key_check").all(), []);
      assert.equal(
        sqlite.prepare("PRAGMA foreign_key_list(unrelated)").get()?.table,
        "paperpilot_agent_runs",
      );
      assert.equal(
        sqlite
          .prepare(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE name GLOB 'llm_for_zotero_*'",
          )
          .get()?.count,
        0,
      );
      await migratePaperpilotDatabaseNamespace(db);
      assert.equal(
        sqlite.prepare("SELECT COUNT(*) AS count FROM unrelated").get()?.count,
        1,
      );
    } finally {
      sqlite.close();
    }
  });

  for (const conflictType of ["table", "index"]) {
    it(`rolls back without losing either store on a ${conflictType} conflict`, async function () {
      const { sqlite, db } = createDatabase();
      try {
        sqlite.exec(`
          CREATE TABLE llm_for_zotero_chat_messages (id INTEGER);
          INSERT INTO llm_for_zotero_chat_messages VALUES (42);
          CREATE TABLE llm_for_zotero_agent_runs (id INTEGER);
          CREATE INDEX llm_for_zotero_agent_runs_idx ON llm_for_zotero_agent_runs(id);
        `);
        sqlite.exec(
          conflictType === "table"
            ? "CREATE TABLE paperpilot_agent_runs (id INTEGER)"
            : "CREATE INDEX paperpilot_agent_runs_idx ON llm_for_zotero_agent_runs(id)",
        );
        await assert.rejects(
          migratePaperpilotDatabaseNamespace(db),
          /namespace migration conflict/,
        );
        assert.equal(
          sqlite.prepare("SELECT id FROM llm_for_zotero_chat_messages").get()
            ?.id,
          42,
        );
        assert.equal(
          sqlite
            .prepare(
              "SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'paperpilot_chat_messages'",
            )
            .get()?.count,
          0,
        );
      } finally {
        sqlite.close();
      }
    });
  }

  it("rolls back earlier renames if a later index migration fails", async function () {
    const { sqlite, db } = createDatabase();
    try {
      sqlite.exec(`
        CREATE TABLE llm_for_zotero_chat_messages (id INTEGER);
        INSERT INTO llm_for_zotero_chat_messages VALUES (42);
        CREATE INDEX llm_for_zotero_chat_messages_idx ON llm_for_zotero_chat_messages(id);
      `);
      const query = db.queryAsync;
      db.queryAsync = async (sql, params) => {
        if (sql.startsWith("DROP INDEX"))
          throw new Error("Injected index failure");
        return query(sql, params);
      };
      await assert.rejects(
        migratePaperpilotDatabaseNamespace(db),
        /Injected index failure/,
      );
      assert.equal(
        sqlite.prepare("SELECT id FROM llm_for_zotero_chat_messages").get()?.id,
        42,
      );
      assert.equal(
        sqlite
          .prepare(
            "SELECT name FROM sqlite_master WHERE name = 'llm_for_zotero_chat_messages_idx'",
          )
          .get()?.name,
        "llm_for_zotero_chat_messages_idx",
      );
    } finally {
      sqlite.close();
    }
  });

  it("works for a fresh profile without creating unnecessary tables", async function () {
    const { sqlite, db } = createDatabase();
    try {
      await migratePaperpilotDatabaseNamespace(db);
      assert.equal(
        sqlite.prepare("SELECT COUNT(*) AS count FROM sqlite_master").get()
          ?.count,
        0,
      );
    } finally {
      sqlite.close();
    }
  });

  it("copies old preference values without replacing current values, including empty values", function () {
    const globals = globalThis as Record<string, unknown>;
    const previous = globals.Zotero;
    const prefs = new Map<string, unknown>([
      [
        "extensions.zotero.llmForZotero.skillBodyHashes",
        '{"custom.md":"hash"}',
      ],
      ["extensions.zotero.llmForZotero.seededBuiltinSkills", '["deleted.md"]'],
      ["extensions.zotero.llmforzotero.pdftoppmPath", "/old/bin/pdftoppm"],
      ["extensions.zotero.paperpilot.pdftoppmPath", ""],
      [
        "extensions.zotero.llmforzotero.popplerPdftoppmPath",
        "/poppler/pdftoppm",
      ],
    ]);
    globals.Zotero = {
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
    };
    try {
      migratePaperpilotPreferences();
      assert.equal(
        prefs.get("extensions.zotero.paperpilot.skillBodyHashes"),
        '{"custom.md":"hash"}',
      );
      assert.equal(
        prefs.get("extensions.zotero.paperpilot.seededBuiltinSkills"),
        '["deleted.md"]',
      );
      assert.equal(prefs.get("extensions.zotero.paperpilot.pdftoppmPath"), "");
      assert.equal(
        prefs.get("extensions.zotero.paperpilot.popplerPdftoppmPath"),
        "/poppler/pdftoppm",
      );
      migratePaperpilotPreferences();
      assert.equal(prefs.get("extensions.zotero.paperpilot.pdftoppmPath"), "");
    } finally {
      globals.Zotero = previous;
    }
  });

  it("copies custom skills, preserves originals and current skills, and converts only valid old markers", async function () {
    const globals = globalThis as Record<string, unknown>;
    const previous = globals.Zotero;
    const prefs = new Map<string, unknown>();
    globals.Zotero = {
      DataDirectory: { dir: "/zotero-data" },
      Profile: { dir: "/zotero-profile" },
      debug: () => undefined,
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
    };
    try {
      const legacyDir = "/zotero-data/llm-for-zotero/skills";
      const old = `---
id: custom
name: custom
description: Custom skill
---
user preface
<!-- LLM-FOR-ZOTERO:MANAGED-BEGIN -->managed content<!-- LLM-FOR-ZOTERO:MANAGED-END -->
user suffix`;
      const existing = old.replace("id: custom", "id: existing");
      const files = new Map([
        [`${legacyDir}/custom.md`, old],
        [`${legacyDir}/existing.md`, "must not overwrite current"],
        [`${legacyDir}/obsolete.md`, old],
        [getCanonicalSkillFilePath("existing"), existing],
      ]);
      const io = {
        exists: async (path: string) =>
          path === legacyDir ||
          path === getCanonicalUserSkillsDir() ||
          files.has(path),
        read: async (path: string) => {
          const value = files.get(path);
          if (value === undefined) throw new Error(`Missing file: ${path}`);
          return new TextEncoder().encode(value);
        },
        write: async (path: string, data: Uint8Array) => {
          files.set(path, new TextDecoder().decode(data));
          return data.length;
        },
        makeDirectory: async () => undefined,
        getChildren: async (path: string) =>
          path === legacyDir
            ? [...files.keys()].filter((key) => key.startsWith(`${legacyDir}/`))
            : [...files.keys()]
                .filter((key) => key.endsWith("/SKILL.md"))
                .map((key) => key.slice(0, -"/SKILL.md".length)),
      };
      const write = io.write;
      io.write = async () => {
        throw new Error("Injected skill write failure");
      };
      await assert.rejects(
        migratePaperpilotSkills(io, new Set(["obsolete.md"]), new Set()),
        /Injected skill write failure/,
      );
      assert.equal(
        prefs.get("extensions.zotero.paperpilot.migrationSkillNamespaceV1Done"),
        undefined,
      );
      io.write = write;
      const migrated = await migratePaperpilotSkills(
        io,
        new Set(["obsolete.md"]),
        new Set(),
      );
      assert.deepEqual(migrated, ["custom.md"]);
      const expected = old
        .replace("<!-- LLM-FOR-ZOTERO:MANAGED-BEGIN -->", MANAGED_BEGIN_MARKER)
        .replace("<!-- LLM-FOR-ZOTERO:MANAGED-END -->", MANAGED_END_MARKER);
      assert.equal(files.get(`${legacyDir}/custom.md`), old);
      assert.equal(files.get(getCanonicalSkillFilePath("custom")), expected);
      assert.equal(
        files.get(getCanonicalSkillFilePath("existing")),
        expected.replace("id: custom", "id: existing"),
      );
      assert.equal(
        hashSkillForUpgrade(expected, "unused"),
        hashSkillForUpgrade(
          `${MANAGED_BEGIN_MARKER}managed content${MANAGED_END_MARKER}`,
          "unused",
        ),
      );
      files.delete(getCanonicalSkillFilePath("custom"));
      assert.deepEqual(
        await migratePaperpilotSkills(io, new Set(["obsolete.md"]), new Set()),
        [],
      );
      assert.equal(files.has(getCanonicalSkillFilePath("custom")), false);
    } finally {
      globals.Zotero = previous;
    }
  });
});

describe("Paper Pilot managed skill blocks", function () {
  it("preserves user content around the current managed block", function () {
    const raw = `before${MANAGED_BEGIN_MARKER}old${MANAGED_END_MARKER}after`;
    assert.deepEqual(extractManagedBlock(raw), {
      before: "before",
      block: "old",
      after: "after",
    });
    assert.equal(
      spliceManagedBlock(raw, "new"),
      `before${MANAGED_BEGIN_MARKER}new${MANAGED_END_MARKER}after`,
    );
  });

  it("leaves unmanaged or malformed user files untouched", function () {
    for (const raw of [
      "user content",
      MANAGED_BEGIN_MARKER,
      `${MANAGED_END_MARKER}content${MANAGED_BEGIN_MARKER}`,
    ]) {
      assert.equal(extractManagedBlock(raw).block, null);
      assert.equal(spliceManagedBlock(raw, "new"), null);
    }
  });
});
