import { strict as assert } from "node:assert";
import { registerMainWindowEntry } from "../src/modules/contextPanel/mainWindowEntry";
import { createPaperPickerController } from "../src/modules/contextPanel/setupHandlers/controllers/paperPickerController";
import {
  createGlobalPortalItem,
  resolveInitialPanelItemState,
  resolvePaperChatSourceItem,
} from "../src/modules/contextPanel/portalScope";
import {
  activeConversationModeByLibrary,
  activeGlobalConversationByLibrary,
  activePaperConversationByPaper,
} from "../src/modules/contextPanel/state";
import { buildPaperStateKey } from "../src/modules/contextPanel/prefHelpers";
import { PAPER_CONVERSATION_KEY_BASE } from "../src/modules/contextPanel/constants";

describe("Library mode entry", function () {
  const globals = globalThis as Record<string, unknown>;
  let previous: Record<string, unknown>;
  let logs: unknown[][];

  beforeEach(function () {
    previous = {
      Zotero: globals.Zotero,
      addon: globals.addon,
      ztoolkit: globals.ztoolkit,
    };
    logs = [];
    globals.Zotero = {
      locale: "en-US",
      Prefs: { get: () => undefined },
      Libraries: { userLibraryID: 1 },
    };
    globals.addon = { data: { config: { addonRef: "paperpilot" } } };
    globals.ztoolkit = { log: (...args: unknown[]) => logs.push(args) };
  });

  describe("Shared reference selector modes", function () {
    function createPicker(singlePaper: boolean, value: string) {
      let persisted = 0;
      let closed = 0;
      const input = {
        value,
        selectionStart: value.length,
        setSelectionRange: () => {},
      } as HTMLTextAreaElement;
      const controller = createPaperPickerController({
        body: { ownerDocument: { defaultView: null } } as Element,
        panelRoot: {} as HTMLElement,
        inputBox: input,
        paperPicker: null,
        paperPickerList: null,
        getItem: () => null,
        getCurrentLibraryID: () => 1,
        onSelectPaper: singlePaper ? () => {} : undefined,
        onClose: () => closed++,
        resolveAutoLoadedPaperContext: () => null,
        getManualPaperContextsForItem: () => [],
        isPaperContextMineru: () => false,
        getTextContextConversationKey: () => null,
        persistDraftInputForCurrentConversation: () => persisted++,
        updatePaperPreviewPreservingScroll: () => {},
        updateSelectedTextPreviewPreservingScroll: () => {},
        log: () => {},
      });
      return { controller, input, counts: () => ({ persisted, closed }) };
    }

    it("keeps the normal @ query and token consumption behavior", function () {
      const { controller, input, counts } = createPicker(
        false,
        "Compare @Alice",
      );
      assert.equal(controller.getActiveAtToken()?.query, "Alice");
      controller.closePaperPicker();
      assert.equal(input.value, "Compare ");
      assert.equal(counts().persisted, 1);
    });

    it("accepts a plain search query in single-paper mode", function () {
      const { controller } = createPicker(true, "Alice 2024");
      assert.equal(controller.getActiveAtToken()?.query, "Alice 2024");
    });

    it("does not consume search text or write chat drafts when cancelled", function () {
      const { controller, input, counts } = createPicker(true, "Alice");
      controller.closePaperPicker();
      assert.equal(input.value, "Alice");
      assert.deepEqual(counts(), { persisted: 0, closed: 1 });
    });
  });

  afterEach(function () {
    Object.assign(globals, previous);
    activeConversationModeByLibrary.clear();
    activeGlobalConversationByLibrary.clear();
    activePaperConversationByPaper.clear();
  });

  function createToolbarDocument(hasToolbar = true, hasNewNote = false) {
    const attributes = new Map<string, string>();
    const listeners = new Map<string, () => void>();
    const button = {
      id: "",
      setAttribute: (key: string, value: string) => attributes.set(key, value),
      addEventListener: (key: string, listener: () => void) =>
        listeners.set(key, listener),
    };
    const children: (typeof button)[] = [];
    const spacer = { id: "spacer" };
    const newNote = {
      id: "zotero-tb-note-add",
      nextSibling: spacer,
      parentElement: null as HTMLElement | null,
    };
    let insertedBefore: unknown;
    const toolbar = {
      appendChild: (child: typeof button) => children.push(child),
      insertBefore: (child: typeof button, next: unknown) => {
        insertedBefore = next;
        children.push(child);
      },
    } as HTMLElement;
    newNote.parentElement = toolbar;
    const doc = {
      getElementById: (id: string) =>
        id === "zotero-items-toolbar"
          ? hasToolbar
            ? toolbar
            : null
          : id === "zotero-tb-note-add" && hasNewNote
            ? newNote
            : children.find((child) => child.id === id) || null,
      createXULElement: () => button,
    } as Document;
    return {
      doc,
      attributes,
      listeners,
      children,
      spacer,
      getInsertedBefore: () => insertedBefore,
    };
  }

  it("places the entry immediately after New Note, before the toolbar spacer", function () {
    const { doc, spacer, getInsertedBefore } = createToolbarDocument(
      true,
      true,
    );
    registerMainWindowEntry(doc, () => {});
    assert.equal(getInsertedBefore(), spacer);
    assert.equal(logs.length, 0);
  });

  it("provides a visible toolbar entry without requiring selected items", function () {
    const { doc, attributes, listeners, children } = createToolbarDocument();
    let opened = 0;
    registerMainWindowEntry(doc, () => opened++);

    assert.equal(children.length, 1);
    assert.equal(children[0].id, "paperpilot-open-standalone");
    assert.equal(attributes.get("label"), "Paper Pilot");
    assert.equal(
      attributes.get("tooltiptext"),
      "Open Paper Pilot in Library mode",
    );
    listeners.get("command")?.();
    assert.equal(opened, 1);
  });

  it("does not duplicate the entry on repeated registration", function () {
    const { doc, children } = createToolbarDocument();
    registerMainWindowEntry(doc, () => {});
    registerMainWindowEntry(doc, () => {});
    assert.equal(children.length, 1);
  });

  it("logs when the library toolbar is unavailable", function () {
    const { doc } = createToolbarDocument(false);
    registerMainWindowEntry(doc, () => {});
    assert.match(String(logs[0]?.[0]), /toolbar is unavailable/);
  });

  it("does not treat a Library portal as a selected paper", function () {
    const portal = createGlobalPortalItem(1, 1_000_000_001);
    assert.equal(resolvePaperChatSourceItem(portal), null);
    assert.equal(resolveInitialPanelItemState(null).basePaperItem, null);
  });

  it("explicit Library opening overrides a remembered Paper mode", function () {
    activeConversationModeByLibrary.set(1, "paper");
    const paper = {
      id: 101,
      libraryID: 1,
      isRegularItem: () => true,
      isAttachment: () => false,
      isNote: () => false,
    } as Zotero.Item;
    const state = resolveInitialPanelItemState(paper, {
      conversationSystem: "upstream",
      conversationMode: "global",
    });
    assert.equal(state.basePaperItem, paper);
    assert.equal(resolvePaperChatSourceItem(state.item), null);
    assert.equal(state.item?.libraryID, 1);
  });

  it("restores the selected paper's own conversation without changing other papers", function () {
    const firstPaperKey = PAPER_CONVERSATION_KEY_BASE + 1;
    const secondPaperKey = PAPER_CONVERSATION_KEY_BASE + 2;
    activePaperConversationByPaper.set(
      buildPaperStateKey(1, 101),
      firstPaperKey,
    );
    activePaperConversationByPaper.set(
      buildPaperStateKey(1, 102),
      secondPaperKey,
    );
    activeConversationModeByLibrary.set(1, "global");
    const selectedPaper = {
      id: 102,
      libraryID: 1,
      isRegularItem: () => true,
      isAttachment: () => false,
      isNote: () => false,
    } as Zotero.Item;
    const state = resolveInitialPanelItemState(selectedPaper, {
      conversationSystem: "upstream",
      conversationMode: "paper",
    });
    assert.equal(state.basePaperItem, selectedPaper);
    assert.equal(state.item?.id, secondPaperKey);
    assert.equal(
      activePaperConversationByPaper.get(buildPaperStateKey(1, 101)),
      firstPaperKey,
    );
  });
});
