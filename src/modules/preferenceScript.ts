import { config } from "../../package.json";
import { t } from "../utils/i18n";
import {
  getFontScalePref,
  getMessageLineSpacingPref,
  getMessageParagraphSpacingPref,
  getMessageWordSpacingPref,
  setFontScalePref,
  setMessageLineSpacingPref,
  setMessageParagraphSpacingPref,
  setMessageWordSpacingPref,
} from "./contextPanel/prefHelpers";
import { getModelProviderGroups } from "../utils/modelProviders";

type PrefsAPI = {
  get?: (key: string, global?: boolean) => unknown;
  set?: (key: string, value: unknown, global?: boolean) => void;
};

function getPrefs(): PrefsAPI | null {
  return (Zotero as unknown as { Prefs?: PrefsAPI } | undefined)?.Prefs || null;
}

function prefKey(key: string): string {
  return `${config.prefsPrefix}.${key}`;
}

function getStringPref(key: string): string {
  const value = getPrefs()?.get?.(prefKey(key), true);
  return typeof value === "string" ? value : "";
}

function setStringPref(key: string, value: string): void {
  getPrefs()?.set?.(prefKey(key), value, true);
}

function setTabState(
  tabButtons: NodeListOf<Element>,
  panels: NodeListOf<Element>,
  activeTab: string,
): void {
  tabButtons.forEach((btn: Element) => {
    const tab = btn.getAttribute("data-pref-tab");
    btn.toggleAttribute("aria-selected", tab === activeTab);
    (btn as HTMLElement).style.fontWeight = tab === activeTab ? "600" : "500";
  });
  panels.forEach((panel: Element) => {
    const isActive = panel.getAttribute("data-pref-panel") === activeTab;
    (panel as HTMLElement).style.display = isActive ? "flex" : "none";
  });
}

export async function registerPrefsScripts(window: Window | undefined | null) {
  if (!window) {
    ztoolkit.log("Preference window not available");
    return;
  }

  const doc = window.document;
  const elementId = (suffix: string) => `${config.addonRef}-${suffix}`;

  const tabButtons = doc.querySelectorAll("[data-pref-tab]");
  const panels = doc.querySelectorAll("[data-pref-panel]");
  const providersTab = doc.getElementById(elementId("pref-panel-providers"));
  const customizationTab = doc.getElementById(
    elementId("pref-panel-customization"),
  );
  const modelProviderGroupsInput = doc.getElementById(
    elementId("model-provider-groups"),
  ) as HTMLTextAreaElement | null;
  const addOllamaProviderButton = doc.getElementById(
    elementId("add-ollama-provider"),
  ) as HTMLButtonElement | null;
  const providerStatus = doc.getElementById(elementId("provider-status"));
  const systemPromptInput = doc.getElementById(
    elementId("system-prompt"),
  ) as HTMLTextAreaElement | null;
  const fontScaleInput = doc.getElementById(
    elementId("panel-font-scale"),
  ) as HTMLInputElement | null;
  const fontScaleReadout = doc.getElementById(
    elementId("panel-font-scale-readout"),
  );
  const paragraphSpacingInput = doc.getElementById(
    elementId("message-paragraph-spacing"),
  ) as HTMLInputElement | null;
  const paragraphSpacingReadout = doc.getElementById(
    elementId("message-paragraph-spacing-readout"),
  );
  const wordSpacingInput = doc.getElementById(
    elementId("message-word-spacing"),
  ) as HTMLInputElement | null;
  const wordSpacingReadout = doc.getElementById(
    elementId("message-word-spacing-readout"),
  );
  const lineSpacingInput = doc.getElementById(
    elementId("message-line-spacing"),
  ) as HTMLInputElement | null;
  const lineSpacingReadout = doc.getElementById(
    elementId("message-line-spacing-readout"),
  );

  const modelProviderGroupsPrefKey = "modelProviderGroups";

  if (modelProviderGroupsInput) {
    const saved = getStringPref(modelProviderGroupsPrefKey);
    modelProviderGroupsInput.value =
      saved || JSON.stringify(getModelProviderGroups(), null, 2);
    modelProviderGroupsInput.addEventListener("change", () => {
      setStringPref(modelProviderGroupsPrefKey, modelProviderGroupsInput.value);
      if (providerStatus)
        providerStatus.textContent = "Provider configuration saved.";
    });
  }

  if (modelProviderGroupsInput && addOllamaProviderButton) {
    addOllamaProviderButton.addEventListener("click", () => {
      let groups: unknown[] = [];
      const raw = modelProviderGroupsInput.value.trim();
      if (raw) {
        try {
          const parsed: unknown = JSON.parse(raw);
          if (!Array.isArray(parsed)) {
            throw new Error("Provider configuration must be a JSON array.");
          }
          groups = parsed;
        } catch (error) {
          ztoolkit.log(
            "Paper Pilot: invalid provider configuration JSON",
            error,
          );
          window.alert("Please fix the provider JSON before adding Ollama.");
          return;
        }
      }
      const hasOllama = groups.some(
        (group) =>
          group &&
          typeof group === "object" &&
          typeof (group as { apiBase?: unknown }).apiBase === "string" &&
          /^(https?:\/\/)?(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(
            (group as { apiBase: string }).apiBase.trim(),
          ),
      );
      if (!hasOllama) {
        groups.push({
          id: "ollama-local",
          apiBase: "http://localhost:11434/v1",
          apiKey: "",
          authMode: "api_key",
          providerProtocol: "openai_chat_compat",
          models: [
            {
              id: "ollama-llama3.2",
              model: "llama3.2",
              temperature: 0.7,
              maxTokens: 4096,
            },
          ],
        });
      }
      modelProviderGroupsInput.value = JSON.stringify(groups, null, 2);
      setStringPref(modelProviderGroupsPrefKey, modelProviderGroupsInput.value);
      if (providerStatus) {
        providerStatus.textContent = hasOllama
          ? "An Ollama provider is already configured."
          : "Ollama provider added. Save or reopen the chat panel to load it.";
      }
    });
  }

  if (systemPromptInput) {
    systemPromptInput.value = getStringPref("systemPrompt");
    systemPromptInput.addEventListener("change", () => {
      setStringPref("systemPrompt", systemPromptInput.value);
    });
  }

  if (fontScaleInput && fontScaleReadout) {
    const sync = () => {
      fontScaleInput.value = `${getFontScalePref()}`;
      fontScaleReadout.textContent = `${fontScaleInput.value}%`;
    };
    sync();
    fontScaleInput.addEventListener("input", () => {
      const value = Number(fontScaleInput.value);
      setFontScalePref(value);
      fontScaleReadout.textContent = `${value}%`;
    });
  }

  if (paragraphSpacingInput && paragraphSpacingReadout) {
    const sync = () => {
      paragraphSpacingInput.value = `${getMessageParagraphSpacingPref()}`;
      paragraphSpacingReadout.textContent = `${paragraphSpacingInput.value}px`;
    };
    sync();
    paragraphSpacingInput.addEventListener("input", () => {
      const value = Number(paragraphSpacingInput.value);
      setMessageParagraphSpacingPref(value);
      paragraphSpacingReadout.textContent = `${value}px`;
    });
  }

  if (wordSpacingInput && wordSpacingReadout) {
    const sync = () => {
      wordSpacingInput.value = `${getMessageWordSpacingPref()}`;
      wordSpacingReadout.textContent = `${wordSpacingInput.value}px`;
    };
    sync();
    wordSpacingInput.addEventListener("input", () => {
      const value = Number(wordSpacingInput.value);
      setMessageWordSpacingPref(value);
      wordSpacingReadout.textContent = `${value}px`;
    });
  }

  if (lineSpacingInput && lineSpacingReadout) {
    const sync = () => {
      lineSpacingInput.value = `${getMessageLineSpacingPref()}`;
      lineSpacingReadout.textContent = `${lineSpacingInput.value}%`;
    };
    sync();
    lineSpacingInput.addEventListener("input", () => {
      const value = Number(lineSpacingInput.value);
      setMessageLineSpacingPref(value);
      lineSpacingReadout.textContent = `${value}%`;
    });
  }

  const activeTab = providersTab
    ? "providers"
    : customizationTab
      ? "customization"
      : "providers";
  setTabState(tabButtons, panels, activeTab);
  tabButtons.forEach((button: Element) => {
    button.addEventListener("click", () => {
      const tab = button.getAttribute("data-pref-tab");
      if (!tab) return;
      setTabState(tabButtons, panels, tab);
    });
  });

  void t("Paper Pilot");
}
