/**
 * Markdown to HTML conversion
 * Uses marked library to convert markdown to HTML for display in Zotero panel
 */

import { marked } from "marked";
import hljs from "highlight.js";
import katex from "katex";

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

const markdownRenderer = new marked.Renderer();
markdownRenderer.code = ({ text, lang }) => {
  const language = lang?.trim().split(/\s+/)[0] || "";
  const highlighted =
    language && hljs.getLanguage(language)
      ? hljs.highlight(text, { language }).value
      : escapeHtml(text);
  const languageClass = language ? ` language-${escapeHtml(language)}` : "";
  return `<pre class="paperpilot-code-block"><code class="paperpilot-code${languageClass}">${highlighted}</code></pre>`;
};

marked.setOptions({
  breaks: true,
  gfm: true,
  async: false,
  renderer: markdownRenderer,
});

function renderMathInMarkdown(markdown: string): string {
  return markdown.replace(
    /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|(?<!\$)\$([^$\n]+)\$(?!\$)/g,
    (_match, displayDollar, displayBracket, inlineParen, inlineDollar) => {
      const display = displayDollar ?? displayBracket;
      const expression = display ?? inlineParen ?? inlineDollar;
      const displayMode = display !== undefined;
      const rendered = katex.renderToString(expression.trim(), {
        displayMode,
        throwOnError: false,
        output: "htmlAndMathml",
      });
      return displayMode
        ? `<div class="math-display">${rendered}</div>`
        : `<span class="math-inline">${rendered}</span>`;
    },
  );
}

/**
 * Convert markdown text to HTML
 */
export function markdownToHtml(markdown: string, doc?: Document): string {
  try {
    const html = marked.parse(renderMathInMarkdown(markdown)) as string;
    const temp = (doc || document).implementation.createHTMLDocument("");
    temp.body.innerHTML = html;
    temp.body.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
      heading.classList.add(
        "paperpilot-heading",
        `paperpilot-${heading.tagName.toLowerCase()}`,
      );
    });
    temp.body
      .querySelectorAll("p")
      .forEach((paragraph) => paragraph.classList.add("paperpilot-paragraph"));
    temp.body
      .querySelectorAll("strong")
      .forEach((strong) => strong.classList.add("paperpilot-strong"));
    temp.body
      .querySelectorAll("em")
      .forEach((em) => em.classList.add("paperpilot-em"));
    temp.body
      .querySelectorAll("code:not(.paperpilot-code)")
      .forEach((code) => code.classList.add("paperpilot-inline-code"));
    temp.body.querySelectorAll("ul, ol").forEach((list) => {
      list.classList.add(
        "paperpilot-list",
        list.tagName.toLowerCase() === "ul" ? "paperpilot-ul" : "paperpilot-ol",
      );
    });
    temp.body
      .querySelectorAll("li")
      .forEach((item) => item.classList.add("paperpilot-list-item"));
    temp.body
      .querySelectorAll("blockquote")
      .forEach((quote) => quote.classList.add("paperpilot-blockquote"));
    temp.body
      .querySelectorAll("table")
      .forEach((table) => table.classList.add("paperpilot-table"));
    temp.body
      .querySelectorAll("hr")
      .forEach((rule) => rule.classList.add("paperpilot-hr"));
    temp.body.querySelectorAll("a").forEach((link) => {
      link.classList.add("paperpilot-link");
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
    temp.body
      .querySelectorAll("img")
      .forEach((image) => image.classList.add("paperpilot-image"));
    return temp.body.innerHTML;
  } catch (error) {
    console.error("Markdown parse error:", error);
    return `<p class="paperpilot-paragraph">${escapeHtml(markdown)}</p>`;
  }
}

/**
 * Render markdown HTML into a DOM element
 */
export function renderMarkdownInto(
  element: HTMLElement,
  markdown: string,
  _doc?: Document,
): void {
  try {
    element.classList.add("paperpilot-rendered-markdown");
    const html = markdownToHtml(markdown, _doc || element.ownerDocument);
    // Create a temporary container to parse the HTML
    const temp = element.ownerDocument.createElement("div");
    temp.innerHTML = html;

    // Clear the target element
    element.innerHTML = "";

    // Move all children from temp to element
    while (temp.firstChild) {
      element.appendChild(temp.firstChild);
    }
  } catch (error) {
    console.error("Markdown render error:", error);
    element.textContent = markdown;
  }
}

/**
 * Render model Markdown as Zotero panel rich text.
 * Keep this entry point separate so every conversation mode uses the same
 * sanitized Markdown-to-DOM pipeline as shortcut summaries.
 */
export function renderZoteroRichTextInto(
  element: HTMLElement,
  markdown: string,
  doc?: Document,
): void {
  renderMarkdownInto(element, markdown, doc);
}

/**
 * Create a renderer for streaming updates
 * Returns a function that can incrementally add text to an element
 */
export function createStreamingRenderer(element: HTMLElement) {
  let buffer = "";
  let lastRenderedLength = 0;

  return {
    append(text: string): void {
      buffer += text;
      // Only re-render if we have significant new content
      // This avoids excessive re-renders during streaming
      if (buffer.length - lastRenderedLength > 50 || text.includes("\n\n")) {
        renderMarkdownInto(element, buffer);
        lastRenderedLength = buffer.length;
      }
    },
    flush(): void {
      if (buffer.length > lastRenderedLength) {
        renderMarkdownInto(element, buffer);
        lastRenderedLength = buffer.length;
      }
    },
    getBuffer(): string {
      return buffer;
    },
  };
}
