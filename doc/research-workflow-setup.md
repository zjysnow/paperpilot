# Setting up the research workflow

This guide configures Paper Pilot to keep bibliographic records, reading notes,
and reproduction projects in their intended systems:

- **Zotero**: metadata, PDFs, collections, and citations.
- **Obsidian**: file-based reading notes and concept notes.
- **VS Code + Git**: reproduction code, data validation, and experiment logs.

Paper Pilot links the systems through reviewed writes. It does not automatically
synchronize edits in both directions.

## 1. Prepare local directories

Create the following directories outside the Zotero data directory:

```text
Research/
├── ObsidianVault/
│   ├── 01-Papers/
│   ├── 02-Concepts/
│   └── assets/
└── paper-reproductions/
```

Use your own names if preferred, but keep the role of each directory stable.
Do not place raw datasets, checkpoints, or generated experiment outputs in the
Obsidian Vault.

## 2. Configure the notes directory

In `Preferences -> paperpilot`:

1. Set **Obsidian Vault Path** to the absolute path of `ObsidianVault`.
2. Set **Notes Target Folder** to `01-Papers`.
3. Set **Attachments Folder** to `assets`.
4. Optionally set a memorable Notes Directory nickname, such as `Obsidian`.
5. Use the built-in test button before saving the path.

When a chat request explicitly says to save a note to Obsidian, Paper Pilot
writes under the configured target folder unless you explicitly name another
folder. Review every write card before approving it.

## 3. Configure the reproduction workspace

In `Preferences -> paperpilot`:

1. Set **Workspace Directory Path** to the absolute path of
   `paper-reproductions`.
2. Use **Test workspace directory**. Paper Pilot creates, reads, and removes a
   temporary probe file before accepting the configuration.
3. Optionally configure the VS Code executable path if the platform default
   cannot open VS Code.
4. Optionally configure a dedicated Python environment for paper replication.

Paper Pilot creates a paper-specific project only below this workspace and
opens that exact folder in VS Code. It never needs a desktop or downloads
folder as a fallback.

## 4. Run a one-paper pilot

Choose a paper with public data, manageable compute requirements, and an
unambiguous target metric.

1. Import and normalize the paper in Zotero. Confirm its title, year, DOI, and
   citation key if available.
2. In Paper Pilot, select the paper and ask:

   ```text
   /write-note Create an evidence-based reading note and save it to Obsidian.
   ```

3. Review the generated note before approving the file write. It includes
   stable identifiers, a reading status, evidence classification, unresolved
   details, and a reproduction-decision section.
4. Decide whether to reproduce, reimplement, audit, or defer the paper.
5. If reproduction is justified, ask:

   ```text
   /paper-replication Prepare a reproducible project for this paper.
   ```

6. Review the workspace preparation card. The project should contain
   `docs/EVIDENCE.md`, `docs/DATA_REQUIREMENTS.md`,
   `docs/REPRODUCTION_PLAN.md`, `docs/EXPERIMENT_RESULTS.md`, a data
   validator, and a bounded smoke-test entry point.
7. Place data only in the documented project-relative location. Ask Paper
   Pilot to continue after the validator succeeds.

## 5. Keep identifiers, statuses, and tags consistent

Use the DOI as the primary cross-system identifier, then the citation key and
Zotero item key. A citation key requires a local tool such as Better BibTeX;
Paper Pilot will leave it empty rather than inventing one when it is absent.

File-based paper notes use exactly one of these workflow statuses:

```text
inbox -> reading -> understood -> candidate -> reproducing -> reproduced
```

Use `blocked` only when a named external prerequisite is missing, and use
`archived` for intentionally inactive work. Keep the reproduction choice
(`replicate`, `reimplement`, `audit`, or `defer`) in the note body rather than
overloading the workflow status. For additional tags, use lowercase
`domain/`, `method/`, `dataset/`, and `status/` namespaces. A `status/...` tag
must match the note's `status` frontmatter.

## 6. Operating rules

- Keep PDFs and citation records in Zotero. Link them from notes; do not copy
  PDFs into the Vault by default.
- Keep detailed experiment receipts in the Git repository. Summarize outcomes
  in the Obsidian note rather than duplicating complete logs.
- Do not state paper claims without a source passage, figure, table, page, or
  an explicit `inferred` label.
- Do not run training before the project data validator and smoke test pass.
- Treat every generated write, command, package installation, and Git commit
  as reviewable. Approval is not a substitute for checking paths and content.

## 7. Optional reusable templates

Copy the following files into your own Vault or paper workspace before the
first pilot:

- [`obsidian-research-dashboard.md`](templates/obsidian-research-dashboard.md)
  provides a manual dashboard and optional Dataview queries.
- [`obsidian-concept-note.md`](templates/obsidian-concept-note.md) keeps
  durable, cross-paper ideas separate from paper-specific reading notes.
- [`reproduction-project/`](templates/reproduction-project/) provides an
  intentionally generic Git, evidence, data, planning, and result-recording
  skeleton.

Treat these as starting points. Customize the commands and data contracts for
each paper; never copy placeholder values into an experiment claim.
