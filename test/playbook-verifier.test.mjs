import { describe, it } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  behavioralCases, completePagedResult, inventory, parsePiTrace, retainTrialArtifacts, verifyReviewed, verifyTrial,
} from "../scripts/e2e/playbook-behavior.mjs";
import { fixedHarnessSettings } from "../scripts/e2e/playbook-observations.mjs";

// Synthetic artifacts validate the verifier, never claim real-provider qualification.
const scenario = { id: "verifier-fixture", pattern: "parallel-work", goal: "Inspect two source files",
  files: { "a.txt": "FACT-A", "b.txt": "FACT-B" },
  expect: { facts: ["FACT-A", "FACT-B"], minExternalRoots: 1, minChildren: 2 },
  review: ["Are both findings supported?", "Was work usefully divided?"] };
const digest = (text) => createHash("sha256").update(text).digest("hex");
const write = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2));
const events = (calls = true, text = "FACT-A and FACT-B") => [
  ...(calls ? [
    { type: "tool_execution_start", toolCallId: "tool1", toolName: "external_workflow", args: {} },
    { type: "tool_execution_end", toolCallId: "tool1", result: { structuredContent: {
      ok: true, data: { run: { runId: "wf_fixture", kind: "workflow" } },
    } } },
  ] : []),
  { type: "message_end", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text }] } },
  { type: "agent_settled", aborted: false },
].map((event) => JSON.stringify(event)).join("\n");
function seal(dir) {
  write(join(dir, "artifacts.json"), { version: 1, sha256: { sessions: inventory(join(dir, "sessions")), evidence: inventory(join(dir, "evidence")) } });
}
function withBundle(check) {
  const dir = mkdtempSync(join(tmpdir(), "flow-verifier-"));
  try {
    mkdirSync(join(dir, "sessions")); mkdirSync(join(dir, "evidence"));
    writeFileSync(join(dir, "sessions/parent.jsonl"), events());
    writeFileSync(join(dir, "pi-events.jsonl"), events());
    for (const id of ["run_a", "run_b"]) {
      mkdirSync(join(dir, "evidence", id));
      write(join(dir, "evidence", id, "summary.json"), { runId: id, summary: { status: "done", backend: "codex" } });
      writeFileSync(join(dir, "evidence", id, "events.ndjson"), [
        { runId: id, type: "run_started", data: { prompt: "Inspect a source" } },
        { runId: id, type: "run_finished", data: { summary: { status: "done", backend: "codex" } } },
      ].map((event) => JSON.stringify(event)).join("\n"));
    }
    const hashes = Object.fromEntries(Object.entries(scenario.files).map(([name, text]) => [name, digest(text)]));
    const trialSettings = fixedHarnessSettings("codex", 420000);
    write(join(dir, "trial-settings.json"), trialSettings);
    write(join(dir, "process.json"), { version: 2, caseId: scenario.id, caseDigest: digest(JSON.stringify(scenario)),
      harness: "codex", trialSettingsDigest: digest(JSON.stringify(trialSettings)), exitCode: 0, timedOut: false });
    write(join(dir, "fixture-manifest.json"), { caseId: scenario.id, files: scenario.files, sha256: hashes });
    write(join(dir, "fixture-after.json"), hashes);
    write(join(dir, "result.json"), { caseId: scenario.id, oraclePassed: true });
    write(join(dir, "review.json"), { caseId: scenario.id, reviewer: "test reviewer", verdict: "pass",
      criteria: scenario.review.map((question) => ({ question, rating: 2, evidence: "sessions/parent.jsonl and evidence/run_a/events.ndjson" })) });
    seal(dir);
    check(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const load = (dir, file) => JSON.parse(readFileSync(join(dir, file), "utf8"));

describe("behavioral evidence retention", () => {
  it("retains readable sessions, child prompts and results after temporary cleanup, but not credential copies", () => {
    const base = mkdtempSync(join(tmpdir(), "flow-retain-")), scratch = join(base, "scratch"), output = join(base, "retained");
    try {
      for (const name of ["sessions", "evidence/run_child", "agent"]) mkdirSync(join(scratch, name), { recursive: true });
      mkdirSync(output);
      writeFileSync(join(scratch, "sessions/parent.jsonl"), events());
      writeFileSync(join(scratch, "evidence/run_child/events.ndjson"), '{"type":"run_started","data":{"prompt":"inspect ledger"}}\n');
      write(join(scratch, "evidence/run_child/summary.json"), { summary: { status: "done", text: "finding" } });
      write(join(scratch, "agent/auth.json"), { token: "not-exported" });
      write(join(scratch, "sessions/auth.json"), { token: "also-not-exported" });
      retainTrialArtifacts(scratch, output);
      rmSync(scratch, { recursive: true });
      assert.match(readFileSync(join(output, "sessions/parent.jsonl"), "utf8"), /FACT-A/);
      assert.match(readFileSync(join(output, "evidence/run_child/events.ndjson"), "utf8"), /inspect ledger/);
      assert.equal(load(output, "evidence/run_child/summary.json").summary.text, "finding");
      const retained = Object.keys(inventory(output));
      assert.ok(!retained.some((name) => /auth\.json|agent\//.test(name)));
      assert.equal(load(output, "artifacts.json").sha256.sessions["parent.jsonl"], digest(events()));
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});

describe("behavioral verification recomputes current-case evidence", () => {
  it("recomputes a consistent bundle even when its cached pass flag is false or missing", () => withBundle((dir) => {
    write(join(dir, "result.json"), { oraclePassed: false });
    assert.equal(verifyTrial(dir, [scenario]).pass, true);
    rmSync(join(dir, "result.json"));
    assert.equal(verifyTrial(dir, [scenario]).pass, true);
  }));
  for (const [name, mutate, failure] of [
    ["missing comparison settings", (dir) => rmSync(join(dir, "trial-settings.json")), "fixed-harness-comparison-unqualified"],
    ["unexpected child harness", (dir) => {
      const r = load(dir, "evidence/run_a/summary.json"); r.summary.backend = "claude";
      write(join(dir, "evidence/run_a/summary.json"), r); seal(dir);
    }, "fixed-harness-comparison-unqualified"],
    ["missing source facts", (dir) => writeFileSync(join(dir, "pi-events.jsonl"), events(true, "generic answer")), "evidence-coverage"],
    ["missing external calls", (dir) => writeFileSync(join(dir, "pi-events.jsonl"), events(false)), "external-used"],
    ["missing child receipts", (dir) => { rmSync(join(dir, "evidence/run_b"), { recursive: true }); seal(dir); }, "successful-child-evidence"],
    ["deleted retained child log", (dir) => rmSync(join(dir, "evidence/run_a/events.ndjson")), "retained evidence"],
    ["summary without matching events", (dir) => { writeFileSync(join(dir, "evidence/run_a/events.ndjson"), '{}\n'); seal(dir); }, "matching run events"],
    ["empty fixture manifest", (dir) => write(join(dir, "fixture-manifest.json"), {}), "Fixture manifest"],
    ["changed source snapshot", (dir) => { const m = load(dir, "fixture-manifest.json"); m.files["a.txt"] = "other"; write(join(dir, "fixture-manifest.json"), m); }, "Fixture manifest"],
    ["edited workspace after run", (dir) => write(join(dir, "fixture-after.json"), {}), "fixture-unchanged"],
    ["missing retained parent session", (dir) => { rmSync(join(dir, "sessions/parent.jsonl")); seal(dir); }, "parent session"],
    ["mismatched review case", (dir) => { const r = load(dir, "review.json"); r.caseId = "other"; write(join(dir, "review.json"), r); }, "current-case-review"],
    ["mismatched review questions", (dir) => { const r = load(dir, "review.json"); r.criteria[0].question = "Different question"; write(join(dir, "review.json"), r); }, "current-case-review"],
    ["missing criterion", (dir) => { const r = load(dir, "review.json"); r.criteria.pop(); write(join(dir, "review.json"), r); }, "current-case-review"],
    ["stale case definition", (dir) => { const p = load(dir, "process.json"); p.caseDigest = "old"; write(join(dir, "process.json"), p); }, "stale case"],
    ["missing process evidence", (dir) => rmSync(join(dir, "process.json")), "process.json"],
    ["failed process", (dir) => { const p = load(dir, "process.json"); p.exitCode = 1; write(join(dir, "process.json"), p); }, "real-pi-process"],
  ]) {
    it("rejects " + name + " despite a cached success", () => withBundle((dir) => {
      mutate(dir);
      const result = verifyTrial(dir, [scenario]);
      assert.equal(result.pass, false);
      assert.ok(result.failedChecks.some((reason) => reason.includes(failure)), JSON.stringify(result));
    }));
  }
  it("rejects the review's all-cases false-pass reproduction", () => {
    const root = mkdtempSync(join(tmpdir(), "flow-stale-passes-"));
    try {
      for (const scenario of behavioralCases) {
        const dir = join(root, scenario.id); mkdirSync(dir);
        write(join(dir, "result.json"), { caseId: scenario.id, oraclePassed: true, reviewCriteria: ["wrong"] });
        writeFileSync(join(dir, "pi-events.jsonl"), events(false, "nothing verified"));
        write(join(dir, "fixture-manifest.json"), {});
        write(join(dir, "review.json"), { caseId: "wrong", reviewer: "reviewer", verdict: "pass", criteria: [{ question: "wrong", rating: 2, evidence: "claimed" }] });
      }
      const rows = verifyReviewed(root);
      assert.equal(rows.length, behavioralCases.length);
      assert.ok(rows.every((row) => !row.pass));
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});

describe("referenced-result retrieval evidence", () => {
  const text = Array.from({ length: 240 }, (_, n) => "row-" + n + ": " + "source payload ".repeat(12) + "\n").join("");
  function pagedTrace() {
    const data = [], size = 4000;
    for (let offset = 0, n = 0; offset < text.length; offset += size, n++) {
      const id = "inspect-" + n, args = { action: "inspect", view: "final", runIds: ["run_big"], limitBytes: size };
      if (n) args.cursor = "page-" + n;
      data.push({ type: "tool_execution_start", toolCallId: id, toolName: "external_runs", args });
      data.push({ type: "tool_execution_end", toolCallId: id, result: { structuredContent: { ok: true, data: {
        page: { text: text.slice(offset, offset + size), nextCursor: offset + size < text.length ? "page-" + (n + 1) : null },
      } } } });
    }
    return parsePiTrace(data.map((event) => JSON.stringify(event)).join("\n"));
  }
  it("accepts only a full linked multi-page canonical result, not just copied markers", () => {
    assert.equal(completePagedResult(pagedTrace(), text), true);
    const skipped = pagedTrace(); skipped.toolCalls.splice(1, 1);
    assert.equal(completePagedResult(skipped, text), false);
    const short = pagedTrace(); short.toolCalls.pop();
    assert.equal(completePagedResult(short, text), false);
    const differentRun = pagedTrace(); differentRun.toolCalls[1].args.runIds = ["run_other"];
    assert.equal(completePagedResult(differentRun, text), false);
    assert.equal(completePagedResult(pagedTrace(), text + "missing bytes"), false);
  });
});
