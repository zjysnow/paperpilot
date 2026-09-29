import { config } from "../../package.json";
import { joinLocalPath } from "./localPath";

const WORKSPACE_DIRECTORY_KEY = `${config.prefsPrefix}.workspaceDirectory`;
const VSCODE_EXECUTABLE_PATH_KEY = `${config.prefsPrefix}.vscodeExecutablePath`;

type ZoteroPrefsLike = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
};

type WorkspaceItem = {
  getField?: (field: string) => unknown;
};

type WorkspaceIOUtils = {
  makeDirectory?: (
    path: string,
    options?: { createAncestors?: boolean; ignoreExisting?: boolean },
  ) => Promise<void>;
  write?: (
    path: string,
    data: Uint8Array,
    options?: { tmpPath?: string },
  ) => Promise<unknown>;
  read?: (path: string) => Promise<Uint8Array | ArrayBuffer>;
  remove?: (
    path: string,
    options?: { ignoreAbsent?: boolean },
  ) => Promise<void>;
};

function getPrefs(): ZoteroPrefsLike | null {
  return (
    (
      globalThis as typeof globalThis & {
        Zotero?: { Prefs?: ZoteroPrefsLike };
      }
    ).Zotero?.Prefs || null
  );
}

export function getWorkspaceDirectory(): string {
  const value = getPrefs()?.get?.(WORKSPACE_DIRECTORY_KEY, true);
  return typeof value === "string" ? value : "";
}

export function setWorkspaceDirectory(value: string): void {
  getPrefs()?.set?.(WORKSPACE_DIRECTORY_KEY, value, true);
}

function getWorkspaceIOUtils(): WorkspaceIOUtils | undefined {
  return (globalThis as typeof globalThis & { IOUtils?: WorkspaceIOUtils })
    .IOUtils;
}

/**
 * Creates the workspace directory when needed, then verifies real write and
 * read access with a short-lived probe file. The configured path is not
 * persisted until this succeeds.
 */
export async function verifyWorkspaceDirectoryAccess(
  directoryPath: string,
): Promise<void> {
  const path = directoryPath.trim();
  if (!path) {
    throw new Error("Workspace directory path is required");
  }
  const io = getWorkspaceIOUtils();
  if (!io?.makeDirectory || !io.write || !io.read || !io.remove) {
    throw new Error("Workspace directory testing is not available");
  }
  await io.makeDirectory(path, {
    createAncestors: true,
    ignoreExisting: true,
  });
  const token = `paperpilot-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const probePath = joinLocalPath(path, `.${token}.tmp`);
  const bytes = new TextEncoder().encode(token);
  try {
    await io.write(probePath, bytes);
    const readResult = await io.read(probePath);
    const readBytes =
      readResult instanceof Uint8Array
        ? readResult
        : new Uint8Array(readResult);
    if (new TextDecoder().decode(readBytes) !== token) {
      throw new Error("Workspace read-back verification failed");
    }
  } finally {
    await io.remove(probePath, { ignoreAbsent: true });
  }
}

export function getVSCodeExecutablePath(): string {
  const value = getPrefs()?.get?.(VSCODE_EXECUTABLE_PATH_KEY, true);
  return typeof value === "string" ? value : "";
}

export function setVSCodeExecutablePath(value: string): void {
  getPrefs()?.set?.(VSCODE_EXECUTABLE_PATH_KEY, value, true);
}

export function isValidWorkspaceFolderName(value: string): boolean {
  const name = value.trim();
  return (
    name.length > 0 &&
    !/[\\/:*?"<>|]/.test(name) &&
    !Array.from(name).some((char) => char.charCodeAt(0) < 32)
  );
}

export function getWorkspaceFolderPath(folderName: string): string {
  return joinLocalPath(getWorkspaceDirectory().trim(), folderName.trim());
}

/**
 * Resolves the same paper-specific workspace directory opened by the UI.
 * A paper without a valid short title has no stable shared workspace path.
 */
export function getPaperWorkspaceFolderPath(
  item: WorkspaceItem | null | undefined,
): string | null {
  let folderName = "";
  try {
    folderName = String(item?.getField?.("shortTitle") || "").trim();
  } catch {
    return null;
  }
  if (!isValidWorkspaceFolderName(folderName)) return null;
  return getWorkspaceFolderPath(folderName);
}
