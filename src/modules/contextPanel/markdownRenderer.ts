/**
 * Markdown to HTML conversion
 * Uses marked library to convert markdown to HTML for display in Zotero panel
 */

import { marked } from "marked";
import hljs from "highlight.js";

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

// Set up code highlighting
marked.setOptions({
  breaks: true,
  gfm: true,
  async: false,
});

/**
 * Convert markdown text to HTML
 */
export function markdownToHtml(markdown: string): string {
  try {
    let html = marked.parse(markdown) as string;
    
    // Add CSS classes for styling
    html = html.replace(/<h([1-6])>/g, '<h$1 class="paperpilot-heading paperpilot-h$1">');
    html = html.replace(/<p>/g, '<p class="paperpilot-paragraph">');
    html = html.replace(/<strong>/g, '<strong class="paperpilot-strong">');
    html = html.replace(/<em>/g, '<em class="paperpilot-em">');
    html = html.replace(/<code>/g, '<code class="paperpilot-inline-code">');
    html = html.replace(/<pre><code/g, '<pre class="paperpilot-code-block"><code');
    html = html.replace(/<ul>/g, '<ul class="paperpilot-list paperpilot-ul">');
    html = html.replace(/<ol>/g, '<ol class="paperpilot-list paperpilot-ol">');
    html = html.replace(/<li>/g, '<li class="paperpilot-list-item">');
    html = html.replace(/<blockquote>/g, '<blockquote class="paperpilot-blockquote">');
    html = html.replace(/<table>/g, '<table class="paperpilot-table">');
    html = html.replace(/<hr>/g, '<hr class="paperpilot-hr">');
    html = html.replace(/<a href=/g, '<a class="paperpilot-link" target="_blank" rel="noopener noreferrer" href=');
    html = html.replace(/<img /g, '<img class="paperpilot-image" ');
    
    return html;
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
    const html = markdownToHtml(markdown);
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
