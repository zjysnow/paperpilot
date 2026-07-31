import { isResponsesBase } from "./apiHelpers";

export type ProviderProtocol =
    | "openai_chat_compat"
    | "responses_api";

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
        helperText: "Use OpenAI-style Responses APIs with tool calls and direct file input.",
        streaming: true,
        toolCalls: true,
        multimodal: true,
        fileInputs: true,
        reasoning: true,
    },
];

const PROVIDER_PROTOCOL_IDS = new Set<ProviderProtocol>(
  PROVIDER_PROTOCOL_SPECS.map((entry) => entry.id),
);

export function isProviderProtocol(value: unknown): value is ProviderProtocol {
  return typeof value === "string" && PROVIDER_PROTOCOL_IDS.has(value as ProviderProtocol);
}




export function inferLegacyProviderProtocol(params: {
    authMode?: string;
    apiBase?: string;
}): ProviderProtocol {
    // if (params.authMode === "codex_auth" || params.authMode === "codex_app_server") {
    //     return "codex_responses";
    // }
    // if (params.authMode === "copilot_auth") {
    //     return "openai_chat_compat";
    // }
    if (isResponsesBase(params.apiBase || "")) {
        return "responses_api";
    }
    // if (isAnthropicMessagesBase(params.apiBase)) {
    //     return "anthropic_messages";
    // }
    // if (isOpenAIChatCompletionsBase(params.apiBase)) {
    //     return "openai_chat_compat";
    // }
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

    // if (params.authMode === "copilot_auth") {
    //     // Copilot supports both responses_api and openai_chat_compat
    //     return normalized === "openai_chat_compat" || normalized === "responses_api"
    //     ? normalized
    //     : "openai_chat_compat";
    // }
    return normalized;
}

