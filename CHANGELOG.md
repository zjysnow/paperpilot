# Project Change List

记录 Paper Pilot 项目的功能、修复、重构和测试变更。后续每次修改完成后，将修改内容追加到本文件顶部。

## 2026-10-09 — v1.5.1 论文学习工作流

- 修复 Linux 上原生选择控件的额外高度：按共享字号显式计算模式控件高度，
  保持与 Agent 开关对齐；增强跨平台几何测试的失败诊断。

- 将学习模式原生灰色下拉框改为与 Agent 开关对齐的紧凑胶囊控件，统一字号、
  字重、高度及悬停/焦点状态；保留原生键盘选择与模式持久化行为。

- Agent 界面新增按会话持久化的 Normal / Guide / Tutor 选择器；学习模式
  每轮固定对应 Skill，Normal 清除学习强制选择，发送与重试使用保存的模式。
- 学习状态改为 Zotero 数据库主存储，成功回合事务提交、跨会话自动恢复，
  中断/取消不提交；来源变化、并发修订冲突和缺少检查点明确报错。
- Notes Directory 新增默认关闭的学习状态单向 Markdown 自动同步授权：
  稳定文件包含多个目标，保留手写区域，检测托管块冲突，原子写入；路径变化
  需要重新授权，同步失败不丢失数据库状态。现有笔记绑定仍需审批。
- 学习 Skills 升级至 v3，默认自动保存数据库检查点；JSON 降为可选导出/
  恢复载体，HTML 导出保持原审批行为。外部 MCP 不允许无法提交的暂存写入。
- 增加数据库/运行时生命周期、可选笔记同步和实际 Zotero 选择器及原生
  SQLite/PDF/Markdown 集成回归测试，更新使用说明与待办。

- 修复学习 Skills 与系统默认轻量回答策略的指令冲突：学习指令改为当轮
  system guidance，显式选择的导览/导师模式不会因“这篇论文讲的什么”
  等简短问题被默认概览策略降级。
- 将导览/导师指令升级至 v2：导览默认包含机制步骤表、连接图、原文证据、
  条件/阅读缺口及学习路线；导师默认围绕一个核心问题开始教学。
  补充提示优先级和已播种指令升级回归测试；未选择时保持轻量问答。
- 修复手动 Skills 没有 `match:` 正则时被运行时加载器丢弃的问题：
  paper-guide / paper-tutor 现在可从实际 Zotero 命令菜单显示并选用。
- 在可复用的 Agent 对话记录中保留菜单显式选择的 Skill，让菜单进入的
  paper-tutor 也能持续教学；暂停或改选其他 Skill 后退出。
- 新增加载器初始化/用户定制/删除保留、实际 Zotero 菜单选择与提交、
  Agent 跨回合导师状态回归测试，补齐先前静态 Skills 测试遗漏的接入路径。
- 更新 TODO，分阶段规划 PaperUnfold 可借鉴的机制导览、导师模式、学习进度、
  离线导出及后续原生章节入口、交互演示。
- 新增显式调用的 paper-guide 和 paper-tutor Skills，保留普通问答行为；
  导师在兼容对话中持续逐点教学，并支持直接讲解、跳过和暂停。
- 新增 paper_learning 工具，校验实际附件原文摘录、复用原生引用、生成
  SVG/MathML 离线单文件导览，并保存/恢复绑定论文身份与原文指纹的学习记录。
- 文件写入沿用审批与撤销机制；来源变化、目标冲突和写入失败显式报错。
- 新增学习契约、离线渲染、Skills 路由、跨会话恢复与文件审批回归测试，
  并补充中英文使用说明和实际运行验证边界。

## 2026-09-30 — v1.4.0

- 在 Zotero 文献库工具栏的 New Note 右侧增加 Paper Pilot 入口，独立窗口默认进入 Library 模式，无需预先选择论文。
- 切换到 Paper 模式但尚未选择论文时，复用 `@` 参考文献选择界面的单篇选择模式；取消时保留原会话。
- 在独立窗口左侧栏增加论文页与双向箭头图标，用于切换论文并恢复对应会话，仅在 Paper 模式显示。
- 修复同一条目包含正式版和预印本 PDF 时来源菜单重复显示 MD、Text、PDF 的问题，保留当前 PDF 的来源模式和其他可读附件。
- 统一 Approval 与 Reasoning Level 的按钮样式，增加盾牌勾选图标，并将 Approval 标签简化为默认或全部允许。
- 窄宽度下按 Model、Approval、Reasoning Level 的顺序逐个折叠，加宽时反向恢复；保留模型选择按钮原有样式。
- 新增工具栏入口、来源菜单和响应式布局回归测试，通过 120 项单元测试、3 项 Zotero 集成测试、类型检查、lint 和循环依赖检查。

## 2026-08-10

- 清理 Claude Code 和 Codex 专用后端、认证协议、偏好设置、运行时适配器、界面入口及相关图标，统一保留通用模型服务商协议和内置 Agent 运行时。
- 移除已废弃的专用对话存储、搜索索引和会话键空间 wiring，并保留旧会话数据的兼容边界，避免启动和类型检查回归。
- 精简模型偏好设置与请求配置逻辑，继续支持 OpenAI-compatible、Responses API、Gemini、Anthropic-compatible 和 GitHub Copilot 服务商。
- 通过 TypeScript typecheck、18 个单元测试、workflow 构建、ESLint 和 `git diff --check`。

## 2026-08-09

- 在默认模型系统提示词中加入 Mermaid 节点标签引号规范，避免将兼容规则显示到用户对话框或快捷指令文本中。
- 增强 Mermaid flowchart 渲染前的确定性兼容处理：自动规范中文弯引号，并为包含空格、括号、逗号等内容的方括号和菱形节点补充引号，提升 Gemma 等本地模型的兼容性。
- 增加本地模型常见 Mermaid 输出的回归测试，覆盖特殊字符、带空格的节点标签和中文弯引号。
- 更新 Mermaid flowchart 快捷指令，要求生成带 `mermaid` 语言标识的 fenced code block。
- 增加快捷指令偏好迁移，清理旧的 Mermaid 默认提示词覆盖值。
- 修复 Mermaid 代码块和完整回答的复制内容，确保包含语言标识、代码围栏和完整源码。
- 对 Mermaid 回答优先使用纯文本剪贴板，兼容 Obsidian 等 Markdown 编辑器。
- 统一 Markdown、聊天后处理器和复制控件的 `paperpilot` class 与 `data-*` 属性命名。
- 修复流式回答阶段提前启动异步内容渲染的问题。
- 修复 Mermaid 渲染状态、主题版本、SVG 缓存和渲染队列。
- 将 Mermaid renderer 隔离到隐藏 HTML iframe，兼容 Zotero chrome DOM、iframe 脚本加载和 esbuild bundle 导出。
- 修复对话 SQLite INSERT 语句中占位符与参数数量不一致的问题。
- 增加 Mermaid flowchart 语法单元测试。
- 清理渲染器迭代过程中已废弃的 Document facade、临时容器和 Cytoscape 辅助代码。
- 通过 TypeScript typecheck、16 个单元测试、生产 build、Prettier 和 `git diff --check`。
