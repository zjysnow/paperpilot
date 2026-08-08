import { config } from "../../package.json";
import { joinLocalPath } from "./localPath";

const WORKSPACE_DIRECTORY_KEY = `${config.prefsPrefix}.workspaceDirectory`;
const VSCODE_EXECUTABLE_PATH_KEY = `${config.prefsPrefix}.vscodeExecutablePath`;

type ZoteroPrefsLike = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
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
