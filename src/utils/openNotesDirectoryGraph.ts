import {
  getObsidianExecutablePath,
  getNotesDirectoryFolder,
  getNotesDirectoryPath,
} from "./notesDirectoryConfig";
import { joinLocalPath } from "./localPath";
import { getRuntimePlatformInfo } from "./runtimePlatform";

function launchObsidianUri(uri: string): void {
  const Components = (
    globalThis as typeof globalThis & {
      Components?: {
        classes?: Record<
          string,
          { createInstance: (iface: unknown) => Record<string, unknown> }
        >;
        interfaces?: Record<string, unknown>;
      };
    }
  ).Components;
  const classes = Components?.classes;
  const interfaces = Components?.interfaces;
  if (!classes || !interfaces) {
    throw new Error("Process launching is not available");
  }

  const file = classes["@mozilla.org/file/local;1"].createInstance(
    interfaces.nsIFile,
  ) as { initWithPath: (path: string) => void };
  const process = classes["@mozilla.org/process/util;1"].createInstance(
    interfaces.nsIProcess,
  ) as {
    init: (file: unknown) => void;
    runAsync?: (args: string[], count: number, observer?: unknown) => void;
    run: (blocking: boolean, args: string[], count: number) => void;
  };
  const platform = getRuntimePlatformInfo().platform;
  const configuredPath = getObsidianExecutablePath().trim();
  const executable =
    platform === "macos" ? "/usr/bin/open" : configuredPath || "obsidian";
  const args =
    platform === "macos" ? ["-a", configuredPath || "Obsidian", uri] : [uri];
  file.initWithPath(executable);
  process.init(file);
  if (process.runAsync) {
    process.runAsync(args, args.length);
  } else {
    process.run(false, args, args.length);
  }
}

export function openNotesDirectoryGraph(): void {
  const dirPath = getNotesDirectoryPath().trim();
  if (!dirPath) {
    throw new Error("Notes directory is not configured");
  }
  const targetFolder = getNotesDirectoryFolder().trim();
  const fullPath = targetFolder
    ? joinLocalPath(dirPath, targetFolder)
    : dirPath;
  launchObsidianUri(
    `obsidian://open?path=${encodeURIComponent(fullPath)}&view=graph`,
  );
}
