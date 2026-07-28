import { config } from "../../package.json";
import type { ModelInputMode } from "../shared/types";


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
  // authMode: ModelProviderAuthMode;
  // providerProtocol: ProviderProtocol;
  providerLabel: string;
  providerOrder: number;
  displayModelLabel: string;
  advanced: AdvancedModelConfig;
};
