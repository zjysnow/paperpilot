import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const providerSource = fs.readFileSync(
  path.join(root, "src/utils/providerPresets.ts"),
  "utf8",
);
const preferenceSource = fs.readFileSync(
  path.join(root, "addon/content/preferences.xhtml"),
  "utf8",
);

assert.match(providerSource, /id: "ollama"/);
assert.doesNotMatch(providerSource, /id: "openai"/);
assert.match(preferenceSource, /add-ollama-provider/);
globalThis.console.log("Workflow smoke tests passed.");
