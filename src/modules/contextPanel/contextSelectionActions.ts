

export type ContextSelectionStatusLevel = "ready" | "warning" | "error";

export type ContextSelectionActionResult = {
  changed: boolean;
  statusMessage?: string;
  statusLevel?: ContextSelectionStatusLevel;
};