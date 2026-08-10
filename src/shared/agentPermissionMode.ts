export type AgentPermissionMode = "safe" | "yolo";

export function normalizeAgentPermissionMode(
  value: unknown,
): AgentPermissionMode {
  return value === "yolo" ? "yolo" : "safe";
}

export function getAgentPermissionModeDescription(): string {
  return "safe is recommended. yolo may allow broader tool actions; Zotero MCP and tool-specific safety checks can still require confirmation or block unsafe operations.";
}
