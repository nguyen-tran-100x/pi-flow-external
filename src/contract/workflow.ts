import { Type } from "typebox";
import { EXTERNAL_WORKFLOW_TOOL } from "../tool-names.ts";
import type { RegisteredRunEntry } from "../core/run-registry.ts";
import { contractEnvelope, INLINE_RESULT_BYTES, type PublicError } from "./envelope.ts";
import { liveWorkflowRun, workflowRunSchema, type EvidenceIntegrity, type PublicRun } from "./run.ts";

const workflowData = Type.Object({ run: Type.Union([Type.Null(), workflowRunSchema]) });
/** `ok` describes the workflow operation: a background launch is accepted, a foreground one settled successfully. */
export const workflowOutputSchema = contractEnvelope(EXTERNAL_WORKFLOW_TOOL, Type.Literal("run"), workflowData, workflowData);

export const HANDLED_CHILD_FAILURES = "handled_child_failures";

export const AGENT_OPTION_KEYS = [
  "description",
  "label",
  "role",
  "harness",
  "subagent_type",
  "permission",
  "max_budget_usd",
  "resume",
  "context",
  "schema",
  "phase",
] as const;

export type AgentOptionKey = (typeof AGENT_OPTION_KEYS)[number];

export const WORKFLOW_HELPERS = {
  functions: {
    agent: `agent(prompt, { ${AGENT_OPTION_KEYS.join(", ")} })`,
    parallel: "parallel(thunks)",
    pipeline: "pipeline(items, ...stages)",
    phase: "phase(title)",
    log: "log(message)",
  },
  globals: ["args", "cwd"] as const,
  agentOptions: AGENT_OPTION_KEYS,
} as const;

export function formatWorkflowHelpersLine(): string {
  return `APIs: ${Object.values(WORKFLOW_HELPERS.functions).join("; ")}. Globals: ${WORKFLOW_HELPERS.globals.join(" and ")}.`;
}

/**
 * The public receipt for one registered workflow. A foreground root that
 * succeeded after handling child failures stays ok, with a warning; an
 * unsuccessful root is a failed operation that keeps its run evidence.
 */
export function workflowReceipt(entry: RegisteredRunEntry, { integrity, inspectable }: { integrity?: EvidenceIntegrity; inspectable: boolean }): {
  data: { run: PublicRun };
  warnings: string[];
  error?: PublicError;
} {
  const built = liveWorkflowRun(entry, { integrity, inlineBudget: INLINE_RESULT_BYTES, inspectable });
  const warnings: string[] = [];
  if (built.redacted) warnings.push("output_redacted");
  const outcome = entry.outcome;
  if (outcome && outcome.status !== "done") {
    return { data: { run: built.run }, warnings, error: { code: outcome.outcome === "succeeded" ? "failed" : outcome.outcome, message: outcome.error ?? "Workflow failed" } };
  }
  if (outcome && (built.run.children?.failed ?? 0) > 0) warnings.push(HANDLED_CHILD_FAILURES);
  return { data: { run: built.run }, warnings };
}
