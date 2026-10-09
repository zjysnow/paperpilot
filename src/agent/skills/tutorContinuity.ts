import type { AgentModelMessage } from "../types";

const EXIT_PATTERN =
  /^(?:please\s+)?(?:pause|stop|end|quit|exit)(?:\s|$)|^(?:请)?(?:暂停|停止|结束|退出)/i;

export function shouldContinuePaperTutor(
  history: readonly AgentModelMessage[],
  forcedSkillIds: readonly string[] = [],
): boolean {
  if (forcedSkillIds.length) return false;
  let active = false;
  for (const message of history) {
    if (message.role !== "user") continue;
    if (
      Array.isArray(message.forcedSkillIds) &&
      message.forcedSkillIds.length
    ) {
      active = message.forcedSkillIds.includes("paper-tutor");
    }
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
    const userText = content.includes("User request:\n")
      ? content
          .slice(
            content.lastIndexOf("User request:\n") + "User request:\n".length,
          )
          .trim()
      : content.trim();
    const directive = /^[$/]([A-Za-z0-9_-]+)(?:\s|$)/.exec(userText);
    if (directive) {
      active =
        directive[1] === "paper-tutor" &&
        !EXIT_PATTERN.test(userText.slice(directive[0].length).trim());
    } else if (EXIT_PATTERN.test(userText)) {
      active = false;
    }
  }
  return active;
}
