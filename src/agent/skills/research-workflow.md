---
id: research-workflow
description: Coordinate Zotero reading, Obsidian notes, and VS Code reproduction projects without duplicating sources of truth.
version: 1
contexts: any
activation: both
match: /\b(?:research|reading|paper|literature)\s+(?:workflow|system|setup|management)\b/i
match: /\b(?:zotero|obsidian|vscode|vs code)\b.*\b(?:workflow|setup|manage|sync|integrat)/i
match: /(研究|论文|阅读).*(工作流|流程|管理|系统)/
match: /(zotero|obsidian|vscode|vs\s*code).*(工作流|流程|配置|管理|集成)/
---

## Research workflow

Coordinate the research workflow without treating generated content as an
unreviewed source of truth.

### Ownership

- Zotero owns bibliographic metadata, PDFs, collections, and citation records.
- The configured notes directory owns long-form Markdown reading notes,
  concept notes, and research decisions.
- The configured Workspace Directory owns reproduction source code,
  environment manifests, configurations, and experiment records.
- Do not create automatic bidirectional synchronization between these systems.
  Link records by DOI, citation key, and Zotero item key instead.

### Setup

Before creating notes or projects, confirm that the notes directory and
Workspace Directory are configured. If either is absent, identify the missing
preference and stop before proposing filesystem output. Never choose a desktop,
downloads folder, or an unconfigured fallback path.

### Reading workflow

1. Verify Zotero metadata before relying on it: title, authors, year, DOI,
   and citation key where available.
2. Use `paper_read` and `library_read` to collect paper evidence. Every
   numerical claim in a saved note needs a source passage, page, section, or
   an explicit statement that it is an inference.
3. When the user requests a file-based reading note, use `write-note` and
   write it under the configured notes directory. Keep Zotero as the PDF and
   citation authority; do not duplicate PDFs into the note vault.
4. Clearly label material as **confirmed**, **inferred**, **assumed**, or
   **unresolved**. Do not turn missing implementation details into facts.
5. Keep the file-note `status` to the shared vocabulary: `inbox`, `reading`,
   `understood`, `candidate`, `reproducing`, `reproduced`, `blocked`, or
   `archived`. The reproduction choice (`replicate`, `reimplement`, `audit`,
   or `defer`) is a decision recorded in the note body, not a status. Use
   stable, lowercase `domain/`, `method/`, `dataset/`, and `status/` tag
   namespaces; a `status/` tag must agree with frontmatter.

### Reproduction workflow

1. Before creating a project, record an explicit target result, success
   tolerance, data availability, license constraints, compute requirements,
   and unresolved details.
2. Use `paper-replication` only after the user decides to reproduce,
   reimplement, audit, or defer the paper.
3. Keep project files beneath the exact configured paper workspace. Require a
   Git repository, environment manifest, data validator, smoke test, evidence
   document, reproduction plan, and experiment result record.
4. Run data validation before training. Run one bounded smoke test before a
   costly experiment. Record commit, config, seed, data version, command,
   environment, hardware, metrics, and artifacts for every meaningful result.
5. After a result, summarize the conclusion and deviations in the reading note
   without overwriting the project's detailed experiment record.

### Completion rule

Do not claim that a workflow phase is complete merely because a note or plan
was generated. Report the exact Zotero item, note path, project path,
validation command, current status, and next user action. File writes,
commands, Git actions, and external data access remain subject to their normal
confirmation policies.
