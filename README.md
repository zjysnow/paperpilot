# Paper Pilot

Paper Pilot is a customized Zotero plugin for reading, organizing, and
researching academic literature with large language models.

This project is a customized modification based on
[Paper Pilot](https://github.com/zjysnow/paperpilot). It keeps the
original project's Zotero-focused research workflow and extends it with a
local-first model and agent architecture.

## What it provides

- Chat with the current PDF, selected text, figures, screenshots, and files.
- Generate summaries, key points, methodology explanations, and other research
  notes with source-aware context.
- Search and work across a Zotero library from the assistant.
- Save answers and research results to Zotero notes or local Markdown folders.
- Use Agent Mode for multi-step workflows and native Zotero operations.
- Load built-in and user-defined Skills to customize Agent Mode workflows.
- Use the assistant in the Zotero reader or in a standalone window.
- Parse PDFs with optional MinerU integration for tables, equations, and figures.

## Standalone Library and Paper chat

Click **Paper Pilot**, immediately to the right of **New Note** in the Zotero
library toolbar, to open the standalone
window in **Library** mode, even when no paper is selected. Library chat supports
library-wide search and discussions about research directions, methods, and
principles without binding the conversation to a single paper. Use Agent Mode
with a tool-capable model for library search and evidence retrieval.

Switch to **Paper** to focus on a specific paper. If no supported paper is
selected or retained in the window, a floating single-paper selector opens.
It reuses the `@` reference selector's folder, tag, and item panels in single-paper
mode. Search by title, author, or year and click a paper to enter its chat. Cancel or Escape
leaves the Library conversation unchanged. Switching modes restores the
corresponding conversation rather than discarding its history.

Click **Switch paper** in the left icon sidebar, below **New chat**, to choose
another paper using the same selector. This button is shown only in Paper mode.
The selected paper's remembered chat is restored; cancelling keeps the current
paper and conversation unchanged.

Approval and Reasoning Level use matching dropdown styles. When the chat area
narrows, the model selector collapses first, followed by Approval (a shield with
a checkmark), then Reasoning Level. Tooltips retain the current settings.
Widening the window or embedded panel restores labels in reverse order.
Approval labels show only **Default** or **Allow all**.

The paper context's source menu shows MD, Text, and PDF options only for its
active PDF, rather than repeating those modes for every PDF version attached
to the paper. Other readable attachments, such as HTML snapshots, remain
available. Use the `@` selector's attachment rows to choose a different PDF
version.

The existing reader pop-out and Ctrl/Cmd+Shift+L shortcut retain their
context-aware opening behavior. If a standalone window is already open,
the toolbar entry focuses it without resetting the active conversation.

## Model providers

The Preferences page intentionally keeps the provider list small:

- **Local OpenAI-Compatible**: a configurable local provider for Ollama,
  llama.cpp, MLX-LM, Unsloth, and other compatible servers.
- **Customized**: any compatible OpenAI or gateway endpoint.

The provider implementation also supports the protocols needed by compatible
chat and Responses API endpoints. API keys are optional for local servers.

## Dify integration

Dify is configured separately from model providers because Paper Pilot selects a
published Dify application rather than a model. Open `Preferences -> paperpilot
-> Dify` to configure the Dify base URL, API keys, default user, published app
keys, and an optional Dataset ID.

- **Chat robots** invoke published Dify Chat applications. Add as many as you
  need — each has its own display name and App Key and shows up as an
  independently selectable AI entry in the chat model menu (using its display
  name, or the Dify app name once fetched via "Refresh app names"). Configs
  created before this feature (a single `Chat App Key`) are migrated
  automatically into one chat robot entry.
- **Completion App Key** invokes a published Dify Completion application.
- **Workflow App Key** invokes a published Dify Workflow application.
- **Dataset ID** identifies the Dify knowledge base used for Markdown document
  create, update, and delete operations.

The Dify client keeps app invocation and Dataset document operations separate
from the LLM provider/model configuration. Dify controls the model and
retrieval settings inside each published application.

### Local OpenAI-Compatible

Start Ollama and configure the following in `Preferences -> paperpilot`:

| Setting  | Value                            |
| -------- | -------------------------------- |
| Provider | `Local OpenAI-Compatible`        |
| API URL  | `http://127.0.0.1:11434/v1`      |
| API key  | Empty                            |
| Model    | Any installed tool-capable model |

The API URL is editable. The default remains Ollama's
`http://127.0.0.1:11434/v1`; replace it with the `/v1` URL exposed by another
local server. Select `Responses API` only when that server implements
`/v1/responses`; otherwise use `OpenAI-Compatible Chat`.

## Agent Mode

Agent Mode is the local orchestration layer around the configured model. It:

1. Selects relevant context and Skills.
2. Sends a request to the configured model.
3. Lets the model request registered Zotero tools.
4. Shows confirmation cards for actions that need user approval.
5. Executes approved actions and continues the turn until the task is complete.

Agent Mode can use the local provider or another model exposed through Customized. The
model must support tool calling for the full agent workflow; models without
tool-calling support can still be used for ordinary chat.

GitHub Copilot online models use the Copilot **Responses API** automatically.
Existing saved Copilot model entries are normalized away from Chat Completions
at runtime, so all Copilot models use the same supported tool-calling protocol.

## Skills

Skills are Markdown instructions that describe reusable research workflows.
Paper Pilot includes built-in Skills and supports user-defined Skills. User Skills
are stored at:

```text
{Zotero data directory}/agent-runtime/<profile-signature>/.agents/skills/<skill-id>/SKILL.md
```

In the standalone window, use the **Skills** button to list, create, open,
restore, or delete Skills. Skills are used by Agent Mode, not by ordinary
text-only chat.

### Using Skills

Skills can be activated automatically when the request matches their trigger
patterns, or explicitly from the chat slash menu:

1. Type `/` in the Agent compose box.
2. Select a Skill, such as `write-note` or `analyze-figures`.
3. Enter the task and send it.

The explicit command uses the Skill ID and a hyphen, for example:

```text
/write-note

Summarize this paper and save the result as a Markdown file to Obsidian.
```

Other examples:

```text
/analyze-figures

Explain Figure 3 and describe the implementation implications.
```

```text
/evidence-based-qa

Find the paper's dataset, batch size, learning rate, and supporting passages.
```

`/write-note` selects the note-writing workflow; it does not by itself choose
the destination. Mention `Obsidian`, `Markdown`, a local file, or a directory
to request an external file. Otherwise, the workflow may write a Zotero note.
For example:

```text
/write-note Create a reading note for this paper and save it to Obsidian.
```

The built-in Skill IDs are:

| Skill               | Typical use                                                    |
| ------------------- | -------------------------------------------------------------- |
| `simple-paper-qa`   | General questions and summaries about one paper                |
| `evidence-based-qa` | Locate methods, parameters, results, and source passages       |
| `analyze-figures`   | Explain figures, tables, charts, and diagrams                  |
| `compare-papers`    | Compare selected papers or their methods and findings          |
| `literature-review` | Produce a structured review or thematic synthesis              |
| `library-analysis`  | Analyze a library or collection                                |
| `write-note`        | Create a Zotero note or Markdown file note                     |
| `import-to-library` | Import cited papers or references into Zotero                  |
| `paper-replication` | Prepare and continue a local paper-replication project         |
| `paper-guide`       | Explain a paper's mechanism, argument, evidence, and limits    |
| `paper-tutor`       | Learn a selected paper topic and save/resume learning progress |

Skills provide workflow instructions; registered Agent tools perform the actual
operations. For example, `write-note` uses `paper_read` and `library_read` to
collect evidence, then uses `note_write` for a Zotero note or `file_io` for a
Markdown file.

### Paper guides and focused tutoring

Enable Agent Mode, select a paper and its readable attachment, then choose
**Normal**, **Guide**, or **Tutor** beside the Agent toggle. The selection is
saved per conversation and forces the corresponding learning Skill on each
turn. Normal keeps lightweight Q&A and does not inherit an old Tutor session.
Library conversations can use learning modes with exactly one paper context.
The slash menu remains available; selecting a learning Skill also sets the mode:

```text
/paper-guide
Explain this paper's central mechanism, evidence, assumptions, and limits.
Show a connected diagram and state which sections were actually read.
```

Add an absolute `.html` destination to export a portable offline guide.
The `paper_learning` tool validates the structured guide and literal evidence
against the actual attachment, generates native quote citations, and saves
one self-contained HTML file with SVG diagrams, MathML formulas, folded
evidence, and copyable chapter-specific Tutor prompts. It needs neither
Python nor a CDN. Original figure embedding and arbitrary interactive
experiments are not part of this first version.

```text
/paper-tutor
Help me understand why this formula is needed. Teach one point at a time.
```

Ask for a direct explanation, skip, or pause at any time. Choose **Normal** to
exit the persistent learning mode. Each successfully completed learning turn
automatically saves structured progress to Zotero's database. New conversations
with the same paper/attachment restore its latest goal when entering Guide or
Tutor; no JSON destination is needed.

Optionally configure **Notes Directory** to your Obsidian Vault and enable
**Automatically sync learning state to notes** in settings. This is a one-way
Markdown projection, not the primary store. A stable note contains all learning
goals; only its managed block changes. Manual content outside it is preserved.
Edited managed blocks cause an explicit conflict, not an overwrite. Changing
the destination requires renewed authorization. Sync failures leave database
progress intact.

JSON remains an explicit portable export/restore option:

```text
/paper-tutor
Resume from /absolute/path/learning-progress.json.
```

An explicit JSON destination uses file approval and undo; reading a JSON record
does not automatically import it into the database. Resume checks
paper/attachment keys and the extracted source fingerprint;
missing or changed source is reported rather than silently reused. Reading
or saying "I understand" is not recorded as mastery. Writes use the normal
approval and undo flow for file exports. See [learning workflow details](doc/paper-learning.md)
for usage, contracts, and validation limits.

### Agent approval mode

The **Approval: Default** button beside the model selector controls how Agent
Mode handles confirmation cards. **Default** prompts before each approved
action. **Allow all** automatically approves ordinary Agent actions, including
workspace file changes and local commands, until you switch back to Default.
Use it only for workspaces and commands you trust. Cards that require edited
input, review, or a user choice remain interactive in both modes.

### Subagents

Enable **Agent -> Enable Subagents (Beta)** to let Agent Mode delegate a narrow
inspection or evidence-gathering task to a fresh context. Every subagent uses
the exact model, provider, authentication, and advanced model configuration
currently selected for the parent chat; it never selects or falls back to a
different model.

Subagents receive only their focused objective and optional essential context,
not the full parent conversation. They can use read-only Agent tools and return
a concise evidence summary to the parent Agent. They cannot write files,
modify Zotero data, run shell commands, initialize Git, or bypass the normal
approval flow. The parent Agent remains responsible for integrating the result
and performing any later mutation through the existing confirmation cards.
The Agent activity panel shows each subagent's started, completed, or failed
state and an **Open details** button from the moment it starts. The main chat
does not duplicate subagent output. Open details opens a live task window
showing the selected model, streamed model output, read-only tool activity, and
the final result or error. Model providers—local or online—never receive filesystem permission:
file and command tools execute in the local Paper Pilot runtime and are subject
to the configured Workspace access checks and approval policy.

When Subagents are enabled, paper replication is explicitly and automatically
orchestrated this way: before project files are written, the runtime starts
three separate summaries covering method/implementation evidence, data and
evaluation requirements, and project compatibility or implementation structure.
Continuing a replication starts two focused validation or experiment-analysis
summaries. The runtime blocks replication file writes until those summaries are
available, so the main Agent can synthesize compact evidence rather than
carrying the entire paper and project exploration in one context. This does not
depend on the selected model deciding to issue a subagent tool call.

### Paper replication projects

Set **Workspace Directory** in `Preferences -> paperpilot` before asking Agent
Mode to reproduce a paper. Then, in a paper chat with the paper available as
context, ask for example:

```text
Please reproduce this paper and prepare the implementation in my workspace.
```

Optionally set **Agent -> Replication Environment -> Python Virtual
Environment** to a virtual-environment root (for example,
`/projects/.venv`) or its Python executable. All Python validation, training,
and evaluation commands for paper replication use that configured interpreter;
leave it empty to use the system Python command.

The same setting provides a refreshable environment picker. It shallowly scans
the Workspace plus common virtualenv, pyenv, Conda, Miniconda, Miniforge, and
Mamba locations, and only lists environments whose Python executable exists.
Use the manual field when an environment is stored outside those locations.

The `paper-replication` Skill reads the paper first, then creates a
paper-specific project in the exact folder opened by **Open workspace in VS
Code**: `{Workspace Directory}/{paper short title}`. It generates runnable
implementation/configuration files together with:

- at least one implementation source file and a smoke-test entry point;
- `README.md` for quick start and expected outputs;
- `docs/REPRODUCTION_PLAN.md` for evidence, implementation choices, and
  assumptions;
- `docs/REQUIREMENTS.md` for data, credentials, hardware, and setup work the
  user must complete;
- `docs/DATA_CONTRACT.md` for the exact data directory, file layout, schema,
  examples, and validation requirements;
- `docs/EXPERIMENT_LOG.md` for commands, results, failures, and next steps;
- `paperpilot-replication.json` for resumable project state.

Before creating or changing a project, the agent enumerates this directory,
checks its Git state, and reads its saved replication metadata and key files.
It continues an existing project only when that evidence identifies the same
paper. If the directory contains unrelated or ambiguous content, the agent
does not overwrite it; it summarizes the conflict and asks you whether to
reuse it, choose another workspace, or clear the directory.

Before it creates a new replication project, Paper Pilot presents a
**Prepare paper-replication workspace** approval card listing the exact target
directory and planned code, documentation, data-validation, and experiment
configuration changes. Git initialization and commits have separate command
confirmation cards. A successfully saved Workspace Directory has already
passed directory creation, write, read-back, and cleanup verification; any
later filesystem error is reported only if the attempted operation actually
fails.

For a new project folder, the agent initializes Git and creates an initial
commit for generated files. For an existing repository, it inspects the status
and stages only files created by the reproduction workflow, preserving other
uncommitted work. Git commits and other local mutations use the normal Agent
Mode confirmation flow.

After completing the listed prerequisites, continue in the same or a later
chat with a request such as:

```text
The reproduction prerequisites are ready. Read the project state and run the
next smoke test.
```

The agent reads the project state and experiment log before it proposes or runs
the next bounded step. It first runs the generated data validator against the
documented data folder. A failed validation produces a remediation report and
does not start training; a successful validation permits one bounded experiment
and creates `docs/EXPERIMENT_RESULTS.md` with metrics and conclusions. Package
installation, downloads, destructive commands, and overwriting existing files
remain subject to Agent Mode confirmation.

### Creating a Custom Skill

Create a `SKILL.md` file under the user Skills directory. Its frontmatter
defines the identifier, activation behavior, context, and matching patterns:

```markdown
---
id: prepare-reproduction
description: Prepare structured context for reproducing a paper
version: 1
contexts: single-paper
activation: manual
match: /\b(reproduce|replicate|reproduction)\b/i
---

## Workflow

1. Extract the method, data, hyperparameters, and evaluation protocol.
2. Separate confirmed evidence from inferred assumptions.
3. List missing data and unresolved implementation choices.
4. Generate a reproduction specification before writing full code.
```

Supported `contexts` include `any`, `single-paper`, `paper-set`,
`library-corpus`, and `note`. `activation` can be `auto`, `manual`, or `both`.
The Skill body is injected into the current Agent turn when the Skill is
activated. User edits are preserved across plugin updates unless the Skill is
restored to its default.

## Installation

1. Download the latest `.xpi` file from the
   [Releases](https://github.com/zjysnow/paperpilot/releases) page.
2. In Zotero, open `Tools -> Add-ons`, select the gear menu, and choose
   **Install Add-on From File**.
3. Select the `.xpi` file and restart Zotero.
4. Open `Preferences -> paperpilot`, configure a local or Customized provider, and click
   **Test Connection**.
5. Open a PDF and click the Paper Pilot icon in the reader toolbar.

After the first installation, Zotero can update Paper Pilot through its native
Add-on Manager. The plugin publishes `update.json` on the fixed `release`
GitHub release, and the manifest points Zotero to that file. See
[发布与 Zotero 自动更新](doc/release-and-update-zhCN.md) for the versioning,
release, and update procedure.

## Development

This repository uses the Zotero plugin scaffold and TypeScript.

```bash
npm install
npm run typecheck
npm run test
npm run build
```

See the [runtime support matrix](doc/runtime-support-matrix.md) for the
required Zotero platform smoke checks before releasing a build.

For a practical Zotero, Obsidian, and VS Code setup, see
[the research-workflow guide](doc/research-workflow-setup.md).
Reusable [Obsidian dashboard and reproduction-project templates](doc/templates)
are included for the first pilot.

To start the development server:

```bash
npm run start
```

## Project status

Paper Pilot is an actively customized project. The local Agent, Skills, and local
provider transport, standalone-window, and PDF workflows may evolve
independently from upstream paperpilot.

## Acknowledgements

This project would not exist without
[Paper Pilot](https://github.com/zjysnow/paperpilot). Thank you to
the original authors and contributors for building the Zotero research
assistant that this customized version is based on.

Thanks also to [@jianghao-zhang](https://github.com/jianghao-zhang) and
[@boltma](https://github.com/boltma) for their contributions to the upstream
project and related integrations.

## License

Paper Pilot is distributed under the
[GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0).
