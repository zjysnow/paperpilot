import type { AgentToolDefinition } from "../types";
import { fail, ok, validateObject } from "./shared";
import { isSubagentsEnabled } from "../../utils/subagentConfig";

export const SUBAGENT_TASK_TOOL_NAME = "subagent_task";

export type SubagentTaskInput = {
  task: string;
  context?: string;
};

export function validateSubagentTaskInput(
  value: unknown,
): { ok: true; value: SubagentTaskInput } | { ok: false; error: string } {
  if (!validateObject<Record<string, unknown>>(value)) {
    return fail("Expected an object with a task string");
  }
  if (typeof value.task !== "string" || !value.task.trim()) {
    return fail("task is required");
  }
  if (value.task.trim().length > 4000) {
    return fail("task must not exceed 4000 characters");
  }
  if (
    value.context !== undefined &&
    (typeof value.context !== "string" || value.context.length > 12000)
  ) {
    return fail("context must be a string no longer than 12000 characters");
  }
  return ok({
    task: value.task.trim(),
    context:
      typeof value.context === "string" ? value.context.trim() : undefined,
  });
}

/**
 * The runtime intercepts execution to spawn an isolated same-model subagent.
 * Keeping the definition here makes it visible through the normal tool
 * registry and model-provider function schemas.
 */
export function createSubagentTaskTool(): AgentToolDefinition<
  SubagentTaskInput,
  unknown
> {
  return {
    spec: {
      name: SUBAGENT_TASK_TOOL_NAME,
      description:
        "Delegate one narrow research, evidence extraction, or read-only project-inspection task to an isolated subagent. The subagent uses the currently selected model with a fresh context and can only use read-only tools. It returns a concise evidence summary; it cannot modify files, the library, or run commands.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["task"],
        properties: {
          task: {
            type: "string",
            description:
              "A narrow, self-contained objective for the subagent. Include the question, expected evidence, and desired output.",
          },
          context: {
            type: "string",
            description:
              "Optional essential excerpts or constraints. Keep this concise; do not paste the whole conversation.",
          },
        },
      },
      mutability: "read",
      requiresConfirmation: false,
      tier: "advanced",
    },
    guidance: {
      matches: () => isSubagentsEnabled(),
      instruction:
        "Subagents are enabled. For paper-replication work, delegate the required focused method, data/evaluation, and project/experiment tasks before writing files; the runtime enforces this. For other work, use subagent_task for narrow, independent evidence gathering, code/project inspection, or focused comparison when delegating it keeps the main context concise. Give a precise task and only essential context. The subagent uses the same currently selected model and is read-only; integrate its returned evidence yourself.",
    },
    isAvailable: () => isSubagentsEnabled(),
    validate: validateSubagentTaskInput,
    execute: async () => ({
      error: "subagent_task must be executed by the Agent runtime",
    }),
  };
}
