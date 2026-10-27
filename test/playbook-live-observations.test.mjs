import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resultEnvelope, invocationCounts, fixedHarnessSettings, harnessControl,
  pageChains, paginationAssessment,
} from "../scripts/e2e/playbook-observations.mjs";
import { parsePiTrace, evaluateTrial } from "../scripts/e2e/playbook-behavior.mjs";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/playbook-behavior/pi-response-shapes.json", import.meta.url), "utf8"));
const parse = (events) => parsePiTrace(events.map((event) => JSON.stringify(event)).join("\n"));
const traced = () => parse(fixture.events);
const baseCase = { id: "one-run", pattern: "cross-cutting", files: { "input.txt": "source" },
  expect: { facts: [], minExternalRoots: 1, maxExternalRoots: 1 }, review: [] };
function evidence(trace = traced()) {
  return { trace, exitCode: 0, timedOut: false, before: {}, after: {}, harness: "codex",
    trialSettings: fixedHarnessSettings("codex", 420000),
    summaries: [{ file: "run_missing/summary.json", runId: "run_missing", harness: "codex", status: "done" }] };
}

describe("reported Pi response field layout", () => {
  it("reads the structured public envelope, not the display-only details", () => {
    const calls = traced().toolCalls;
    assert.equal(calls[0].result.ok, false);
    assert.equal(calls[0].result.error.code, "request_invalid");
    assert.equal(calls[1].result.data.run.runId, "run_missing");
    assert.equal(calls[2].result.data.page.nextCursor, "opaque-next-page");
    assert.equal(calls[2].visibleText, "Page text only, with no continuation instruction.");
  });
  it("does not override a structured failure with a stale details success", () => {
    const failure = { ok: false, data: { run: null }, error: { code: "request_invalid" } };
    assert.equal(resultEnvelope({ structuredContent: failure, details: { ok: true },
      content: [{ type: "text", text: '{"ok":true}' }] }), failure);
  });
  it("retains legacy details and text fallbacks without treating arbitrary text as an envelope", () => {
    assert.equal(resultEnvelope({ details: { ok: true, data: {} } }).ok, true);
    assert.equal(resultEnvelope({ content: [{ type: "text", text: '{"ok":false,"data":{"run":null}}' }] }).ok, false);
    assert.equal(resultEnvelope({ structuredContent: { other: 1 }, content: [{ type: "text", text: "not JSON" }] }), null);
  });
});

describe("invocation attempts versus admitted runs", () => {
  it("counts an argument correction separately from the one launched child", () => {
    const count = invocationCounts(traced());
    assert.equal(count.attempts, 2);
    assert.equal(count.rejected, 1);
    assert.equal(count.argumentRejections, 1);
    assert.equal(count.unresolved, 0);
    assert.deepEqual(count.admitted.map((r) => r.runId), ["run_missing"]);
    const score = evaluateTrial(baseCase, evidence());
    assert.equal(score.oraclePassed, true);
    assert.equal(score.admittedRuns, 1);
    assert.equal(score.rootToolCalls, 2);
    assert.equal(score.argumentRejections, 1);
  });
  it("still counts an admitted failure and a second new run as two runs", () => {
    const trace = traced();
    trace.toolCalls[1].result.data.run.state = { status: "error", outcome: "failed" };
    trace.toolCalls.push({ name: "external_delegate", args: {}, result: {
      ok: true, data: { run: { runId: "run_retry", state: { status: "done" } } },
    } });
    const score = evaluateTrial(baseCase, evidence(trace));
    assert.equal(score.admittedRuns, 2);
    assert.equal(score.oraclePassed, false);
    assert.ok(score.failedChecks.includes("no-extra-external-runs"));
  });
  it("counts a post-admission error envelope with a run ID, irrespective of ok", () => {
    const trace = { toolCalls: [{ name: "external_workflow", args: {},
      result: { ok: false, data: { run: { runId: "wf_failed" } }, error: { code: "run_failed" } } }] };
    assert.equal(invocationCounts(trace).admitted.length, 1);
    assert.equal(invocationCounts(trace).rejected, 0);
  });
  it("does not invent an admission for an unresolved result", () => {
    const trace = traced();
    delete trace.toolCalls[1].result;
    const score = evaluateTrial(baseCase, evidence(trace));
    assert.equal(score.unresolvedInvocations, 1);
    assert.equal(score.admittedRuns, 0);
    assert.ok(score.failedChecks.includes("external-admission-known"));
  });
  it("identifies native validation errors, but not arbitrary tool exceptions, as rejected arguments", () => {
    const events = [
      { type: "tool_execution_start", toolCallId: "native", toolName: "external_delegate", args: {} },
      { type: "tool_execution_end", toolCallId: "native", isError: true,
        result: { content: [{ type: "text", text: "Validation failed for tool external_delegate: description is required" }] } },
    ];
    assert.equal(invocationCounts(parse(events)).argumentRejections, 1);
    events[1].result.content[0].text = "Process disappeared after launch";
    assert.equal(invocationCounts(parse(events)).unresolved, 1);
  });
  it("does not count the same admitted run ID twice", () => {
    const trace = traced(); trace.toolCalls.push(structuredClone(trace.toolCalls[1]));
    assert.equal(invocationCounts(trace).attempts, 3);
    assert.equal(invocationCounts(trace).admitted.length, 1);
  });
});

describe("controlled harness evidence", () => {
  it("disables all other built-in harnesses in the isolated version-5 settings", () => {
    const settings = fixedHarnessSettings("codex", 10000);
    assert.equal(settings.defaultHarness, "codex");
    assert.equal(settings.defaultPermission, "readonly");
    assert.deepEqual(Object.entries(settings.harnesses).filter(([, h]) => h.enabled).map(([name]) => name), ["codex"]);
    assert.equal(harnessControl(evidence()).qualified, true);
  });
  it("keeps task success but does not certify a legacy default-only setup", () => {
    const legacy = evidence(); delete legacy.trialSettings;
    const score = evaluateTrial(baseCase, legacy);
    assert.equal(score.oraclePassed, true);
    assert.equal(score.comparison.configurationRestricted, false);
    assert.ok(score.qualificationBlockers.includes("fixed-harness-comparison-unqualified"));
  });
  it("requires actual receipts to match the selected harness", () => {
    const mixed = evidence(); mixed.summaries[0].harness = "claude";
    const result = harnessControl(mixed);
    assert.equal(result.qualified, false);
    assert.equal(result.unexpectedReceipts[0].harness, "claude");
    delete mixed.summaries[0].harness;
    assert.equal(harnessControl(mixed).unknownReceipts.length, 1);
  });
  it("cannot qualify an admitted direct run without a matching receipt", () => {
    const missing = evidence(); missing.summaries = [];
    assert.equal(harnessControl(missing).qualified, false);
    assert.deepEqual(harnessControl(missing).unbackedRuns, ["run_missing"]);
  });
  it("does not invalidate an entirely local task for an irrelevant child-harness constraint", () => {
    const local = evidence({ toolCalls: [] }); local.summaries = []; delete local.trialSettings;
    assert.equal(harnessControl(local).applicable, false);
    assert.equal(harnessControl(local).qualified, true);
  });
});

describe("retrieval fidelity, source fidelity and cursor visibility", () => {
  const source = "document line with meaningful whitespace\n".repeat(700) + " ";
  function paged(text, visible = false) {
    const events = [], size = Math.ceil(text.length / 8);
    for (let offset = 0, n = 0; offset < text.length; offset += size, n++) {
      const next = offset + size < text.length ? "cursor-" + (n + 1) : null;
      const chunk = text.slice(offset, offset + size);
      events.push({ type: "tool_execution_start", toolCallId: "page-" + n, toolName: "external_runs",
        args: { action: "inspect", view: "final", runIds: ["run_big"], ...(n ? { cursor: "cursor-" + n } : {}) } });
      events.push({ type: "tool_execution_end", toolCallId: "page-" + n, result: {
        content: [{ type: "text", text: chunk + (visible && next ? "\nnextCursor: " + next : "") }],
        details: { view: "final", runId: "run_big" },
        structuredContent: { ok: true, data: { run: { runId: "run_big" }, page: { text: chunk, nextCursor: next } } },
      } });
    }
    return parse(events);
  }
  const receipt = (canonicalText) => [{ file: "run_big/summary.json", runId: "run_big", harness: "codex", status: "done", canonicalText }];
  it("recognizes eight complete pages even when the child omitted one trailing source space", () => {
    const canonical = source.slice(0, -1);
    const result = paginationAssessment(paged(canonical), receipt(canonical), source);
    assert.equal(result.pages, 8);
    assert.equal(result.retrievalFidelity, "matched");
    assert.equal(result.sourceFidelity, "mismatch");
    assert.equal(result.sourceBytes - result.canonicalBytes, 1);
    assert.equal(result.cursorVisibility, "not_established_on_tool_text");
  });
  it("cannot use a correct source snapshot as a substitute for the retained canonical child result", () => {
    assert.equal(paginationAssessment(paged(source), [], source).retrievalFidelity, "unverified");
  });
  it("rejects missing pages and changed page data even if the source markers are intact", () => {
    const missing = paged(source); missing.toolCalls.splice(2, 1);
    assert.equal(paginationAssessment(missing, receipt(source), source).retrievalFidelity, "mismatch");
    const changed = paged(source); changed.toolCalls[1].result.data.page.text += "!";
    assert.equal(paginationAssessment(changed, receipt(source), source).retrievalFidelity, "mismatch");
  });
  it("requires continuation in tool text rather than treating metadata alone as model-visible", () => {
    assert.equal(pageChains(paged(source))[0].modelVisibleContinuation, false);
    assert.equal(pageChains(paged(source, true))[0].modelVisibleContinuation, true);
  });
  it("reports exact-copy failure separately and leaves metadata-only pagination unqualified", () => {
    const canonical = source.slice(0, -1), trace = paged(canonical);
    Object.assign(trace, { final: "retrieved", settled: true, finalStopReason: "stop" });
    const input = evidence(trace); input.summaries = receipt(canonical);
    const testCase = { ...baseCase, files: { "source.txt": source }, expect: { facts: [], requirePagedSource: "source.txt" } };
    const score = evaluateTrial(testCase, input);
    assert.equal(score.automaticChecks.find((c) => c.id === "complete-referenced-output").pass, true);
    assert.equal(score.automaticChecks.find((c) => c.id === "exact-source-copy").pass, false);
    assert.ok(score.qualificationBlockers.includes("model-visible-pagination-unqualified"));
  });
});
