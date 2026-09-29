import { strict as assert } from "node:assert";
import { normalizeResponsesStepFromPayload } from "../src/agent/model/responsesShared";

describe("Responses function call normalization", function () {
  it("removes an empty duplicate function call after a valid call", function () {
    const step = normalizeResponsesStepFromPayload({
      output: [
        {
          type: "function_call",
          call_id: "run-valid",
          name: "run_command",
          arguments: '{"command":"git status --short"}',
        },
        {
          type: "function_call",
          call_id: "run-empty",
          name: "run_command",
          arguments: "",
        },
      ],
    });

    assert.deepEqual(step.toolCalls, [
      {
        id: "run-valid",
        name: "run_command",
        arguments: { command: "git status --short" },
      },
    ]);
    assert.equal(step.outputItems.length, 1);
  });

  it("keeps an isolated empty function call for explicit model correction", function () {
    const step = normalizeResponsesStepFromPayload({
      output: [
        {
          type: "function_call",
          call_id: "run-empty",
          name: "run_command",
          arguments: "",
        },
      ],
    });

    assert.equal(step.toolCalls.length, 1);
    assert.deepEqual(step.toolCalls[0].arguments, {});
  });
});
