# Paper Pilot

Paper Pilot is a customized Zotero plugin for reading, organizing, and
researching academic literature with large language models.

This project is a customized modification based on
[llm-for-zotero](https://github.com/jianghao-zhang/llm-for-zotero). It keeps the
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

## Model providers

The Preferences page intentionally keeps the provider list small:

- **Local OpenAI-Compatible**: a configurable local provider for Ollama,
  llama.cpp, MLX-LM, Unsloth, and other compatible servers.
- **Customized**: any compatible OpenAI or gateway endpoint.

The provider implementation also supports the protocols needed by compatible
chat and Responses API endpoints. API keys are optional for local servers.

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

| Skill | Typical use |
| --- | --- |
| `simple-paper-qa` | General questions and summaries about one paper |
| `evidence-based-qa` | Locate methods, parameters, results, and source passages |
| `analyze-figures` | Explain figures, tables, charts, and diagrams |
| `compare-papers` | Compare selected papers or their methods and findings |
| `literature-review` | Produce a structured review or thematic synthesis |
| `library-analysis` | Analyze a library or collection |
| `write-note` | Create a Zotero note or Markdown file note |
| `import-to-library` | Import cited papers or references into Zotero |

Skills provide workflow instructions; registered Agent tools perform the actual
operations. For example, `write-note` uses `paper_read` and `library_read` to
collect evidence, then uses `note_write` for a Zotero note or `file_io` for a
Markdown file.

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

## Development

This repository uses the Zotero plugin scaffold and TypeScript.

```bash
npm install
npm run typecheck
npm run test
npm run build
```

To start the development server:

```bash
npm run start
```

## Project status

Paper Pilot is an actively customized project. The local Agent, Skills, and local
provider transport, standalone-window, and PDF workflows may evolve
independently from upstream llm-for-zotero.

## Acknowledgements

This project would not exist without
[llm-for-zotero](https://github.com/jianghao-zhang/llm-for-zotero). Thank you to
the original authors and contributors for building the Zotero research
assistant that this customized version is based on.

Thanks also to [@jianghao-zhang](https://github.com/jianghao-zhang) and
[@boltma](https://github.com/boltma) for their contributions to the upstream
project and related integrations.

## License

Paper Pilot is distributed under the
[GNU Affero General Public License v3.0](https://www.gnu.org/licenses/agpl-3.0).
