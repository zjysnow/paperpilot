import type { AgentToolDefinition } from "../types";
import { fail, ok, validateObject } from "./shared";
import { isSubagentsEnabled } from "../../utils/subagentConfig";

export const SUBAGENT_TASK_TOOL_NAME = "subagent_task";

export type SubagentTaskInput = {
  task: string;
  title?: string;
  context?: string;
};

const LOCAL_WORKSPACE_TASK_PATTERN =
  /(?:\b(?:local\s+)?(?:workspace|working\s+directory|file\s*tree|directory|filesystem|git\s+status|git\s+repository|shell\s+command|run\s+command|terminal|cwd)\b|(?:\/Users\/|[A-Za-z]:[\\/]))/i;

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
  if (LOCAL_WORKSPACE_TASK_PATTERN.test(value.task)) {
    return fail(
      "subagent_task cannot inspect a local workspace, filesystem, Git state, or shell command. The main Agent must perform this directly with file_io or run_command.",
    );
  }
  if (
    value.title !== undefined &&
    (typeof value.title !== "string" || value.title.trim().length > 80)
  ) {
    return fail("title must be a string no longer than 80 characters");
  }
  if (
    value.context !== undefined &&
    (typeof value.context !== "string" || value.context.length > 12000)
  ) {
    return fail("context must be a string no longer than 12000 characters");
  }
  return ok({
    task: value.task.trim(),
    title: typeof value.title === "string" ? value.title.trim() : undefined,
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
        "Delegate one narrow research, evidence extraction, or paper-content comparison task to an isolated subagent. The subagent uses the currently selected model with a fresh context and can only use semantic read-only tools. It has no local filesystem, workspace, Git, or shell access, and cannot modify files or the library. Do not delegate directory/file-tree inspection, Git status, local project auditing, or command execution; perform those in the main Agent with file_io or run_command.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["task"],
        properties: {
          title: {
            type: "string",
            description:
              "A concise, unique task title (max 80 characters). State the concrete objective and target, not a generic label such as 'Research task'.",
          },
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
        "Subagents are enabled. For every subagent_task, first derive a concise, unique title that identifies its objective and target, then provide that title in the title field. For paper-replication work, delegate only focused paper-method, data/evaluation, and experiment-planning evidence tasks before writing files; the runtime enforces this. Never delegate local workspace/project inspection, file-tree listing, Git status, shell commands, script execution, or filesystem reads: those capabilities exist only in the main Agent, which must perform them itself with file_io or run_command. For other work, use subagent_task only for narrow, independent evidence gathering or focused comparison when delegating it keeps the main context concise. Give a precise task and only essential context. The subagent uses the same currently selected model and is read-only; integrate its returned evidence yourself.",
    },
    isAvailable: () => isSubagentsEnabled(),
    validate: validateSubagentTaskInput,
    execute: async () => ({
      error: "subagent_task must be executed by the Agent runtime",
    }),
  };
}
