import { strict as assert } from "node:assert";
import { config } from "../package.json";
import {
  synchronizeLearningNote,
  type LearningNoteBinding,
} from "../src/agent/services/learningNoteSync";
import type { LearningProgress } from "../src/agent/services/paperLearning";
import {
  getLearningNoteSyncDirectory,
  isLearningNoteSyncEnabled,
  setLearningNoteSyncEnabled,
} from "../src/utils/learningNoteSyncConfig";
import {
  setNotesDirectoryFolder,
  setNotesDirectoryPath,
} from "../src/utils/notesDirectoryConfig";

const root = "/notes";
const destination = "/notes/Zotero Notes";
const marker = "<!-- paperpilot:learning-progress:start -->";

function record(target = "Method"): LearningProgress {
  return {
    version: 1,
    source: {
      itemId: 12,
      contextItemId: 13,
      libraryID: 1,
      itemKey: "ITEM1234",
      attachmentKey: "PDF12345",
      fingerprint: "sha256:original",
      title: "A paper",
      coverage: "full",
      missing: [],
    },
    target,
    location: "Section 2",
    explained: ["How the method works"],
    understanding: [
      {
        point: "Assumptions",
        status: "explained_unverified",
        answer: "",
        reason: "No answer yet",
      },
    ],
    gaps: ["Test an example"],
    nextEntry: "Start with an example",
  };
}

describe("optional learning note sync", function () {
  const globals = globalThis as unknown as {
    Zotero?: unknown;
    IOUtils?: unknown;
  };
  let originalZotero: unknown;
  let originalIO: unknown;
  let prefs: Map<string, unknown>;
  let files: Map<string, Uint8Array>;
  let directories: Set<string>;
  let writes: Array<{ path: string; options: WriteOptions }>;
  let mutations: string[];
  let symlinks: Set<string>;
  let writeFailure: Error | undefined;
  let writeHook: (() => Promise<void>) | undefined;
  let tempCounter: number;

  const text = (path: string) =>
    new TextDecoder("utf-8", { ignoreBOM: true }).decode(files.get(path));
  const put = (path: string, content: string) =>
    files.set(path, new TextEncoder().encode(content));
  const enable = () => setLearningNoteSyncEnabled(true);
  const sync = (goals = [record()], binding?: LearningNoteBinding | null) =>
    synchronizeLearningNote(goals, binding);

  beforeEach(function () {
    originalZotero = globals.Zotero;
    originalIO = globals.IOUtils;
    prefs = new Map();
    files = new Map();
    writes = [];
    mutations = [];
    symlinks = new Set();
    writeFailure = undefined;
    writeHook = undefined;
    tempCounter = 0;
    directories = new Set(["/", root, destination]);
    globals.Zotero = {
      File: {
        pathToFile: (path: string) => ({
          isSymlink: () => symlinks.has(path),
        }),
      },
      Prefs: {
        get: (key: string) => prefs.get(key),
        set: (key: string, value: unknown) => prefs.set(key, value),
      },
      Libraries: {
        userLibraryID: 1,
        get: (id: number) => (id === 2 ? { groupID: 42 } : undefined),
      },
    };
    globals.IOUtils = {
      exists: async (path: string) =>
        files.has(path) || directories.has(path) || symlinks.has(path),
      getFile: async () => {
        throw new Error(
          "IOUtils.getFile is mutating and unsafe at filesystem roots",
        );
      },
      read: async (path: string) => {
        const data = files.get(path);
        if (!data) throw new Error("File not found");
        return data.slice();
      },
      makeDirectory: async (path: string, options: MakeDirectoryOptions) => {
        assert.equal(options.createAncestors, false);
        const parent = path.slice(0, path.lastIndexOf("/")) || "/";
        if (!directories.has(parent)) {
          throw new Error("Parent directory does not exist");
        }
        mutations.push(path);
        directories.add(path);
      },
      createUniqueFile: async (parent: string, prefix: string) => {
        const path = `${parent}/${prefix}${++tempCounter}`;
        mutations.push(path);
        put(path, "");
        return path;
      },
      remove: async (path: string) => {
        mutations.push(path);
        files.delete(path);
      },
      write: async (path: string, bytes: Uint8Array, options: WriteOptions) => {
        writes.push({ path, options });
        assert.ok(options.tmpPath);
        assert.equal(files.has(options.tmpPath), false);
        if (writeHook) await writeHook();
        if (writeFailure) throw writeFailure;
        if (options.mode === "create" && files.has(path)) {
          throw new Error("Destination already exists");
        }
        files.set(path, bytes.slice());
        return bytes.length;
      },
    };
    setNotesDirectoryPath(root);
    setNotesDirectoryFolder("Zotero Notes");
  });

  afterEach(function () {
    globals.Zotero = originalZotero;
    globals.IOUtils = originalIO;
  });

  it("defaults to disabled and performs no file I/O even for invalid input", async function () {
    assert.equal(isLearningNoteSyncEnabled(), false);
    assert.equal(getLearningNoteSyncDirectory(), null);
    globals.IOUtils = undefined;
    assert.equal(await sync([]), null);
    assert.deepEqual(mutations, []);
    prefs.set(`${config.prefsPrefix}.learningNoteSyncEnabled`, "true");
    assert.equal(isLearningNoteSyncEnabled(), false);
  });

  it("captures opt-in and requires reauthorization after root or folder changes", async function () {
    enable();
    assert.equal(getLearningNoteSyncDirectory(), destination);
    setNotesDirectoryFolder("Other");
    assert.throws(getLearningNoteSyncDirectory, /Re-enable/);
    await assert.rejects(sync(), /authorization/);
    assert.deepEqual(mutations, []);
    enable();
    assert.equal(getLearningNoteSyncDirectory(), "/notes/Other");
    setNotesDirectoryPath("/new-notes");
    await assert.rejects(sync(), /authorization/);
    enable();
    assert.equal(getLearningNoteSyncDirectory(), "/new-notes/Other");
    setLearningNoteSyncEnabled(false);
    assert.equal(getLearningNoteSyncDirectory(), null);
    assert.equal(await sync(), null);
  });

  it("rejects invalid configuration and missing authorization", function () {
    for (const path of ["relative", "/notes/../elsewhere", ""]) {
      setNotesDirectoryPath(path);
      assert.throws(enable, /absolute/);
      assert.equal(isLearningNoteSyncEnabled(), false);
    }
    setNotesDirectoryPath(root);
    prefs.set(`${config.prefsPrefix}.learningNoteSyncEnabled`, true);
    assert.throws(getLearningNoteSyncDirectory, /authorization/);
    setNotesDirectoryPath("relative");
    assert.throws(getLearningNoteSyncDirectory, /absolute/);
  });

  it("writes all goals with saved statuses and native links in one stable filename", async function () {
    enable();
    const binding = (await sync([record(), record("Results")]))!;
    assert.equal(
      binding.filePath,
      `${destination}/paperpilot-learning-1-ITEM1234-PDF12345.md`,
    );
    const content = text(binding.filePath);
    assert.match(content, /Goal: Method/);
    assert.match(content, /Goal: Results/);
    assert.match(content, /sha256:original/);
    assert.match(content, /explained\\_unverified/);
    assert.doesNotMatch(content, /— mastered/);
    assert.match(content, /zotero:\/\/select\/library\/items\/ITEM1234/);
    assert.match(content, /zotero:\/\/open-pdf\/library\/items\/PDF12345/);
    assert.equal(content.split(marker).length, 2);
    assert.equal(writes[0].options.mode, "create");
    assert.equal(writes[0].options.flush, true);
    assert.ok(writes[0].options.tmpPath!.startsWith(`${destination}/`));
  });

  it("creates a missing authorized target folder without creating outside ancestors", async function () {
    directories.delete(destination);
    enable();
    const binding = (await sync())!;
    assert.equal(directories.has(destination), true);
    assert.equal(binding.filePath.startsWith(`${destination}/`), true);
    assert.match(text(binding.filePath), /Goal: Method/);
    assert.equal(writes.length, 1);
    assert.ok(
      mutations.every(
        (path) => path === destination || path.startsWith(`${destination}/`),
      ),
    );
  });

  it("inspects ancestors including the root without using mutating IOUtils.getFile", async function () {
    enable();
    const inspected: string[] = [];
    const file = (
      globals.Zotero as {
        File: { pathToFile(path: string): { isSymlink(): boolean } };
      }
    ).File;
    const pathToFile = file.pathToFile;
    file.pathToFile = (path) => {
      inspected.push(path);
      return pathToFile(path);
    };
    const first = (await sync())!;
    await sync([record("Updated")], first);
    assert.ok(inspected.includes("/"));
    assert.ok(inspected.includes(root));
    assert.ok(inspected.includes(destination));
    assert.ok(inspected.includes(first.filePath));
    assert.equal(writes.length, 2);
    assert.ok(
      mutations.every(
        (path) => path === destination || path.startsWith(`${destination}/`),
      ),
    );
  });

  it("refuses missing ancestors outside the authorized target instead of creating them", async function () {
    directories.delete(destination);
    directories.delete(root);
    enable();
    await assert.rejects(sync(), /Parent directory does not exist/);
    assert.deepEqual(mutations, []);
    assert.equal(writes.length, 0);
    assert.equal(files.size, 0);
    assert.equal(directories.has(root), false);
    assert.equal(directories.has(destination), false);
  });

  it("refuses to create a missing target through a symbolic-link ancestor", async function () {
    directories.delete(destination);
    symlinks.add(root);
    enable();
    await assert.rejects(sync(), /symbolic-link/);
    assert.deepEqual(mutations, []);
    assert.equal(directories.has(destination), false);
  });

  it("updates without duplicate blocks, preserves filename across fingerprint changes, and skips identical writes", async function () {
    enable();
    const first = (await sync())!;
    assert.deepEqual(await sync([record()], first), first);
    assert.equal(writes.length, 1);
    const changed = record("New goal");
    changed.source.fingerprint = "sha256:updated";
    changed.source.title = "Updated title";
    const updated = (await sync([changed], first))!;
    assert.equal(updated.filePath, first.filePath);
    assert.match(text(first.filePath), /New goal/);
    assert.doesNotMatch(text(first.filePath), /Goal: Method/);
    assert.equal(text(first.filePath).split(marker).length, 2);
    assert.equal(writes[1].options.mode, "overwrite");
  });

  it("preserves outside manual edits, BOM, unicode, and CRLF byte-for-byte", async function () {
    enable();
    const first = (await sync())!;
    const prefix = "\uFEFF# 私人笔记\r\nManual prefix\r\n\r\n";
    const suffix = "\r\nManual suffix 🚀\r\n";
    put(first.filePath, prefix + first.managedBlock + suffix);
    const updated = (await sync([record("Updated")], first))!;
    assert.deepEqual(
      files.get(first.filePath),
      new TextEncoder().encode(prefix + updated.managedBlock + suffix),
    );
  });

  it("appends to an explicitly bound existing note without markers", async function () {
    enable();
    const filePath = `${destination}/personal.md`;
    const manual = "# My existing note\r\nUnterminated text";
    put(filePath, manual);
    const first = (await sync([record()], { filePath, managedBlock: "" }))!;
    assert.equal(text(filePath), `${manual}\n${first.managedBlock}\n`);
    const updated = (await sync([record("Updated")], first))!;
    assert.equal(text(filePath), `${manual}\n${updated.managedBlock}\n`);
  });

  it("rejects untrusted markers in an explicitly bound existing note", async function () {
    enable();
    const first = (await sync())!;
    await assert.rejects(
      sync([record()], { filePath: first.filePath, managedBlock: "" }),
      /conflict.*no trusted/,
    );
    assert.equal(writes.length, 1);
  });

  it("rejects edited, missing, duplicated, or damaged managed markers", async function () {
    enable();
    const first = (await sync())!;
    const original = text(first.filePath);
    for (const edited of [
      original.replace("No answer yet", "User changed this"),
      original.replace(marker, ""),
      original.replace("progress:end", "progress:changed"),
      original + first.managedBlock,
    ]) {
      put(first.filePath, edited);
      await assert.rejects(sync([record("Updated")], first), /conflict/);
      assert.equal(text(first.filePath), edited);
    }
    assert.equal(writes.length, 1);
  });

  it("rejects unrelated automatic filename collisions and lost bound notes", async function () {
    enable();
    const filePath = `${destination}/paperpilot-learning-1-ITEM1234-PDF12345.md`;
    put(filePath, "Unrelated note");
    await assert.rejects(sync(), /conflict.*without a binding/);
    assert.equal(text(filePath), "Unrelated note");
    files.delete(filePath);
    await assert.rejects(
      sync([record()], { filePath, managedBlock: "" }),
      /conflict.*no longer exists/,
    );
    assert.deepEqual(mutations, []);
  });

  it("rejects outside paths, traversal, non-markdown paths, and symlinks", async function () {
    enable();
    for (const filePath of [
      "/outside/note.md",
      `${destination}-other/note.md`,
      `${destination}/../outside.md`,
      `${destination}/nested/../../outside.md`,
      `${destination}/note.txt`,
      "relative.md",
    ]) {
      await assert.rejects(
        sync([record()], { filePath, managedBlock: "" }),
        /authorized directory/,
      );
    }
    symlinks.add(destination);
    await assert.rejects(sync(), /symbolic-link/);
    assert.deepEqual(mutations, []);
  });

  it("propagates write failures, cleans temporary siblings, and allows retry", async function () {
    enable();
    const first = (await sync())!;
    const original = text(first.filePath);
    writeFailure = new Error("Disk is full");
    await assert.rejects(sync([record("Updated")], first), /Disk is full/);
    assert.equal(text(first.filePath), original);
    assert.equal(files.size, 1);
    writeFailure = undefined;
    const updated = (await sync([record("Updated")], first))!;
    assert.match(updated.managedBlock, /Updated/);
  });

  it("propagates read errors and unavailable I/O rather than returning null", async function () {
    enable();
    const first = (await sync())!;
    const io = globals.IOUtils as { read: () => Promise<Uint8Array> };
    io.read = async () => {
      throw new Error("Read permission denied");
    };
    await assert.rejects(sync([record("Updated")], first), /permission denied/);
    assert.equal(writes.length, 1);
    globals.IOUtils = undefined;
    await assert.rejects(sync(), /I\/O is unavailable/);
  });

  it("does not overwrite a note changed during preparation", async function () {
    enable();
    const first = (await sync())!;
    const io = globals.IOUtils as {
      createUniqueFile: (parent: string, prefix: string) => Promise<string>;
    };
    const create = io.createUniqueFile;
    io.createUniqueFile = async (parent, prefix) => {
      const path = await create(parent, prefix);
      put(first.filePath, `Manual edit\n${text(first.filePath)}`);
      return path;
    };
    await assert.rejects(sync([record("Updated")], first), /conflict.*changed/);
    assert.match(text(first.filePath), /^Manual edit/);
    assert.equal(writes.length, 1);
    assert.equal(files.size, 1);
  });

  it("serializes overlapping writes and rejects stale bindings rather than losing updates", async function () {
    enable();
    const first = (await sync())!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    writeHook = async () => {
      started();
      await gate;
    };
    const one = sync([record("First update")], first);
    await began;
    const two = assert.rejects(
      sync([record("Second update")], first),
      /conflict/,
    );
    release();
    await Promise.all([one, two]);
    assert.match(text(first.filePath), /First update/);
    assert.doesNotMatch(text(first.filePath), /Second update/);
    assert.equal(writes.length, 2);
  });

  it("rejects empty, mixed, or unstable source records and uses actual group IDs", async function () {
    enable();
    await assert.rejects(sync([]), /at least one/);
    const other = record("Other source");
    other.source.attachmentKey = "OTHER123";
    await assert.rejects(sync([record(), other]), /single source/);
    const unstable = record();
    delete unstable.source.itemKey;
    await assert.rejects(sync([unstable]), /stable/);
    const grouped = record();
    grouped.source.libraryID = 2;
    const binding = (await sync([grouped]))!;
    assert.match(binding.managedBlock, /zotero:\/\/select\/groups\/42\/items/);
    assert.match(
      binding.managedBlock,
      /zotero:\/\/open-pdf\/groups\/42\/items/,
    );
  });

  it("escapes record text so it cannot create managed markers", async function () {
    enable();
    const goal = record(marker);
    const binding = (await sync([goal]))!;
    assert.equal(text(binding.filePath).split(marker).length, 2);
    assert.match(binding.managedBlock, /&lt;!--/);
    await sync([record()], binding);
  });

  it("rechecks authorization during asynchronous preparation", async function () {
    enable();
    const io = globals.IOUtils as {
      makeDirectory: (
        path: string,
        options: MakeDirectoryOptions,
      ) => Promise<void>;
    };
    const originalMakeDirectory = io.makeDirectory;
    io.makeDirectory = async (path, options) => {
      await originalMakeDirectory(path, options);
      setNotesDirectoryFolder("Different");
    };
    await assert.rejects(sync(), /authorization/);
    assert.equal(writes.length, 0);
    assert.equal(files.size, 0);
  });
});
