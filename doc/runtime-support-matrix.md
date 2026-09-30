# Runtime support matrix

Paper Pilot is developed and release-verified with **Zotero 7** and Node.js 22. The Node test suite validates shared TypeScript behavior; it cannot
substitute for the Gecko runtime APIs used by the installed add-on.

## Required release verification

Before publishing a release, install the built `.xpi` in a Zotero 7 profile on
each supported operating system and record the result in the release issue or
pull request.

| Platform | Required smoke checks                                                                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | Configure a local provider; read/write a new Markdown file with `file_io`; run `pwd` with `run_command`; start a Codex-native turn and list MCP tools.          |
| Windows  | Repeat the file test using a drive-letter path; run `cmd /c echo paperpilot`; confirm command output is captured; start a Codex-native turn and list MCP tools. |
| Linux    | Configure a local provider; read/write a new Markdown file with `file_io`; run `pwd` with `run_command`; start a Codex-native turn and list MCP tools.          |

For every platform, also verify the following approval and cleanup behavior:

1. Writing an existing file requires confirmation.
2. A library mutation requires confirmation in both Agent and MCP modes.
3. An invalid MCP bearer token returns HTTP 401.
4. Deleting a conversation removes its Agent trace from the activity UI and
   prevents it from being reopened after restarting Zotero.

## Gecko API fallback expectations

| Capability         | Primary API               | Fallback          | Expected behavior when unavailable                                                                                            |
| ------------------ | ------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| File read/write    | `IOUtils`                 | `OS.File`         | The operation reports a file-I/O error; it must not claim success.                                                            |
| Directory creation | `IOUtils.makeDirectory`   | `OS.File.makeDir` | The write fails and reports the underlying error.                                                                             |
| Shell execution    | `Subprocess.call`         | `nsIProcess`      | `nsIProcess` does not capture stdout; the result explicitly states this limitation. If neither API exists, the command fails. |
| MCP HTTP endpoint  | `Zotero.Server.Endpoints` | None              | Native MCP is unavailable; other Agent modes continue to operate.                                                             |

The compatibility fallback paths are covered by unit tests where practical.
The installation smoke checks above remain release requirements because they
exercise Zotero's actual Gecko runtime and operating-system integration.
