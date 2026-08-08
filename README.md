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

- **Ollama**: the recommended local provider.
- **Customized**: any compatible OpenAI, Ollama, or local gateway endpoint.

The provider implementation also supports the protocols needed by compatible
chat and Responses API endpoints. API keys are optional for local Ollama
servers.

### Ollama

Start Ollama and configure the following in `Preferences -> paperpilot`:

| Setting  | Value                            |
| -------- | -------------------------------- |
| Provider | `Ollama`                         |
| API URL  | `http://127.0.0.1:11434/v1`      |
| API key  | Empty                            |
| Model    | Any installed tool-capable model |

For the protocol used by `ollama launch copilot`, select the `Responses API`
protocol. Paper Pilot calls Ollama's local `/v1/responses` endpoint directly;
it does not start or attach to a separate Copilot CLI process.

## Agent Mode

Agent Mode is the local orchestration layer around the configured model. It:

1. Selects relevant context and Skills.
2. Sends a request to the configured model.
3. Lets the model request registered Zotero tools.
4. Shows confirmation cards for actions that need user approval.
5. Executes approved actions and continues the turn until the task is complete.

Agent Mode can use Ollama or another model exposed through Customized. The
model must support tool calling for the full agent workflow; models without
tool-calling support can still be used for ordinary chat.

## Skills

Skills are Markdown instructions that describe reusable research workflows.
Paper Pilot includes built-in Skills and supports user-defined Skills at:

```text
{Zotero data directory}/paperpilot/skills/<skill-id>/SKILL.md
```

In the standalone window, use the **Skills** button to list, create, open,
restore, or delete Skills. Skills are used by Agent Mode, not by ordinary
text-only chat.

## Installation

1. Download the latest `.xpi` file from the
   [Releases](https://github.com/zjysnow/paperpilot/releases) page.
2. In Zotero, open `Tools -> Add-ons`, select the gear menu, and choose
   **Install Add-on From File**.
3. Select the `.xpi` file and restart Zotero.
4. Open `Preferences -> paperpilot`, configure Ollama or Customized, and click
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

Paper Pilot is an actively customized project. The local Agent, Skills, Ollama,
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
