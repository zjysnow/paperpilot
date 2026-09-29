import { strict as assert } from "node:assert";
import { verifyWorkspaceDirectoryAccess } from "../src/utils/workspaceDirectoryConfig";

describe("workspace directory access verification", function () {
  const files = new Map<string, Uint8Array>();

  beforeEach(function () {
    files.clear();
    (globalThis as Record<string, unknown>).IOUtils = {
      async makeDirectory() {
        return undefined;
      },
      async write(path: string, bytes: Uint8Array) {
        files.set(path, bytes);
      },
      async read(path: string) {
        const bytes = files.get(path);
        if (!bytes) throw new Error("Missing probe file");
        return bytes;
      },
      async remove(path: string) {
        files.delete(path);
      },
    };
  });

  afterEach(function () {
    delete (globalThis as Record<string, unknown>).IOUtils;
  });

  it("creates, reads, and removes a probe file", async function () {
    await verifyWorkspaceDirectoryAccess("/workspace");

    assert.equal(files.size, 0);
  });

  it("cleans up the probe when read-back fails", async function () {
    (globalThis as Record<string, unknown>).IOUtils = {
      async makeDirectory() {
        return undefined;
      },
      async write(path: string, bytes: Uint8Array) {
        files.set(path, bytes);
      },
      async read() {
        return new TextEncoder().encode("unexpected");
      },
      async remove(path: string) {
        files.delete(path);
      },
    };

    await assert.rejects(
      verifyWorkspaceDirectoryAccess("/workspace"),
      /read-back/i,
    );
    assert.equal(files.size, 0);
  });
});
