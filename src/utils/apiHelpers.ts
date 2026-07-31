

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
