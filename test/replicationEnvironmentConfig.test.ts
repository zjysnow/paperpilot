import { strict as assert } from "node:assert";
import {
  discoverReplicationPythonEnvironments,
  getReplicationPythonEnvironment,
  getReplicationPythonExecutable,
  rewritePythonCommandForReplication,
  setReplicationPythonEnvironment,
} from "../src/utils/replicationEnvironmentConfig";

const preferences = new Map<string, unknown>();

describe("replication environment configuration", function () {
  beforeEach(function () {
    (globalThis as Record<string, unknown>).Zotero = {
      Prefs: {
        get: (key: string) => preferences.get(key),
        set: (key: string, value: unknown) => preferences.set(key, value),
      },
    };
    preferences.clear();
  });

  afterEach(function () {
    delete (globalThis as Record<string, unknown>).Services;
    delete (globalThis as Record<string, unknown>).Components;
    delete (globalThis as Record<string, unknown>).IOUtils;
  });

  it("persists a configured virtual environment and resolves its interpreter", function () {
    setReplicationPythonEnvironment("/projects/paper/.venv");

    assert.equal(getReplicationPythonEnvironment(), "/projects/paper/.venv");
    assert.match(getReplicationPythonExecutable(), /python(?:\.exe)?$/i);
  });

  it("preserves an explicitly configured Python executable", function () {
    setReplicationPythonEnvironment("/projects/paper/.venv/bin/python");

    assert.equal(
      getReplicationPythonExecutable(),
      "/projects/paper/.venv/bin/python",
    );
  });

  it("rewrites Python commands while retaining shell chaining", function () {
    assert.equal(
      rewritePythonCommandForReplication(
        "python scripts/check.py && python3 -m train",
        "/projects/paper/.venv/bin/python",
      ),
      '"/projects/paper/.venv/bin/python" scripts/check.py && "/projects/paper/.venv/bin/python" -m train',
    );
  });

  it("discovers workspace and common global virtual environments", async function () {
    preferences.set(
      "extensions.zotero.paperpilot.workspaceDirectory",
      "/workspace",
    );
    (globalThis as Record<string, unknown>).Services = {
      dirsvc: { get: () => ({ path: "/home/test" }) },
    };
    (globalThis as Record<string, unknown>).Components = {
      interfaces: { nsIFile: {} },
    };
    const executableSuffix =
      process.platform === "win32" ? "Scripts/python.exe" : "bin/python";
    const workspacePython = `/workspace/.venv/${executableSuffix}`;
    const globalPython = `/home/test/.virtualenvs/ml/${executableSuffix}`;
    (globalThis as Record<string, unknown>).IOUtils = {
      exists: async (path: string) =>
        path === workspacePython || path === globalPython,
      getChildren: async (path: string) =>
        path === "/home/test/.virtualenvs"
          ? ["/home/test/.virtualenvs/ml"]
          : [],
    };

    const environments = await discoverReplicationPythonEnvironments();

    assert.deepEqual(
      environments.map((environment) => environment.environmentPath).sort(),
      ["/home/test/.virtualenvs/ml", "/workspace/.venv"],
    );
  });
});
