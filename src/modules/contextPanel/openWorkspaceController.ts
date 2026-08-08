import { t } from "../../utils/i18n";
import {
  getWorkspaceDirectory,
  getWorkspaceFolderPath,
  isValidWorkspaceFolderName,
  getVSCodeExecutablePath,
} from "../../utils/workspaceDirectoryConfig";
import { showConversationRenameDialog } from "./conversationRenameDialog";
import { getRuntimePlatformInfo } from "../../utils/runtimePlatform";

type IOUtilsLike = {
  makeDirectory?: (
    path: string,
    options?: { createAncestors?: boolean; ignoreExisting?: boolean },
  ) => Promise<void>;
};

type WorkspaceItem = {
  getField?: (field: string) => unknown;
  setField?: (field: string, value: string) => void;
  saveTx?: () => Promise<unknown>;
};

function getIOUtils(): IOUtilsLike | undefined {
  return (globalThis as typeof globalThis & { IOUtils?: IOUtilsLike }).IOUtils;
}

function launchVSCode(workspacePath: string): void {
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
  ) as {
    initWithPath: (path: string) => void;
  };
  const process = classes["@mozilla.org/process/util;1"].createInstance(
    interfaces.nsIProcess,
  ) as {
    init: (file: unknown) => void;
    runAsync?: (args: string[], count: number, observer?: unknown) => void;
    run: (blocking: boolean, args: string[], count: number) => void;
  };
  const platform = getRuntimePlatformInfo().platform;
  const configuredPath = getVSCodeExecutablePath().trim();
  const executable =
    platform === "macos"
      ? "/usr/bin/open"
      : configuredPath ||
        (platform === "windows"
          ? "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd"
          : "/usr/bin/code");
  file.initWithPath(executable);
  process.init(file);
  const args =
    platform === "macos"
      ? ["-a", configuredPath || "Visual Studio Code", workspacePath]
      : [workspacePath];
  if (process.runAsync) {
    process.runAsync(args, args.length);
  } else {
    process.run(false, args, args.length);
  }
}

function getShortTitle(item: WorkspaceItem): string {
  try {
    return String(item.getField?.("shortTitle") || "").trim();
  } catch {
    return "";
  }
}

export async function openWorkspaceInVSCode(options: {
  doc: Document;
  item: WorkspaceItem | null;
  setStatus: (message: string, level: "ready" | "warning" | "error") => void;
}): Promise<void> {
  const rootDirectory = getWorkspaceDirectory().trim();
  if (!rootDirectory) {
    options.setStatus(t("Configure a Workspace Directory first"), "warning");
    return;
  }
  if (!options.item) {
    options.setStatus(t("Open a paper to create a workspace"), "warning");
    return;
  }

  let folderName = getShortTitle(options.item);
  let shouldPersistShortTitle = false;
  if (!folderName) {
    const promptedName = await showConversationRenameDialog(options.doc, {
      title: t("Workspace folder name"),
      initialTitle: "",
      confirmLabel: t("Create workspace"),
      cancelLabel: t("Cancel"),
    });
    if (!promptedName) return;
    folderName = promptedName.trim();
    shouldPersistShortTitle = true;
  }
  if (!isValidWorkspaceFolderName(folderName)) {
    options.setStatus(
      t("Workspace folder name contains invalid characters"),
      "error",
    );
    return;
  }

  const workspacePath = getWorkspaceFolderPath(folderName);
  const io = getIOUtils();
  if (!io?.makeDirectory) {
    options.setStatus(t("File I/O is not available"), "error");
    return;
  }

  try {
    await io.makeDirectory(workspacePath, {
      createAncestors: true,
      ignoreExisting: true,
    });
    if (shouldPersistShortTitle) {
      if (
        typeof options.item.setField !== "function" ||
        typeof options.item.saveTx !== "function"
      ) {
        throw new Error("Cannot save the workspace short title");
      }
      options.item.setField("shortTitle", folderName);
      await options.item.saveTx();
    }
    launchVSCode(workspacePath);
    options.setStatus(t("Opened workspace in VS Code"), "ready");
  } catch (error) {
    options.setStatus(
      `${t("Failed to open workspace")}: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
  }
}
