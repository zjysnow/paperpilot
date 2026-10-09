import { config } from "../../package.json";
import { isAbsoluteLocalPath } from "./localPath";
import { getNotesDirectoryConfig } from "./notesDirectoryConfig";

const ENABLED_KEY = `${config.prefsPrefix}.learningNoteSyncEnabled`;
const DIRECTORY_KEY = `${config.prefsPrefix}.learningNoteSyncDirectory`;

type Preferences = {
  get(key: string, global?: boolean): unknown;
  set(key: string, value: string | boolean, global?: boolean): void;
};

function preferences(): Preferences | undefined {
  return (globalThis as unknown as { Zotero?: { Prefs?: Preferences } }).Zotero
    ?.Prefs;
}

function configuredDirectory(): string {
  const path = getNotesDirectoryConfig()?.defaultTargetPath;
  if (
    !path ||
    !isAbsoluteLocalPath(path) ||
    /[\0\r\n]/.test(path) ||
    path.split(/[\\/]/).some((part) => part === "." || part === "..")
  ) {
    throw new Error(
      "Learning note sync requires an absolute Notes Directory default target without dot segments.",
    );
  }
  return path;
}

/** Sync is opt-in; only the boolean preference true enables it. */
export function isLearningNoteSyncEnabled(): boolean {
  return preferences()?.get(ENABLED_KEY, true) === true;
}

/** Enabling (including re-enabling) authorizes the current default target. */
export function setLearningNoteSyncEnabled(enabled: boolean): void {
  const prefs = preferences();
  if (!prefs)
    throw new Error("Learning note sync preferences are unavailable.");
  if (!enabled) {
    prefs.set(ENABLED_KEY, false, true);
    prefs.set(DIRECTORY_KEY, "", true);
    return;
  }
  const directory = configuredDirectory();
  prefs.set(ENABLED_KEY, false, true);
  prefs.set(DIRECTORY_KEY, directory, true);
  prefs.set(ENABLED_KEY, true, true);
}

/** Never substitute a newly configured destination for the authorized one. */
export function getLearningNoteSyncDirectory(): string | null {
  if (!isLearningNoteSyncEnabled()) return null;
  const directory = configuredDirectory();
  if (preferences()?.get(DIRECTORY_KEY, true) !== directory) {
    throw new Error(
      "Learning note sync authorization does not match the Notes Directory. Re-enable learning note sync to authorize the current destination.",
    );
  }
  return directory;
}
