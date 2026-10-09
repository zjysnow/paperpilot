import {
  getLocalParentPath,
  isAbsoluteLocalPath,
  joinLocalPath,
} from "../../utils/localPath";
import { getLearningNoteSyncDirectory } from "../../utils/learningNoteSyncConfig";
import { isLocalPathInsideOrEqual } from "../../utils/notesDirectoryConfig";
import type { LearningProgress, LearningSource } from "./paperLearning";

export type LearningNoteBinding = { filePath: string; managedBlock: string };

const START = "<!-- paperpilot:learning-progress:start -->";
const END = "<!-- paperpilot:learning-progress:end -->";
const queues = new Map<string, Promise<unknown>>();

type NoteIO = Pick<
  typeof IOUtils,
  "exists" | "read" | "write" | "makeDirectory" | "createUniqueFile" | "remove"
>;

function getIO(): NoteIO {
  const io = (globalThis as unknown as { IOUtils?: NoteIO }).IOUtils;
  if (!io) throw new Error("Learning note sync file I/O is unavailable.");
  return io;
}

function conflict(message: string): never {
  throw new Error(`Learning note sync conflict: ${message}`);
}

function sourceKey(source: LearningSource): string {
  if (
    !Number.isSafeInteger(source.libraryID) ||
    Number(source.libraryID) < 1 ||
    !/^[A-Za-z0-9]{1,100}$/.test(source.itemKey || "") ||
    !/^[A-Za-z0-9]{1,100}$/.test(source.attachmentKey || "")
  ) {
    throw new Error(
      "Learning note sync requires stable libraryID, itemKey, and attachmentKey.",
    );
  }
  return `${source.libraryID}-${source.itemKey}-${source.attachmentKey}`;
}

function markdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/[\\`*_[\]#|]/g, "\\$&")
    .replace(/\r?\n/g, "\n    ");
}

function nativeLinks(source: LearningSource): string[] {
  const libraries = (
    globalThis as unknown as {
      Zotero?: {
        Libraries?: {
          userLibraryID: number;
          get(id: number): { groupID?: number } | undefined;
        };
      };
    }
  ).Zotero?.Libraries;
  if (!libraries) {
    throw new Error("Learning note sync cannot resolve the Zotero library.");
  }
  let libraryPath = "library";
  if (source.libraryID !== libraries.userLibraryID) {
    const groupID = libraries.get(source.libraryID!)?.groupID;
    if (!groupID) {
      throw new Error("Learning note sync cannot resolve the Zotero group.");
    }
    libraryPath = `groups/${groupID}`;
  }
  return [
    `[Zotero item](zotero://select/${libraryPath}/items/${source.itemKey})`,
    `[PDF](zotero://open-pdf/${libraryPath}/items/${source.attachmentKey})`,
  ];
}

function render(progress: readonly LearningProgress[]): string {
  const source = progress[0].source;
  const lines = [
    START,
    "# Learning progress",
    "",
    `Paper: ${markdown(source.title)}`,
    "",
    nativeLinks(source).join(" · "),
    "",
    "Understanding statuses reflect saved tutor records, not inferred mastery.",
  ];
  for (const record of progress) {
    lines.push(
      "",
      `## Goal: ${markdown(record.target)}`,
      "",
      `Location: ${markdown(record.location)}`,
      `Source fingerprint: ${markdown(record.source.fingerprint || "(not recorded)")}`,
      "",
      "### Explained",
      ...record.explained.map((point) => `- ${markdown(point)}`),
      "",
      "### Understanding",
      ...record.understanding.flatMap((entry) => [
        `- ${markdown(entry.point)} — ${markdown(entry.status)}`,
        `    - Answer: ${markdown(entry.answer)}`,
        `    - Reason: ${markdown(entry.reason)}`,
      ]),
      "",
      "### Gaps",
      ...record.gaps.map((gap) => `- ${markdown(gap)}`),
      "",
      `Next entry: ${markdown(record.nextEntry)}`,
    );
  }
  return [...lines, END].join("\n");
}

function checkedPath(path: string, directory: string): string {
  if (
    !isAbsoluteLocalPath(path) ||
    /[\0\r\n]/.test(path) ||
    path.split(/[\\/]/).some((part) => part === "." || part === "..") ||
    !/\.md$/i.test(path) ||
    !isLocalPathInsideOrEqual(path, directory)
  ) {
    throw new Error(
      "Learning note sync requires a .md file inside the authorized directory.",
    );
  }
  return joinLocalPath(path);
}

// Reject symlink ancestors too: lexical containment alone cannot constrain I/O.
async function rejectSymlinks(io: NoteIO, path: string): Promise<void> {
  const zoteroFile = (
    globalThis as unknown as {
      Zotero?: {
        File?: { pathToFile(path: string): Pick<nsIFile, "isSymlink"> };
      };
    }
  ).Zotero?.File;
  if (!zoteroFile?.pathToFile) {
    throw new Error(
      "Learning note sync non-mutating path inspection is unavailable.",
    );
  }
  for (;;) {
    if (await io.exists(path)) {
      // IOUtils.getFile creates parents and crashes at "/" (null parent).
      const file = zoteroFile.pathToFile(path);
      if (file.isSymlink()) {
        throw new Error(
          "Learning note sync refuses symbolic-link destinations.",
        );
      }
    }
    const parent = getLocalParentPath(path);
    if (parent === path) return;
    path = parent;
  }
}

function replaceManaged(
  content: string,
  binding: LearningNoteBinding,
  block: string,
): string {
  if (!binding.managedBlock) {
    if (
      content.includes(START) ||
      content.includes(END) ||
      content.includes("<!-- paperpilot:learning-progress:")
    ) {
      conflict("the existing note has markers but no trusted prior content.");
    }
    return `${content}${content && !content.endsWith("\n") ? "\n" : ""}${block}\n`;
  }
  const start = content.indexOf(START);
  const end = content.indexOf(END);
  if (
    start < 0 ||
    end < start ||
    content.indexOf(START, start + START.length) !== -1 ||
    content.indexOf(END, end + END.length) !== -1 ||
    content.slice(start, end + END.length) !== binding.managedBlock
  ) {
    conflict("the managed progress or its markers were edited or removed.");
  }
  return content.slice(0, start) + block + content.slice(end + END.length);
}

/**
 * Sync all goal records for one stable source. Persist the returned binding only
 * after success; failures are thrown so callers can retain primary DB progress.
 * An empty managedBlock explicitly authorizes appending to an existing note.
 */
export async function synchronizeLearningNote(
  progress: readonly LearningProgress[],
  binding?: LearningNoteBinding | null,
): Promise<LearningNoteBinding | null> {
  const directory = getLearningNoteSyncDirectory();
  if (directory === null) return null;
  if (!progress.length) {
    throw new Error(
      "Learning note sync requires at least one progress record.",
    );
  }
  const key = sourceKey(progress[0].source);
  if (progress.some((record) => sourceKey(record.source) !== key)) {
    throw new Error("Learning note sync requires records for a single source.");
  }
  const filePath = checkedPath(
    binding?.filePath ||
      joinLocalPath(directory, `paperpilot-learning-${key}.md`),
    directory,
  );
  const trusted = binding ? { ...binding, filePath } : null;
  const block = render(progress);
  const queueKey = /^[A-Za-z]:|^\\\\|^\/\//.test(filePath)
    ? filePath.toLowerCase()
    : filePath;
  const previous = queues.get(queueKey) || Promise.resolve();
  const operation = previous
    .catch(() => {})
    .then(async () => {
      const checkAuthorization = () => {
        if (getLearningNoteSyncDirectory() !== directory) {
          throw new Error(
            "Learning note sync authorization changed before writing. Retry after reauthorization.",
          );
        }
      };
      checkAuthorization();
      const io = getIO();
      await rejectSymlinks(io, filePath);
      const exists = await io.exists(filePath);
      let content = "";
      if (exists) {
        if (!trusted)
          conflict("the automatic filename already exists without a binding.");
        content = new TextDecoder("utf-8", {
          fatal: true,
          ignoreBOM: true,
        }).decode(await io.read(filePath));
      } else if (trusted) {
        conflict("the bound note no longer exists.");
      }
      const updated = trusted
        ? replaceManaged(content, trusted, block)
        : `${block}\n`;
      checkAuthorization();
      if (updated !== content) {
        const parent = getLocalParentPath(filePath);
        await io.makeDirectory(parent, {
          createAncestors: false,
          ignoreExisting: true,
        });
        await rejectSymlinks(io, filePath);
        checkAuthorization();
        const tmpPath = await io.createUniqueFile(
          parent,
          ".paperpilot-learning-sync-",
        );
        try {
          // Reserve a unique sibling name, then let create-mode I/O create it.
          await io.remove(tmpPath, { ignoreAbsent: false });
          checkAuthorization();
          // Detect outside edits during the asynchronous preparation as well.
          if (exists) {
            const latest = new TextDecoder("utf-8", {
              fatal: true,
              ignoreBOM: true,
            }).decode(await io.read(filePath));
            if (latest !== content)
              conflict("the note changed while preparing the write; retry.");
          }
          checkAuthorization();
          await io.write(filePath, new TextEncoder().encode(updated), {
            tmpPath,
            mode: exists ? "overwrite" : "create",
            flush: true,
          });
        } finally {
          await io.remove(tmpPath, { ignoreAbsent: true }).catch(() => {});
        }
      }
      return { filePath, managedBlock: block };
    });
  queues.set(queueKey, operation);
  try {
    return await operation;
  } finally {
    if (queues.get(queueKey) === operation) queues.delete(queueKey);
  }
}
