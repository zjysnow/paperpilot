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

  it("loads manual learning Skills and selects them from the real /paper- menu", async function () {
    const api = getWorkflowApi();
    await api.reset();
    const key = "extensions.zotero.paperpilot.enableAgentMode";
    const previousMode = Zotero.Prefs.get(key, true);
    const fixture = await api.createPaperWithPdfFixture({
      title: "Learning Skill menu fixture",
      pdfTitle: "Learning PDF",
      pages: [
        "The method transforms the input into an intermediate representation.",
      ],
    });
    try {
      Zotero.Prefs.set(key, true, true);
      const panel = await api.renderPanelForItem(fixture.parentItemId);
      for (const skillId of ["paper-guide", "paper-tutor"]) {
        const menu = await api.exercisePanelSkillSlashMenu(
          panel.panelId,
          "/paper-",
          skillId,
        );
        expect(menu.loadedSkillIds).to.include.members([
          "paper-guide",
          "paper-tutor",
        ]);
        expect(menu.renderedSkillIds).to.include.members([
          "paper-guide",
          "paper-tutor",
          "paper-replication",
        ]);
        const sent = await api.ask(
          panel.panelId,
          "Explain the central mechanism.",
        );
        expect(sent.forcedSkillIds).to.deep.equal([skillId]);
        expect(sent.question).to.equal("Explain the central mechanism.");
      }
    } catch (error) {
      debug(`Learning Skill menu workflow failed: ${String(error)}`);
      throw error;
    } finally {
      if (previousMode === undefined) {
        Zotero.Prefs.clear(key, true);
      } else {
        Zotero.Prefs.set(key, previousMode, true);
      }
      await api.reset();
      await api.cleanupFixture(fixture);
    }
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

  it("persists real Guide/Tutor selections and clears them in Normal mode", async function () {
    const api = getWorkflowApi();
    await api.reset();
    const key = "extensions.zotero.paperpilot.enableAgentMode";
    const previous = Zotero.Prefs.get(key, true);
    const fixture = await api.createPaperWithPdfFixture({
      title: "Persistent learning mode fixture",
      pdfTitle: "Learning PDF",
      pages: ["Input becomes an intermediate representation."],
    });
    try {
      Zotero.Prefs.set(key, true, true);
      const panel = await api.renderPanelForItem(fixture.parentItemId);
      for (const mode of ["guide", "tutor"] as const) {
        expect(await api.selectPanelLearningMode(panel.panelId, mode)).to.equal(
          mode,
        );
        const geometry = api.measurePanelLearningControls(panel.panelId);
        expect(geometry.modeFontSize).to.equal(geometry.agentFontSize);
        expect(geometry.modeFontWeight).to.equal("400");
        expect(geometry.modeAppearance).to.equal("none");
        expect(geometry.heightDifference).to.be.at.most(1);
        expect(geometry.topDifference).to.be.at.most(1);
        expect(geometry.overflows).to.equal(false);
        for (let turn = 0; turn < 2; turn++) {
          const sent = await api.ask(panel.panelId, "Explain the mechanism.");
          expect(sent.learningMode).to.equal(mode);
          expect(sent.forcedSkillIds).to.deep.equal([`paper-${mode}`]);
        }
        expect(
          await api.selectPanelLearningMode(panel.panelId, mode, true),
        ).to.equal(mode);
      }
      await api.selectPanelLearningMode(panel.panelId, "normal");
      const sent = await api.ask(panel.panelId, "Ordinary question.");
      expect(sent.learningMode).to.equal("normal");
      expect(sent.forcedSkillIds || []).to.deep.equal([]);
      await api.startNewPanelConversation(panel.panelId);
      expect(
        await api.selectPanelLearningMode(panel.panelId, "normal", true),
      ).to.equal("normal");
    } catch (error) {
      debug(`Learning selector workflow failed: ${String(error)}`);
      throw error;
    } finally {
      if (previous === undefined) Zotero.Prefs.clear(key, true);
      else Zotero.Prefs.set(key, previous, true);
      await api.reset();
      await api.cleanupFixture(fixture);
    }
  });

  it("commits real PDF learning state and synchronizes Markdown without overwriting manual edits", async function () {
    this.timeout(60000);
    const api = getWorkflowApi();
    await api.reset();
    const fixture = await api.createPaperWithPdfFixture({
      title: "Learning persistence fixture",
      pdfTitle: "Mechanism PDF",
      pages: [
        "Input is transformed into an intermediate representation. The next stage uses the representation to produce the output.",
      ],
    });
    try {
      const panel = await api.renderPanelForItem(fixture.parentItemId);
      expect(
        await api.exerciseLearningPersistence(
          panel.panelId,
          fixture.pdfAttachmentId,
        ),
      ).to.deep.equal({
        restored: true,
        manualPreserved: true,
        conflictReported: true,
        databaseAdvanced: true,
      });
    } catch (error) {
      debug(`Learning persistence workflow failed: ${String(error)}`);
      throw error;
    } finally {
      await api.reset();
      await api.cleanupFixture(fixture);
    }
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
