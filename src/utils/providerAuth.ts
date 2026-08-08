import type { ModelProviderAuthMode } from "./modelProviders";
import type { ProviderPresetId } from "./providerPresets";

export function requiresProviderApiKey(params: {
  authMode: ModelProviderAuthMode;
  presetId: ProviderPresetId;
}): boolean {
  return params.authMode !== "copilot_auth" && params.presetId !== "ollama";
}
