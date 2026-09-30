---
title: Research Dashboard
created: 2026-09-30
tags: [research-dashboard]
---

# Research Dashboard

Use this file as the home page of the research Vault. It relies on the
file-based paper-note fields shipped by Paper Pilot:
`status`, `citekey`, `doi`, `zotero_item_key`, and `project_path`.

## Workflow status

Update a paper note's `status` only after the relevant evidence or project
state has been reviewed:

`inbox` → `reading` → `understood` → `candidate` → `reproducing` →
`reproduced`

Use `blocked` when an external prerequisite is missing, `archived` for
intentionally inactive work, and `defer` only in the note's reproduction
decision section.

## Current queue

If the Dataview community plugin is installed, replace this section with:

```dataview
TABLE status, citekey, doi, project_path, file.mtime AS reviewed
FROM "01-Papers"
WHERE status != "archived"
SORT choice(status = "reproducing", 0,
            status = "candidate", 1,
            status = "reading", 2,
            status = "inbox", 3,
            status = "blocked", 4,
            5) ASC, file.mtime DESC
```

Without Dataview, keep a short curated list:

- [ ] [[Paper note]] — status and next action

## Reproduction watch list

Use this section only for papers with a non-empty `project_path`.

```dataview
TABLE status, project_path, file.mtime AS updated
FROM "01-Papers"
WHERE project_path != "" AND status != "archived"
SORT file.mtime DESC
```

For each blocked project, add a link to the paper note and state the exact
missing prerequisite: data access, license, compute, source code, or paper
detail.

## Weekly review

- [ ] Empty or classify the inbox.
- [ ] Review papers that have been `reading` for more than two weeks.
- [ ] Confirm every `reproducing` paper has a Git repository, data validator,
      smoke test, and next experiment.
- [ ] Move finished work to `reproduced`, `blocked`, or `archived` with a
      written conclusion.
