import { config } from "../../package.json";
import type { ModelInputMode } from "../shared/types";
import { DEFAULT_MAX_TOKENS, DEFAULT_TEMPERATURE } from "./llmDefaults";
import {
  normalizeMaxTokensForModel,
  normalizeOptionalInputTokenCap,
  normalizeTemperature,
} from "./normalization";
import { normalizeModelInputModeForRuntime } from "./modelInputMode";
import {
  isProviderProtocol,
  normalizeProviderProtocolForAuthMode,
  type ProviderProtocol,
} from "./providerProtocol";
import { detectProviderPreset, getProviderPreset } from "./providerPresets";
import type { ProviderPresetId } from "./providerPresets";

export type ModelProviderModel = AdvancedModelConfig & {
  id: string;
  model: string;
  /** Per-model protocol override. When set, overrides the group-level protocol. */
  providerProtocol?: ProviderProtocol;
};

export type ModelProviderAuthMode = "api_key";

export type AdvancedModelConfig = {
  temperature: number;
  maxTokens: number;
  inputTokenCap?: number;
  inputMode?: ModelInputMode;
};

export type RuntimeModelEntry = {
  entryId: string;
  groupId: string;
  model: string;
  apiBase: string;
  apiKey: string;
  authMode: ModelProviderAuthMode;
  providerProtocol: ProviderProtocol;
  providerLabel: string;
  providerOrder: number;
  displayModelLabel: string;
  advanced: AdvancedModelConfig;
};

export type ModelProviderGroup = {
  id: string;
  apiBase: string;
  apiKey: string;
  authMode: ModelProviderAuthMode;
  providerProtocol: ProviderProtocol;
  models: ModelProviderModel[];
  /** When "customized", UI shows Customized and allows editing URL; when undefined, preset is derived from apiBase. */
  presetIdOverride?: ProviderPresetId;
};

type AdvancedModelConfigInput = {
  temperature?: number | string | null;
  maxTokens?: number | string | null;
  inputTokenCap?: number | string | null;
  inputMode?: unknown;
};

type ZoteroPrefsAPI = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
};

const MODEL_PROVIDER_GROUPS_PREF_KEY = "modelProviderGroups";
const LAST_USED_MODEL_ENTRY_ID_PREF_KEY = "lastUsedModelEntryId";

function normalizeProviderAuthMode(_value: unknown): ModelProviderAuthMode {
  return "api_key";
}

function getZoteroPrefs(): ZoteroPrefsAPI | null {
  return (
    (Zotero as unknown as { Prefs?: ZoteroPrefsAPI } | undefined)?.Prefs || null
  );
}

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

function setPref(key: string, value: unknown): void {
  getZoteroPrefs()?.set?.(prefKey(key), value, true);
}

export function setModelProviderGroups(groups: ModelProviderGroup[]): void {
  setPref(MODEL_PROVIDER_GROUPS_PREF_KEY, JSON.stringify(groups));
}

export async function refreshOllamaProviderModels(): Promise<number> {
  const groups = getModelProviderGroups();
  let discovered = 0;
  let changed = false;

  for (const group of groups) {
    if (detectProviderPreset(group.apiBase) !== "ollama") continue;
    const parsed = new URL(group.apiBase);
    const endpoint = `${parsed.origin}/api/tags`;

    try {
      const xhr = await Zotero.HTTP.request("GET", endpoint, {
        timeout: 10000,
        successCodes: false,
      });

      if (!xhr.responseText) {
        throw new Error(`Ollama model discovery failed: empty response`);
      }

      const payload = JSON.parse(xhr.responseText) as {
        models?: Array<{ name?: unknown }>;
      };
      const names = (payload.models || [])
        .map((model) =>
          typeof model?.name === "string" ? model.name.trim() : "",
        )
        .filter(Boolean);
      discovered += names.length;
      const existingByName = new Map(
        group.models.map((model) => [model.model, model]),
      );
      group.models = names.map((name) => {
        const existing = existingByName.get(name);
        return (
          existing || {
            id: `ollama-${name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`,
            model: name,
            temperature: 0.7,
            maxTokens: 4096,
          }
        );
      });
      changed = true;
    } catch (error) {
      throw new Error(
        `Ollama model discovery failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }

  if (changed) setModelProviderGroups(groups);
  return discovered;
}

function getStringPref(key: string): string {
  const value = getZoteroPrefs()?.get?.(prefKey(key), true);
  return typeof value === "string" ? value : "";
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function createId(prefix: "provider" | "model"): string {
  const token = Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${token}`;
}

function normalizeApiBase(apiBase: string): string {
  return normalizeString(apiBase).replace(/\/+$/, "");
}

function normalizeAdvancedModelConfig(
  value?: AdvancedModelConfigInput | null,
  modelName?: string,
  runtimeMode?: unknown,
): AdvancedModelConfig {
  const inputMode = normalizeModelInputModeForRuntime(
    value?.inputMode,
    runtimeMode,
  );
  return {
    temperature: normalizeTemperature(
      `${value?.temperature ?? DEFAULT_TEMPERATURE}`,
    ),
    maxTokens: normalizeMaxTokensForModel(
      `${value?.maxTokens ?? DEFAULT_MAX_TOKENS}`,
      modelName,
    ),
    inputTokenCap: normalizeOptionalInputTokenCap(value?.inputTokenCap),
    ...(inputMode ? { inputMode } : {}),
  };
}

function normalizePresetIdOverride(
  value: unknown,
): ProviderPresetId | undefined {
  if (value !== "customized") return undefined;
  return "customized";
}

function normalizeGroup(group: unknown): ModelProviderGroup | null {
  if (!group || typeof group !== "object") return null;
  const rawGroup = group as {
    id?: unknown;
    apiBase?: unknown;
    apiKey?: unknown;
    authMode?: unknown;
    providerProtocol?: unknown;
    models?: unknown;
    presetIdOverride?: unknown;
  };

  const normalizeGroupModel = (
    model: unknown,
    authMode: ModelProviderAuthMode,
  ): ModelProviderModel | null => {
    if (!model || typeof model !== "object") return null;
    const rawModel = model as {
      id?: unknown;
      model?: unknown;
      temperature?: unknown;
      maxTokens?: unknown;
      inputTokenCap?: unknown;
      inputMode?: unknown;
      providerProtocol?: unknown;
    };
    const modelName = normalizeString(rawModel.model);
    const advanced = normalizeAdvancedModelConfig(
      {
        temperature: Number(rawModel.temperature),
        maxTokens: Number(rawModel.maxTokens),
        inputTokenCap: rawModel.inputTokenCap as number | string | undefined,
        inputMode: rawModel.inputMode,
      },
      modelName,
      authMode,
    );
    const modelProtocol = isProviderProtocol(rawModel.providerProtocol)
      ? rawModel.providerProtocol
      : undefined;
    return {
      id:
        typeof rawModel.id === "string" && rawModel.id.trim()
          ? rawModel.id.trim()
          : createId("model"),
      model: modelName,
      ...advanced,
      ...(modelProtocol ? { providerProtocol: modelProtocol } : {}),
    };
  };

  const authMode = normalizeProviderAuthMode(rawGroup.authMode);
  const models = Array.isArray(rawGroup.models)
    ? rawGroup.models
        .map((entry) => normalizeGroupModel(entry, authMode))
        .filter((entry): entry is ModelProviderModel => Boolean(entry))
    : [];

  const apiBase = normalizeApiBase(normalizeString(rawGroup.apiBase));
  return {
    id:
      typeof rawGroup.id === "string" && rawGroup.id.trim()
        ? rawGroup.id.trim()
        : createId("provider"),
    apiBase,
    apiKey: normalizeString(rawGroup.apiKey),
    authMode,
    providerProtocol: normalizeProviderProtocolForAuthMode({
      protocol: rawGroup.providerProtocol,
      authMode,
      apiBase,
    }),
    models,
    presetIdOverride: normalizePresetIdOverride(rawGroup.presetIdOverride),
  };
}

export function normalizeModelProviderGroups(
  raw: unknown,
): ModelProviderGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((group) => normalizeGroup(group))
    .filter(
      (group): group is ModelProviderGroup =>
        group !== null && detectProviderPreset(group.apiBase) === "ollama",
    )
    .sort((left, right) => {
      const leftIsLocal = detectProviderPreset(left.apiBase) === "ollama";
      const rightIsLocal = detectProviderPreset(right.apiBase) === "ollama";
      return Number(rightIsLocal) - Number(leftIsLocal);
    });
}

function parseStoredModelProviderGroups(raw: string): ModelProviderGroup[] {
  if (!raw.trim()) return [];
  try {
    return normalizeModelProviderGroups(JSON.parse(raw));
  } catch {
    return [];
  }
}

function ensureModelProviderGroups(): ModelProviderGroup[] {
  const raw = getStringPref(MODEL_PROVIDER_GROUPS_PREF_KEY);
  return parseStoredModelProviderGroups(raw);
}

export function getModelProviderGroups(): ModelProviderGroup[] {
  return ensureModelProviderGroups();
}

function extractProviderHost(apiBase: string): string {
  const normalizedBase = normalizeApiBase(apiBase);
  if (!normalizedBase) return "";
  try {
    const parsed = new URL(normalizedBase);
    return parsed.hostname.trim().toLowerCase();
  } catch {
    const fallback = normalizedBase
      .replace(/^[a-z]+:\/\//i, "")
      .split("/")[0]
      .trim()
      .toLowerCase();
    return fallback;
  }
}

export function deriveProviderLabel(
  apiBase: string,
  providerIndex?: number,
): string {
  const normalizedBase = normalizeApiBase(apiBase);
  if (!normalizedBase) {
    return `Provider ${providerIndex || 1}`;
  }

  const host = extractProviderHost(normalizedBase);
  if (!host) {
    return `Provider ${providerIndex || 1}`;
  }
  const presetId = detectProviderPreset(normalizedBase);
  if (presetId !== "customized") {
    return getProviderPreset(presetId).label;
  }
  const lowerHost = host.toLowerCase();

  if (lowerHost.includes("openai.com") || lowerHost === "chatgpt.com") {
    return "OpenAI";
  }

  return host;
}

function resolveStoredPresetId(group: ModelProviderGroup): ProviderPresetId {
  return group.presetIdOverride ?? detectProviderPreset(group.apiBase);
}

function resolveRuntimeProviderProtocol(
  group: ModelProviderGroup,
  modelEntry?: ModelProviderModel,
): ProviderProtocol {
  const authMode = normalizeProviderAuthMode(group.authMode);
  const presetId = resolveStoredPresetId(group);
  const fallback =
    presetId === "customized"
      ? undefined
      : getProviderPreset(presetId).defaultProtocol;
  if (modelEntry?.providerProtocol) {
    return normalizeProviderProtocolForAuthMode({
      protocol: modelEntry.providerProtocol,
      authMode,
      apiBase: group.apiBase,
      ...(fallback ? { fallback } : {}),
    });
  }
  if (fallback) {
    return normalizeProviderProtocolForAuthMode({
      protocol: fallback,
      authMode,
      apiBase: group.apiBase,
      fallback,
    });
  }
  const shouldInferCustomizedProtocol =
    presetId === "customized" &&
    group.providerProtocol === "openai_chat_compat";
  return normalizeProviderProtocolForAuthMode({
    protocol: shouldInferCustomizedProtocol
      ? undefined
      : group.providerProtocol,
    authMode,
    apiBase: group.apiBase,
  });
}

export function getRuntimeModelEntries(): RuntimeModelEntry[] {
  const groups = getModelProviderGroups();
  const entries: RuntimeModelEntry[] = [];

  for (const [groupIndex, group] of groups.entries()) {
    const authMode = normalizeProviderAuthMode(group.authMode);
    const baseProviderLabel = deriveProviderLabel(
      group.apiBase,
      groupIndex + 1,
    );
    const providerLabel = baseProviderLabel;
    const normalizedCounts = new Map<string, number>();
    for (const modelEntry of group.models) {
      const modelName = modelEntry.model.trim();
      if (!modelName) continue;
      const normalizedModel = modelName.toLowerCase();
      const duplicateCount = (normalizedCounts.get(normalizedModel) || 0) + 1;
      normalizedCounts.set(normalizedModel, duplicateCount);
      entries.push({
        entryId: modelEntry.id,
        groupId: group.id,
        model: modelName,
        apiBase: normalizeApiBase(group.apiBase),
        apiKey: group.apiKey.trim(),
        authMode,
        providerProtocol: resolveRuntimeProviderProtocol(group, modelEntry),
        providerLabel,
        providerOrder: groupIndex,
        displayModelLabel:
          duplicateCount > 1 ? `${modelName} #${duplicateCount}` : modelName,
        advanced: normalizeAdvancedModelConfig(modelEntry, modelName),
      });
    }
  }

  return entries;
}

export function getModelEntryById(
  entryId: string | undefined | null,
): RuntimeModelEntry | null {
  const normalizedId = normalizeString(entryId);
  if (!normalizedId) return null;
  return (
    getRuntimeModelEntries().find((entry) => entry.entryId === normalizedId) ||
    null
  );
}

export function getDefaultModelEntry(): RuntimeModelEntry | null {
  const entries = getRuntimeModelEntries();
  return entries[0] || null;
}

export function getDefaultProviderGroup(): ModelProviderGroup | null {
  const groups = getModelProviderGroups();
  return groups[0] || null;
}

export function getLastUsedModelEntryId(): string {
  return getStringPref(LAST_USED_MODEL_ENTRY_ID_PREF_KEY).trim();
}

export function setLastUsedModelEntryId(entryId: string): void {
  setPref(LAST_USED_MODEL_ENTRY_ID_PREF_KEY, entryId.trim());
}

export function getModelProviderGroupsPrefKey(): string {
  return MODEL_PROVIDER_GROUPS_PREF_KEY;
}
