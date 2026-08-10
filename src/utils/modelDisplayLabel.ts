export function formatDisplayModelName(
  modelName: string | undefined,
  modelProviderLabel: string | undefined,
  options?: { suppressProviderPrefix?: boolean },
): string {
  const normalizedModel = (modelName || "").trim();
  if (!normalizedModel) return "";
  const provider = (modelProviderLabel || "").trim().toLowerCase();
  if (provider.includes("(copilot auth")) {
    return `copilot/${normalizedModel}`;
  }
  return normalizedModel;
}
