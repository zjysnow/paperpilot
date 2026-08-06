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
const panelSource = fs.readFileSync(
  path.join(root, "src/modules/contextPanel/buildUI.ts"),
  "utf8",
);
const chatSource = fs.readFileSync(
  path.join(root, "src/modules/contextPanel/chat.ts"),
  "utf8",
);
const stylesheetSource = fs.readFileSync(
  path.join(root, "addon/content/zoteroPane.css"),
  "utf8",
);

assert.match(providerSource, /id: "ollama"/);
assert.doesNotMatch(providerSource, /id: "openai"/);
assert.match(preferenceSource, /add-ollama-provider/);
assert.match(preferenceSource, /refresh-ollama-models/);
assert.match(panelSource, /disabled: true/);
assert.match(panelSource, /Reasoning controls are not supported by Ollama yet/);
assert.match(chatSource, /paperAttachmentsExpanded/);
assert.match(chatSource, /paperpilot-user-papers-icon/);
assert.match(chatSource, /paperpilot-user-screenshots-icon/);
assert.match(chatSource, /paperpilot-context-icon-text/);
assert.match(chatSource, /creatorLabel/);
assert.match(chatSource, /year/);
assert.match(chatSource, /collapseOtherContextExpansions/);
assert.match(stylesheetSource, /border-radius: 999px/);
assert.match(stylesheetSource, /action-papers\.svg/);
assert.match(stylesheetSource, /action-screenshot\.svg/);
assert.match(stylesheetSource, /flex-direction: row/);
assert.match(stylesheetSource, /align-self: flex-start/);
assert.match(stylesheetSource, /display: none/);
globalThis.console.log("Workflow smoke tests passed.");
