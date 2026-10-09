import type {
  AgentToolContext,
  AgentToolDefinition,
  AgentToolExecutionOutput,
} from "../../types";
import type { PdfService } from "../../services/pdfService";
import type { ZoteroGateway } from "../../services/zoteroGateway";
import type { PaperContextRef } from "../../../shared/types";
import {
  MAX_LEARNING_RECORD_CHARS,
  parseLearningProgress,
  parsePaperGuide,
  verifyGuideEvidence,
  verifyLearningSource,
  type GuideEvidenceCitation,
  type LearningProgress,
  type LearningSource,
  type PaperGuide,
} from "../../services/paperLearning";
import { renderPaperGuide } from "../../services/paperGuideRenderer";
import { buildPdfSourceFingerprint } from "../../../modules/contextPanel/pdfContext";
import { buildQuoteCitation } from "../../../modules/contextPanel/quoteCitations";
import { formatPaperSourceLabel } from "../../../modules/contextPanel/paperAttribution";
import { isAbsoluteLocalPath } from "../../../utils/localPath";
import {
  collectRequestPaperContexts,
  resolveLearningPaperContext,
} from "../requestPaperContexts";
import { fail, ok, validateObject } from "../shared";
import {
  isManagedLearningTurn,
  learningSourceKey,
  loadLearningNoteBinding,
  loadLearningProgressForPaper,
  stageLearningNoteBinding,
  stageLearningProgress,
} from "../../store/learningStore";
import { getLearningNoteSyncDirectory } from "../../../utils/learningNoteSyncConfig";
import {
  createFileIOTool,
  fileExistsForWriteConfirmation,
  type FileIOInput,
} from "./fileIO";

type LearningInput =
  | {
      mode: "guide";
      filePath: string;
      record: PaperGuide;
      allowOverwrite?: boolean;
    }
  | {
      mode: "progress";
      filePath?: string;
      record: LearningProgress;
      allowOverwrite?: boolean;
    }
  | { mode: "resume"; filePath?: string; target?: string }
  | { mode: "bind-note"; filePath: string };

function resultContent(
  output: AgentToolExecutionOutput,
): Record<string, unknown> {
  const value =
    validateObject(output) && "content" in output ? output.content : output;
  if (!validateObject(value))
    throw new Error("File operation returned an invalid result");
  if (typeof value.error === "string") throw new Error(value.error);
  return value;
}

export function createPaperLearningTool(deps: {
  pdfService: Pick<PdfService, "ensurePaperContext">;
  zoteroGateway: Pick<ZoteroGateway, "resolvePaperContextTarget" | "getItem">;
}): AgentToolDefinition<LearningInput, unknown> {
  const fileIO = createFileIOTool();

  async function readProgress(
    filePath: string,
    context: AgentToolContext,
  ): Promise<LearningProgress> {
    const content = resultContent(
      await fileIO.execute(
        { action: "read", filePath, length: MAX_LEARNING_RECORD_CHARS + 1 },
        context,
      ),
    );
    if (content.nextOffset !== undefined || typeof content.text !== "string") {
      throw new Error("Learning progress is truncated or not a text record");
    }
    return parseLearningProgress(JSON.parse(content.text));
  }

  async function resolveSource(
    saved: LearningSource,
    context: AgentToolContext,
  ) {
    const selected = collectRequestPaperContexts(context.request);
    if (
      selected.length &&
      !selected.some(
        (entry) =>
          entry.itemId === saved.itemId &&
          entry.contextItemId === saved.contextItemId,
      )
    ) {
      throw new Error(
        "Select the learning record's paper and attachment before continuing",
      );
    }
    const resolved = deps.zoteroGateway.resolvePaperContextTarget(saved);
    if (
      !resolved ||
      resolved.itemId !== saved.itemId ||
      resolved.contextItemId !== saved.contextItemId
    ) {
      throw new Error("Learning source paper or attachment is unavailable");
    }
    const selectedContext = selected.find(
      (entry) =>
        entry.itemId === saved.itemId &&
        entry.contextItemId === saved.contextItemId,
    );
    const paperContext: PaperContextRef = {
      ...resolved,
      ...(selectedContext
        ? {
            contentSourceMode: selectedContext.contentSourceMode,
            mineruCacheDir: selectedContext.mineruCacheDir,
          }
        : {}),
    };
    const item = deps.zoteroGateway.getItem(saved.itemId);
    const attachment = deps.zoteroGateway.getItem(saved.contextItemId);
    if (
      !item ||
      !attachment ||
      (context.request.libraryID &&
        item.libraryID !== context.request.libraryID)
    ) {
      throw new Error(
        "Learning source is not available in the current library",
      );
    }
    const pdf = await deps.pdfService.ensurePaperContext(paperContext);
    if (!pdf?.chunks.some((chunk) => chunk.trim())) {
      throw new Error(
        "No readable source text; learning progress cannot replace the paper",
      );
    }
    const current: LearningSource = {
      ...saved,
      title: paperContext.title,
      itemKey: item.key,
      attachmentKey: attachment.key,
      libraryID: item.libraryID,
      fingerprint:
        pdf.chunkMeta.find((meta) => meta.sourceFingerprint)
          ?.sourceFingerprint ||
        buildPdfSourceFingerprint(pdf.chunks.join("\n\n"), pdf.sourceType),
    };
    if (
      saved.fingerprint ||
      saved.itemKey ||
      saved.attachmentKey ||
      saved.libraryID
    ) {
      verifyLearningSource(
        { ...saved, fingerprint: saved.fingerprint || current.fingerprint },
        current,
      );
    }
    return { current, paperContext, pdf };
  }

  async function prepareWrite(
    input: Extract<LearningInput, { mode: "guide" | "progress" }> & {
      filePath: string;
    },
    context: AgentToolContext,
  ) {
    const { current, paperContext, pdf } = await resolveSource(
      input.record.source,
      context,
    );
    let content: string;
    let citations: GuideEvidenceCitation[] = [];
    if (input.mode === "guide") {
      const guide = parsePaperGuide({ ...input.record, source: current });
      verifyGuideEvidence(guide, pdf.chunks);
      citations = guide.evidence.map((entry) => {
        const meta = pdf.chunkMeta[entry.chunkIndex];
        const citation = buildQuoteCitation({
          quoteText: entry.quote,
          sourceLabel: formatPaperSourceLabel(paperContext),
          sourceSectionLabel: meta?.sectionLabel,
          sourceChunkKind: meta?.chunkKind,
          itemId: current.itemId,
          contextItemId: current.contextItemId,
          sourceFingerprint: current.fingerprint,
          sourceMatchKind: "exact",
          sourceMatchSource: "context-text",
          pageHintIndex: meta?.pageStart,
          allowShortQuoteText: true,
        });
        if (!citation)
          throw new Error(
            `Evidence ${entry.id} is not a substantive native source citation`,
          );
        return { evidenceId: entry.id, citation };
      });
      content = renderPaperGuide(guide, citations);
    } else {
      const exists = await fileExistsForWriteConfirmation(input.filePath);
      if (exists === null)
        throw new Error(
          "Cannot verify the existing progress file; choose a new path",
        );
      if (exists) {
        const previous = await readProgress(input.filePath, context);
        verifyLearningSource(previous.source, current);
        if (previous.target !== input.record.target) {
          throw new Error(
            "Existing progress has another learning target; choose a new path",
          );
        }
      }
      content = JSON.stringify(
        parseLearningProgress({ ...input.record, source: current }),
      );
    }
    const validated = fileIO.validate({
      action: "write",
      filePath: input.filePath,
      content,
      allowOverwrite: input.allowOverwrite,
    });
    if (!validated.ok) throw new Error(validated.error);
    const write: FileIOInput = {
      ...validated.value,
      allowOverwrite: input.allowOverwrite,
    };
    return { write, current, citations };
  }

  return {
    spec: {
      name: "paper_learning",
      description:
        "Checkpoint source-checked learning progress in the database with mode:'progress' and record (no filePath required); it commits when the turn completes. Database checkpoints and note binding require a managed Paper Pilot Agent turn, not an external MCP call. Use mode:'resume' without filePath to restore the selected paper's database progress; optional target selects one goal. An explicit JSON filePath exports progress or reads a portable record, with file approval for writes; reading JSON does not automatically import it into the database. Use mode:'guide' with absolute .html filePath for offline export. Use mode:'bind-note' with an existing .md filePath to bind the selected paper's progress to a note inside the authorized Notes Directory, with approval. Never use for ordinary Q&A.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["mode"],
        properties: {
          mode: {
            type: "string",
            enum: ["guide", "progress", "resume", "bind-note"],
          },
          target: {
            type: "string",
            description:
              "Optional exact learning target when resuming database progress.",
          },
          filePath: {
            type: "string",
            description:
              "Optional .json export/import path for progress/resume; required absolute .html for guide or .md for bind-note.",
          },
          record: {
            type: "object",
            additionalProperties: true,
            description:
              "Version 1 PaperGuide or LearningProgress, including source itemId, contextItemId, title, coverage and missing. See the active learning Skill for the complete shape.",
          },
        },
      },
      mutability: "write",
      requiresConfirmation: true,
      tier: "advanced",
    },
    presentation: {
      label: "Paper Learning",
      summaries: {
        onCall: "Preparing paper learning record",
        onPending: "Waiting for confirmation on learning export",
        onDenied: "Learning export cancelled",
        onSuccess: "Paper learning operation completed",
      },
    },
    validate(args) {
      try {
        if (!validateObject(args)) return fail("Expected a learning operation");
        if (args.mode === "progress" && args.filePath === undefined) {
          return ok({
            mode: "progress",
            record: parseLearningProgress(args.record),
          });
        }
        if (args.mode === "resume" && args.filePath === undefined) {
          if (args.record !== undefined)
            return fail("Resume reads saved progress; do not supply record");
          if (
            args.target !== undefined &&
            (typeof args.target !== "string" || !args.target.trim())
          )
            return fail("target must be nonempty");
          return ok({
            mode: "resume",
            target: typeof args.target === "string" ? args.target : undefined,
          });
        }
        if (
          typeof args.filePath !== "string" ||
          !isAbsoluteLocalPath(args.filePath.trim())
        ) {
          return fail("filePath must be an absolute path");
        }
        const filePath = args.filePath.trim();
        if (args.mode === "bind-note" && /\.md$/i.test(filePath)) {
          return ok({ mode: "bind-note", filePath });
        }
        if (args.mode === "resume" && /\.json$/i.test(filePath)) {
          if (args.record !== undefined)
            return fail("Resume reads the saved record; do not supply record");
          return ok({ mode: "resume", filePath });
        }
        if (args.mode === "guide" && /\.html$/i.test(filePath)) {
          return ok({
            mode: "guide",
            filePath,
            record: parsePaperGuide(args.record),
          });
        }
        if (args.mode === "progress" && /\.json$/i.test(filePath)) {
          return ok({
            mode: "progress",
            filePath,
            record: parseLearningProgress(args.record),
          });
        }
        return fail("Use guide with .html, or progress/resume with .json");
      } catch (error) {
        return fail(error instanceof Error ? error.message : String(error));
      }
    },
    shouldRequireConfirmation: (input) =>
      input.mode !== "resume" && Boolean(input.filePath),
    async createPendingAction(input, context) {
      if (input.mode === "resume")
        throw new Error("Resume does not need write approval");
      if (!input.filePath)
        throw new Error("Database checkpoints do not need file approval");
      const action = await fileIO.createPendingAction!(
        {
          action: "write",
          filePath: input.filePath,
          content:
            input.mode === "bind-note"
              ? "Bind this existing note for learning progress synchronization; preserve all manual content."
              : JSON.stringify(input.record, null, 2),
        },
        context,
      );
      return {
        ...action,
        toolName: "paper_learning",
        description: `${action.description}\nThe learning record will be source-checked before saving${input.mode === "guide" ? " and rendered as offline HTML" : ""}.`,
      };
    },
    applyConfirmation(input) {
      return ok(
        input.mode === "resume" ? input : { ...input, allowOverwrite: true },
      );
    },
    async execute(input, context) {
      if (input.mode === "resume") {
        if (!input.filePath) {
          const selected = resolveLearningPaperContext(context.request);
          const records = await loadLearningProgressForPaper(
            selected.itemId,
            selected.contextItemId,
          );
          const progress = input.target
            ? records.find((record) => record.target === input.target)
            : records[0];
          if (!progress)
            return {
              mode: "resume",
              storage: "database",
              progress: null,
              guidance:
                "No saved progress for this paper/target. Start a new source-grounded learning goal.",
            };
          const { current } = await resolveSource(progress.source, context);
          verifyLearningSource(progress.source, current);
          return {
            mode: "resume",
            storage: "database",
            progress,
            otherTargets: records.map((record) => record.target),
            guidance:
              "Learning state is not paper evidence. Reread the relevant current paper passage before teaching. Never upgrade mastery just from a saved status.",
          };
        }
        const progress = await readProgress(input.filePath, context);
        const { current } = await resolveSource(progress.source, context);
        verifyLearningSource(progress.source, current);
        return {
          mode: "resume",
          filePath: input.filePath,
          progress,
          guidance:
            "Progress is learning context, not paper evidence. Reread the recorded location with paper_read before teaching. Resume never upgrades understanding status.",
        };
      }
      if (input.mode === "bind-note") {
        if (!isManagedLearningTurn(context.request))
          throw new Error(
            "Note binding requires a PaperPilot-managed Agent turn",
          );
        const selected = resolveLearningPaperContext(context.request);
        const directory = getLearningNoteSyncDirectory();
        if (!directory)
          throw new Error(
            "Enable learning note sync in settings before binding a note",
          );
        const progress = (
          await loadLearningProgressForPaper(
            selected.itemId,
            selected.contextItemId,
          )
        )[0];
        if (!progress)
          throw new Error("Save a learning checkpoint before binding a note");
        const { current } = await resolveSource(progress.source, context);
        verifyLearningSource(progress.source, current);
        const path = input.filePath.replace(/\\/g, "/");
        const root = directory.replace(/\\/g, "/").replace(/\/+$/, "");
        if (/(?:^|\/)\.\.?(?:\/|$)/.test(path) || !path.startsWith(`${root}/`))
          throw new Error(
            "Learning note must be inside the authorized Notes Directory",
          );
        const sourceKey = learningSourceKey(progress.source);
        const previous = await loadLearningNoteBinding(sourceKey);
        stageLearningNoteBinding(context.request, sourceKey, {
          filePath: input.filePath,
          managedBlock:
            previous?.filePath === input.filePath ? previous.managedBlock : "",
        });
        return {
          mode: "bind-note",
          filePath: input.filePath,
          pendingCommit: true,
          guidance:
            "The note binding will be synchronized at successful turn completion; manual content is preserved.",
        };
      }
      if (input.mode === "progress" && !input.filePath) {
        if (!isManagedLearningTurn(context.request))
          throw new Error(
            "Database checkpoints require a PaperPilot-managed Agent turn. External clients can explicitly export progress to JSON.",
          );
        const selected = resolveLearningPaperContext(context.request);
        if (
          selected.itemId !== input.record.source.itemId ||
          selected.contextItemId !== input.record.source.contextItemId
        )
          throw new Error(
            "Learning checkpoint must belong to the active paper and attachment",
          );
        const { current } = await resolveSource(input.record.source, context);
        const progress = parseLearningProgress({
          ...input.record,
          source: current,
        });
        await stageLearningProgress(context.request, progress);
        return {
          mode: "progress",
          storage: "database",
          pendingCommit: true,
          guidance:
            "Checkpoint validated and staged. The runtime saves it when this turn completes. Do not claim source checking proves mastery.",
        };
      }
      if (!input.filePath) throw new Error("Export needs an absolute filePath");
      const { write, current, citations } = await prepareWrite(
        { ...input, filePath: input.filePath },
        context,
      );
      const content = resultContent(await fileIO.execute(write, context));
      return {
        content: {
          ...content,
          mode: input.mode,
          source: current,
          quoteCitations: citations.map((entry) => entry.citation),
          validation:
            "Source quotes checked; explanation accuracy and learner mastery are not certified.",
        },
        artifacts: [
          {
            kind: "file_ref",
            mimeType: input.mode === "guide" ? "text/html" : "application/json",
            storedPath: input.filePath,
            name: input.filePath.split(/[\\/]/).pop() || input.filePath,
          },
        ],
      };
    },
  };
}
