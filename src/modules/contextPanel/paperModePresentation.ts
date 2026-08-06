import { createElement } from "../../utils/domHelpers";
import { BUILTIN_SHORTCUTS } from "./constants";
import { isPdfContextAttachment } from "./contextAttachmentSupport";
import {
  formatPaperCitationLabel,
  resolvePaperContextRefFromAttachment,
} from "./paperAttribution";
import {
  resolvePaperChatSourceItem,
  resolveDisplayConversationKind,
} from "./portalScope";
import type { ChatAttachment } from "./types";

function getPaperPdfAttachment(item: Zotero.Item | null | undefined): Zotero.Item | null {
  const sourceItem = resolvePaperChatSourceItem(item);
  if (!sourceItem) return null;
  if (isPdfContextAttachment(sourceItem)) return sourceItem;

  const attachmentIDs = sourceItem.getAttachments?.() || [];
  for (const attachmentID of attachmentIDs) {
    const attachment = Zotero.Items.get(attachmentID) || null;
    if (isPdfContextAttachment(attachment)) return attachment;
  }
  return null;
}

function getItemTitle(item: Zotero.Item | null | undefined): string {
  const title = item?.getField?.("title");
  return typeof title === "string" && title.trim() ? title.trim() : "Untitled paper";
}

function getAttachmentLabel(attachment: Zotero.Item): string {
  const title = attachment.getField?.("title");
  if (typeof title === "string" && title.trim()) return title.trim();
  const filename = (attachment as unknown as { attachmentFilename?: unknown })
    .attachmentFilename;
  return typeof filename === "string" && filename.trim()
    ? filename.trim()
    : "Selected PDF";
}

function getPaperCreatorLabel(item: Zotero.Item | null | undefined): string {
  const creator = item?.getCreators?.()?.[0];
  if (!creator) return "";
  const creatorName = (creator as unknown as { name?: unknown }).name;
  if (typeof creatorName === "string" && creatorName.trim()) {
    return creatorName.trim();
  }
  return [creator.lastName, creator.firstName]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .join(", ")
    .trim();
}

function getPaperYear(item: Zotero.Item | null | undefined): string {
  const date = item?.getField?.("date");
  const match = typeof date === "string" ? date.match(/\b\d{4}\b/) : null;
  return match?.[0] || "";
}

async function readFullTextCache(attachment: Zotero.Item): Promise<string> {
  const fulltext = (
    Zotero as unknown as {
      Fulltext?: {
        getItemCacheFile?: (item: Zotero.Item) => { path?: string; exists?: () => boolean };
      };
      FullText?: {
        getItemCacheFile?: (item: Zotero.Item) => { path?: string; exists?: () => boolean };
      };
    }
  ).Fulltext || (Zotero as unknown as { FullText?: unknown }).FullText;
  const cacheFile = (
    fulltext as { getItemCacheFile?: (item: Zotero.Item) => unknown } | undefined
  )?.getItemCacheFile?.(attachment) as
    | { path?: string; exists?: () => boolean }
    | undefined;
  if (!cacheFile || (typeof cacheFile.exists === "function" && !cacheFile.exists())) {
    return "";
  }

  const zoteroFile = (
    Zotero as unknown as {
      File?: {
        getContentsAsync?: (source: unknown, charset?: string) => Promise<unknown>;
      };
    }
  ).File;
  if (zoteroFile?.getContentsAsync) {
    const value = await zoteroFile.getContentsAsync(cacheFile, "utf-8");
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) {
      return new TextDecoder("utf-8").decode(value);
    }
  }
  return "";
}

export async function resolvePaperShortcutAttachment(
  item: Zotero.Item | null | undefined,
): Promise<ChatAttachment | null> {
  const attachment = getPaperPdfAttachment(item);
  if (!attachment) return null;
  const textContent = (
    (attachment as unknown as { textContent?: unknown }).textContent as string | undefined
  )?.trim() || (await readFullTextCache(attachment)).trim();
  if (!textContent) return null;
  const clippedText = textContent.slice(0, 120000);
  return {
    id: `paper-shortcut-${attachment.id}`,
    name: getAttachmentLabel(attachment),
    mimeType: "application/pdf",
    sizeBytes: clippedText.length,
    category: "pdf",
    textContent: clippedText,
    creatorLabel: getPaperCreatorLabel(resolvePaperChatSourceItem(item)),
    year: getPaperYear(resolvePaperChatSourceItem(item)),
  };
}

export function renderPaperModeContext(
  body: Element,
  item: Zotero.Item | null | undefined,
): void {
  const panel = body.querySelector("#paperpilot-paper-mode-context") as HTMLDivElement | null;
  if (!panel) return;

  const isPaperMode = resolveDisplayConversationKind(item) === "paper";
  const attachment = isPaperMode ? getPaperPdfAttachment(item) : null;
  if (!attachment) {
    panel.style.display = "none";
    panel.replaceChildren();
    return;
  }

  const sourceItem = resolvePaperChatSourceItem(item);
  const attachmentLabel = getAttachmentLabel(attachment);
  const paperTitle = getItemTitle(sourceItem);
  const paperContext = resolvePaperContextRefFromAttachment(attachment);
  const citationLabel = formatPaperCitationLabel(paperContext);

  panel.style.display = "contents";
  panel.replaceChildren();
  const chip = createElement(
    body.ownerDocument!,
    "div",
    "paperpilot-selected-context paperpilot-paper-context-chip paperpilot-paper-context-chip-pdf",
  );
  chip.dataset.contentSource = "pdf";
  chip.dataset.paperContextItemId = `${attachment.id}`;
  chip.title = paperTitle;

  const chipHeader = createElement(
    body.ownerDocument!,
    "div",
    "paperpilot-image-preview-header paperpilot-selected-context-header paperpilot-paper-context-chip-header",
  );
  const chipLabel = createElement(
    body.ownerDocument!,
    "span",
    "paperpilot-paper-context-chip-label",
    { title: `${attachmentLabel} - ${paperTitle}` },
  );
  const chipIcon = createElement(
    body.ownerDocument!,
    "span",
    "paperpilot-paper-context-chip-icon",
    { textContent: "PDF" },
  );
  chipIcon.setAttribute("aria-hidden", "true");
  const chipText = createElement(
    body.ownerDocument!,
    "span",
    "paperpilot-paper-context-chip-text",
    { textContent: `${citationLabel} - Text` },
  );
  chipLabel.append(chipIcon, chipText);
  chipHeader.append(chipLabel);
  const expanded = createElement(
    body.ownerDocument!,
    "div",
    "paperpilot-selected-context-expanded paperpilot-paper-context-chip-expanded",
  );
  const expandedTitle = createElement(
    body.ownerDocument!,
    "div",
    "paperpilot-paper-chip-preview-title",
    { textContent: paperTitle },
  );
  const expandedMeta = createElement(
    body.ownerDocument!,
    "div",
    "paperpilot-paper-chip-preview-meta",
    { textContent: `${citationLabel} - Text` },
  );
  expanded.append(expandedTitle, expandedMeta);
  chip.append(expanded);
  chip.append(chipHeader);
  panel.append(chip);
}

export function renderPaperModeShortcuts(
  body: Element,
  isPaperMode: boolean,
): void {
  const row = body.querySelector("#paperpilot-shortcuts") as HTMLDivElement | null;
  if (!row) return;
  row.style.display = isPaperMode ? "flex" : "none";
  row.replaceChildren();
  if (!isPaperMode) return;

  const doc = body.ownerDocument;
  if (!doc) return;
  for (const shortcut of BUILTIN_SHORTCUTS) {
    const button = createElement(doc, "button", "paperpilot-shortcut-btn", {
      type: "button",
      textContent: shortcut.label,
      title: shortcut.prompt,
    });
    button.dataset.shortcutPrompt = shortcut.prompt;
    button.dataset.shortcutId = shortcut.id;
    row.appendChild(button);
  }
}
