/**
 * Centralized i18n module for Paper Pilot.
 *
 * Design: English is the source of truth. All UI strings stay hardcoded in
 * English throughout the codebase. The `t()` function wraps them — when the
 * user picks Chinese, it looks up a translation map; otherwise it returns the
 * original English string unchanged.
 *
 * Adding a new English string requires NO changes here — it will just show
 * in English until a Chinese translation is added to the map.
 */

// ── Chinese (Simplified) translation map ────────────────────────────────────

const zhCN: Record<string, string> = {};

// ── Runtime state ────────────────────────────────────────────────────────────

let currentLocale: string = "auto";

/**
 * Initialize i18n — call once at plugin startup.
 */
export function initI18n(): void {
  try {
    const pref = Zotero.Prefs.get("extensions.zotero.paperpilot.locale", true);
    currentLocale = typeof pref === "string" ? pref : "auto";
  } catch {
    currentLocale = "auto";
  }
}

function getEffectiveLocale(): string {
  if (currentLocale !== "auto") return currentLocale;
  try {
    return (Zotero as unknown as { locale?: string }).locale || "en-US";
  } catch {
    return "en-US";
  }
}

/**
 * Translate an English UI string.
 *
 * - When locale is Chinese: look up the zhCN map; fall back to the English
 *   string if no translation exists.
 * - When locale is English (or anything else): return the English string as-is.
 *
 * Usage:  `button.textContent = t("Start All");`
 */
export function t(en: string): string {
  if (getEffectiveLocale().startsWith("zh")) {
    return zhCN[en] ?? en;
  }
  return en;
}

export function getWelcomeHtml(): string {
  if (getEffectiveLocale().startsWith("zh")) {
    return `
      <div class="paperpilot-welcome">
        <div class="paperpilot-welcome-icon paperpilot-context-svg-icon paperpilot-context-icon-model-chip" aria-hidden="true"></div>
        <div class="paperpilot-welcome-text">
          <div class="paperpilot-welcome-title">开始对话 — 以下是你可以做的。</div>
          <ul class="paperpilot-welcome-list">
            <li><strong>论文对话</strong>回答关于当前打开的 PDF 的问题。<strong>开放对话</strong>是一个自由形式的工作区，可跨多篇论文和文件提问。</li>
            <li>输入 <strong>/</strong> 打开快捷操作：附加文件、添加参考文献、发送当前 PDF 页面或发送整个 PDF。输入 <strong>@</strong> 从文献库添加论文作为上下文。</li>
            <li>在偏好设置中配置 <strong>AI Providers</strong>，然后照常开始对话。</li>
            <li>内联添加上下文：在 PDF 阅读器中选择文本作为<strong>文本上下文</strong>，使用截图按钮作为<strong>图片上下文</strong>，或使用 <strong>@</strong> 作为<strong>论文上下文</strong>。右键点击论文标签可强制发送全文；再次右键点击切换回检索模式。</li>
          </ul>
        </div>
      </div>
    `;
  }
  return `
    <div class="paperpilot-welcome">
      <div class="paperpilot-welcome-icon paperpilot-context-svg-icon paperpilot-context-icon-model-chip" aria-hidden="true"></div>
      <div class="paperpilot-welcome-text">
        <div class="paperpilot-welcome-title">Start chatting — here's what you can do.</div>
        <ul class="paperpilot-welcome-list">
          <li><strong>Paper chat</strong> answers questions about the currently open PDF. <strong>Library chat</strong> is a free-form workspace for questions across multiple papers and files.</li>
          <li>Type <strong>/</strong> to open quick actions: attach files, add a reference, send the current PDF page, or send the entire PDF. Type <strong>@</strong> to add a paper from your library as context.</li>
          <li>Configure your <strong>AI Providers</strong> in Preferences, then start chatting normally.</li>
          <li>Add context inline: select text in the PDF reader for <strong>text context</strong>, use the screenshot button for <strong>figure context</strong>, or use <strong>@</strong> for <strong>paper context</strong>. Right-click a paper chip to force sending its full text; right-click again to switch it back to retrieval mode.</li>
        </ul>
      </div>
    </div>
  `;
}

export function getPaperChatStartPageHtml(): string {
  if (getEffectiveLocale().startsWith("zh")) {
    return `
      <div class="paperpilot-start-page">
        <div class="paperpilot-start-page-title">Paper Pilot</div>
        <div class="paperpilot-start-page-subtitle">从这里开始，读懂这篇论文的一切</div>
        <div class="paperpilot-start-page-desc">
          <p>论文对话回答关于当前活跃论文的问题。论文将在你提问前预加载到上下文中。</p>
          <p>内联添加上下文：<strong>文本</strong>、<strong>截图</strong>或 <strong>@论文</strong>。左键点击论文标签发送 PDF；右键点击切换全文/检索模式。</p>
          <p>使用文献库对话请点击顶部的<strong>在新窗口中打开</strong>按钮。</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="paperpilot-start-page">
      <div class="paperpilot-start-page-title">Paper Pilot</div>
      <div class="paperpilot-start-page-subtitle">Understand everything of this paper, from here</div>
      <div class="paperpilot-start-page-desc">
        <p>Paper chat answers questions about your current active paper. The paper will be pre-loaded into context before your first question.</p>
        <p>Add context inline: <strong>text</strong>, <strong>screenshots</strong>, or <strong>@papers</strong>. Left-click a paper chip to send its PDF; right-click to toggle between full-text and retrieval mode.</p>
        <p>For library chat, click the <strong>Open in Window</strong> button at the top.</p>
      </div>
    </div>
  `;
}

export function getNoteEditingStartPageHtml(): string {
  if (getEffectiveLocale().startsWith("zh")) {
    return `
      <div class="paperpilot-start-page">
        <div class="paperpilot-start-page-title">Paper Pilot</div>
        <div class="paperpilot-start-page-subtitle">一起写笔记，让想法进化</div>
        <div class="paperpilot-start-page-desc">
          <p>选中一段文字，我可以帮你<strong>重写润色</strong>。</p>
          <p>如果是条目笔记，论文上下文会<strong>自动预加载</strong>；如果是独立笔记，那就自由发挥吧。</p>
          <p>重写后的内容会以 <strong>diff 模式</strong>显示，让你清楚看到每处改动，帮助你越写越好。</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="paperpilot-start-page">
      <div class="paperpilot-start-page-title">Paper Pilot</div>
      <div class="paperpilot-start-page-subtitle">Write with me, evolve your ideas</div>
      <div class="paperpilot-start-page-desc">
        <p>Select a text snippet, and I can <strong>rewrite</strong> it for you.</p>
        <p>If it's an item note, the paper context will be <strong>automatically preloaded</strong> for you; if it's a standalone note, let's freestyle.</p>
        <p>The rewritten note will show in <strong>diff mode</strong>, so you can see exactly what changed — helping you evolve to write better.</p>
      </div>
    </div>
  `;
}

export function getStandaloneLibraryChatStartPageHtml(): string {
  if (getEffectiveLocale().startsWith("zh")) {
    return `
      <div class="paperpilot-standalone-start-page">
        <div class="paperpilot-start-page-title">Paper Pilot</div>
        <div class="paperpilot-start-page-subtitle">为你和你的文献库服务</div>
        <div class="paperpilot-start-page-recommendations">
          <div class="paperpilot-start-page-rec-title">推荐设置以获得最佳体验</div>
          <ol class="paperpilot-start-page-rec-list">
            <li><strong>偏好设置 → MinerU</strong>：将 PDF 解析为 Markdown + 图片<span class="paperpilot-rec-reason">（MD 是 LLM 的语言；可以利用解析出的图片写出更好的笔记；节省 token）</span></li>
            <li>使用 <strong>AI Providers</strong> 里配置的模型完成研究任务</li>
            <li>使用<strong>适合研究任务的模型</strong>：例如适合总结、对比和写作的模型</li>
            <li>在偏好设置中配置<strong>笔记目录路径</strong></li>
          </ol>
        </div>
      </div>
    `;
  }
  return `
    <div class="paperpilot-standalone-start-page">
      <div class="paperpilot-start-page-title">Paper Pilot</div>
      <div class="paperpilot-start-page-subtitle">serve you and your library</div>
      <div class="paperpilot-start-page-recommendations">
        <div class="paperpilot-start-page-rec-title">Recommended settings for the best experience</div>
        <ol class="paperpilot-start-page-rec-list">
          <li><strong>Preferences → AI Providers</strong>: configure the model provider you want to use</li>
          <li><strong>Preferences → MinerU</strong>: parse your PDFs to Markdown + images<span class="paperpilot-rec-reason"> (MD is the language of LLMs; parsed images help better notes and save tokens)</span></li>
          <li>Use a <strong>capable research model</strong> for summaries, comparisons, and note drafting</li>
          <li>Set up <strong>Notes directory</strong> in Preferences</li>
        </ol>
      </div>
    </div>
  `;
}
