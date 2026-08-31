import { config as addonConfig } from "../../package.json";

export type DifyAppKind = "chat" | "completion" | "workflow";
export type DifyResponseMode = "blocking" | "streaming";
export type DifyAppMetadata = {
  name: string;
  mode?: string;
  description?: string;
  icon?: string;
};

/**
 * A single "chat robot": one published Dify Chat application, identified by
 * its own App Key. Multiple can be configured so each shows up as an
 * independently selectable AI entry in the runtime model menu.
 */
export type DifyChatAppConfig = {
  id: string;
  /** User-editable display name; falls back to the /info-derived app name. */
  name?: string;
  appKey: string;
};

export type DifyConfig = {
  baseUrl: string;
  apiKey: string;
  user: string;
  timeoutMs?: number;
  /**
   * Legacy single-app-key storage. `appKeys.chat`/`appMetadata.chat` are kept
   * for backward compatibility: configs created before multi chat-app support
   * are migrated into a single `chatApps` entry on read (see
   * `normalizeConfig`). `completion`/`workflow` still use these single keys.
   */
  appKeys?: Partial<Record<DifyAppKind, string>>;
  appMetadata?: Partial<Record<DifyAppKind, DifyAppMetadata>>;
  /** Multiple configured chat robots (new format, superset of legacy chat key). */
  chatApps?: DifyChatAppConfig[];
  /** /info metadata for each chat app, keyed by `DifyChatAppConfig.id`. */
  chatAppMetadata?: Record<string, DifyAppMetadata>;
  datasetId?: string;
};

export type DifyInvocationOptions = {
  apiKey?: string;
  user?: string;
  responseMode?: DifyResponseMode;
  conversationId?: string;
  inputs?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type DifyInvocationResponse = {
  event?: string;
  task_id?: string;
  workflow_run_id?: string;
  message_id?: string;
  conversation_id?: string;
  answer?: string;
  data?: unknown;
  [key: string]: unknown;
};

export type DifyDatasetDocument = {
  id: string;
  name?: string;
  word_count?: number;
  indexing_status?: string;
  [key: string]: unknown;
};

export type DifyDocumentInput = {
  name: string;
  text: string;
  indexingTechnique?: string;
  processRule?: Record<string, unknown>;
  docForm?: string;
};

export type DifyMarkdownSyncEntry = {
  datasetId: string;
  documentId?: string;
  noteId: string;
  name: string;
  markdown: string;
  deleted?: boolean;
};

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

function getZoteroHttpRequest():
  | ((
      method: string,
      url: string,
      options: {
        headers?: Record<string, string>;
        body?: string;
        responseType?: string;
        successCodes?: boolean;
        timeout?: number;
      },
    ) => Promise<{ status: number; responseText?: string }>)
  | null {
  const zotero = (
    globalThis as typeof globalThis & {
      Zotero?: {
        HTTP?: {
          request?: (
            method: string,
            url: string,
            options: {
              headers?: Record<string, string>;
              body?: string;
              responseType?: string;
              successCodes?: boolean;
              timeout?: number;
            },
          ) => Promise<{ status: number; responseText?: string }>;
        };
      };
    }
  ).Zotero;
  return zotero?.HTTP?.request ? zotero.HTTP.request.bind(zotero.HTTP) : null;
}

function createDefaultFetcher(): FetchLike {
  const zoteroRequest = getZoteroHttpRequest();
  if (!zoteroRequest) return fetch as unknown as FetchLike;
  return async (input, init) => {
    const xhr = await zoteroRequest(init?.method || "GET", input, {
      headers: init?.headers,
      body: init?.body,
      responseType: "text",
      successCodes: false,
    });
    const responseText = xhr.responseText || "";
    return {
      ok: xhr.status >= 200 && xhr.status < 300,
      status: xhr.status,
      statusText: "",
      json: async () => JSON.parse(responseText),
      text: async () => responseText,
    };
  };
}

const PREF_KEY = `${addonConfig.prefsPrefix}.difyConfig`;
const CONVERSATION_PREF_KEY = `${addonConfig.prefsPrefix}.difyConversationIds`;
export const DEFAULT_DIFY_BASE_URL = "https://api.dify.ai/v1";

// ── Chat robot runtime entry ids ────────────────────────────────────────
//
// Each configured chat robot must show up as its own selectable AI entry.
// The single legacy chat app (migrated from `appKeys.chat`) keeps the bare
// "dify-chat" entry id so previously-saved `lastUsedModelEntryId` prefs keep
// pointing at it; every other chat robot gets a `dify-chat-<id>` entry id.
export const LEGACY_DIFY_CHAT_APP_ID = "legacy";
export const LEGACY_DIFY_CHAT_ENTRY_ID = "dify-chat";
export const DIFY_CHAT_ENTRY_PREFIX = "dify-chat-";

export function createDifyChatAppId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function buildDifyChatEntryId(chatAppId: string): string {
  return chatAppId === LEGACY_DIFY_CHAT_APP_ID
    ? LEGACY_DIFY_CHAT_ENTRY_ID
    : `${DIFY_CHAT_ENTRY_PREFIX}${chatAppId}`;
}

export function isDifyChatEntryId(
  entryId: string | undefined | null,
): entryId is string {
  return (
    typeof entryId === "string" &&
    (entryId === LEGACY_DIFY_CHAT_ENTRY_ID ||
      entryId.startsWith(DIFY_CHAT_ENTRY_PREFIX))
  );
}

export function getDifyChatAppIdFromEntryId(entryId: string): string | null {
  if (entryId === LEGACY_DIFY_CHAT_ENTRY_ID) return LEGACY_DIFY_CHAT_APP_ID;
  if (entryId.startsWith(DIFY_CHAT_ENTRY_PREFIX)) {
    return entryId.slice(DIFY_CHAT_ENTRY_PREFIX.length);
  }
  return null;
}

export function getDifyChatApps(config: DifyConfig): DifyChatAppConfig[] {
  return config.chatApps || [];
}

export function getDifyChatAppDisplayName(
  chatApp: DifyChatAppConfig,
  config: DifyConfig,
): string {
  const customName = chatApp.name?.trim();
  if (customName) return customName;
  const metadataName = config.chatAppMetadata?.[chatApp.id]?.name?.trim();
  if (metadataName) return metadataName;
  return "Chat app";
}

/** Resolves the Dify App Key to use for a given chat-robot runtime entry. */
export function resolveDifyChatApiKey(
  entryId: string | undefined | null,
  config: DifyConfig = getDifyConfig(),
): string {
  const chatAppId = entryId ? getDifyChatAppIdFromEntryId(entryId) : null;
  if (chatAppId) {
    const app = getDifyChatApps(config).find((item) => item.id === chatAppId);
    if (app?.appKey.trim()) return app.appKey.trim();
  }
  return config.appKeys?.chat?.trim() || "";
}

function normalizeBaseUrl(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return DEFAULT_DIFY_BASE_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_DIFY_BASE_URL;
    }
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
  } catch {
    return DEFAULT_DIFY_BASE_URL;
  }
}

function describeNetworkFailure(status: number, statusText: string): string {
  return status === 0
    ? "Unable to connect to Dify. Check that the Base URL is reachable from Zotero and uses http:// for a local, non-TLS deployment."
    : `Dify connection failed (${status} ${statusText})`;
}

function normalizeAppMetadataItem(value: unknown): DifyAppMetadata | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name) return null;
  return {
    name,
    ...(typeof item.mode === "string" && item.mode.trim()
      ? { mode: item.mode.trim() }
      : {}),
    ...(typeof item.description === "string" && item.description.trim()
      ? { description: item.description.trim() }
      : {}),
    ...(typeof item.icon === "string" && item.icon.trim()
      ? { icon: item.icon.trim() }
      : {}),
  };
}

function normalizeChatApps(value: unknown): DifyChatAppConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const usedIds = new Set<string>();
  return value
    .map((entry): DifyChatAppConfig | null => {
      if (!entry || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      let id = typeof item.id === "string" ? item.id.trim() : "";
      if (!id || usedIds.has(id)) id = createDifyChatAppId();
      usedIds.add(id);
      const name = typeof item.name === "string" ? item.name.trim() : "";
      const appKey = typeof item.appKey === "string" ? item.appKey.trim() : "";
      return { id, ...(name ? { name } : {}), appKey };
    })
    .filter((entry): entry is DifyChatAppConfig => Boolean(entry));
}

function normalizeChatAppMetadata(
  value: unknown,
): Record<string, DifyAppMetadata> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const entries = Object.entries(value as Record<string, unknown>).flatMap(
    ([id, metadata]) => {
      if (!id.trim()) return [];
      const normalized = normalizeAppMetadataItem(metadata);
      return normalized ? [[id.trim(), normalized] as const] : [];
    },
  );
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeConfig(value: unknown): DifyConfig {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const appKeys =
    raw.appKeys && typeof raw.appKeys === "object"
      ? Object.fromEntries(
          Object.entries(raw.appKeys).filter(
            ([kind, key]) =>
              ["chat", "completion", "workflow"].includes(kind) &&
              typeof key === "string" &&
              key.trim(),
          ),
        )
      : undefined;
  const timeout = Number(raw.timeoutMs);
  const appMetadata =
    raw.appMetadata && typeof raw.appMetadata === "object"
      ? Object.fromEntries(
          Object.entries(raw.appMetadata).flatMap(([kind, metadata]) => {
            if (!["chat", "completion", "workflow"].includes(kind)) return [];
            const normalized = normalizeAppMetadataItem(metadata);
            return normalized ? [[kind, normalized]] : [];
          }),
        )
      : undefined;

  // Migrate legacy single chat app key/metadata into the multi chat-app list
  // only when the stored config predates that feature (`chatApps` missing).
  // A config that explicitly stores `chatApps: []` (all robots removed via
  // the UI) is respected as-is and is not re-populated from legacy fields.
  const legacyChatKey = appKeys?.chat?.trim();
  const explicitChatApps = normalizeChatApps(raw.chatApps);
  const chatApps =
    explicitChatApps ??
    (legacyChatKey
      ? [{ id: LEGACY_DIFY_CHAT_APP_ID, appKey: legacyChatKey }]
      : undefined);
  const explicitChatAppMetadata = normalizeChatAppMetadata(raw.chatAppMetadata);
  const chatAppMetadata =
    explicitChatAppMetadata ??
    (legacyChatKey && appMetadata?.chat
      ? { [LEGACY_DIFY_CHAT_APP_ID]: appMetadata.chat }
      : undefined);

  return {
    baseUrl: normalizeBaseUrl(raw.baseUrl),
    apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : "",
    user: typeof raw.user === "string" ? raw.user.trim() : "paperpilot",
    ...(Number.isFinite(timeout) && timeout > 0
      ? { timeoutMs: Math.floor(timeout) }
      : {}),
    ...(appKeys && Object.keys(appKeys).length ? { appKeys } : {}),
    ...(appMetadata && Object.keys(appMetadata).length ? { appMetadata } : {}),
    // `chatApps` is persisted even when empty: an empty array means the
    // config already uses the multi chat-app format (all robots removed via
    // the UI), which must not be re-migrated from the legacy chat app key on
    // the next read (see the `explicitChatApps` check above).
    ...(chatApps !== undefined ? { chatApps } : {}),
    ...(chatAppMetadata && Object.keys(chatAppMetadata).length
      ? { chatAppMetadata }
      : {}),
    ...(typeof raw.datasetId === "string" && raw.datasetId.trim()
      ? { datasetId: raw.datasetId.trim() }
      : {}),
  };
}

export function getDifyConfig(): DifyConfig {
  const raw = (
    globalThis as { Zotero?: { Prefs?: { get?: Function } } }
  ).Zotero?.Prefs?.get?.(PREF_KEY, true);
  if (typeof raw !== "string" || !raw.trim()) return normalizeConfig({});
  try {
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return normalizeConfig({});
  }
}

export function setDifyConfig(value: DifyConfig): void {
  (
    globalThis as { Zotero?: { Prefs?: { set?: Function } } }
  ).Zotero?.Prefs?.set?.(
    PREF_KEY,
    JSON.stringify(normalizeConfig(value)),
    true,
  );
}

export function getDifyConversationId(conversationKey: number): string {
  const raw = (
    globalThis as { Zotero?: { Prefs?: { get?: Function } } }
  ).Zotero?.Prefs?.get?.(CONVERSATION_PREF_KEY, true);
  let map: Record<string, unknown>;
  try {
    map = typeof raw === "string" ? JSON.parse(raw) : {};
  } catch {
    map = {};
  }
  const value = map[String(conversationKey)];
  return typeof value === "string" ? value : "";
}

export function setDifyConversationId(
  conversationKey: number,
  conversationId: string,
): void {
  if (!conversationId.trim()) return;
  const prefs = (
    globalThis as { Zotero?: { Prefs?: { get?: Function; set?: Function } } }
  ).Zotero?.Prefs;
  if (!prefs?.set) return;
  const raw = prefs.get?.(CONVERSATION_PREF_KEY, true);
  let map: Record<string, unknown> = {};
  try {
    map = typeof raw === "string" ? JSON.parse(raw) : {};
  } catch {
    // Keep an empty map when preferences contain invalid JSON.
  }
  map[String(conversationKey)] = conversationId.trim();
  prefs.set(CONVERSATION_PREF_KEY, JSON.stringify(map), true);
}

export function getDifyConfigPrefKey(): string {
  return PREF_KEY;
}

export class DifyApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "DifyApiError";
  }
}

export class DifyClient {
  private readonly fetcher: FetchLike;
  constructor(
    private readonly config: DifyConfig,
    fetcher: FetchLike = createDefaultFetcher(),
  ) {
    this.fetcher = fetcher;
  }

  /** Best-effort API key when no explicit key is provided by the caller. */
  private resolveFallbackApiKey(explicit?: string): string {
    return (
      explicit ||
      this.config.apiKey ||
      this.config.appKeys?.chat ||
      this.config.appKeys?.completion ||
      this.config.appKeys?.workflow ||
      getDifyChatApps(this.config)[0]?.appKey ||
      ""
    );
  }

  private async request<T>(
    path: string,
    body: Record<string, unknown>,
    options: DifyInvocationOptions = {},
  ): Promise<T> {
    const controller =
      options.signal || !this.config.timeoutMs
        ? undefined
        : new AbortController();
    const timer = controller
      ? setTimeout(() => controller.abort(), this.config.timeoutMs)
      : undefined;
    try {
      const response = await this.fetcher(
        `${normalizeBaseUrl(this.config.baseUrl)}${path}`,
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer " + this.resolveFallbackApiKey(options.apiKey),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: options.signal || controller?.signal,
        },
      );
      const payload = await response.json().catch(async () => response.text());
      if (!response.ok) {
        throw new DifyApiError(
          `Dify request failed (${response.status} ${response.statusText})`,
          response.status,
          payload,
        );
      }

      return payload as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async testConnection(options: { apiKey?: string } = {}): Promise<boolean> {
    const apiKey = this.resolveFallbackApiKey(options.apiKey);
    const response = await this.fetcher(
      `${normalizeBaseUrl(this.config.baseUrl)}/info`,
      {
        method: "GET",
        headers: {
          Authorization: "Bearer " + apiKey,
        },
      },
    );
    const payload = await response.json().catch(async () => response.text());
    if (!response.ok) {
      throw new DifyApiError(
        describeNetworkFailure(response.status, response.statusText),
        response.status,
        payload,
      );
    }

    return true;
  }

  async getAppInfo(apiKey: string): Promise<DifyAppMetadata> {
    const response = await this.fetcher(
      `${normalizeBaseUrl(this.config.baseUrl)}/info`,
      { method: "GET", headers: { Authorization: "Bearer " + apiKey.trim() } },
    );
    const payload = await response.json().catch(async () => response.text());
    if (!response.ok) {
      throw new DifyApiError(
        describeNetworkFailure(response.status, response.statusText),
        response.status,
        payload,
      );
    }
    return extractDifyAppMetadata(payload);
  }

  invokeChat(query: string, options: DifyInvocationOptions = {}) {
    return this.request<DifyInvocationResponse>(
      "/chat-messages",
      {
        inputs: options.inputs || {},
        query,
        response_mode: options.responseMode || "blocking",
        user: options.user || this.config.user,
        ...(options.conversationId
          ? { conversation_id: options.conversationId }
          : {}),
      },
      {
        ...options,
        apiKey:
          options.apiKey ||
          this.config.appKeys?.chat ||
          getDifyChatApps(this.config)[0]?.appKey,
      },
    );
  }

  invokeCompletion(options: DifyInvocationOptions = {}) {
    return this.request<DifyInvocationResponse>(
      "/completion-messages",
      {
        inputs: options.inputs || {},
        response_mode: options.responseMode || "blocking",
        user: options.user || this.config.user,
      },
      { ...options, apiKey: options.apiKey || this.config.appKeys?.completion },
    );
  }

  invokeWorkflow(options: DifyInvocationOptions = {}) {
    return this.request<DifyInvocationResponse>(
      "/workflows/run",
      {
        inputs: options.inputs || {},
        response_mode: options.responseMode || "blocking",
        user: options.user || this.config.user,
      },
      { ...options, apiKey: options.apiKey || this.config.appKeys?.workflow },
    );
  }

  createDocument(
    datasetId: string,
    document: DifyDocumentInput,
    options: { apiKey?: string } = {},
  ) {
    return this.request<DifyDatasetDocument>(
      `/datasets/${encodeURIComponent(datasetId)}/document/create-by-text`,
      {
        name: document.name,
        text: document.text,
        ...(document.indexingTechnique
          ? { indexing_technique: document.indexingTechnique }
          : {}),
        ...(document.processRule ? { process_rule: document.processRule } : {}),
        ...(document.docForm ? { doc_form: document.docForm } : {}),
      },
      options,
    );
  }

  updateDocument(
    datasetId: string,
    documentId: string,
    document: DifyDocumentInput,
    options: { apiKey?: string } = {},
  ) {
    return this.request<DifyDatasetDocument>(
      `/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}/update-by-text`,
      {
        name: document.name,
        text: document.text,
        ...(document.indexingTechnique
          ? { indexing_technique: document.indexingTechnique }
          : {}),
        ...(document.processRule ? { process_rule: document.processRule } : {}),
        ...(document.docForm ? { doc_form: document.docForm } : {}),
      },
      options,
    );
  }

  async deleteDocument(
    datasetId: string,
    documentId: string,
    options: { apiKey?: string } = {},
  ): Promise<void> {
    const response = await this.fetcher(
      `${normalizeBaseUrl(this.config.baseUrl)}/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + this.resolveFallbackApiKey(options.apiKey),
        },
      },
    );
    const payload = await response.json().catch(async () => response.text());
    if (!response.ok)
      throw new DifyApiError(
        `Dify request failed (${response.status} ${response.statusText})`,
        response.status,
        payload,
      );
  }
}

export function extractDifyAppMetadata(payload: unknown): DifyAppMetadata {
  const raw =
    payload && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};
  const name =
    typeof raw.name === "string" && raw.name.trim()
      ? raw.name.trim()
      : typeof raw.title === "string" && raw.title.trim()
        ? raw.title.trim()
        : "Unnamed app";
  return {
    name,
    ...(typeof raw.mode === "string" && raw.mode.trim()
      ? { mode: raw.mode.trim() }
      : typeof raw.type === "string" && raw.type.trim()
        ? { mode: raw.type.trim() }
        : typeof raw.app_type === "string" && raw.app_type.trim()
          ? { mode: raw.app_type.trim() }
          : {}),
    ...(typeof raw.description === "string" && raw.description.trim()
      ? { description: raw.description.trim() }
      : {}),
    ...(typeof raw.icon === "string" && raw.icon.trim()
      ? { icon: raw.icon.trim() }
      : {}),
  };
}

export async function discoverDifyAppMetadata(
  client: DifyClient,
  config: DifyConfig = getDifyConfig(),
): Promise<DifyConfig> {
  const appMetadata: Partial<Record<DifyAppKind, DifyAppMetadata>> = {
    ...(config.appMetadata || {}),
  };
  for (const kind of ["chat", "completion", "workflow"] as DifyAppKind[]) {
    const key = config.appKeys?.[kind]?.trim();
    if (!key) continue;
    appMetadata[kind] = await client.getAppInfo(key);
  }
  const chatAppMetadata: Record<string, DifyAppMetadata> = {
    ...(config.chatAppMetadata || {}),
  };
  for (const chatApp of getDifyChatApps(config)) {
    const key = chatApp.appKey.trim();
    if (!key) continue;
    chatAppMetadata[chatApp.id] = await client.getAppInfo(key);
  }
  const next: DifyConfig = {
    ...config,
    appMetadata,
    ...(Object.keys(chatAppMetadata).length ? { chatAppMetadata } : {}),
  };
  setDifyConfig(next);
  return next;
}

export async function syncDifyMarkdownNote(
  client: DifyClient,
  entry: DifyMarkdownSyncEntry,
): Promise<{ action: "created" | "updated" | "deleted"; documentId?: string }> {
  if (entry.deleted) {
    if (entry.documentId)
      await client.deleteDocument(entry.datasetId, entry.documentId);
    return { action: "deleted" };
  }
  const document = { name: entry.name, text: entry.markdown };
  if (entry.documentId) {
    const result = await client.updateDocument(
      entry.datasetId,
      entry.documentId,
      document,
    );
    return { action: "updated", documentId: result.id };
  }
  const result = await client.createDocument(entry.datasetId, document);
  return { action: "created", documentId: result.id };
}
