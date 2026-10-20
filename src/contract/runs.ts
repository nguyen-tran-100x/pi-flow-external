import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { failureVariant, strings, successVariant } from "./envelope.ts";
import { supervisedRunSchema } from "./run.ts";

const TOOL = "external_runs";
const runs = Type.Array(supervisedRunSchema);
const cursor = Type.Optional(Type.String());

export const EXTERNAL_RUNS_ACTIONS = ["list", "inspect", "wait", "cancel"] as const;
export const SINGLE_INSPECT_VIEWS = ["summary", "output", "diagnostics", "final", "launch"] as const;
export const WAIT_MODES = ["any", "all"] as const;
export const MAX_WAIT_TARGETS = 100;
/**
 * Cap for `inspect`'s batch `runIds` mode. Intentionally lower than `wait`'s
 * MAX_WAIT_TARGETS (100): batch inspection returns full projections and may
 * touch live evidence reads per target, so it stays cheap by staying small.
 */
export const MAX_BATCH_INSPECT_TARGETS = 20;

export const externalRunsParameters = Type.Object({
  action: StringEnum(EXTERNAL_RUNS_ACTIONS, {
    description:
      "Required action. list: page session runs and workflow roots (optional: workflowRunId, limit, cursor, workflowCursor; omit runIds, view, mode, limitBytes, reason). inspect: read 1 run with any view or 2-20 runs for batch summary (required: runIds; optional: view, cursor, limitBytes; omit mode, workflowRunId, workflowCursor, limit, reason). wait: block until terminal outcomes for 1-100 runs (required: runIds; optional: mode, limitBytes; omit view, cursor, workflowCursor, limit, workflowRunId, reason). cancel: stop 1 run (required: runIds with 1 ID; optional: reason; omit view, mode, cursor, workflowCursor, limit, limitBytes, workflowRunId).",
  }),
  runIds: Type.Optional(Type.Array(Type.String(), {
    maxItems: MAX_WAIT_TARGETS,
    description:
      "Target run IDs (run_... agent, wf_... workflow). Required for inspect (1 ID for any view: summary, output, diagnostics, final, launch; 2-20 IDs for summary-only batch), wait (1-100 IDs), and cancel (1 ID). Inapplicable to list (omit).",
  })),
  view: Type.Optional(StringEnum(SINGLE_INSPECT_VIEWS, {
    description:
      "Optional for inspect only (default \"summary\"); inapplicable to list, wait, and cancel (omit). Single-target inspect (1 ID) accepts \"summary\" (state/timing/freshness/refs, default), \"output\" (assistant text plus canonical result, partial or final), \"diagnostics\" (tool activity/errors), \"final\" (only the verified canonical terminal answer, empty until a successful terminal boundary exists), or \"launch\" (recorded prompt, context and execution configuration; sensitive, explicit inspection only). Batch inspect (2-20 runIds) only supports \"summary\".",
  })),
  mode: Type.Optional(StringEnum(WAIT_MODES, {
    description:
      "Optional for wait only (\"any\" | \"all\", default \"all\"); inapplicable to list, inspect, and cancel (omit). any returns on the first terminal outcome; all waits for every target. Neither cancels pending work; an unsuccessful selected workflow returns early even in all mode.",
  })),
  cursor: Type.Optional(Type.String({
    description:
      "Optional continuation cursor for list and inspect; inapplicable to wait and cancel (omit). For list: pass back nextCursor verbatim to page the runs stream (all agent runs, or that workflow's children when workflowRunId is set). For single inspect: pass back page.nextCursor with the same runId and view. For batch inspect: pass back nextCursor with the identical runIds array. Stale/reused cursors fail with an actionable error.",
  })),
  workflowCursor: Type.Optional(Type.String({
    description:
      "Optional continuation cursor for unfiltered list only; inapplicable when workflowRunId filters to one workflow's children and for inspect, wait, and cancel (omit). Pass back nextWorkflowCursor verbatim to page the workflow-roots listing (workflows); passing workflowCursor without cursor pages workflows only.",
  })),
  limit: Type.Optional(Type.Integer({
    minimum: 1,
    maximum: 100,
    description: "Optional for list only (1-100); inapplicable to inspect, wait, and cancel (omit). Max entries per list/children page.",
  })),
  limitBytes: Type.Optional(Type.Integer({
    minimum: 4,
    maximum: 65536,
    description:
      "Optional for inspect and wait (4-65536); inapplicable to list and cancel (omit). For inspect: max UTF-8 bytes per page, including the summary view; follow nextCursor for the remainder. For wait: total result budget shared across every settled outcome in the response in request order (default 32768); a result that fits is returned complete, one that does not is truncated with resultTruncated:true and outputRef/diagnosticsRef for the rest.",
  })),
  workflowRunId: Type.Optional(Type.String({
    description:
      "Optional for list only (wf_... ID); inapplicable to inspect, wait, and cancel (omit). Filters list.runs to children of this wf_... workflow only, leaves list.workflows empty, and pages via cursor (nextCursor) rather than workflowCursor.",
  })),
  reason: Type.Optional(Type.String({
    maxLength: 512,
    description: "Optional for cancel only (max 512 chars); inapplicable to list, inspect, and wait (omit). Cancellation reason recorded with the run evidence.",
  })),
});

export type ExternalRunsParameterKey = keyof typeof externalRunsParameters.properties;

export const EXTERNAL_RUNS_PARAMETER_KEYS = Object.keys(
  externalRunsParameters.properties,
) as readonly ExternalRunsParameterKey[];

export const EXTERNAL_RUNS_EXAMPLES = {
  list: { action: "list" as const },
  listWorkflowChildren: { action: "list" as const, workflowRunId: "wf_example" },
  listRunsNextPage: { action: "list" as const, cursor: "cursor_from_nextCursor" },
  listWorkflowsNextPage: { action: "list" as const, workflowCursor: "cursor_from_nextWorkflowCursor" },
  inspectSingle: { action: "inspect" as const, runIds: ["run_example"], view: "final" as const },
  inspectBatch: { action: "inspect" as const, runIds: ["run_example_1", "run_example_2"] },
  wait: { action: "wait" as const, runIds: ["run_example"], mode: "all" as const },
  cancel: { action: "cancel" as const, runIds: ["run_example"] },
  cancelWithReason: { action: "cancel" as const, runIds: ["run_example"], reason: "No longer needed" },
};

export type ExternalRunsExample = (typeof EXTERNAL_RUNS_EXAMPLES)[keyof typeof EXTERNAL_RUNS_EXAMPLES];

export interface ExternalRunsActionSpec {
  id: "list" | "list_children" | "inspect_single" | "inspect_batch" | "wait" | "cancel";
  label: string;
  action: (typeof EXTERNAL_RUNS_ACTIONS)[number];
  required: readonly ExternalRunsParameterKey[];
  optional: readonly ExternalRunsParameterKey[];
  inapplicable: readonly ExternalRunsParameterKey[];
  rule: string;
  example: ExternalRunsExample;
}

function defineActionSpec(spec: Omit<ExternalRunsActionSpec, "inapplicable">): ExternalRunsActionSpec {
  const allowed = new Set<ExternalRunsParameterKey>([...spec.required, ...spec.optional]);
  return {
    ...spec,
    inapplicable: EXTERNAL_RUNS_PARAMETER_KEYS.filter((key) => !allowed.has(key)),
  };
}

export const EXTERNAL_RUNS_ACTION_SPECS: readonly ExternalRunsActionSpec[] = [
  defineActionSpec({
    id: "list",
    label: "list (session runs + workflow roots)",
    action: "list",
    required: ["action"],
    optional: ["limit", "cursor", "workflowCursor", "workflowRunId"],
    rule: "Two independent cursor streams: cursor (from nextCursor) pages runs; workflowCursor (from nextWorkflowCursor) pages workflows. Passing workflowCursor without cursor pages workflows alone.",
    example: EXTERNAL_RUNS_EXAMPLES.list,
  }),
  defineActionSpec({
    id: "list_children",
    label: "list (workflow children via workflowRunId)",
    action: "list",
    required: ["action", "workflowRunId"],
    optional: ["limit", "cursor"],
    rule: "workflowRunId (wf_...) filters runs to that workflow's children and returns workflows: []; page with cursor (nextCursor) only, never workflowCursor.",
    example: EXTERNAL_RUNS_EXAMPLES.listWorkflowChildren,
  }),
  defineActionSpec({
    id: "inspect_single",
    label: "inspect (single run, any view)",
    action: "inspect",
    required: ["action", "runIds"],
    optional: ["view", "cursor", "limitBytes"],
    rule: `1 ID in runIds (legacy runId also accepted); view is ${SINGLE_INSPECT_VIEWS.join("|")} (default summary); cursor continues from page.nextCursor with the same runId and view.`,
    example: EXTERNAL_RUNS_EXAMPLES.inspectSingle,
  }),
  defineActionSpec({
    id: "inspect_batch",
    label: `inspect (batch summary, 2-${MAX_BATCH_INSPECT_TARGETS} runs)`,
    action: "inspect",
    required: ["action", "runIds"],
    optional: ["view", "cursor", "limitBytes"],
    rule: `2-${MAX_BATCH_INSPECT_TARGETS} IDs in runIds (1 ID with default/summary view also uses batch shape); view must be omitted or "summary" (output, diagnostics, final, and launch are rejected); cursor continues from nextCursor with the identical runIds array.`,
    example: EXTERNAL_RUNS_EXAMPLES.inspectBatch,
  }),
  defineActionSpec({
    id: "wait",
    label: `wait (1-${MAX_WAIT_TARGETS} runs)`,
    action: "wait",
    required: ["action", "runIds"],
    optional: ["mode", "limitBytes"],
    rule: `1-${MAX_WAIT_TARGETS} IDs in runIds; mode is ${WAIT_MODES.join("|")} (default all); limitBytes is the shared result budget spent in request order.`,
    example: EXTERNAL_RUNS_EXAMPLES.wait,
  }),
  defineActionSpec({
    id: "cancel",
    label: "cancel (1 run)",
    action: "cancel",
    required: ["action", "runIds"],
    optional: ["reason"],
    rule: "1 ID in runIds (legacy runId also accepted); reason is optional (<=512 chars).",
    example: EXTERNAL_RUNS_EXAMPLES.cancelWithReason,
  }),
];

/**
 * Compact per-action argument matrix and minimal valid examples generated from
 * `externalRunsParameters` and `EXTERNAL_RUNS_ACTION_SPECS` so on-demand help
 * cannot drift from the executable tool contract.
 */
export function formatExternalRunsActionGuidance(): string {
  const rows = EXTERNAL_RUNS_ACTION_SPECS.map((spec) => [
    `- ${spec.label}: required: ${spec.required.join(", ")} | optional: ${spec.optional.join(", ") || "none"} | omit: ${spec.inapplicable.join(", ") || "none"}`,
    `  Rule: ${spec.rule}`,
    `  Minimal call: ${JSON.stringify(spec.example)}`,
  ].join("\n"));
  return [
    "external_runs action-specific arguments (supply only the relevant fields; omit inapplicable ones):",
    ...rows,
    `List pagination examples: runs stream -> ${JSON.stringify(EXTERNAL_RUNS_EXAMPLES.listRunsNextPage)}; workflow roots stream -> ${JSON.stringify(EXTERNAL_RUNS_EXAMPLES.listWorkflowsNextPage)}.`,
  ].join("\n");
}

/** One success variant per action (inspect has batch and single shapes); every expected failure has `data: null`. */
export const externalRunsOutputSchema = Type.Union([
  successVariant(TOOL, Type.Literal("list"), Type.Object({ runs, workflows: runs, nextCursor: cursor, nextWorkflowCursor: cursor })),
  successVariant(TOOL, Type.Literal("inspect"), Type.Union([
    Type.Object({ mode: Type.Literal("batch"), entries: runs, nextCursor: cursor }),
    Type.Object({
      mode: Type.Literal("single"),
      runId: Type.String(),
      view: strings(...SINGLE_INSPECT_VIEWS),
      page: Type.Object({
        /** UTF-8 bytes bounded by limitBytes. JSON pages may be fragments: concatenate one cursor sequence before parsing. */
        text: Type.String(),
        encoding: strings("json", "text"),
        complete: Type.Boolean(),
        nextCursor: cursor,
      }),
      finalAvailable: Type.Optional(Type.Boolean()),
      outputStatus: Type.Optional(strings("preliminary", "final", "interrupted")),
    }),
  ])),
  successVariant(TOOL, Type.Literal("wait"), Type.Object({ mode: strings(...WAIT_MODES), completed: runs, pending: Type.Array(Type.String()) })),
  successVariant(TOOL, Type.Literal("cancel"), Type.Object({ runId: Type.String(), status: strings("requested", "terminal") })),
  failureVariant(TOOL, strings(...EXTERNAL_RUNS_ACTIONS), Type.Null()),
]);

