export type ProviderProtocol = "openai_chat_compat";

export type ProviderProtocolSpec = {
  id: ProviderProtocol;
  label: string;
  helperText: string;
  streaming: boolean;
  toolCalls: boolean;
  multimodal: boolean;
  fileInputs: boolean;
  reasoning: boolean;
};

export const PROVIDER_PROTOCOL_SPECS: ProviderProtocolSpec[] = [
  {
    id: "openai_chat_compat",
    label: "Ollama Chat",
    helperText: "Use Ollama's local /api/chat endpoint.",
    streaming: true,
    toolCalls: false,
    multimodal: true,
    fileInputs: false,
    reasoning: false,
  },
];

const PROVIDER_PROTOCOL_IDS = new Set<ProviderProtocol>(
  PROVIDER_PROTOCOL_SPECS.map((entry) => entry.id),
);

export function isProviderProtocol(value: unknown): value is ProviderProtocol {
  return (
    typeof value === "string" &&
    PROVIDER_PROTOCOL_IDS.has(value as ProviderProtocol)
  );
}

export function inferLegacyProviderProtocol(params: {
  authMode?: string;
  apiBase?: string;
}): ProviderProtocol {
  void params;
  return "openai_chat_compat";
}

export function normalizeProviderProtocol(
  value: unknown,
  fallback: ProviderProtocol = "openai_chat_compat",
): ProviderProtocol {
  return isProviderProtocol(value) ? value : fallback;
}

export function normalizeProviderProtocolForAuthMode(params: {
  protocol?: unknown;
  authMode?: string;
  apiBase?: string;
  fallback?: ProviderProtocol;
  model?: string;
}): ProviderProtocol {
  const inferred = inferLegacyProviderProtocol(params);
  const fallback = params.fallback || inferred;
  const normalized = normalizeProviderProtocol(params.protocol, fallback);
  return normalized;
}
