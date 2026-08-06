/**
 * Global reference selector UI - appears when user clicks "Select references" in slash menu
 * Allows searching and multi-selecting papers from the library
 */

import { searchLibraryPapers, type IndexedPaper } from "./globalLibraryIndex";
import { createElement } from "../../utils/domHelpers";

const SELECTOR_ID = "paperpilot-global-reference-selector";

export async function renderGlobalReferenceSelectorUI(
  container: HTMLElement,
  doc: Document,
  libraryID: number,
  onSelect: (papers: IndexedPaper[]) => Promise<void>,
  t: (key: string) => string,
  initialQuery = "",
): Promise<void> {
  const floatingHost = container.classList.contains("paperpilot-paper-picker");
  const closeSelector = () => {
    const existing = container.querySelector(`#${SELECTOR_ID}`);
    if (existing) existing.remove();
    if (floatingHost) {
      container.style.display = "none";
      container.classList.remove("paperpilot-paper-picker-below");
    }
  };

  closeSelector();

  // Create selector container
  const selector = createElement(
    doc,
    "div",
    "paperpilot-global-reference-selector",
    {
      id: SELECTOR_ID,
    },
  );

  if (floatingHost) {
    container.style.display = "block";
    container.style.minHeight = "240px";
    container.innerHTML = "";
    container.appendChild(selector);
  } else {
    container.appendChild(selector);
  }

  // Header
  const header = createElement(doc, "div", "paperpilot-ref-selector-header");
  const title = createElement(doc, "h3", "paperpilot-ref-selector-title", {
    textContent: t("Select references"),
  });
  const closeBtn = createElement(doc, "button", "paperpilot-ref-selector-close", {
    type: "button",
    innerHTML: "&times;",
    title: t("Close"),
  });
  closeBtn.addEventListener("click", closeSelector);
  header.append(title, closeBtn);

  // Search box
  const searchBox = createElement(
    doc,
    "input",
    "paperpilot-ref-selector-search",
    {
      type: "text",
      placeholder: t("Search papers..."),
    },
  ) as HTMLInputElement;

  // Results list
  const resultsList = createElement(doc, "div", "paperpilot-ref-selector-list");

  // Bottom buttons
  const footer = createElement(doc, "div", "paperpilot-ref-selector-footer");
  const confirmBtn = createElement(
    doc,
    "button",
    "paperpilot-ref-selector-btn paperpilot-ref-selector-confirm",
    {
      type: "button",
      textContent: t("Add selected"),
    },
  );
  const cancelBtn = createElement(
    doc,
    "button",
    "paperpilot-ref-selector-btn paperpilot-ref-selector-cancel",
    {
      type: "button",
      textContent: t("Cancel"),
    },
  );
  footer.append(confirmBtn, cancelBtn);

  // Track selected papers
  const selectedPapers = new Map<number, IndexedPaper>();

  // Handle cancel
  cancelBtn.addEventListener("click", closeSelector);

  // Handle search
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;

  const updateResults = async (query: string) => {
    try {
      const results = await searchLibraryPapers(libraryID, query, 50);

      resultsList.innerHTML = "";

      if (results.length === 0) {
        const emptyMsg = createElement(doc, "div", "paperpilot-ref-selector-empty", {
          textContent:
            query.trim() === ""
              ? t("No papers found in this library")
              : t("No papers match your search"),
        });
        resultsList.appendChild(emptyMsg);
        return;
      }

      for (const paper of results) {
        const item = createElement(doc, "div", "paperpilot-ref-selector-item");
        item.addEventListener("click", (event: Event) => {
          if (event.target instanceof HTMLInputElement) return;
          checkbox.click();
        });

        const checkbox = createElement(
          doc,
          "input",
          "paperpilot-ref-selector-checkbox",
          {
            type: "checkbox",
          },
        ) as HTMLInputElement;

        const isSelected = selectedPapers.has(paper.itemId);
        checkbox.checked = isSelected;

        checkbox.addEventListener("change", () => {
          if (checkbox.checked) {
            selectedPapers.set(paper.itemId, paper);
          } else {
            selectedPapers.delete(paper.itemId);
          }
        });

        const label = createElement(doc, "label", "paperpilot-ref-selector-item-label");

        const titleSpan = createElement(doc, "span", "paperpilot-ref-selector-item-title", {
          textContent: paper.title,
          title: paper.title,
        });

        const metaSpan = createElement(doc, "span", "paperpilot-ref-selector-item-meta");
        const metaParts = [];
        if (paper.creators.length > 0) {
          metaParts.push(paper.creators[0]);
        }
        if (paper.year) {
          metaParts.push(paper.year);
        }
        if (paper.pdfs.length > 0) {
          metaParts.push(`${paper.pdfs.length} PDF${paper.pdfs.length > 1 ? "s" : ""}`);
        }
        metaSpan.textContent = metaParts.join(" • ");

        label.append(titleSpan);
        if (metaSpan.textContent) {
          label.appendChild(metaSpan);
        }

        item.append(checkbox, label);
        resultsList.appendChild(item);
      }
    } catch (error) {
      console.error("Failed to search library papers:", error);
      resultsList.innerHTML = "";
      const errorMsg = createElement(doc, "div", "paperpilot-ref-selector-error", {
        textContent: t("Error searching papers"),
      });
      resultsList.appendChild(errorMsg);
    }
  };

  searchBox.addEventListener("input", (e) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    const query = (e.target as HTMLInputElement).value;
    searchTimeout = setTimeout(() => updateResults(query), 300);
  });

  // Handle confirm
  confirmBtn.addEventListener("click", async () => {
    const papers = Array.from(selectedPapers.values());
    closeSelector();
    try {
      await onSelect(papers);
    } catch (error) {
      console.error("Failed to process selected papers:", error);
    }
  });

  // Assemble UI
  selector.append(header, searchBox, resultsList, footer);
  selector.style.minHeight = "240px";

  // Load initial results
  searchBox.value = initialQuery;
  await updateResults(initialQuery);
  searchBox.focus();
}
