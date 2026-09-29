import { config } from "../../../package.json";
import { HTML_NS } from "../../utils/domHelpers";
import type { AgentEvent } from "../../agent/types";

type SubagentDetailEvent = Extract<
  AgentEvent,
  | { type: "subagent_started" }
  | { type: "subagent_output_delta" }
  | { type: "subagent_tool_activity" }
  | { type: "subagent_completed" }
  | { type: "subagent_failed" }
>;

type SubagentDetailState = {
  detailsByTaskId: Map<string, SubagentDetailEvent[]>;
  detailWindow: Window | null;
  activeTaskId: string | null;
};

const DETAIL_STATE_KEY = "__paperpilotSubagentDetailState";

let state: SubagentDetailState = {
  detailsByTaskId: new Map<string, SubagentDetailEvent[]>(),
  detailWindow: null,
  activeTaskId: null,
};

function connectStateToMainWindow(sourceDocument: Document): void {
  const sourceWindow = sourceDocument.defaultView as
    (Window & { [DETAIL_STATE_KEY]?: SubagentDetailState }) | null;
  if (!sourceWindow) return;
  const existing = sourceWindow[DETAIL_STATE_KEY];
  if (existing) {
    for (const [taskId, events] of state.detailsByTaskId) {
      if (!existing.detailsByTaskId.has(taskId)) {
        existing.detailsByTaskId.set(taskId, events);
      }
    }
    state = existing;
    return;
  }
  sourceWindow[DETAIL_STATE_KEY] = state;
}

function taskLabel(taskId: string): string {
  const started = (state.detailsByTaskId.get(taskId) || []).find(
    (
      event,
    ): event is Extract<SubagentDetailEvent, { type: "subagent_started" }> =>
      event.type === "subagent_started",
  );
  const task = started?.task || "Subagent task";
  return task.length > 44 ? `${task.slice(0, 43)}…` : task;
}

function taskStatus(taskId: string): "working" | "completed" | "failed" {
  const events = state.detailsByTaskId.get(taskId) || [];
  if (events.some((event) => event.type === "subagent_failed")) {
    return "failed";
  }
  if (events.some((event) => event.type === "subagent_completed")) {
    return "completed";
  }
  return "working";
}

function formatToolArguments(args: unknown): string {
  if (!args || typeof args !== "object" || Array.isArray(args)) return "";
  const safeArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    safeArgs[key] =
      key === "content" || key === "text" || key === "data"
        ? "[content omitted]"
        : value;
  }
  try {
    const formatted = JSON.stringify(safeArgs);
    return formatted.length > 900 ? `${formatted.slice(0, 897)}...` : formatted;
  } catch {
    return "";
  }
}

function render(win: Window): void {
  const root = win.document.getElementById("paperpilot-subagent-detail-root");
  if (!root) return;
  const taskId =
    state.activeTaskId && state.detailsByTaskId.has(state.activeTaskId)
      ? state.activeTaskId
      : state.detailsByTaskId.keys().next().value;
  if (!taskId) {
    return;
  }
  const events = state.detailsByTaskId.get(taskId) || [];
  const started = events.find(
    (
      event,
    ): event is Extract<SubagentDetailEvent, { type: "subagent_started" }> =>
      event.type === "subagent_started",
  );
  const doc = win.document;
  doc.title = started ? `Subagent: ${started.task}` : "Paper Pilot Subagent";
  const shell = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  shell.dataset.paperpilotSubagentShell = "true";
  shell.style.cssText =
    "height:100%;box-sizing:border-box;padding:16px;display:flex;flex-direction:column;gap:12px;font:13px system-ui,sans-serif;color:var(--fill-primary,CanvasText);background:var(--material-background,Canvas);";
  const tabs = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  tabs.style.cssText =
    "display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;flex:0 0 auto;";
  for (const candidateTaskId of state.detailsByTaskId.keys()) {
    const status = taskStatus(candidateTaskId);
    const tab = doc.createElementNS(HTML_NS, "button") as HTMLButtonElement;
    tab.type = "button";
    tab.textContent = `${status === "working" ? "●" : status === "completed" ? "✓" : "!"} ${taskLabel(candidateTaskId)}`;
    tab.title = taskLabel(candidateTaskId);
    tab.style.cssText = `flex:0 0 auto;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:5px 8px;border:1px solid var(--stroke-secondary,GrayText);border-radius:6px;cursor:pointer;color:var(--fill-primary,CanvasText);background:${candidateTaskId === taskId ? "color-mix(in srgb, var(--color-accent, Highlight) 16%, Canvas)" : "transparent"};`;
    tab.addEventListener("click", () => {
      state.activeTaskId = candidateTaskId;
      refreshDetailWindow(win);
    });
    tabs.appendChild(tab);
  }
  const title = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  title.style.cssText = "font-size:16px;font-weight:700;";
  title.textContent = started?.task || "Subagent task";
  const meta = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  meta.style.cssText = "color:var(--fill-secondary,GrayText);font-size:12px;";
  meta.textContent = started
    ? `Model: ${started.model} · Read-only isolated task`
    : "Waiting for task details";
  const transcript = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  transcript.style.cssText =
    "flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:12px;padding-right:2px;";
  const createBubble = (
    label: string,
    text: string,
    background: string,
  ): HTMLDivElement => {
    const bubble = doc.createElementNS(HTML_NS, "section") as HTMLDivElement;
    bubble.style.cssText = `align-self:${label === "Subagent" ? "flex-start" : "flex-end"};max-width:92%;padding:10px 12px;border:1px solid var(--stroke-secondary,GrayText);border-radius:8px;background:${background};`;
    const heading = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    heading.style.cssText =
      "margin-bottom:5px;color:var(--fill-secondary,GrayText);font-size:11px;font-weight:700;";
    heading.textContent = label;
    const body = doc.createElementNS(HTML_NS, "pre") as HTMLPreElement;
    body.style.cssText =
      "margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;line-height:1.45;";
    body.textContent = text;
    bubble.append(heading, body);
    return bubble;
  };
  if (started) {
    transcript.appendChild(
      createBubble(
        "Task",
        started.task,
        "color-mix(in srgb, var(--color-accent, Highlight) 12%, Canvas)",
      ),
    );
    if (started.paperContexts.length) {
      const papers = doc.createElementNS(HTML_NS, "section") as HTMLDivElement;
      papers.style.cssText =
        "padding:10px 12px;border:1px solid var(--stroke-secondary,GrayText);border-radius:8px;background:color-mix(in srgb, Canvas 94%, GrayText 6%);";
      const label = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
      label.style.cssText =
        "margin-bottom:6px;color:var(--fill-secondary,GrayText);font-size:11px;font-weight:700;";
      label.textContent = "Papers passed from the main chat";
      const list = doc.createElementNS(HTML_NS, "ul") as HTMLUListElement;
      list.style.cssText = "margin:0;padding-left:18px;";
      for (const paper of started.paperContexts) {
        const item = doc.createElementNS(HTML_NS, "li") as HTMLLIElement;
        const source =
          paper.source === "full_text"
            ? "full text"
            : paper.source === "pinned"
              ? "pinned"
              : "selected";
        const bibliographic = [paper.firstCreator, paper.year]
          .filter(Boolean)
          .join(", ");
        item.textContent = `${paper.title}${bibliographic ? ` (${bibliographic})` : ""} · ${source}`;
        list.appendChild(item);
      }
      papers.append(label, list);
      transcript.appendChild(papers);
    }
  }
  const lines: string[] = [];
  const activities: string[] = [];
  let streamedText = "";
  for (const event of events) {
    if (event.type === "subagent_output_delta") {
      streamedText += event.text;
      lines.push(event.text);
    }
    if (event.type === "subagent_tool_activity") {
      const argumentsText = formatToolArguments(event.args);
      activities.push(
        `${event.phase === "started" ? "Using" : event.ok === false ? "Failed" : "Completed"}${event.name ? `: ${event.name}` : ""}${argumentsText ? ` ${argumentsText}` : ""}`,
      );
    }
    if (event.type === "subagent_completed") {
      if (!streamedText.trim()) lines.push(event.summary);
      activities.push(`Completed in ${event.rounds} round(s)`);
    }
    if (event.type === "subagent_failed") {
      activities.push(`Failed: ${event.error}`);
    }
  }
  if (activities.length) {
    transcript.appendChild(
      createBubble(
        "Activity",
        activities.join("\n"),
        "color-mix(in srgb, Canvas 94%, GrayText 6%)",
      ),
    );
  }
  if (lines.join("").trim()) {
    transcript.appendChild(
      createBubble(
        "Subagent",
        lines.join(""),
        "color-mix(in srgb, Canvas 94%, GrayText 6%)",
      ),
    );
  }
  const composer = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  composer.style.cssText =
    "padding:9px 12px;border:1px solid var(--stroke-secondary,GrayText);border-radius:8px;color:var(--fill-secondary,GrayText);font-size:12px;";
  composer.textContent =
    "This isolated subagent session is read-only. Its findings are returned to the main chat for integration.";
  shell.append(tabs, title, meta, transcript, composer);
  const existingShell = root.querySelector(
    '[data-paperpilot-subagent-shell="true"]',
  );
  if (existingShell) {
    existingShell.replaceChildren();
    while (shell.firstChild) {
      existingShell.appendChild(shell.firstChild);
    }
  } else {
    root.appendChild(shell);
  }
  transcript.scrollTop = transcript.scrollHeight;
}

function refreshDetailWindow(win: Window): void {
  if (win.closed) return;
  render(win);
}

function focusDetailWindow(win: Window): void {
  if (win.closed) return;
  win.focus();
  win.setTimeout(() => {
    if (!win.closed) win.focus();
  }, 0);
}

export function recordSubagentDetailEvent(event: AgentEvent): void {
  if (
    event.type !== "subagent_started" &&
    event.type !== "subagent_output_delta" &&
    event.type !== "subagent_tool_activity" &&
    event.type !== "subagent_completed" &&
    event.type !== "subagent_failed"
  ) {
    return;
  }
  const events = state.detailsByTaskId.get(event.taskId) || [];
  events.push(event);
  state.detailsByTaskId.set(event.taskId, events);
  if (state.detailWindow && !state.detailWindow.closed) {
    refreshDetailWindow(state.detailWindow);
  }
}

export function openSubagentDetailWindow(
  sourceDocument: Document,
  taskId: string,
): void {
  connectStateToMainWindow(sourceDocument);
  const activeTaskId = state.activeTaskId;
  if (state.detailsByTaskId.has(taskId)) {
    state.activeTaskId = taskId;
  }
  if (state.detailWindow && !state.detailWindow.closed) {
    if (state.activeTaskId !== activeTaskId) {
      refreshDetailWindow(state.detailWindow);
    }
    focusDetailWindow(state.detailWindow);
    return;
  }
  const opener = sourceDocument.defaultView as
    | (Window & {
        openDialog?: (...args: unknown[]) => Window | null;
      })
    | null;
  const win = opener?.openDialog?.(
    `chrome://${config.addonRef}/content/subagentDetail.xhtml`,
    "paperpilot-subagents",
    "chrome,dialog=no,resizable,centerscreen,dependent=no",
  );
  if (!win) return;
  state.detailWindow = win;
  // A XUL dialog can load an intermediate document before the target XHTML.
  // Keep listening until the target root exists so stream events are not lost.
  win.addEventListener("load", () => refreshDetailWindow(win));
  refreshDetailWindow(win);
  focusDetailWindow(win);
  win.addEventListener(
    "unload",
    () => {
      if (state.detailWindow === win) {
        state.detailWindow = null;
        state.activeTaskId = null;
      }
    },
    { once: true },
  );
}
