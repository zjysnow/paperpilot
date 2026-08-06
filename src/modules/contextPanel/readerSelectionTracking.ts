import { recentReaderSelectionCache } from "./state";
import { normalizeSelectedText } from "./textUtils";

const READER_SELECTION_EVENT = "renderTextSelectionPopup";
const TRACKING_PLUGIN_ID = "paperpilot-reader-selection";

type ReaderSelectionEvent = {
  reader?: {
    _item?: { id?: unknown; parentID?: unknown };
    itemID?: unknown;
  };
  doc?: Document;
  params?: {
    annotation?: { text?: unknown };
    text?: unknown;
    selectedText?: unknown;
  };
};

let registered = false;

function readReaderSelection(event: ReaderSelectionEvent): string {
  const fromParams = [
    event.params?.annotation?.text,
    event.params?.text,
    event.params?.selectedText,
  ];
  for (const value of fromParams) {
    const text = normalizeSelectedText(typeof value === "string" ? value : "");
    if (text) return text;
  }

  const fromPopup = normalizeSelectedText(
    event.doc?.defaultView?.getSelection?.()?.toString() || "",
  );
  if (fromPopup) return fromPopup;

  const reader = event.reader as
    | {
        _iframeWindow?: Window;
        _iframe?: { contentDocument?: Document };
        _internalReader?: {
          _state?: {
            primaryViewSelectionPopup?: { annotation?: { text?: unknown } };
            secondaryViewSelectionPopup?: { annotation?: { text?: unknown } };
          };
        };
      }
    | undefined;
  const documents = [
    reader?._iframeWindow?.document,
    reader?._iframe?.contentDocument,
  ];
  for (const document of documents) {
    const text = normalizeSelectedText(
      document?.defaultView?.getSelection?.()?.toString() || "",
    );
    if (text) return text;
  }
  const popups = [
    reader?._internalReader?._state?.primaryViewSelectionPopup,
    reader?._internalReader?._state?.secondaryViewSelectionPopup,
  ];
  for (const popup of popups) {
    const text = normalizeSelectedText(
      typeof popup?.annotation?.text === "string"
        ? popup.annotation.text
        : "",
    );
    if (text) return text;
  }
  return "";
}

export function registerReaderSelectionTracking(): void {
  if (registered) return;
  const readerApi = (
    Zotero as unknown as {
      Reader?: {
        registerEventListener?: (
          type: string,
          handler: (event: ReaderSelectionEvent) => void,
          pluginID?: string,
        ) => void;
      };
    }
  ).Reader;
  if (!readerApi?.registerEventListener) return;

  readerApi.registerEventListener(
    READER_SELECTION_EVENT,
    (event: ReaderSelectionEvent) => {
      const reader = event.reader;
      const itemId = Number(reader?._item?.id || reader?.itemID || 0);
      if (!Number.isFinite(itemId) || itemId <= 0) return;
      const selectedText = readReaderSelection(event);
      if (selectedText) {
        recentReaderSelectionCache.set(Math.floor(itemId), selectedText);
        const parentId = Number(reader?._item?.parentID || 0);
        if (Number.isFinite(parentId) && parentId > 0) {
          recentReaderSelectionCache.set(Math.floor(parentId), selectedText);
        }
      }
    },
    TRACKING_PLUGIN_ID,
  );
  registered = true;
}
