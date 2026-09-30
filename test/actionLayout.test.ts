import { strict as assert } from "node:assert";
import { createActionLayoutController } from "../src/modules/contextPanel/setupHandlers/controllers/actionLayoutController";

describe("Approval and Reasoning responsive layout", function () {
  function createFixture(initialWidth: number) {
    let width = initialWidth;
    const makeElement = (renderedWidth = 0) => {
      const classes = new Set<string>();
      const attributes = new Map<string, string>();
      return {
        dataset: {} as Record<string, string>,
        textContent: "",
        title: "",
        parentElement: null,
        scrollWidth: 0,
        get clientWidth() {
          return width;
        },
        getBoundingClientRect: () => ({ width: renderedWidth || width }),
        setAttribute: (name: string, value: string) =>
          attributes.set(name, value),
        getAttribute: (name: string) => attributes.get(name),
        classList: {
          contains: (name: string) => classes.has(name),
          remove: (name: string) => classes.delete(name),
          toggle: (name: string, force: boolean) => {
            if (force) classes.add(name);
            else classes.delete(name);
          },
        },
      };
    };
    const panel = makeElement();
    const model = makeElement();
    model.dataset.modelLabel = "Model";
    const approval = makeElement();
    approval.dataset.approvalLabel = "Default";
    approval.dataset.approvalHint = "Approval mode: Default";
    const reasoning = makeElement();
    reasoning.dataset.reasoningLabel = "High";
    const approvalSlot = makeElement();
    const reasoningSlot = makeElement();
    const send = makeElement();
    const style = {
      getPropertyValue: (property: string) =>
        ({
          "padding-left": "12px",
          "padding-right": "12px",
          "column-gap": "2px",
          "min-width": "0px",
          "max-width": "none",
        })[property] || "0px",
    };
    const body = {
      getBoundingClientRect: () => ({ width }),
      ownerDocument: {
        createElement: () => ({ getContext: () => null }),
        defaultView: { getComputedStyle: () => style },
      },
    } as Element;
    const controller = createActionLayoutController({
      body,
      panelRoot: panel as HTMLDivElement,
      actionsRow: makeElement() as HTMLDivElement,
      actionsLeft: makeElement() as HTMLDivElement,
      modelBtn: model as HTMLButtonElement,
      modelSlot: makeElement() as HTMLDivElement,
      approvalBtn: approval as HTMLButtonElement,
      approvalSlot: approvalSlot as HTMLDivElement,
      reasoningBtn: reasoning as HTMLButtonElement,
      reasoningSlot: reasoningSlot as HTMLDivElement,
      uploadBtn: null,
      selectTextBtn: null,
      screenshotBtn: null,
      sendBtn: send as HTMLButtonElement,
      cancelBtn: null,
    });
    return {
      controller,
      model,
      approval,
      approvalSlot,
      reasoning,
      reasoningSlot,
      send,
      resize: (next: number) => {
        width = next;
        controller.applyResponsiveActionButtonsLayout();
      },
    };
  }

  it("shows both labels at sufficient width", function () {
    const { controller, approval, reasoning } = createFixture(700);
    controller.applyResponsiveActionButtonsLayout();
    assert.equal(approval.textContent, "Default");
    assert.equal(reasoning.textContent, "High");
    assert.equal(
      approval.classList.contains("paperpilotapproval-btn-collapsed"),
      false,
    );
    assert.equal(
      reasoning.classList.contains("paperpilotreasoning-btn-collapsed"),
      false,
    );
  });

  it("preserves the existing full model label when the row fits", function () {
    const { controller, model, approval, reasoning } = createFixture(335);
    controller.applyResponsiveActionButtonsLayout();
    assert.equal(
      model.classList.contains("paperpilotmodel-btn-collapsed"),
      false,
    );
    assert.equal(model.textContent, "Model");
    assert.equal(approval.textContent, "Default");
    assert.equal(reasoning.textContent, "High");
  });

  it("keeps Approval expanded after the model collapses", function () {
    const { controller, model, approval, reasoning } = createFixture(315);
    controller.applyResponsiveActionButtonsLayout();
    assert.equal(
      model.classList.contains("paperpilotmodel-btn-collapsed"),
      true,
    );
    assert.equal(
      approval.classList.contains("paperpilotapproval-btn-collapsed"),
      false,
    );
    assert.equal(approval.textContent, "Default");
    assert.equal(
      reasoning.classList.contains("paperpilotreasoning-btn-collapsed"),
      false,
    );
    assert.equal(reasoning.textContent, "High");
  });

  it("collapses Approval before Reasoning at intermediate widths", function () {
    const { controller, model, approval, approvalSlot, reasoning } =
      createFixture(280);
    controller.applyResponsiveActionButtonsLayout();
    assert.equal(
      model.classList.contains("paperpilotmodel-btn-collapsed"),
      true,
    );
    assert.equal(
      approval.classList.contains("paperpilotapproval-btn-collapsed"),
      true,
    );
    assert.equal(
      approvalSlot.classList.contains("paperpilotapproval-dropdown-collapsed"),
      true,
    );
    assert.equal(approval.textContent, "");
    assert.equal(
      reasoning.classList.contains("paperpilotreasoning-btn-collapsed"),
      false,
    );
    assert.equal(reasoning.textContent, "High");
  });

  it("collapses Reasoning only after Model and Approval", function () {
    const { controller, approval, approvalSlot, reasoning, reasoningSlot } =
      createFixture(250);
    controller.applyResponsiveActionButtonsLayout();
    assert.equal(approval.textContent, "");
    assert.equal(
      approval.classList.contains("paperpilotapproval-btn-collapsed"),
      true,
    );
    assert.equal(
      approvalSlot.classList.contains("paperpilotapproval-dropdown-collapsed"),
      true,
    );
    assert.equal(
      reasoning.classList.contains("paperpilotreasoning-btn-collapsed"),
      true,
    );
    assert.equal(
      reasoningSlot.classList.contains(
        "paperpilotreasoning-dropdown-collapsed",
      ),
      true,
    );
    assert.equal(approval.title, "Approval mode: Default");
    assert.equal(approval.getAttribute("aria-label"), "Approval mode: Default");
  });

  it("restores labels after widening and remains stable through repeated resizes", function () {
    const { resize, model, approval, reasoning } = createFixture(700);
    for (const width of [335, 315, 280, 250, 280, 315, 335, 250, 335]) {
      resize(width);
      assert.equal(
        approval.classList.contains("paperpilotapproval-btn-collapsed"),
        width <= 280,
      );
      assert.equal(
        reasoning.classList.contains("paperpilotreasoning-btn-collapsed"),
        width <= 250,
      );
      assert.equal(
        model.classList.contains("paperpilotmodel-btn-collapsed"),
        width <= 315,
      );
    }
    assert.equal(approval.textContent, "Default");
    assert.equal(reasoning.textContent, "High");
  });

  it("retains a changed Approval setting while compact and restores its new label", function () {
    const { resize, approval } = createFixture(280);
    resize(280);
    approval.dataset.approvalLabel = "Allow all";
    approval.dataset.approvalHint = "Approval mode: Allow all";
    resize(280);
    assert.equal(approval.textContent, "");
    assert.equal(approval.title, "Approval mode: Allow all");
    resize(700);
    assert.equal(approval.textContent, "Allow all");
  });

  it("uses measured fit thresholds for each successive collapse stage", function () {
    const { resize, model, approval, reasoning, send } = createFixture(700);
    for (const [width, expected] of [
      [326, [false, false, false, false]],
      [325, [false, false, false, false]],
      [324, [true, false, false, false]],
      [301, [true, false, false, false]],
      [300, [true, true, false, false]],
      [261, [true, true, false, false]],
      [260, [true, true, true, false]],
      [245, [true, true, true, false]],
      [244, [true, true, true, true]],
    ] as const) {
      resize(width);
      assert.deepEqual(
        [
          model.classList.contains("paperpilotmodel-btn-collapsed"),
          approval.classList.contains("paperpilotapproval-btn-collapsed"),
          reasoning.classList.contains("paperpilotreasoning-btn-collapsed"),
          send.classList.contains("paperpilotaction-icon-only"),
        ],
        expected,
        `Unexpected layout at ${width}px`,
      );
    }
  });
});
