/**
 * Global library indexing for fast paper/attachment discovery in Global mode
 * Maintains a per-library index of papers with PDFs and their metadata
 */

export type IndexedPaper = {
  itemId: number;
  title: string;
  creators: string[];
  year?: string;
  doi?: string;
  pdfs: IndexedPDF[];
  collectionIDs: number[];
  tags: string[];
};

export type IndexedPDF = {
  attachmentId: number;
  title: string;
};

export type IndexedCollection = {
  collectionId: number;
  name: string;
  parentID: number;
  childCollectionIDs: number[];
  childItemIDs: number[];
};

export type IndexedTag = {
  name: string;
  count: number;
};

export type LibraryIndex = {
  libraryID: number;
  papers: IndexedPaper[];
  collections: IndexedCollection[];
  tags: IndexedTag[];
  lastUpdated: number;
};

const indexCache = new Map<number, LibraryIndex>();

/**
 * Normalize text for searching (lowercase, remove diacritics, etc.)
 */
function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Score a paper against a search query
 */
function scoreMatch(paper: IndexedPaper, query: string): number {
  if (!query) return 0;

  const queryTerms = query.split(/\s+/).filter(Boolean);
  let score = 0;

  const normalizedTitle = normalizeSearchText(paper.title);
  const normalizedQuery = normalizeSearchText(query);

  // Exact match on normalized title
  if (normalizedTitle === normalizedQuery) score += 1000;

  // Title prefix match
  if (normalizedTitle.startsWith(normalizedQuery)) score += 500;

  // Title contains all query terms
  if (queryTerms.every((term) => normalizedTitle.includes(term))) score += 300;

  // Creator matches
  for (const creator of paper.creators) {
    const normalizedCreator = normalizeSearchText(creator);
    if (normalizedCreator === normalizedQuery) score += 400;
    if (normalizedCreator.startsWith(normalizedQuery)) score += 200;
    if (queryTerms.every((term) => normalizedCreator.includes(term)))
      score += 100;
  }

  // Year match
  if (paper.year === query) score += 150;

  return score;
}

/**
 * Build a complete index for a library
 */
async function buildLibraryIndex(libraryID: number): Promise<LibraryIndex> {
  const papers: IndexedPaper[] = [];
  const tags = new Map<string, number>();
  let collections: IndexedCollection[] = [];

  try {
    const items = await Zotero.Items.getAll(
      Math.floor(libraryID),
      true,
      false,
      false,
    );

    for (const item of items) {
      if (!item || item.isAttachment?.()) continue;
      if (item.isRegularItem && !item.isRegularItem()) continue;

      const pdfs: IndexedPDF[] = [];
      const attachmentIDs = item.getAttachments?.() || [];

      for (const attachmentID of attachmentIDs) {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment) continue;

        const contentType = (
          attachment as unknown as { attachmentContentType?: string }
        ).attachmentContentType;
        const filename = (
          attachment as unknown as { attachmentFilename?: string }
        ).attachmentFilename;
        const attachTitle = String(attachment.getField?.("title") || "");

        if (
          contentType === "application/pdf" ||
          filename?.toLowerCase().endsWith(".pdf") ||
          attachTitle.toLowerCase().endsWith(".pdf")
        ) {
          pdfs.push({
            attachmentId: attachment.id,
            title: attachTitle || filename || `PDF ${pdfs.length + 1}`,
          });
        }
      }

      const title = String(item.getField?.("title") || "").trim();
      if (!title) continue;

      // Collect creator names
      const creators: string[] = [];
      try {
        const creatorList = item.getCreators?.() || [];
        for (const creator of creatorList) {
          const name = [creator?.firstName || "", creator?.lastName || ""]
            .filter(Boolean)
            .join(" ")
            .trim();
          if (name) creators.push(name);
        }
      } catch {
        // Ignore creator parsing errors
      }

      // Try to extract year
      let year: string | undefined;
      try {
        const dateStr = String(item.getField?.("date") || "");
        const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) year = yearMatch[0];
      } catch {
        // Ignore year parsing errors
      }

      const doi = String(item.getField?.("DOI") || "").trim() || undefined;
      const collectionIDs = (item.getCollections?.() || [])
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isFinite(id) && id > 0)
        .map((id: number) => Math.floor(id));
      const paperTags = (item.getTags?.() || [])
        .map((tag: unknown) =>
          typeof tag === "string"
            ? tag
            : String(
                (tag as { tag?: unknown; name?: unknown } | null)?.tag ||
                  (tag as { name?: unknown } | null)?.name ||
                  "",
              ),
        )
        .map((tag: string) => tag.trim())
        .filter(Boolean);
      for (const tag of paperTags) tags.set(tag, (tags.get(tag) || 0) + 1);

      papers.push({
        itemId: item.id,
        title,
        creators,
        year,
        doi,
        pdfs,
        collectionIDs,
        tags: paperTags,
      });
    }

    const collectionItems =
      Zotero.Collections?.getByLibrary?.(libraryID, true) || [];
    collections = collectionItems.map((collection: Zotero.Collection) => ({
      collectionId: collection.id,
      name: String(collection.name || `Collection ${collection.id}`),
      parentID: Number(collection.parentID) || 0,
      childCollectionIDs: (collection.getChildCollections?.(true, false) || [])
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isFinite(id) && id > 0),
      childItemIDs: (collection.getChildItems?.(true, false) || [])
        .map((id: unknown) => Number(id))
        .filter((id: number) => Number.isFinite(id) && id > 0),
    }));
  } catch (error) {
    console.error("Failed to build library index:", error);
  }

  return {
    libraryID,
    papers,
    collections,
    tags: [...tags.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    lastUpdated: Date.now(),
  };
}

/**
 * Get or build index for a library
 */
export async function getLibraryIndex(
  libraryID: number,
): Promise<LibraryIndex> {
  const normalized = Math.floor(libraryID);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return {
      libraryID: 0,
      papers: [],
      collections: [],
      tags: [],
      lastUpdated: 0,
    };
  }

  const cached = indexCache.get(normalized);
  if (cached && Date.now() - cached.lastUpdated < 60000) {
    // Cache is valid for 1 minute
    return cached;
  }

  const index = await buildLibraryIndex(normalized);
  indexCache.set(normalized, index);
  return index;
}

/**
 * Search papers in a library
 */
export async function searchLibraryPapers(
  libraryID: number,
  query: string,
  limit: number = 20,
): Promise<IndexedPaper[]> {
  const index = await getLibraryIndex(libraryID);

  if (!query.trim()) {
    // Return recently added papers
    return index.papers.slice(0, limit);
  }

  const results = index.papers
    .map((paper) => ({
      paper,
      score: scoreMatch(paper, query),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ paper }) => paper);

  return results;
}

/**
 * Invalidate cache for a library
 */
export function invalidateLibraryIndex(libraryID?: number): void {
  if (typeof libraryID === "number" && Number.isFinite(libraryID)) {
    indexCache.delete(Math.floor(libraryID));
  } else {
    indexCache.clear();
  }
}
