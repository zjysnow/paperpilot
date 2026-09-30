# Project Change List

记录 Paper Pilot 项目的功能、修复、重构和测试变更。后续每次修改完成后，将修改内容追加到本文件顶部。

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
