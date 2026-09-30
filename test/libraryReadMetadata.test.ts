import { strict as assert } from "node:assert";
import { LibraryReadService } from "../src/agent/services/libraryReadService";
import type {
  EditableArticleMetadataSnapshot,
  ZoteroGateway,
} from "../src/agent/services/zoteroGateway";

describe("library metadata reads", function () {
  it("preserves the stable Zotero item key in metadata results", async function () {
    const metadata: EditableArticleMetadataSnapshot = {
      itemId: 42,
      itemKey: "ABCD1234",
      itemType: "journalArticle",
      title: "Stable identifiers for research notes",
      fields: {
        title: "Stable identifiers for research notes",
        shortTitle: "",
        abstractNote: "",
        publicationTitle: "",
        journalAbbreviation: "",
        proceedingsTitle: "",
        date: "",
        volume: "",
        issue: "",
        pages: "",
        DOI: "",
        url: "",
        language: "",
        extra: "",
        ISSN: "",
        ISBN: "",
        publisher: "",
        place: "",
      },
      creators: [],
    };
    const gateway = {
      getPaperTargetsByItemIds: () => [],
      getItem: () => ({ id: 42 }),
      resolveMetadataItem: () => ({ id: 42 }),
      getEditableArticleMetadata: () => metadata,
    } as unknown as ZoteroGateway;
    const service = new LibraryReadService(gateway);

    const result = await service.readItems({
      request: { conversationKey: 1, mode: "agent", userText: "" },
      itemIds: [42],
      sections: ["metadata"],
    });

    assert.equal(result["42"].metadata?.itemKey, "ABCD1234");
  });
});
