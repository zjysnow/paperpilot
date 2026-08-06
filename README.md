# Paper Pilot

**Local Ollama Research Assistant Rooted in Your Zotero Library**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Zotero Plugin](https://img.shields.io/badge/Zotero-Plugin-orange)](https://www.zotero.org/)

Paper Pilot is a powerful AI-powered research assistant plugin for [Zotero](https://www.zotero.org/). It integrates intelligent chat, semantic search, and citation extraction directly into your Zotero library, enabling faster and more informed research workflows.

## ✨ Features

### 🤖 AI-Powered Chat

- **Conversational Research Assistance**: Interact with LLMs to explore your library and get contextual answers
- **Paper-Specific Mode**: Get focused assistance on individual papers or collections
- **Quote Citation Extraction**: Automatically extract and cite relevant passages from PDFs
- **Screenshot Attachments**: Capture and attach screenshots to your conversations

### 📚 Library Integration

- **Semantic Paper Search**: Find relevant papers using AI-powered semantic retrieval
- **Smart Context Retrieval**: Automatic context building from your library with configurable limits
- **Collection Retrieval**: Search across entire collections with ranked results
- **Zotero Item Menu Integration**: Access Paper Pilot features directly from Zotero's right-click menu

### 📖 Document Understanding

- **PDF Text Extraction**: Extract text and annotations from PDF attachments
- **Citation Context Analysis**: Understand how papers cite and discuss related work
- **Markdown Rendering**: Rich rendering with KaTeX (math), Mermaid (diagrams), and syntax highlighting
- **Paper Attribution Tracking**: Identify and display paper metadata

### 🎨 Customization

- **Ollama-first local inference**: Connects to a locally running Ollama server
- **Configurable Settings**: Fine-tune retrieval parameters, font scaling, message spacing, and more
- **Scroll-Safe Chat**: Intelligent scroll behavior that follows or pauses based on your interaction
- **Customizable UI Panels**: Flexible panel sizing and positioning

## 🏗️ Architecture

```
paperpilot/
├── src/
│   ├── addon.ts                 # Main Addon class & lifecycle
│   ├── index.ts                 # Entry point, global instance setup
│   ├── hooks.ts                 # Plugin lifecycle hooks
│   ├── modules/
│   │   └── contextPanel/        # Core chat & context panel module
│   │       ├── buildUI.ts       # UI rendering for chat messages
│   │       ├── chat.ts          # Chat session management
│   │       ├── constants.ts     # Configurable constants
│   │       ├── contextResolution.ts    # Context building logic
│   │       ├── paperSearch.ts           # Paper semantic search
│   │       ├── markdownRenderer.ts      # Rich text rendering
│   │       ├── referenceSelector/       # Reference selector panel
│   │       └── setupHandlers/           # Event & DOM handlers
│   ├── shared/                  # Shared types & utilities
│   └── utils/                   # Utility functions
├── addon/                       # Static assets (locale, prefs)
├── test/                        # Unit & workflow tests
└── zotero-plugin.config.ts      # Plugin build configuration
```

## 📦 Installation

### From Source

1. Clone the repository:

   ```bash
   git clone https://github.com/albert/paperpilot.git
   cd paperpilot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. Load the built XPI in Zotero:
   - Open Zotero
   - Go to `Edit > Preferences > Plugins`
   - Click "Install Plugin From File" and select the built `.xpi` file

### Development Build

```bash
npm start
```

This starts a development server that hot-reloads the plugin as you code.

## 🚀 Usage

### Getting Started

1. **Open Paper Pilot**: Access the context panel from Zotero's sidebar or menu
2. **Select Papers**: Choose papers from your library to provide context for AI queries
3. **Ask Questions**: Chat with the AI assistant about your research
4. **Explore Results**: Review AI responses with embedded citations and references

### Key Workflows

- **Paper Search**: Use semantic search to find related papers in your library
- **Citation Context**: Click on citations to see how they're used in context
- **Follow-Up Questions**: Continue conversations with automatic context retention
- **Collection Analysis**: Get insights across entire research collections

## ⚙️ Configuration

Available preferences (accessible via Zotero Preferences):

| Setting                      | Description                        | Default |
| ---------------------------- | ---------------------------------- | ------- |
| `CHUNK_TARGET_LENGTH`        | Target length for text chunks      | 2000    |
| `CHUNK_OVERLAP`              | Overlap between consecutive chunks | 200     |
| `EMBEDDING_BATCH_SIZE`       | Batch size for embedding requests  | 16      |
| `RETRIEVAL_TOP_K_PER_PAPER`  | Papers to retrieve per document    | 24      |
| `RETRIEVAL_MMR_LAMBDA`       | MMR diversity parameter            | 0.7     |
| `PERSISTED_HISTORY_LIMIT`    | Max chat history messages          | 200     |
| `FONT_SCALE_DEFAULT_PERCENT` | Default font scaling               | 120%    |

## 🧪 Testing

Run the test suite:

```bash
npm test              # All tests (typecheck + unit + workflow)
npm run test:unit     # Unit tests only
npm run test:workflow # Workflow integration tests
npm run typecheck     # TypeScript type checking
```

## 📋 Scripts

| Script               | Description                              |
| -------------------- | ---------------------------------------- |
| `npm start`          | Start development server with hot reload |
| `npm run build`      | Build production bundle & typecheck      |
| `npm run release`    | Package for distribution                 |
| `npm test`           | Run full test suite                      |
| `npm run lint:check` | Check code formatting & linting          |
| `npm run lint:fix`   | Auto-fix formatting & linting issues     |
| `npm run typecheck`  | TypeScript type checking                 |

## 🛠️ Tech Stack

- **Language**: TypeScript
- **Framework**: Zotero Plugin Toolkit
- **Build Tool**: ESBuild + Zotero Plugin Scaffold
- **Testing**: Mocha + Chai
- **Linting**: ESLint + Prettier
- **Rendering**: Marked (Markdown), KaTeX (Math), Highlight.js, Mermaid

## 📦 Dependencies

### Runtime

- `fflate` - Compression utilities
- `highlight.js` - Syntax highlighting
- `katex` - LaTeX math rendering
- `marked` - Markdown parsing
- `mermaid` - Diagrams & flowcharts
- `zotero-plugin-toolkit` - Zotero plugin utilities

### Dev Dependencies

- `@types/mocha`, `@types/chai` - Test type definitions
- `@zotero-plugin/eslint-config` - Shared ESLint config
- `chai`, `mocha` - Testing framework
- `eslint`, `prettier` - Code quality tools
- `tsx`, `typescript` - TypeScript execution & compiler

## 📄 License

This project is licensed under the **GNU Affero General Public License v3.0** - see the [LICENSE](LICENSE) file for details.

## Ollama support

Paper Pilot currently supports Ollama only. Start Ollama, pull at least one
chat model, and use **Preferences > AI Providers > Add local Ollama provider**.
The default endpoint is `http://localhost:11434/v1`; requests use Ollama's
native `/api/chat` streaming API. Other providers, Responses API features, and
agent-mode execution are intentionally not active in this fork.

The page and interaction design is based on
[llm-for-zotero](https://github.com/yilewang/llm-for-zotero). The repository's
existing Git remotes are intentionally unchanged; that project is the
documented reference upstream for future comparisons.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📧 Support

- [Issue Tracker](https://github.com/albert/paperpilot/issues)
- [Project Homepage](https://github.com/albert/paperpilot)

## 🙏 Acknowledgments

- Thanks to the **[llm-for-zotero](https://github.com/yilewang/llm-for-zotero)** project, from which Paper Pilot was forked and significantly evolved with the assistance of AI agents.
- Built with [Zotero Plugin Toolkit](https://github.com/northword/zotero-plugin-toolkit)
- Powered by the [Zotero](https://www.zotero.org/) community

---

_Paper Pilot - Your AI research companion, rooted in your library._
