import { isTextOnlyModel } from "./modelChecks";
import type { ProviderCapabilities, ProviderParams } from "./types";
import * as serverUpload from "./tiers/serverUpload";
import * as copilot from "./tiers/copilot";
import * as thirdParty from "./tiers/thirdParty";
import { resolvePromptCacheCapability } from "../contextCache/manager";
import { resolveModelInputMode } from "../utils/modelInputMode";

// Evaluate auth-mode tiers before protocol-based tiers so Copilot's endpoint
// handling remains independent of the selected generic protocol.
const TIERS = [copilot, serverUpload, thirdParty] as const;

/**
 * Resolve the full provider capability set for the given request
 * parameters.  This is the single entry point that replaces the
 * scattered getModelPdfSupport / isScreenshotUnsupportedModel /
 * isMultimodalRequestSupported checks.
 */
export function resolveProviderCapabilities(
  params: ProviderParams,
): ProviderCapabilities {
  const matched = TIERS.find((tier) => tier.matches(params));
  const base = matched?.capabilities ?? thirdParty.capabilities;
  const inputMode = resolveModelInputMode(params.inputMode);
  const textOnly =
    inputMode === "text_only" ||
    (inputMode === "auto" && isTextOnlyModel(params.model));
  const images =
    inputMode === "vision_allowed" ? true : textOnly ? false : base.images;

  return {
    ...base,
    promptCache: resolvePromptCacheCapability(params),
    images,
    multimodal: images || (!textOnly && base.pdf !== "none"),
    ...(textOnly ? { pdf: "none" as const, images: false } : {}),
  };
}
