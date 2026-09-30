import { strict as assert } from "node:assert";
import {
  buildPaperSourceOptions,
  type BuildPaperSourceOptionsParams,
} from "../src/modules/contextPanel/setupHandlers/controllers/paperSourceOptionsController";

describe("Paper source menu", function () {
  function createFixture(
    contextItemId = 201,
    attachmentIds = [201, 202, 203],
  ): BuildPaperSourceOptionsParams {
    const parent = {
      id: 101,
      isRegularItem: () => true,
      isAttachment: () => false,
      getAttachments: () => attachmentIds,
      getField: (field: string) =>
        ({
          title: "Neural-Symbolic Computing",
          firstCreator: "Garcez et al.",
          date: "2019",
        })[field] || "",
    } as Zotero.Item;
    function attachment(id: number, title: string, contentType: string) {
      return {
        id,
        parentID: 101,
        isRegularItem: () => false,
        isAttachment: () => true,
        attachmentContentType: contentType,
        getField: () => title,
      } as Zotero.Item;
    }
    const items = new Map<number, Zotero.Item>([
      [101, parent],
      [201, attachment(201, "PDF", "application/pdf")],
      [202, attachment(202, "Preprint PDF", "application/pdf")],
      [203, attachment(203, "Snapshot", "text/html")],
    ]);
    return {
      paperContext: {
        itemId: 101,
        contextItemId,
        title: "Neural-Symbolic Computing",
      },
      getItemById: (id) => items.get(id),
      pdfSupport: "none",
      isMineruEnabled: true,
      getItemStatus: () => undefined,
      isPaperContextMineru: () => false,
      mineruAvailableIds: new Set(),
      fullPdfUnsupportedMessage: "No direct PDF upload",
      mineruDisabledParsingMessage: "Enable MinerU",
    };
  }

  it("shows each PDF mode once for the active PDF while preserving the snapshot", function () {
    const options = buildPaperSourceOptions(createFixture(201));
    assert.deepEqual(
      options.map((option) => option.mode),
      ["mineru", "text", "pdf", "html"],
    );
    assert.deepEqual(
      options.map((option) => option.paperContext.contextItemId),
      [201, 201, 201, 203],
    );
  });

  it("uses the selected preprint rather than silently replacing it with the first PDF", function () {
    const options = buildPaperSourceOptions(createFixture(202));
    assert.deepEqual(
      options.map((option) => option.mode),
      ["mineru", "text", "pdf", "html"],
    );
    assert.deepEqual(
      options.slice(0, 3).map((option) => option.paperContext.contextItemId),
      [202, 202, 202],
    );
    assert.match(options[1].description, /Preprint PDF/);
    assert.equal(options[2].disabledReason, "No direct PDF upload");
  });

  it("offers one PDF mode group when the active attachment is HTML", function () {
    const options = buildPaperSourceOptions(createFixture(203));
    assert.deepEqual(
      options.map((option) => option.mode),
      ["mineru", "text", "pdf", "html"],
    );
    assert.equal(options[0].paperContext.contextItemId, 201);
  });

  it("does not repeat source rows even if attachment IDs repeat", function () {
    const options = buildPaperSourceOptions(
      createFixture(201, [201, 201, 202, 203, 203]),
    );
    assert.deepEqual(
      options.map((option) => option.mode),
      ["mineru", "text", "pdf", "html"],
    );
  });

  it("keeps PDF support and MinerU cache state tied to the active attachment", function () {
    const fixture = createFixture(202);
    fixture.pdfSupport = "native";
    fixture.getItemStatus = (id) =>
      id === 202 ? { status: "cached" } : undefined;
    const options = buildPaperSourceOptions(fixture);
    assert.equal(options[0].mineruState, "cached");
    assert.equal(options[0].mineruAction, "select");
    assert.equal(options[2].disabledReason, undefined);
    assert.deepEqual([...fixture.mineruAvailableIds], [202]);
  });

  it("preserves a single-PDF paper's existing modes", function () {
    const options = buildPaperSourceOptions(createFixture(201, [201]));
    assert.deepEqual(
      options.map((option) => option.mode),
      ["mineru", "text", "pdf"],
    );
  });
});
