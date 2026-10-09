# Current-version improvement backlog

Reviewed version: `v1.2.3` (`f53ce73`)

This list contains issues confirmed from the current implementation and
prioritized improvements. Items are ordered by user-data risk and release
impact rather than implementation size.

## P0 — address before the next release

### [x] Delete persisted agent traces when a conversation is deleted

**Evidence:** Agent run metadata, final answers, and event payloads are stored
in the agent trace tables by `src/agent/store/traceStore.ts`. Conversation
deletion clears conversation memory, transcripts, tool-result handles,
evidence, and coverage, but does not clear either trace table in
`src/modules/contextPanel/agentConversationCleanup.ts`.

**Impact:** Deleting a chat leaves potentially sensitive prompts, tool inputs,
tool results, and generated answers in Zotero's database. When trace export is
enabled, the corresponding JSON debug export is also left on disk.

**Work:**

1. Add an exported trace-store cleanup function that deletes run events and
   runs by `conversation_key`, and removes their exported debug files when
   applicable.
2. Call it from `clearAgentConversationState`.
3. Define a retention policy for completed traces that are not tied to a
   deleted conversation, including a bounded age or count.
4. Add tests proving that conversation deletion removes database rows,
   in-memory trace state, and exported trace files.

**Acceptance criteria:** After deleting a conversation, querying either trace
table for its conversation key returns no rows; no trace export for one of its
runs remains readable.

### [x] Commit a dependency lockfile and make CI use deterministic installs

**Evidence:** The repository has no committed lockfile, and the release
workflow uses `npm install` in `.github/workflows/release.yml`.

**Impact:** The same tag can build against different versions of every
caret-ranged dependency, making releases non-reproducible and allowing a newly
published incompatible dependency version to break or alter a release.

**Work:**

1. Generate and commit `package-lock.json` using the supported Node version.
2. Replace release-workflow installation with `npm ci --ignore-scripts` (or
   document and narrowly enable any install scripts that are required).
3. Add a CI check that fails if the manifest and lockfile are out of sync.

**Acceptance criteria:** Two clean installs from the same revision resolve an
identical dependency graph, and release CI uses `npm ci`.

**Status:** Completed with committed lockfile and deterministic CI installs.

## P1 — schedule for the next development cycle

### [x] Run all defined quality gates in pull-request and release CI

**Evidence:** `package.json` defines `lint:check` and `check:cycles`, but the
release workflow runs only `npm test`; there is no pull-request workflow.

**Impact:** Formatting violations, ESLint findings, and newly introduced import
cycles can reach a tagged release even though project checks exist to detect
them.

**Work:**

1. Add a pull-request workflow using the pinned dependency install.
2. Run `npm run lint:check`, `npm run check:cycles`, and `npm test` in CI.
3. Keep the release job dependent on the same verification command or reusable
   workflow.

**Acceptance criteria:** A PR that introduces a Prettier/ESLint violation or
an import cycle fails before merge; a release cannot bypass those checks.

### [x] Enforce absolute paths and explicit bounds in `file_io`

**Evidence:** `src/agent/tools/write/fileIO.ts` describes `filePath` as an
absolute path and tells the model to always use absolute paths, but validation
only checks that the value is non-empty. Relative paths are passed directly to
Gecko I/O APIs. `offset` and `length` also have no upper bound, so an
unbounded read can load a large local text file into memory.

**Impact:** File behavior depends on Zotero's process working directory rather
than the displayed request, and accidental large-file reads can degrade the UI
or inflate model context.

**Work:**

1. Reuse or add a cross-platform absolute-path guard for reads and writes.
2. Reject relative, empty, and whitespace-only normalized paths with a clear
   tool error.
3. Set a conservative default/max read size and return continuation metadata
   for larger files.
4. Add unit tests for POSIX, Windows-drive, and UNC paths; relative-path
   rejection; and oversized reads.

**Acceptance criteria:** Relative paths are rejected before filesystem access,
and any successful file read has a documented, tested maximum payload size.

### [x] Add contract tests for the local MCP endpoint

**Evidence:** The MCP server in `src/agent/mcp/server.ts` controls bearer-token
authentication, current-turn scope tokens, tool exposure, raw-PDF isolation,
and write confirmation. The test suite contains no MCP endpoint test file.

**Impact:** A regression in authentication, scope handling, or confirmation
could expose library data or bypass the intended approval boundary without
being caught by the current test suite.

**Work:**

1. Test unauthorized requests, malformed JSON-RPC, and bearer-token rotation.
2. Test expired/unknown scoped tokens and concurrent scopes from two
   conversations.
3. Test raw-PDF mode rejects hidden filesystem/retrieval tools and that write
   calls require a matching confirmation handler.
4. Test read-result cache keys do not return results across scopes.

**Acceptance criteria:** The endpoint behavior above is covered by isolated
tests using `invokeRegisteredZoteroMcpEndpoint`.

## P2 — maintainability and resilience

### [x] Cover Mermaid SVG sanitization with adversarial tests

**Evidence:** `src/modules/contextPanel/mermaidSvg.ts` implements a custom
allowlist sanitizer and then injects the result with `innerHTML`. The current
test suite has no direct sanitizer tests.

**Impact:** The renderer processes model-generated diagram content; changes to
the sanitizer or Mermaid output can create XSS or rendering regressions that
are hard to detect manually.

**Work:**

1. Add allow/deny fixtures for event handlers, `javascript:` URLs, external
   `href`/`src`, CSS imports, CSS `url()`, dangerous tags, malformed SVG, and
   valid Mermaid output.
2. Run the fixtures in the normal unit-test command.
3. Prefer platform sanitization where it can preserve the required SVG and
   `foreignObject` behavior; otherwise document the custom sanitizer's threat
   model and maintenance requirements.

**Acceptance criteria:** Every blocked vector is rejected with a reason, and a
representative valid Mermaid SVG still renders.

### [x] Publish an automated support matrix for supported runtime combinations

**Evidence:** The plugin uses Zotero/Gecko-specific APIs (`IOUtils`,
`Subprocess`, `Zotero.Server`, and `OS.File`) with several compatibility
fallbacks, but CI only runs a Node-based test suite.

**Impact:** Platform-specific execution paths—especially Windows command
capture, filesystem writes, and Zotero HTTP endpoint registration—can regress
without a release-blocking signal.

**Work:**

1. Document supported Zotero and operating-system versions.
2. Add a smoke-test checklist or automated harness for macOS, Windows, and
   Linux, covering `file_io`, `run_command`, and MCP startup.
3. Record expected fallback behavior when a Gecko API is unavailable.

**Acceptance criteria:** Each release has reproducible evidence for the
documented support matrix, or clearly identifies untested platforms.

## Validation status

Validated with `npm ci --ignore-scripts --no-audit --no-fund`,
`npm run lint:check`, `npm run check:cycles`, and `npm test`.

## Paper learning workflow — inspired by PaperUnfold

Design reference: [PaperUnfold](https://github.com/Kstheme/PaperUnfold).
Reuse Paper Pilot's paper tools, quote anchors, Skills, file approvals, and
undo support. Do not replace ordinary lightweight Q&A or introduce a second
PDF/OCR pipeline. The implementation is native TypeScript, not a dependency
on PaperUnfold's Python helpers.

### [x] P0 — Add a mechanism-complete paper guide

**Work:** Add an explicit `paper-guide` Skill, a structured guide contract,
and validated export. Explain the problem, central steps or inferences,
intermediate artifacts, evidence, conditions, and limitations. Adapt the
visual to method, empirical, or theoretical research. Distinguish author
claims, inference, background, and analogy.

**Acceptance criteria:** Claims reference supplied evidence; quoted evidence
is checked against the selected attachment's extracted text and uses native
quote citations. A guide records actual reading coverage and missing material.
Ordinary summary requests retain the existing Q&A workflow.

**Status:** Implemented as a manual `paper-guide` Skill, typed guide validation,
literal attachment-source checking, and native quote citation generation.
The chat guide reuses Mermaid; offline export uses explicit SVG relationships.
Instruction v3 retains the default six-part guide for generic questions and
adds mandatory automatic database checkpoints.
Current-turn system guidance gives its mechanism/evidence requirements priority
over ordinary one-overview defaults; regression tests cover prompt priority and
upgrades of unmodified seeded Skills. This does not certify real-model output
quality; the real-paper release evaluation below remains required.

### [x] P1 — Add focused tutoring and portable learning progress

**Work:** Add an explicit `paper-tutor` Skill with one-point-at-a-time feedback,
direct-explanation/skip/pause controls, and a versioned progress record.
Track explained-unverified, partial, and narrowly demonstrated understanding.

**Acceptance criteria:** Progress can be saved and resumed across conversations.
Resume checks paper/attachment identity and extracted-source fingerprint;
missing or changed source fails explicitly without upgrading mastery.
Partial/mastered entries require an answer and assessment, not just a status.
Explicit file exports use existing approval and undo behavior.

**Status:** Implemented as a manual `paper-tutor` Skill and `paper_learning`
progress/resume operations. Fixed Tutor mode persists per conversation until
Normal is selected; direct explanation, skipping, and pausing remain supported.
Records carry native paper/attachment keys and the extracted-source fingerprint.

### [x] P1 — Add persistent UI modes and database-first learning state

**Work:** Add Normal/Guide/Tutor selection beside the Agent toggle, persist it
per conversation, and force the corresponding Skill without repeated commands.
Keep structured learning state separate from already-persisted chat transcripts.

**Acceptance criteria:** Send/retry honor mode; Normal stops Tutor inheritance.
Successful turns commit source-checked checkpoints transactionally; failed or
cancelled turns do not. Restore across conversations/model changes without a
JSON path. Reject concurrent goal overwrites and changed sources explicitly.

**Status:** Implemented modes, database tables, automatic restore/checkpoint
enforcement, revision checks, and focused lifecycle regressions. JSON remains
optional portable export/restore rather than the authoritative store.

### [x] P1 — Optionally project learning state into Obsidian notes

**Work:** Reuse Notes Directory with explicit opt-in; write one stable Markdown
note per paper/attachment containing all learning goals.

**Acceptance criteria:** Preserve manual regions, reject managed-block edits
and untrusted collisions, require reauthorization after directory changes,
write atomically, and retain DB state with an explicit warning on sync failure.
Existing-note binding requires approval; do not guess by title or parse notes
back into authoritative state.

**Status:** Implemented opt-in settings, stable managed blocks, conflict
detection, atomic synchronization, and configuration/I/O regressions. Native
Zotero tests additionally verify real SQLite/PDF/Markdown creation and updates,
manual-region preservation, conflicts without lost DB state, and cross-chat
restore using a scripted model adapter.

### [x] P1 — Export a portable offline HTML guide

**Work:** Render structured guides with connected SVG diagrams, formula
rendering, folded evidence, and chapter-specific Tutor prompts. Embed the
structured record in the HTML so export does not require a second file.

**Acceptance criteria:** No CDN or external font dependency; model text is
escaped, graph endpoints are validated, and evidence links reveal their
target. Export errors do not report a saved guide.

**Status:** Implemented in TypeScript with embedded MathML and SVG, folded
native evidence, the structured JSON record, and copyable chapter Tutor prompts.
Original figure embedding and arbitrary interactive experiments are not shipped.

### [ ] P2 — Add native chapter-to-Tutor actions

**Work:** Replace copyable chapter prompts with a native action that binds
the paper, selected topic, and learning goal to the compose box.

**Acceptance criteria:** Switching or cancelling preserves the current
conversation and never silently changes the selected paper.

### [ ] P2 — Add bounded interactive mechanism demonstrations

**Work:** Start with an independently tested softmax-temperature example;
add other mechanisms only with explicit assumptions and source-grounded
explanations. Do not promise arbitrary generated experiments.

**Acceptance criteria:** Numerical outputs are tested, invented inputs are
labeled as teaching examples, and unsupported mechanisms remain diagrams.

### [x] Validate and document the learning workflow

**Work:** Cover contracts, source mismatch, graph references, file approvals,
offline rendering, and Skill routing. Document English and Chinese usage.
Use representative method, empirical, and theoretical fixtures.

**Acceptance criteria:** Targeted unit tests, type checking, lint, and build
pass. Real Zotero/browser checks are recorded separately from static tests;
neither successful export nor a learning record proves learning gains.

**Status:** Added contract, tool persistence/approval/undo, source mismatch,
Skill routing/continuity, and MCP exposure tests plus
[English/Chinese usage documentation](doc/paper-learning.md).
Browser checks on generated HTML verify MathML layout, evidence expansion
(including repeated links), a chapter Tutor prompt, a 390px viewport, and
zero external resource loads. Existing Zotero namespace integration tests
pass. Runtime-loader regressions cover seeding/loading patternless manual
Skills while preserving customizations and intentional deletions. A real
Zotero workflow checks `/paper-` menu visibility, selection of both learning
Skills, and the submitted `forcedSkillIds`; Agent-runtime regressions cover
menu-selected Tutor continuation and switching to another Skill. These
checks are not an end-to-end real-model learning evaluation.

### [ ] Release check — evaluate learning with real papers in Zotero

Use one method, empirical, and theoretical paper with the configured model.
Verify explanation fidelity, actual coverage reporting, Tutor feedback,
pause/save/new-conversation resume, and changed-attachment failure in Zotero.
Record the model/runtime and sources. This operational quality check remains
separate from automated contract tests and synthetic browser fixtures.
