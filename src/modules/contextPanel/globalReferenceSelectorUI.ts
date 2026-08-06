/**
 * The global @ picker. Keep the library hierarchy visible so references can be
 * selected by collection, while retaining search and multi-selection.
 */

import {
  getLibraryIndex,
  type IndexedCollection,
  type IndexedPaper,
  type IndexedTag,
} from "./globalLibraryIndex";
import { createElement } from "../../utils/domHelpers";

const SELECTOR_ID = "paperpilot-global-reference-selector";
const PICKER_OPEN_CLASS = "paperpilot-reference-picker-open";

function setAttachmentControlVisibility(doc: Document, open: boolean): void {
  doc
    .querySelectorAll(
      "#paperpilot-paper-mode-context, .paperpilot-file-context-list",
    )
    .forEach((element) => {
      element.classList.toggle(PICKER_OPEN_CLASS, open);
      element
        .querySelectorAll(
          ".paperpilot-paper-context-clear, .paperpilot-file-context-remove",
        )
        .forEach((button) => {
          if (open) {
            (button as HTMLElement).style.setProperty(
              "display",
              "none",
              "important",
            );
          } else {
            (button as HTMLElement).style.removeProperty("display");
          }
        });
    });
}

function bindButtonAction(
  button: HTMLElement,
  action: () => void | Promise<void>,
): void {
  let handled = false;
  const invoke = (event: Event) => {
    if (handled) return;
    handled = true;
    event.preventDefault();
    void action();
    setTimeout(() => {
      handled = false;
    }, 0);
  };
  button.addEventListener("click", invoke);
  button.addEventListener("command", invoke);
}

export async function renderGlobalReferenceSelectorUI(
  container: HTMLElement,
  doc: Document,
  libraryID: number,
  onSelect: (papers: IndexedPaper[]) => Promise<void>,
  t: (key: string) => string,
  initialQuery = "",
  onClose?: () => void,
): Promise<void> {
  const floatingHost =
    container.classList.contains("paperpilot-paper-picker") ||
    container.id === "paperpilot-paper-picker-list";
  const floatingPicker =
    container.id === "paperpilot-paper-picker-list"
      ? container.parentElement
      : container;
  let documentEscapeHandler: ((event: Event) => void) | null = null;
  const closeSelector = () => {
    const currentSelector = container.querySelector(`#${SELECTOR_ID}`);
    currentSelector?.remove();
    try {
      onClose?.();
      currentSelector?.dispatchEvent(
        new CustomEvent("paperpilot-global-reference-selector-closed", {
          bubbles: false,
        }),
      );
    } finally {
      setAttachmentControlVisibility(doc, false);
      if (documentEscapeHandler) {
        doc.removeEventListener("keydown", documentEscapeHandler, true);
        documentEscapeHandler = null;
      }
      if (floatingHost && floatingPicker) {
        floatingPicker.style.display = "none";
        floatingPicker.classList.remove("paperpilot-paper-picker-below");
      }
    }
  };

  closeSelector();
  const selector = createElement(
    doc,
    "div",
    "paperpilot-global-reference-selector",
    {
      id: SELECTOR_ID,
    },
  );
  documentEscapeHandler = (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    if (!container.querySelector(`#${SELECTOR_ID}`)) return;
    event.preventDefault();
    event.stopPropagation();
    closeSelector();
  };
  doc.addEventListener("keydown", documentEscapeHandler, true);
  if (floatingHost) {
    setAttachmentControlVisibility(doc, true);
    floatingPicker?.style.setProperty("display", "block");
    floatingPicker?.style.setProperty("min-height", "240px");
    container.innerHTML = "";
  }
  container.appendChild(selector);

  const loading = createElement(doc, "div", "paperpilot-ref-selector-empty", {
    textContent: t("Loading library references..."),
  });
  selector.appendChild(loading);

  let index;
  try {
    index = await getLibraryIndex(libraryID);
  } catch (error) {
    console.error("Failed to load library references:", error);
    loading.textContent = t("Unable to load library references");
    return;
  }
  loading.remove();
  const selectedPapers = new Map<number, IndexedPaper>();
  let activeCollectionID: number | null = null;
  let activeTag = "";
  let query = initialQuery;
  let folderQuery = "";

  const header = createElement(doc, "div", "paperpilot-ref-selector-header");
  const title = createElement(doc, "h3", "paperpilot-ref-selector-title", {
    textContent: t("Select references"),
  });
  header.append(title);

  const search = createElement(doc, "input", "paperpilot-ref-selector-search", {
    type: "text",
    placeholder: t("Search papers..."),
    value: initialQuery,
  }) as HTMLInputElement;
  const folderPanel = createElement(
    doc,
    "section",
    "paperpilot-paper-picker-folder-panel",
  );
  const itemPanel = createElement(
    doc,
    "section",
    "paperpilot-paper-picker-main",
  );
  const tagPanel = createElement(
    doc,
    "section",
    "paperpilot-paper-picker-tag-panel",
  );
  const footer = createElement(doc, "div", "paperpilot-ref-selector-footer");
  const confirm = createElement(
    doc,
    "button",
    "paperpilot-ref-selector-btn paperpilot-ref-selector-confirm",
    {
      type: "button",
      textContent: t("Add selected"),
    },
  );
  const cancel = createElement(
    doc,
    "button",
    "paperpilot-ref-selector-btn paperpilot-ref-selector-cancel",
    {
      type: "button",
      textContent: t("Cancel"),
    },
  );
  bindButtonAction(cancel, closeSelector);
  bindButtonAction(confirm, async () => {
    const papers = [...selectedPapers.values()];
    closeSelector();
    try {
      await onSelect(papers);
    } catch (error) {
      console.error("Failed to process selected papers:", error);
    }
  });
  footer.append(confirm, cancel);

  selector.addEventListener("keydown", (event: Event) => {
    if ((event as KeyboardEvent).key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeSelector();
  });

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "");
  const collectionById = new Map(
    index.collections.map((collection) => [
      collection.collectionId,
      collection,
    ]),
  );
  const childCollections = (parentID: number) =>
    index.collections
      .filter((collection) => collection.parentID === parentID)
      .sort((a, b) => a.name.localeCompare(b.name));

  const renderHeader = (
    label: string,
    className: string,
    target: HTMLElement,
  ) => {
    target.innerHTML = "";
    const headerRow = createElement(doc, "div", className);
    headerRow.textContent = label;
    target.appendChild(headerRow);
  };

  const renderFolders = () => {
    renderHeader(
      t("Library folders"),
      "paperpilot-paper-picker-folder-header",
      folderPanel,
    );
    const filterBar = createElement(
      doc,
      "div",
      "paperpilot-paper-picker-folder-filter-bar",
    );
    const folderFilter = createElement(
      doc,
      "input",
      "paperpilot-paper-picker-folder-filter",
      {
        type: "search",
        placeholder: t("Filter folders..."),
        value: folderQuery,
      },
    ) as HTMLInputElement;
    filterBar.appendChild(folderFilter);
    const pane = createElement(
      doc,
      "div",
      "paperpilot-paper-picker-folder-pane",
    );
    folderPanel.append(filterBar, pane);

    const addFolder = (collection: IndexedCollection | null, depth: number) => {
      if (
        collection &&
        query &&
        !normalize(collection.name).includes(normalize(query))
      ) {
        // Still render matching descendants, but avoid hiding a parent needed for navigation.
        if (
          !childCollections(collection.collectionId).some((child) =>
            normalize(child.name).includes(normalize(query)),
          )
        )
          return;
      }
      const row = createElement(
        doc,
        "button",
        "paperpilot-paper-picker-sidebar-row",
        {
          type: "button",
        },
      );
      row.style.setProperty(
        "--paperpilot-paper-picker-sidebar-depth",
        String(depth),
      );
      if ((collection?.collectionId ?? null) === activeCollectionID) {
        row.classList.add("paperpilot-paper-picker-sidebar-row-active");
      }
      const label = collection?.name || t("All documents");
      row.append(
        createElement(doc, "span", "paperpilot-paper-picker-sidebar-chevron", {
          textContent:
            collection && childCollections(collection.collectionId).length
              ? "›"
              : "",
        }),
        createElement(
          doc,
          "span",
          "paperpilot-paper-picker-sidebar-folder-icon",
          {
            textContent: "▰",
          },
        ),
        createElement(doc, "span", "paperpilot-paper-picker-sidebar-label", {
          textContent: label,
        }),
        createElement(doc, "span", "paperpilot-paper-picker-sidebar-count", {
          textContent: String(
            collection ? collection.childItemIDs.length : index.papers.length,
          ),
        }),
      );
      row.addEventListener("click", () => {
        activeCollectionID = collection?.collectionId ?? null;
        renderFolders();
        renderItems();
      });
      pane.appendChild(row);
      if (collection)
        childCollections(collection.collectionId).forEach((child) =>
          addFolder(child, depth + 1),
        );
    };

    const normalizedFolderQuery = normalize(folderQuery);
    if (normalizedFolderQuery) {
      index.collections
        .filter((collection) =>
          normalize(collection.name).includes(normalizedFolderQuery),
        )
        .forEach((collection) => addFolder(collection, 0));
    } else {
      addFolder(null, 0);
      childCollections(0).forEach((collection) => addFolder(collection, 0));
    }
    folderFilter.addEventListener("input", () => {
      folderQuery = folderFilter.value;
      renderFolders();
    });
  };

  const papersForCollection = () => {
    if (activeCollectionID === null) return index.papers;
    const collection = collectionById.get(activeCollectionID);
    if (!collection) return [];
    const ids = new Set<number>(collection.childItemIDs);
    const visit = (id: number) =>
      childCollections(id).forEach((child) => {
        child.childItemIDs.forEach((itemID) => ids.add(itemID));
        visit(child.collectionId);
      });
    visit(activeCollectionID);
    return index.papers.filter((paper) => ids.has(paper.itemId));
  };

  const renderItems = () => {
    renderHeader(
      t("Documents"),
      "paperpilot-paper-picker-item-header",
      itemPanel,
    );
    const list = createElement(doc, "div", "paperpilot-ref-selector-list");
    const matches = papersForCollection().filter((paper) => {
      const text = normalize(
        `${paper.title} ${paper.creators.join(" ")} ${paper.year || ""}`,
      );
      return (
        (!query || text.includes(normalize(query))) &&
        (!activeTag || paper.tags.includes(activeTag))
      );
    });
    if (!matches.length) {
      list.appendChild(
        createElement(doc, "div", "paperpilot-ref-selector-empty", {
          textContent: t("No papers match your search"),
        }),
      );
    }
    for (const paper of matches) {
      const row = createElement(doc, "button", "paperpilot-ref-selector-item", {
        type: "button",
      });
      row.setAttribute(
        "aria-selected",
        selectedPapers.has(paper.itemId) ? "true" : "false",
      );
      const titleLine = createElement(
        doc,
        "span",
        "paperpilot-ref-selector-item-title",
        {
          textContent: paper.title,
          title: paper.title,
        },
      );
      const meta = [
        paper.creators[0],
        paper.year,
        paper.tags.length ? `${paper.tags.length} tags` : "",
      ]
        .filter(Boolean)
        .join(" • ");
      row.append(titleLine);
      if (meta)
        row.appendChild(
          createElement(doc, "span", "paperpilot-ref-selector-item-meta", {
            textContent: meta,
          }),
        );
      row.addEventListener("click", () => {
        if (selectedPapers.has(paper.itemId)) return;
        selectedPapers.set(paper.itemId, paper);
        void onSelect([paper]).catch((error) => {
          console.error("Failed to add selected paper:", error);
        });
        renderItems();
      });
      list.appendChild(row);
    }
    itemPanel.appendChild(list);
  };

  selector.addEventListener("paperpilot-global-reference-removed", (event) => {
    const attachmentId = (event as CustomEvent<{ attachmentId?: number }>)
      .detail?.attachmentId;
    if (!Number.isFinite(attachmentId)) return;
    for (const [itemId, paper] of selectedPapers) {
      if (paper.pdfs.some((pdf) => pdf.attachmentId === attachmentId)) {
        selectedPapers.delete(itemId);
        renderItems();
        break;
      }
    }
  });

  const renderTags = () => {
    renderHeader(t("Tags"), "paperpilot-paper-picker-tag-header", tagPanel);
    const cloud = createElement(
      doc,
      "div",
      "paperpilot-paper-picker-tag-cloud",
    );
    const clear = createElement(
      doc,
      "button",
      "paperpilot-paper-picker-tag-scope",
      {
        type: "button",
        textContent: t("All tags"),
      },
    );
    clear.classList.toggle(
      "paperpilot-paper-picker-tag-scope-active",
      !activeTag,
    );
    clear.addEventListener("click", () => {
      activeTag = "";
      renderTags();
      renderItems();
    });
    cloud.appendChild(clear);
    const tags: IndexedTag[] = index.tags.filter(
      (tag) => !query || normalize(tag.name).includes(normalize(query)),
    );
    for (const tag of tags) {
      const chip = createElement(
        doc,
        "button",
        "paperpilot-paper-picker-tag-chip",
        {
          type: "button",
          textContent: `${tag.name} (${tag.count})`,
        },
      );
      chip.classList.toggle(
        "paperpilot-paper-picker-tag-chip-selected",
        tag.name === activeTag,
      );
      chip.addEventListener("click", () => {
        activeTag = activeTag === tag.name ? "" : tag.name;
        renderTags();
        renderItems();
      });
      cloud.appendChild(chip);
    }
    tagPanel.appendChild(cloud);
  };

  search.addEventListener("input", () => {
    query = search.value.trim();
    renderFolders();
    renderItems();
    renderTags();
  });
  selector.append(header, search, folderPanel, itemPanel, tagPanel, footer);
  renderFolders();
  renderItems();
  renderTags();
  search.focus();
}
