export function resolveOllamaTagsEndpoint(apiBase: string): string {
  const parsed = new URL(apiBase.trim());
  return `${parsed.origin}/api/tags`;
}

export async function fetchOllamaModelNames(
  fetchFn: typeof fetch,
  apiBase: string,
): Promise<string[]> {
  const response = await fetchFn(resolveOllamaTagsEndpoint(apiBase));
  if (!response.ok) {
    throw new Error(
      `Ollama model discovery failed: ${response.status} ${response.statusText}`,
    );
  }
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("Ollama model discovery returned an invalid response");
  }
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) {
    throw new Error("Ollama model discovery response has no models list");
  }
  return models
    .map((model) =>
      model && typeof model === "object" && typeof model.name === "string"
        ? model.name.trim()
        : "",
    )
    .filter((name, index, names) => name && names.indexOf(name) === index);
}
