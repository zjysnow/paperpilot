/** Check whether the base URL points at a Responses API endpoint. */
export function isResponsesBase(baseOrUrl: string): boolean {
  const cleaned = baseOrUrl.trim().replace(/\/+$/, "");
  if (!cleaned) return false;
  try {
    const pathname = new URL(cleaned).pathname
      .replace(/\/+$/, "")
      .toLowerCase();
    return pathname.endsWith("/responses");
  } catch (_err) {
    return cleaned.toLowerCase().endsWith("/responses");
  }
}

/** Check whether the base URL points at an OpenAI-style chat completions endpoint. */
export function isOpenAIChatCompletionsBase(baseOrUrl: string): boolean {
  const cleaned = baseOrUrl.trim().replace(/\/+$/, "");
  if (!cleaned) return false;
  try {
    const pathname = new URL(cleaned).pathname
      .replace(/\/+$/, "")
      .toLowerCase();
    return pathname.endsWith("/chat/completions");
  } catch (_err) {
    return cleaned.toLowerCase().endsWith("/chat/completions");
  }
}

/** Check whether the base URL points at a local Flowise prediction endpoint. */
export function isFlowisePredictionBase(baseOrUrl: string): boolean {
  const cleaned = baseOrUrl.trim().replace(/\/+$/, "");
  if (!cleaned) return false;
  try {
    const pathname = new URL(cleaned).pathname
      .replace(/\/+$/, "")
      .toLowerCase();
    return pathname.startsWith("/api/v1/prediction");
  } catch (_err) {
    return cleaned.toLowerCase().includes("/api/v1/prediction");
  }
}
