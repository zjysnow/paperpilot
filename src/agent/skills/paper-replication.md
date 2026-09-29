---
id: paper-replication
description: Prepare and continue an evidence-based, local paper-replication project with implementation code, setup documentation, and an experiment log.
version: 1
contexts: single-paper,paper-set
activation: both
match: /\b(reproduce|replicate|reproduction|paper implementation|implement (this|the) paper|reimplement)\b/i
match: /(复现|复刻|重现|实现.*论文|论文.*实现|复现实验)/
---

## Paper replication workflow

## Subagent orchestration

When Subagents are enabled, act as the orchestrating main Agent. Do not retain
the full paper and implementation exploration in the main conversation. Before
creating or updating project files, delegate narrow read-only tasks with
`subagent_task` and use only their concise evidence summaries in the main
workflow:

1. extract method, architecture, loss, and hyperparameter evidence;
2. derive the data contract, preprocessing, splits, metrics, and experiment
   protocol;
3. inspect an existing project for compatibility, or design the implementation
   structure when the directory is new.

For a continuation, delegate at least two focused validation or experiment
analysis tasks before writing results. The runtime blocks replication file
writes until these summaries have been returned successfully.

Use this workflow when the user wants to reproduce, replicate, reimplement, or
run experiments for a paper. Treat the configured **Workspace Directory** in
the runtime context as the only root for project files. Never choose an
unrelated local directory. If it is not configured, explain that the user must
configure it in Paper Pilot preferences before a project can be prepared.

This workflow has two phases: **prepare** and **experiment**. Persist the
handoff between them in the project's files so that a later chat turn can
continue reliably rather than relying only on chat history.

### Phase 0 — inspect the existing workspace project

Before creating, overwriting, initializing Git, or installing anything, inspect
the exact paper workspace directory with `run_command` using that directory as
`cwd`. Enumerate its contents and inspect Git status. When it contains files,
read `paperpilot-replication.json`, `README.md`, the reproduction plan, and
relevant source/configuration files.

- If the stored paper identity and implementation clearly match the current
  paper, preserve the project and continue from its current state.
- If the directory is empty, proceed to Phase 1.
- If content is missing paper identity or belongs to a different paper, do
  **not** write, initialize Git, commit, or overwrite files. Summarize the
  conflict and ask the user whether to reuse the existing project, choose a
  different workspace, or clear the directory. Wait for that decision.

  When Paper Pilot presents a **Prepare paper-replication workspace** approval
  card, wait for the user's decision before creating project files. This explicit
  approval covers source code, documentation, data-validation assets, and
  experiment configuration. Git initialization and commits remain separately
  reviewable actions. The card is user authorization, not operating-system
  privilege escalation: actual directory access is verified by the first
  filesystem operation using Zotero's current user permissions. Report a
  specific filesystem error only when that operation fails.

### Phase 1 — prepare a reproducible project

1. Read the paper before implementing it. Start with
   `paper_read({ mode:'overview' })`, then retrieve focused evidence for the
   method, data, training details, and evaluation protocol. Read figures or
   relevant passages when they resolve an implementation ambiguity. Clearly
   distinguish paper-supported facts from assumptions or deliberate baseline
   choices.
2. Use the exact paper workspace path provided in the runtime context. It is
   the same folder opened by the **Open workspace in VS Code** button, based on
   the paper's saved short title. Do not create another slugged subfolder or
   write directly to the Workspace Directory root.
3. Use `file_io` to create a project that is useful to run, not an empty
   scaffold. At minimum create:
   - `README.md` — quick start, expected outputs, and the next chat prompt.
   - `docs/REPRODUCTION_PLAN.md` — paper evidence, implementation mapping,
     assumptions, success criteria, and known gaps.
   - `docs/REQUIREMENTS.md` — a user checklist for data access, licenses,
     credentials, hardware, software, and any decisions still needed.
   - `docs/DATA_CONTRACT.md` — the exact directory layout, filenames, file
     formats, schema/column or tensor shapes, dtypes, label encoding, split
     rules, required metadata, and an example record. Include the exact
     project-relative folder where the user must place data.
   - `docs/EXPERIMENT_LOG.md` — dated experiment entries, commands, metrics,
     artifacts, and the next recommended action.
   - `paperpilot-replication.json` — project state with `phase`, paper
     identity, paths, pending prerequisites, and the current next action.
   - at least one runnable implementation source file (not only documents or
     configuration), configuration files, and a small
     preflight or smoke-test entry point appropriate for the paper.
   - `scripts/validate_data.<extension>` — a runnable validator that checks
     the documented data location, required files, format/schema, split
     consistency, and a small sample before training. Its exit code must be
     zero only when data is accepted; print actionable errors otherwise.
   - a bounded training/evaluation entry point and a configuration file whose
     data path defaults to the documented project-relative data folder.
4. Generate code that follows the paper evidence and explain every
   approximation in the plan. Do not fabricate unavailable datasets,
   proprietary weights, hyperparameters, or claimed results. If a detail is
   missing, make it configurable and record the assumption. Implement as much
   of the paper pipeline as evidence supports: data loading, preprocessing,
   model, loss/objective, training loop, checkpointing, evaluation, metrics,
   reproducibility seeds, and command-line configuration. Do not replace
   missing implementation with prose-only pseudocode.
5. Use `run_command` with the project directory as `cwd` to inspect Git state.
   For a newly created project, run `git init`, stage the generated project
   files, and create its first commit. For an existing repository, preserve
   user work: inspect status first and stage only files generated by this
   workflow before committing. Before any command that installs packages,
   downloads data, starts a costly job, creates a Git commit, or changes
   existing project files, use the normal confirmation flow. Do not report a
   file or commit as generated until the respective tool confirms it.
6. Finish the preparation response with: files created, the exact data folder
   and data contract, prerequisites the user must complete, the exact
   validation command and smoke-test command to run after setup, and the next
   suggested conversational instruction. Tell the user to say that data is
   ready or ask to continue once it has been placed in the documented folder.

### Phase 2 — continue experiments

When the user says prerequisites are ready, asks to continue, provides a log,
or asks for the next experiment:

1. Read `paperpilot-replication.json`, `docs/DATA_CONTRACT.md`,
   `docs/EXPERIMENT_LOG.md`, and the relevant source/configuration files before
   proposing changes. Use these project files as the source of truth for state.
2. Run `scripts/validate_data.<extension>` against the documented data folder
   before starting training. Check its exit status and output; do not infer
   validity from the user's statement alone. If validation fails, do not run
   training or evaluation. Write `docs/DATA_VALIDATION.md` with the exact
   failed checks and concrete remediation steps, update project state, and
   return the data-preparation requirements to the user.
3. Only when validation passes, execute one bounded next experiment using the
   generated training/evaluation entry point. Run commands only after the
   required confirmation. Surface command errors and failed checks explicitly;
   do not claim an experiment ran when it did not.
4. After an experiment, write `docs/EXPERIMENT_RESULTS.md` with the exact
   command, environment, data split, configuration, metrics, artifacts,
   comparison with paper targets, limitations, and an evidence-based
   conclusion. Append the same operational receipt to `docs/EXPERIMENT_LOG.md`.
5. Update `paperpilot-replication.json` whenever the phase, prerequisite
   status, command, validation result, experiment result, or next action
   changes. Preserve prior log entries rather than overwriting experiment
   history, then commit only the generated experiment artifacts.
6. Compare results with paper-reported targets only when their protocol is
   comparable. State mismatches and likely causes as hypotheses, not facts.

Keep the project documentation in the user's language when practical. Use
clear paths and commands in every handoff so the user can prepare requirements
outside Zotero and later resume the workflow through chat.
