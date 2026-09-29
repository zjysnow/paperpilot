import { config } from "../../package.json";
import { joinLocalPath } from "./localPath";
import { getRuntimePlatformInfo } from "./runtimePlatform";
import { getWorkspaceDirectory } from "./workspaceDirectoryConfig";

const REPLICATION_PYTHON_ENVIRONMENT_KEY = `${config.prefsPrefix}.replicationPythonEnvironment`;

type ZoteroPrefsLike = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
};

type IOUtilsLike = {
  exists?: (path: string) => Promise<boolean>;
  getChildren?: (path: string) => Promise<string[]>;
};

export type ReplicationPythonEnvironmentOption = {
  environmentPath: string;
  executablePath: string;
  label: string;
  source: "workspace" | "virtualenv" | "pyenv" | "conda" | "configured";
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

export function getReplicationPythonEnvironment(): string {
  const value = getPrefs()?.get?.(REPLICATION_PYTHON_ENVIRONMENT_KEY, true);
  return typeof value === "string" ? value.trim() : "";
}

export function setReplicationPythonEnvironment(value: string): void {
  getPrefs()?.set?.(REPLICATION_PYTHON_ENVIRONMENT_KEY, value.trim(), true);
}

function isPythonExecutablePath(value: string): boolean {
  return /(?:^|[\\/])(?:python|python3|python\.exe|python3\.exe)$/i.test(value);
}

/**
 * Resolves a configured virtual-environment root to its Python executable.
 * Users may also configure the executable path directly.
 */
export function getReplicationPythonExecutable(): string {
  const environment = getReplicationPythonEnvironment();
  if (!environment) return "";
  if (isPythonExecutablePath(environment)) return environment;
  return getRuntimePlatformInfo().platform === "windows"
    ? joinLocalPath(environment, "Scripts", "python.exe")
    : joinLocalPath(environment, "bin", "python");
}

export function rewritePythonCommandForReplication(
  command: string,
  pythonExecutable = getReplicationPythonExecutable(),
): string {
  if (!pythonExecutable) return command;
  const quotedExecutable = `"${pythonExecutable.replace(/"/g, '\\"')}"`;
  return command.replace(
    /(^|(?:&&|\|\||;|\|)\s*)(?:python3?|py)(?=\s|$)/g,
    (_match, prefix: string) => `${prefix}${quotedExecutable}`,
  );
}

function getIOUtils(): IOUtilsLike | undefined {
  return (globalThis as typeof globalThis & { IOUtils?: IOUtilsLike }).IOUtils;
}

function getHomeDirectory(): string {
  const services = (
    globalThis as typeof globalThis & {
      Services?: {
        dirsvc?: {
          get?: (key: string, iface?: unknown) => { path?: unknown };
        };
      };
      Components?: { interfaces?: { nsIFile?: unknown } };
      process?: { env?: Record<string, string | undefined> };
    }
  ).Services;
  const components = (
    globalThis as typeof globalThis & {
      Components?: { interfaces?: { nsIFile?: unknown } };
    }
  ).Components;
  try {
    const path = services?.dirsvc?.get?.(
      "Home",
      components?.interfaces?.nsIFile,
    )?.path;
    if (typeof path === "string" && path.trim()) return path.trim();
  } catch {
    // Fall through to environment variables when the host cannot resolve Home.
  }
  const env = (
    globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env;
  return (env?.HOME || env?.USERPROFILE || "").trim();
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() || path;
}

function sourceLabel(
  source: ReplicationPythonEnvironmentOption["source"],
): string {
  switch (source) {
    case "workspace":
      return "Workspace";
    case "virtualenv":
      return "virtualenv";
    case "pyenv":
      return "pyenv";
    case "conda":
      return "Conda/Mamba";
    case "configured":
      return "Configured";
  }
}

async function listDirectoryChildren(path: string): Promise<string[]> {
  const io = getIOUtils();
  if (!io?.getChildren) return [];
  try {
    return await io.getChildren(path);
  } catch {
    return [];
  }
}

async function hasPythonExecutable(path: string): Promise<boolean> {
  const io = getIOUtils();
  if (!io?.exists) return false;
  try {
    return Boolean(await io.exists(getPythonExecutableForEnvironment(path)));
  } catch {
    return false;
  }
}

function getPythonExecutableForEnvironment(environment: string): string {
  return getRuntimePlatformInfo().platform === "windows"
    ? joinLocalPath(environment, "Scripts", "python.exe")
    : joinLocalPath(environment, "bin", "python");
}

async function addEnvironmentIfValid(
  options: ReplicationPythonEnvironmentOption[],
  environmentPath: string,
  source: ReplicationPythonEnvironmentOption["source"],
): Promise<void> {
  const normalized = environmentPath.trim();
  if (
    !normalized ||
    options.some((option) => option.environmentPath === normalized) ||
    !(await hasPythonExecutable(normalized))
  ) {
    return;
  }
  options.push({
    environmentPath: normalized,
    executablePath: getPythonExecutableForEnvironment(normalized),
    label: `${basename(normalized)} (${sourceLabel(source)})`,
    source,
  });
}

/**
 * Discovers common local Python virtual-environment locations without invoking
 * a shell. Scanning is intentionally shallow to keep the preferences UI fast.
 */
export async function discoverReplicationPythonEnvironments(): Promise<
  ReplicationPythonEnvironmentOption[]
> {
  const options: ReplicationPythonEnvironmentOption[] = [];
  const workspaceDirectory = getWorkspaceDirectory();
  const homeDirectory = getHomeDirectory();
  const configured = getReplicationPythonEnvironment();

  if (configured) {
    if (isPythonExecutablePath(configured)) {
      const io = getIOUtils();
      const executableExists = io?.exists
        ? await io.exists(configured).catch(() => false)
        : false;
      if (executableExists) {
        options.push({
          environmentPath: configured,
          executablePath: configured,
          label: `${basename(configured)} (${sourceLabel("configured")})`,
          source: "configured",
        });
      }
    } else {
      await addEnvironmentIfValid(options, configured, "configured");
    }
  }

  const workspaceCandidates = workspaceDirectory
    ? [
        joinLocalPath(workspaceDirectory, ".venv"),
        joinLocalPath(workspaceDirectory, "venv"),
        joinLocalPath(workspaceDirectory, ".env"),
      ]
    : [];
  for (const candidate of workspaceCandidates) {
    await addEnvironmentIfValid(options, candidate, "workspace");
  }

  const roots: Array<{
    path: string;
    source: ReplicationPythonEnvironmentOption["source"];
  }> = homeDirectory
    ? [
        {
          path: joinLocalPath(homeDirectory, ".virtualenvs"),
          source: "virtualenv",
        },
        {
          path: joinLocalPath(homeDirectory, ".pyenv", "versions"),
          source: "pyenv",
        },
        {
          path: joinLocalPath(homeDirectory, "miniconda3", "envs"),
          source: "conda",
        },
        {
          path: joinLocalPath(homeDirectory, "anaconda3", "envs"),
          source: "conda",
        },
        {
          path: joinLocalPath(homeDirectory, "mambaforge", "envs"),
          source: "conda",
        },
        {
          path: joinLocalPath(homeDirectory, "miniforge3", "envs"),
          source: "conda",
        },
        {
          path: joinLocalPath(homeDirectory, ".conda", "envs"),
          source: "conda",
        },
        {
          path: joinLocalPath(homeDirectory, "micromamba", "envs"),
          source: "conda",
        },
      ]
    : [];
  for (const root of roots) {
    for (const child of await listDirectoryChildren(root.path)) {
      await addEnvironmentIfValid(options, child, root.source);
    }
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}
