import type { ProviderProtocol } from "./providerProtocol";

export type SupportedProviderPresetId = "openai" | "ollama";

export type ProviderPresetId = SupportedProviderPresetId | "customized";

export type ProviderPreset = {
  id: SupportedProviderPresetId;
  label: string;
  defaultApiBase: string;
  defaultProtocol: ProviderProtocol;
  supportedProtocols: ProviderProtocol[];
  helperText: string;
  matches: (apiBase: string) => boolean;
  /** When true, prefer /v1/responses over /v1/chat/completions when calling the API. */
  supportsResponsesEndpoint?: boolean;
  /** Whether this provider exposes an OpenAI-compatible /v1/embeddings endpoint. */
  supportsEmbeddings?: boolean;
  /** Default embedding model name for providers that support embeddings. */
  defaultEmbeddingModel?: string;
};

function normalizeApiBase(apiBase: string): string {
  return typeof apiBase === "string" ? apiBase.trim().replace(/\/+$/, "") : "";
}

type ParsedApiBase = {
  hostname: string;
  pathname: string;
};

function parseApiBase(apiBase: string): ParsedApiBase | null {
  const normalized = normalizeApiBase(apiBase);
  if (!normalized) return null;
  try {
    const parsed = new URL(normalized);
    return {
      hostname: parsed.hostname.trim().toLowerCase(),
      pathname: parsed.pathname.replace(/\/+$/, "") || "/",
    };
  } catch (_err) {
    return null;
  }
}

function isHost(parsed: ParsedApiBase | null, hosts: string[]): boolean {
  if (!parsed) return false;
  return hosts.includes(parsed.hostname);
}

function matchesPaths(pathname: string, paths: string[]): boolean {
  return paths.includes(pathname);
}

function makeHostAndPathMatcher(hosts: string[], paths: string[]) {
  return (apiBase: string) => {
    const parsed = parseApiBase(apiBase);
    if (!parsed) return false;
    return isHost(parsed, hosts) && matchesPaths(parsed.pathname, paths);
  };
}

const OPENAI_PATHS = [
  "/",
  "/v1",
  "/v1/chat/completions",
  "/v1/responses",
  "/v1/files",
  "/v1/embeddings",
];
const OLLAMA_PATHS = ["/", "/v1", "/v1/chat/completions"];

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI",
    defaultApiBase: "https://api.openai.com/v1/responses",
    defaultProtocol: "responses_api",
    supportedProtocols: ["responses_api", "openai_chat_compat"],
    helperText: "Preset uses OpenAI's official Responses endpoint.",
    matches: makeHostAndPathMatcher(["api.openai.com"], OPENAI_PATHS),
    supportsResponsesEndpoint: true,
    supportsEmbeddings: true,
    defaultEmbeddingModel: "text-embedding-3-small",
  },
  {
    id: "ollama",
    label: "Ollama",
    defaultApiBase: "http://localhost:11434/v1",
    defaultProtocol: "openai_chat_compat",
    supportedProtocols: ["openai_chat_compat"],
    helperText:
      "Use Ollama's local OpenAI-compatible /v1/chat/completions endpoint.",
    matches: makeHostAndPathMatcher(
      ["localhost", "127.0.0.1", "::1"],
      OLLAMA_PATHS,
    ),
  },
];

export function detectProviderPreset(apiBase: string): ProviderPresetId {
  const normalized = normalizeApiBase(apiBase);
  if (!normalized) return "customized";
  for (const preset of PROVIDER_PRESETS) {
    if (preset.matches(normalized)) return preset.id;
  }
  return "customized";
}

export function getProviderPreset(
  id: SupportedProviderPresetId,
): ProviderPreset {
  const preset = PROVIDER_PRESETS.find((entry) => entry.id === id);
  if (!preset) {
    throw new Error(`Unknown provider preset: ${id}`);
  }
  return preset;
}
