import { config } from "../../../package.json";
import { getAgentRunTrace } from "../../agent/store/traceStore";
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
  detailsByTaskKey: Map<string, SubagentDetailEvent[]>;
  taskRunIdsByKey: Map<string, string>;
  runConversationKeys: Map<string, number>;
  runStartedAtById: Map<string, number>;
  detailWindow: Window | null;
  activeTaskKey: string | null;
  activeRunId: string | null;
  activeConversationKey: number | null;
};

const DETAIL_STATE_KEY = "__paperpilotSubagentDetailState";
const subagentDetailHydrations = new Map<string, Promise<void>>();

let state: SubagentDetailState = {
  detailsByTaskKey: new Map<string, SubagentDetailEvent[]>(),
  taskRunIdsByKey: new Map<string, string>(),
  runConversationKeys: new Map<string, number>(),
  runStartedAtById: new Map<string, number>(),
  detailWindow: null,
  activeTaskKey: null,
  activeRunId: null,
  activeConversationKey: null,
};

function getTaskKey(runId: string, taskId: string): string {
  return JSON.stringify([runId, taskId]);
}

function connectStateToMainWindow(sourceDocument: Document): void {
  const sourceWindow = sourceDocument.defaultView as
    (Window & { [DETAIL_STATE_KEY]?: SubagentDetailState }) | null;
  if (!sourceWindow) return;
  const existing = sourceWindow[DETAIL_STATE_KEY];
  if (existing) {
    existing.detailsByTaskKey ||= new Map<string, SubagentDetailEvent[]>();
    existing.taskRunIdsByKey ||= new Map<string, string>();
    existing.runConversationKeys ||= new Map<string, number>();
    existing.runStartedAtById ||= new Map<string, number>();
    for (const [taskKey, events] of state.detailsByTaskKey) {
      if (!existing.detailsByTaskKey.has(taskKey)) {
        existing.detailsByTaskKey.set(taskKey, events);
      }
    }
    for (const [taskKey, runId] of state.taskRunIdsByKey) {
      if (!existing.taskRunIdsByKey.has(taskKey)) {
        existing.taskRunIdsByKey.set(taskKey, runId);
      }
    }
    for (const [runId, conversationKey] of state.runConversationKeys) {
      if (!existing.runConversationKeys.has(runId)) {
        existing.runConversationKeys.set(runId, conversationKey);
      }
    }
    for (const [runId, startedAt] of state.runStartedAtById) {
      if (!existing.runStartedAtById.has(runId)) {
        existing.runStartedAtById.set(runId, startedAt);
      }
    }
    state = existing;
    return;
  }
  sourceWindow[DETAIL_STATE_KEY] = state;
}

function formatRunScope(runId: string): string {
  const startedAt = state.runStartedAtById.get(runId);
  const localTime =
    typeof startedAt === "number" && Number.isFinite(startedAt)
      ? new Date(startedAt).toLocaleString()
      : "Current turn";
  const shortRunId = runId.length > 12 ? runId.slice(-12) : runId;
  return `${localTime} · Run ${shortRunId}`;
}

function visibleTaskKeys(): string[] {
  if (!state.activeRunId) {
    return [...state.detailsByTaskKey.keys()];
  }
  return [...state.detailsByTaskKey.keys()].filter((taskKey) => {
    const runId = state.taskRunIdsByKey.get(taskKey);
    return runId === state.activeRunId;
  });
}

function isSubagentDetailEvent(
  event: AgentEvent,
): event is SubagentDetailEvent {
  return (
    event.type === "subagent_started" ||
    event.type === "subagent_output_delta" ||
    event.type === "subagent_tool_activity" ||
    event.type === "subagent_completed" ||
    event.type === "subagent_failed"
  );
}

async function hydrateSubagentDetailsForRun(runId: string): Promise<void> {
  const hasRunDetails = [...state.taskRunIdsByKey.values()].some(
    (candidateRunId) => candidateRunId === runId,
  );
  if (hasRunDetails) return;
  const inFlight = subagentDetailHydrations.get(runId);
  if (inFlight) return inFlight;
  const hydration = (async () => {
    const trace = await getAgentRunTrace(runId);
    if (
      trace.run &&
      typeof trace.run.conversationKey === "number" &&
      trace.run.conversationKey > 0
    ) {
      state.runConversationKeys.set(runId, trace.run.conversationKey);
    }
    if (
      trace.run &&
      typeof trace.run.createdAt === "number" &&
      Number.isFinite(trace.run.createdAt)
    ) {
      state.runStartedAtById.set(runId, trace.run.createdAt);
    }
    for (const entry of trace.events) {
      if (!isSubagentDetailEvent(entry.payload)) continue;
      const taskKey = getTaskKey(runId, entry.payload.taskId);
      const events = state.detailsByTaskKey.get(taskKey) || [];
      events.push(entry.payload);
      state.detailsByTaskKey.set(taskKey, events);
      state.taskRunIdsByKey.set(taskKey, runId);
    }
  })();
  subagentDetailHydrations.set(runId, hydration);
  try {
    await hydration;
  } finally {
    subagentDetailHydrations.delete(runId);
  }
}

function taskLabel(taskKey: string): string {
  const started = (state.detailsByTaskKey.get(taskKey) || []).find(
    (
      event,
    ): event is Extract<SubagentDetailEvent, { type: "subagent_started" }> =>
      event.type === "subagent_started",
  );
  const task = started?.title || "Subagent task";
  return task.length > 44 ? `${task.slice(0, 43)}…` : task;
}

function taskStatus(taskKey: string): "working" | "completed" | "failed" {
  const events = state.detailsByTaskKey.get(taskKey) || [];
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
  const taskKeys = visibleTaskKeys();
  const taskKey =
    state.activeTaskKey && taskKeys.includes(state.activeTaskKey)
      ? state.activeTaskKey
      : taskKeys[0];
  if (!taskKey) {
    root.replaceChildren();
    const empty = win.document.createElementNS(HTML_NS, "div");
    empty.style.cssText =
      "height:100%;box-sizing:border-box;padding:16px;font:13px system-ui,sans-serif;color:var(--fill-secondary,GrayText);background:var(--material-background,Canvas);";
    empty.textContent = "No subagent details are available for this agent run.";
    root.appendChild(empty);
    return;
  }
  const events = state.detailsByTaskKey.get(taskKey) || [];
  const started = events.find(
    (
      event,
    ): event is Extract<SubagentDetailEvent, { type: "subagent_started" }> =>
      event.type === "subagent_started",
  );
  const doc = win.document;
  doc.title = started ? `Subagent: ${started.title}` : "Paper Pilot Subagent";
  const shell = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  shell.dataset.paperpilotSubagentShell = "true";
  shell.style.cssText =
    "height:100%;box-sizing:border-box;padding:16px;display:flex;gap:16px;font:13px system-ui,sans-serif;color:var(--fill-primary,CanvasText);background:var(--material-background,Canvas);";
  const taskList = doc.createElementNS(HTML_NS, "nav") as HTMLElement;
  taskList.setAttribute("aria-label", "Subagent tasks");
  taskList.style.cssText =
    "flex:0 0 210px;min-width:160px;display:flex;flex-direction:column;gap:6px;overflow-y:auto;padding-right:10px;border-right:1px solid var(--stroke-secondary,GrayText);";
  const taskListTitle = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  taskListTitle.style.cssText =
    "padding:2px 4px 6px;color:var(--fill-secondary,GrayText);font-size:11px;font-weight:700;text-transform:uppercase;";
  taskListTitle.textContent = "Subagent tasks";
  taskList.appendChild(taskListTitle);
  if (state.activeRunId) {
    const runScope = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
    runScope.style.cssText =
      "padding:0 4px 7px;color:var(--fill-secondary,GrayText);font-size:11px;line-height:1.35;word-break:break-word;";
    runScope.textContent = `Agent turn · ${formatRunScope(state.activeRunId)}`;
    runScope.title = `Agent run ID: ${state.activeRunId}`;
    taskList.appendChild(runScope);
  }
  for (const candidateTaskKey of taskKeys) {
    const status = taskStatus(candidateTaskKey);
    const taskButton = doc.createElementNS(
      HTML_NS,
      "button",
    ) as HTMLButtonElement;
    taskButton.type = "button";
    taskButton.textContent = `${status === "working" ? "●" : status === "completed" ? "✓" : "!"} ${taskLabel(candidateTaskKey)}`;
    taskButton.title = taskLabel(candidateTaskKey);
    taskButton.setAttribute(
      "aria-current",
      candidateTaskKey === taskKey ? "page" : "false",
    );
    taskButton.style.cssText = `width:100%;overflow:hidden;text-overflow:ellipsis;text-align:left;white-space:normal;line-height:1.35;padding:7px 8px;border:1px solid var(--stroke-secondary,GrayText);border-radius:6px;cursor:pointer;color:var(--fill-primary,CanvasText);background:${candidateTaskKey === taskKey ? "color-mix(in srgb, var(--color-accent, Highlight) 16%, Canvas)" : "transparent"};`;
    taskButton.addEventListener("click", () => {
      state.activeTaskKey = candidateTaskKey;
      refreshDetailWindow(win);
    });
    taskList.appendChild(taskButton);
  }
  const content = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  content.style.cssText =
    "min-width:0;flex:1;display:flex;flex-direction:column;gap:12px;";
  const title = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  title.style.cssText = "font-size:16px;font-weight:700;";
  title.textContent = started?.title || "Subagent task";
  const meta = doc.createElementNS(HTML_NS, "div") as HTMLDivElement;
  meta.style.cssText = "color:var(--fill-secondary,GrayText);font-size:12px;";
  meta.textContent = started
    ? `Agent turn: ${state.activeRunId ? formatRunScope(state.activeRunId) : "Current turn"} · Model: ${started.model} · Read-only isolated task`
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
  content.append(title, meta, transcript, composer);
  shell.append(taskList, content);
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

export function recordSubagentDetailEvent(
  event: AgentEvent,
  agentRunId?: string,
  conversationKey?: number,
): void {
  if (
    event.type !== "subagent_started" &&
    event.type !== "subagent_output_delta" &&
    event.type !== "subagent_tool_activity" &&
    event.type !== "subagent_completed" &&
    event.type !== "subagent_failed"
  ) {
    return;
  }
  const runId = agentRunId || "pending";
  const taskKey = getTaskKey(runId, event.taskId);
  const events = state.detailsByTaskKey.get(taskKey) || [];
  events.push(event);
  state.detailsByTaskKey.set(taskKey, events);
  state.taskRunIdsByKey.set(taskKey, runId);
  if (typeof conversationKey === "number" && conversationKey > 0) {
    state.runConversationKeys.set(runId, conversationKey);
  }
  if (!state.runStartedAtById.has(runId)) {
    state.runStartedAtById.set(runId, Date.now());
  }
  if (
    event.type === "subagent_started" &&
    state.detailWindow &&
    !state.detailWindow.closed &&
    state.activeConversationKey === conversationKey
  ) {
    if (state.activeRunId !== runId) {
      state.activeRunId = runId;
      state.activeTaskKey = taskKey;
    } else if (
      !state.activeTaskKey ||
      taskStatus(state.activeTaskKey) !== "working"
    ) {
      state.activeTaskKey = taskKey;
    }
  }
  if (state.detailWindow && !state.detailWindow.closed) {
    refreshDetailWindow(state.detailWindow);
  }
}

export async function openSubagentDetailWindow(
  sourceDocument: Document,
  taskId: string,
  agentRunId: string,
): Promise<void> {
  connectStateToMainWindow(sourceDocument);
  try {
    await hydrateSubagentDetailsForRun(agentRunId);
  } catch (error) {
    ztoolkit.log(
      "Paper Pilot: Failed to restore persisted subagent details",
      agentRunId,
      error,
    );
  }
  const activeTaskKey = state.activeTaskKey;
  const activeRunId = state.activeRunId;
  const taskKey = getTaskKey(agentRunId, taskId);
  state.activeTaskKey = state.detailsByTaskKey.has(taskKey) ? taskKey : null;
  state.activeRunId = agentRunId;
  state.activeConversationKey =
    state.runConversationKeys.get(agentRunId) || null;
  if (state.detailWindow && !state.detailWindow.closed) {
    if (
      state.activeTaskKey !== activeTaskKey ||
      state.activeRunId !== activeRunId
    ) {
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
  const initializeWindow = () => {
    if (win.closed) return;
    state.detailWindow = win;
    refreshDetailWindow(win);
    focusDetailWindow(win);
    // Register this only after the target XHTML has loaded. XUL unloads its
    // intermediate document during startup, which is not a user close.
    win.addEventListener(
      "unload",
      () => {
        if (state.detailWindow === win) {
          state.detailWindow = null;
          state.activeTaskKey = null;
          state.activeRunId = null;
          state.activeConversationKey = null;
        }
      },
      { once: true },
    );
  };
  win.addEventListener("load", initializeWindow, { once: true });
  focusDetailWindow(win);
}
