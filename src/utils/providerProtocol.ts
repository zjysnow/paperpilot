import {
  isOpenAIChatCompletionsBase,
  isResponsesBase,
} from "./apiHelpers";

export type ProviderProtocol =
  "openai_chat_compat" | "responses_api";

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
    id: "responses_api",
    label: "Responses API",
    helperText:
      "Use OpenAI-style Responses APIs with tool calls and direct file input.",
    streaming: true,
    toolCalls: true,
    multimodal: true,
    fileInputs: true,
    reasoning: true,
  },
  {
    id: "openai_chat_compat",
    label: "OpenAI Chat Completions",
    helperText: "Use the classic OpenAI-style /v1/chat/completions endpoint.",
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
  if (isResponsesBase(params.apiBase || "")) {
    return "responses_api";
  }
  if (isOpenAIChatCompletionsBase(params.apiBase || "")) {
    return "openai_chat_compat";
  }
  return "openai_chat_compat";
}

export function normalizeProviderProtocol(
  value: unknown,
  fallback: ProviderProtocol = "responses_api",
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
