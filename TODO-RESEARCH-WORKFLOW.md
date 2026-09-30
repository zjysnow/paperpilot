# Zotero + Obsidian + VS Code research workflow backlog

## Goal

Build a repeatable workflow in which:

- Zotero is the authority for bibliographic metadata, PDFs, collections, and
  citation records.
- Obsidian is the authority for reading notes, conceptual links, and research
  decisions.
- VS Code and Git are the authority for reproduction code, environments,
  experiment configurations, and results.
- Paper Pilot is the reviewed bridge between these systems; it does not become
  an unreviewed source of truth.

## Operating rules

1. Do not create bidirectional automatic synchronization between Zotero notes,
   Obsidian notes, and project documentation.
2. Use a stable paper identity in every system: DOI first, then citation key
   and Zotero item key.
3. Record paper facts with an evidence source; label model inferences and
   reproduction assumptions separately.
4. Keep PDFs in Zotero, data and generated artifacts out of Git, and source
   code plus reproducibility metadata in Git.
5. Require review before Paper Pilot writes outside the configured Obsidian
   note directory or VS Code reproduction workspace.

## Phase 0 - Establish the shared contract

### [ ] Choose canonical local directories

**Work**

1. Create one Obsidian Vault for research notes.
2. Create one parent directory for paper reproduction repositories.
3. Configure Paper Pilot's note-output directory to
   `<vault>/01-Papers`.
4. Configure its workspace directory to the reproduction-repository parent.
5. Record both absolute paths in the team's onboarding documentation; do not
   store machine-specific paths in shared notes.

**Acceptance criteria**

- Paper Pilot can create a reviewed Markdown note in `01-Papers`.
- Paper Pilot can create a reviewed reproduction project below the selected
  workspace directory.
- No write operation targets the desktop, downloads folder, or an unspecified
  directory by default.

**Implementation status:** The setup sequence is documented in
[`doc/research-workflow-setup.md`](doc/research-workflow-setup.md). Each user
must still choose and verify their own local directories in Paper Pilot
preferences.

### [x] Define paper identifiers and status vocabulary

**Work**

1. Enable a stable citation-key convention, preferably through Zotero Better
   BibTeX if it is already part of the local workflow.
2. Require `doi`, `citekey`, and `zotero_item_key` in every paper note where
   available.
3. Standardize statuses:
   `inbox`, `reading`, `understood`, `candidate`, `reproducing`,
   `reproduced`, `blocked`, and `archived`.
4. Standardize tags into namespaces such as `domain/`, `method/`, `dataset/`,
   and `status/`.

**Acceptance criteria**

- A paper can be found from any system using its DOI or citation key.
- Status has one spelling and one meaning across Zotero and Obsidian.

**Implementation status:** File-based notes now expose the verified Zotero item
key and use one documented status vocabulary (`inbox`, `reading`, `understood`,
`candidate`, `reproducing`, `reproduced`, `blocked`, `archived`) plus stable
tag namespaces. Enabling and configuring an external citation-key provider
such as Better BibTeX remains a per-user Zotero setup step.

### [x] Create templates before bulk note generation

**Work**

1. Create an Obsidian paper-note template with YAML frontmatter, evidence,
   critique, and reproduction-decision sections.
2. Create a concept-note template for reusable ideas that link multiple
   papers.
3. Create a VS Code reproduction-project template with `README.md`,
   `configs/`, `src/`, `scripts/`, `docs/`, `outputs/`, and `.gitignore`.
4. Create templates for `EVIDENCE.md`, `REPRODUCTION_PLAN.md`,
   `DATA_REQUIREMENTS.md`, and `EXPERIMENT_RESULTS.md`.

**Acceptance criteria**

- A new paper note contains links to Zotero and its optional reproduction
  project.
- A new project contains a clear command to validate data and run a smoke
  test.

**Implementation status:** Paper Pilot now ships a `research-workflow` Skill
and requires evidence, data-requirements, reproduction-plan, and
experiment-results documents in its paper-replication workflow. Creating and
customizing the user's local Vault/project templates remains a Phase 0 setup
task. Copy-ready
[dashboard and reproduction-project templates](doc/templates) are also
provided.

## Phase 1 - Make reading evidence-driven

### [ ] Build a Zotero triage queue

**Work**

1. Create collections for `Reading Queue`, `Reproduction Candidates`, and
   active literature-review topics.
2. Add a short triage protocol: verify metadata, inspect abstract/figures,
   assign a status, and decide whether full reading is justified.
3. Keep the initial tag set deliberately small; add tags only when they drive
   a future search or decision.

**Acceptance criteria**

- Every newly imported paper receives a valid status before leaving the inbox.
- The reproduction queue contains only papers with accessible data, code, or
  a documented reason to attempt reimplementation.

### [ ] Generate reviewed paper notes from evidence

**Work**

1. Use Paper Pilot to extract method, data, metrics, baselines, results,
   limitations, and figures from the selected Zotero paper.
2. Require quotations, page/section references, or explicit source passages
   for every numerical claim.
3. Separate note content into `confirmed`, `inferred`, `assumed`, and
   `unresolved`.
4. Review the generated Markdown before writing it to the Obsidian Vault.

**Acceptance criteria**

- Every result reported in the note has a traceable paper source.
- Unsupported details are visibly marked rather than silently invented.

**Implementation status:** The file-based paper-note template now records the
stable Zotero key, workflow status, optional project path, and dedicated
confirmed/inferred/unresolved plus reproduction-decision sections. Confirmed
claims now require a page, section, figure/table, or source-passage anchor;
unanchored numerical claims must be marked as inferred or unresolved.
Generating and reviewing notes for the user's own library remains an
operational task.

### [ ] Convert repeated findings into concept notes

**Work**

1. Extract only durable concepts, methods, datasets, and open questions into
   `02-Concepts`.
2. Link each concept note to its supporting paper notes.
3. Add contrary findings and known limitations instead of maintaining only
   favorable summaries.

**Acceptance criteria**

- A concept note names at least one supporting source.
- Paper notes remain paper-specific; they do not become an unstructured
  duplicate of the whole vault.

## Phase 2 - Make reproduction staged and auditable

### [ ] Define a reproduction decision gate

**Work**

1. Complete the paper-note sections for claimed result, available resources,
   expected compute cost, data license, missing details, and success metric.
2. Decide whether the effort is `replicate`, `reimplement`, `audit`, or
   `defer`.
3. Record the decision and its rationale in Obsidian before creating a
   project.

**Acceptance criteria**

- Every project has a defined target metric or behavior and an explicit
  success tolerance.
- Expensive or unavailable prerequisites are identified before environment
  setup begins.

### [ ] Bootstrap one isolated VS Code project per paper

**Work**

1. Create the project below the reproduction workspace using the citation key
   or a normalized paper identifier.
2. Initialize Git before writing experimental code.
3. Create a separate virtual environment or other locked runtime per project.
4. Add `.env`, datasets, checkpoints, and generated outputs to `.gitignore`.
5. Link the repository README back to the corresponding Obsidian note.

**Acceptance criteria**

- A clean clone can recreate the environment from tracked manifests.
- The repository has no PDF, secret, raw dataset, or large generated artifact
  committed.

### [ ] Capture an evidence-backed implementation plan

**Work**

1. Generate `docs/EVIDENCE.md` from quoted paper evidence.
2. Generate `docs/REPRODUCTION_PLAN.md` with explicit stages and assumptions.
3. Generate `docs/DATA_REQUIREMENTS.md` with acquisition, license, format,
   split, and validation requirements.
4. Review these files before implementation begins.

**Acceptance criteria**

- Every implementation-critical parameter is either cited or marked as an
  assumption.
- Unknowns become tracked experiments, not invisible defaults.

### [ ] Require data validation and smoke tests

**Work**

1. Write a deterministic data validator before training code.
2. Validate file layout, schema, sample counts, split integrity, label range,
   and a small representative sample.
3. Add a smoke test that runs one short training/evaluation path on minimal
   data.
4. Make the project README document both commands.

**Acceptance criteria**

- Training does not start if data validation fails.
- A new contributor can run the smoke test without downloading the full
  dataset.

### [ ] Record experiments as versioned evidence

**Work**

1. Version all experiment configurations under `configs/`.
2. Record Git commit, environment version, data version, seed, hardware,
   command, metric, and elapsed time for each meaningful run.
3. Append results to `docs/EXPERIMENT_RESULTS.md`.
4. Summarize the result and any deviation from the paper back into the
   Obsidian paper note.

**Acceptance criteria**

- Every claimed reproduction result is attributable to a commit and config.
- The Obsidian note states whether the target was reproduced, partially
  reproduced, disproved, or remains blocked.

## Phase 3 - Scale without losing control

### [ ] Add a research dashboard in Obsidian

**Work**

1. Build views for reading queue, reproduction candidates, active projects,
   blocked work, and completed replications.
2. Derive the dashboard from note frontmatter rather than manually duplicated
   status lists.
3. Review stale `reading` and `reproducing` items on a regular cadence.

**Acceptance criteria**

- The dashboard identifies the next actionable paper and the reason any
  project is blocked.

### [ ] Establish review and archival routines

**Work**

1. Review paper-note evidence and project documentation before declaring a
   reproduction complete.
2. Tag final project commits or create releases for successful replications.
3. Archive inactive projects with a final status and handoff note.
4. Periodically remove local duplicate exports and obsolete model artifacts
   according to a documented retention policy.

**Acceptance criteria**

- Completed and blocked projects both have a final, discoverable explanation.
- The active workspace contains only active projects and intentional archives.

## First pilot: one-paper checklist

Use one inexpensive, public paper to validate the workflow before applying it
to the full library.

1. [ ] Import and normalize the paper in Zotero.
2. [ ] Create the reviewed Obsidian paper note.
3. [ ] Extract citations, method evidence, data requirements, and figures with
       Paper Pilot.
4. [ ] Decide whether to reproduce it and record the decision.
5. [ ] Create the VS Code project and initial Git commit.
6. [ ] Write and run data validation.
7. [ ] Write and run a smoke test.
8. [ ] Run one bounded baseline experiment.
9. [ ] Record the result in the project and summarize it in Obsidian.
10. [ ] Retrospectively update this workflow based on the friction observed.

## Suggested success metrics

- Time from Zotero import to reviewed reading note: less than 30 minutes for a
  typical paper.
- Every active reproduction has a linked note, Git repository, target metric,
  and current status.
- Every reported experimental result has a tracked commit, config, and data
  validation record.
- No unreviewed Paper Pilot file write becomes the canonical research record.
