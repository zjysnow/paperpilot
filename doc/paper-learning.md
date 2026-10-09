# Paper learning / 论文学习

Paper Pilot's learning workflow is inspired by
[PaperUnfold](https://github.com/Kstheme/PaperUnfold), but uses native TypeScript,
the existing Zotero paper tools, and file approvals. No PaperUnfold scripts or
paper examples are bundled.

## 使用方法

1. 在 Agent Mode 选择一篇论文和确切的可读附件。
2. 在 Agent 开关旁选择 **Normal / Guide / Tutor**。模式按会话保存；
   Guide/Tutor 每轮固定使用对应 Skill，不需要重复输入命令。Library 会话
   需要恰好一个论文上下文；笔记会话不提供论文学习模式。
3. Guide 默认在聊天中展示机制/论证导览与 Mermaid 图；Tutor 围绕一个
   知识点教学。Normal 使用原来的轻量问答，不继承历史 Tutor 激活。
   `/paper-guide`、`/paper-tutor` 菜单仍保留，选用后也会设置对应模式。
4. 如需离线导览，在请求中指定绝对 `.html` 路径。未指定目录时可使用已配置的
   Workspace Directory；未配置时需要提供路径。确认写入后得到单文件 HTML。
5. 选择 Tutor 并说明具体学习目标，或复制离线导览中的章节学习提示。
   导师每轮围绕一个知识点给出讲解、问题或反馈。可随时要求直接解释、跳过、
   暂停或结束；不要求强制测验。模式选择不会因一句“暂停”被重置，
   退出固定教学模式需选 Normal。
6. 每个成功完成的学习回合自动提交数据库进度，无需路径或文件审批。
   同一论文、附件的新会话进入学习模式时自动恢复最新目标，也可指定已保存
   的其他目标。来源无法核对、检查点缺失或数据库失败会明确提示未保存。

对话历史和 Agent 上下文原本已持久化；新增结构化状态用于准确提取学习目标、
定位、解释/理解状态、缺口和下一步，不是重复备份所有聊天。它独立于模型
切换和上下文压缩，按论文/附件与目标存储。切换附件或原文指纹变化不会
静默沿用旧来源；同一目标的并发更新冲突会报错。失败或取消的回合不提交。

## 可选 Obsidian 自动同步

在插件设置的 **Notes Directory** 选择 Obsidian Vault 和目标子目录，然后
勾选 **Automatically sync learning state to notes**。默认关闭，启用时授权
当前目录；修改 Vault 或子目录后必须重新启用授权。目标子目录可自动创建，
但不会创建授权目录之外的缺失父目录，符号链接目的地被拒绝。

- 数据库是学习状态的唯一主存储，Markdown 是单向可读投影，不做双向解析。
- 同一论文/附件使用稳定文件名，包含多个学习目标和各自原文指纹、理解状态、
  回答/评估、缺口、下一步与原生 Zotero 链接。
- 只替换标记包围的托管区块。前后的手写笔记逐字保留；请在托管区块外编辑。
- 托管区块被手动修改、标记损坏、文件丢失或同名文件无法确认身份时停止覆盖，
  最终回复会提示同步失败。数据库中已提交的进度仍保留。
- 修复冲突后，下一个成功学习回合会重新尝试同步；也可要求 Agent 经审批绑定
  到授权目录内另一份现有 `.md` 笔记。系统不会依据论文标题猜测绑定关系。
- 自动同步采用临时文件与原子替换，不逐次弹出普通导出审批；授权可随时关闭。
  文件投影不享有普通显式导出的撤销栈，手写托管区域不会被自动合并。

## 可选 JSON 导出与恢复

JSON 只用于搬运、备份或显式恢复，不是日常保存的必要文件。提供绝对 `.json`
路径时沿用文件审批与撤销。读取 JSON 会核对来源，但不会直接导入数据库；
后续成功学习回合产生有效检查点才会提交。原始 JSON 文件不会因恢复被修改。

## English quick start

```text
/paper-guide
Explain this paper's question, central mechanism, evidence, and limits.
Save an offline guide to /absolute/workspace/guide.html.
```

```text
/paper-tutor
Help me trace the inputs and outputs of Equation 2, one point at a time.
```

```text
Pause here. Keep my next learning entry.
```

```text
/paper-tutor
Resume from /absolute/workspace/progress.json.
```

## Output contracts

- `paper-guide` and `paper-tutor` are manual Skills, available in the existing
  slash menu. They do not automatically replace Simple Paper Q&A.
- `paper_learning` exposes `guide`, `progress`, and `resume` operations.
  `bind-note` is also available. Path-free progress stages a database checkpoint
  in a managed Agent turn and requires no file approval. JSON/HTML writes and
  existing-note bindings use normal approval. Resume is read-only.
  The tool is unavailable through raw-PDF MCP transport, like other native
  filesystem tools, and is not a read-only subagent tool. External MCP clients
  can read database progress or explicitly export files, but cannot create
  unfinalizable internal checkpoints or staged note bindings.
- Version 1 source records include paper and attachment IDs, title, actual
  reading coverage, and missing material. The runtime stamps native keys,
  library ID, and the extracted-source fingerprint. A fingerprint identifies
  extracted content; it is not a cryptographic authenticity certificate.
- Guide points distinguish author claims, inference, background, and analogy.
  Author/inference points require evidence references. Literal excerpts must
  occur in the specified extracted source chunk. Native quote citations carry
  observed source metadata. The runtime does not independently verify which
  sections the model actually read or whether its interpretation is correct.
- Guide visuals have explicit nodes and edges; array order alone creates no
  connection. Method, empirical, and argument structures share this contract.
  SVG is a teaching reconstruction, not an author figure.
- HTML embeds the guide JSON and citations, offline MathML, SVG, and folded
  evidence. Evidence links open their collapsed target. Chapter prompts can be
  copied manually into Agent chat; the HTML does not run a model or access
  Zotero. Browsers without MathML support may not display formulas correctly.
- Progress records preserve a narrow learning target, source position,
  explained points, answer excerpts, assessment reasons, gaps, and next entry.
  States are `explained_unverified`, `partial`, and `mastered`.
  Partial/mastered require a nonempty answer and reason. The validator cannot
  determine whether that answer demonstrates understanding.
- Resume reads database progress by default (or explicitly provided JSON),
  verifies identity and source fingerprint,
  then directs the Agent to reread the relevant paper passage before teaching.
  It never upgrades learning status. Changed/missing source or a different
  selected attachment is an explicit error and leaves saved state untouched.
- An existing progress file can be updated only for the same source and exact
  target. Choose another filename for another target. File creates/overwrites
  use existing undo support. A guide is one HTML file, not a two-file partial
  export. Records are bounded to 80,000 characters.

## Scope and acceptance

Explicit selection determines the learning workflow even for a short message
such as "这篇论文讲的什么". The guide's default chat deliverable includes problem
and key change, a step-by-step mechanism/argument table, a connected Mermaid
visual, supporting evidence, limits/actual reading coverage, and a learning
route. The Tutor instead starts one focused explanation and reasoning question
(or direct explanation without a quiz when requested). Neither is merely a
longer ordinary summary.

Learning Skill instructions are supplied as current-turn system guidance.
The ordinary one-overview/brief-answer defaults do not override their evidence
and deliverable requirements. Reuse existing body evidence when sufficient;
otherwise read the missing mechanism and result passages. Missing body text
must produce an explicitly partial guide, not fabricated steps or results.
Unselected ordinary Q&A keeps its lightweight workflow. These prompt contracts
guide the model; they are not a semantic validator of the generated chat answer.
Unmodified seeded learning Skills upgrade to instruction version 3; user
customizations and intentional deletions remain preserved. Record JSON remains
version 1. Customized older Skills may omit the required automatic checkpoint;
that produces an explicit failed learning round rather than a false save claim.
Restore the default learning Skill instructions or add the v3 checkpoint
contract to your customization.

The implementation supports source-grounded guides, focused teaching instructions,
persistent modes, database progress, optional Markdown projection, portable
progress, and offline HTML. Native one-click chapter-to-chat actions,
original figure embedding, and interactive mechanism demonstrations remain
future work in [the backlog](../TODO.md).

Unit tests cover representative research structures, contracts, literal source
checks, graph references, source mismatch, cross-conversation resume, file
approval/denial/undo, and escaped offline output. These tests do not establish
learning gains, real-model explanation quality, or every Zotero/browser runtime.

Before release, manually exercise a method, empirical, and theoretical paper in
Zotero: generate a guide, open the exported HTML offline, inspect a formula and
evidence link, copy a Tutor prompt, pause/save, resume in a new conversation,
and check failure with another attachment. Exercise opt-in note sync and managed
block conflicts. Record the runtime/model and actual
source coverage; do not infer browser success from export success.

The generated example HTML was also checked in an integrated browser: MathML
has a rendered layout, evidence links expand both disclosure levels and reopen
a manually closed target, a chapter Tutor prompt is present, a 390px viewport
has no horizontal overflow, and no external resources load. Zotero
workflow tests include the actual startup loader, `/paper-` menu visibility,
selection of both learning Skills, and their submitted `forcedSkillIds`.
Manual Skills do not need regex match patterns; they remain explicitly invoked.
Loader regressions preserve user-customized files and intentional deletions.
Agent-runtime tests also verify that a menu-selected Tutor continues across
compatible turns and ends when another Skill is selected. These are not
real-paper/model teaching evaluations; that release check remains in the backlog.

The redesigned workflow passes 182 unit tests and six native Zotero workflow
tests. The additional native checks exercise actual selector changes and
database reloads, fixed Skill submission, Normal reset/new-conversation defaults,
actual synthetic-PDF extraction and SQLite checkpoint commits, atomic Markdown
creation/update, preservation of manual regions, managed-block conflict warnings
with retained database progress, and automatic restore in another conversation.
The model adapter is scripted for these storage tests: this verifies integration
and native I/O, not real-model teaching quality.
