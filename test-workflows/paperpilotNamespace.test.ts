import { expect } from "chai";
import type { WorkflowTestApi } from "../src/modules/contextPanel/workflowTestTypes";
import { migratePaperpilotDatabaseNamespace } from "../src/utils/paperpilotNamespaceMigration";
import { loadConversation } from "../src/utils/chatStore";

declare const debug: (message: string) => void;

declare const Zotero: _ZoteroTypes.Zotero & {
  PaperPilot: {
    data: { initialized?: boolean };
    api: { workflowTest?: WorkflowTestApi };
  };
};

function getWorkflowApi(): WorkflowTestApi {
  const api = Zotero.PaperPilot.api.workflowTest;
  if (!api) throw new Error("Paper Pilot workflow harness was not installed");
  return api;
}

describe("Paper Pilot namespace workflows in Zotero", function () {
  afterEach(async function () {
    await getWorkflowApi().reset();
  });

  it("starts with the Paper Pilot namespace and a ready workflow API", async function () {
    expect(Zotero.PaperPilot.data.initialized).to.equal(true);
    const rows = (await Zotero.DB.queryAsync(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?, ?)",
      [
        "paperpilot_chat_messages",
        "paperpilot_global_conversations",
        "paperpilot_conversation_registry",
      ],
    )) as Array<{ name: string }>;
    expect(rows).to.have.length(3);
    expect(getWorkflowApi().renderPanelForItem).to.be.a("function");
  });

  it("migrates data and unique indexes using Zotero's actual database transaction API", async function () {
    try {
      await Zotero.DB.queryAsync(
        "CREATE TABLE llm_for_zotero_workflow_probe (id INTEGER PRIMARY KEY, content TEXT)",
      );
      await Zotero.DB.queryAsync(
        "CREATE UNIQUE INDEX llm_for_zotero_workflow_probe_idx ON llm_for_zotero_workflow_probe(content)",
      );
      await Zotero.DB.queryAsync(
        "INSERT INTO llm_for_zotero_workflow_probe VALUES (?, ?)",
        [42, "preserved workflow message"],
      );
      await migratePaperpilotDatabaseNamespace();
      const rows = (await Zotero.DB.queryAsync(
        "SELECT id, content FROM paperpilot_workflow_probe",
      )) as Array<{ id: number; content: string }>;
      expect(
        rows.map((row) => ({ id: row.id, content: row.content })),
      ).to.deep.equal([{ id: 42, content: "preserved workflow message" }]);
      const indexes = (await Zotero.DB.queryAsync(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?",
        ["paperpilot_workflow_probe_idx"],
      )) as Array<{ name: string }>;
      expect(indexes).to.have.length(1);
      await migratePaperpilotDatabaseNamespace();
    } catch (error) {
      debug(`Namespace migration failed: ${String(error)}`);
      throw error;
    } finally {
      await Zotero.DB.queryAsync(
        "DROP TABLE IF EXISTS paperpilot_workflow_probe",
      );
      await Zotero.DB.queryAsync(
        "DROP TABLE IF EXISTS llm_for_zotero_workflow_probe",
      );
    }
    const remaining = (await Zotero.DB.queryAsync(
      "SELECT name FROM sqlite_master WHERE name IN (?, ?)",
      ["paperpilot_workflow_probe", "llm_for_zotero_workflow_probe"],
    )) as Array<{ name: string }>;
    expect(remaining).to.have.length(0);
  });

  it("renders a paper panel and reloads its persisted message from the renamed store", async function () {
    const api = getWorkflowApi();
    await api.reset();
    const fixture = await api.createPaperWithPdfFixture({
      title: "Paper Pilot workflow fixture",
      pdfTitle: "Workflow PDF",
      pages: ["Namespace integration test"],
    });
    try {
      const panel = await api.renderPanelForItem(fixture.parentItemId);
      const diagnostics = await api.seedPanelStoredUserMessage(
        panel.panelId,
        "Persisted Paper Pilot workflow message",
      );
      expect(diagnostics.conversationKey).to.be.a("number");
      expect(diagnostics.messageText).to.include(
        "Persisted Paper Pilot workflow message",
      );
      if (!diagnostics.conversationKey)
        throw new Error("Workflow panel has no conversation key");
      const messages = await loadConversation(diagnostics.conversationKey, 20);
      expect(
        messages.some(
          (message) =>
            message.text === "Persisted Paper Pilot workflow message" &&
            message.role === "user",
        ),
      ).to.equal(true);
      const draft = await api.exercisePanelDraftStateRefresh(
        panel.panelId,
        "User draft must survive refresh",
      );
      expect(draft.inputAfterRefresh).to.equal(draft.inputBeforeRefresh);
      expect(draft.inputAfterRefresh).to.equal(
        "User draft must survive refresh",
      );
    } finally {
      await api.reset();
      await api.cleanupFixture(fixture);
    }
  });
});
