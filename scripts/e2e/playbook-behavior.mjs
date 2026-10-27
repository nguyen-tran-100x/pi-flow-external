#!/usr/bin/env node
/** Opt-in real parent/child trials. Offline tests and saved verdicts are not live qualification. */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { largeOutputCase } from "../../test/fixtures/playbook-behavior/large-output.mjs";
import { resultEnvelope, invocationCounts, fixedHarnessSettings, harnessControl, paginationAssessment } from "./playbook-observations.mjs";
export { completePagedResult } from "./playbook-observations.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(join(root, "test/fixtures/playbook-behavior/scenarios.json"), "utf8"));
export const behavioralCases = [...manifest.cases, largeOutputCase].map((item) =>
  ["parallel-known", "pipeline-evidence", "discovery-unknown", "discovery-child-decomposition"].includes(item.id)
    ? { ...item, review: [...item.review,
      "Before coordinated work, did the parent explain assignments, order, allowed changes and deliverable, and use meaningful phase progress without inventing an approval gate?"] }
    : item);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const readJSON = (path) => JSON.parse(readFileSync(path, "utf8"));
const writeJSON = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
const nonempty = (value) => typeof value === "string" && value.trim().length > 0;

function usage() {
  return [
    "Opt-in parent+child behavioral trials. Each real case may incur provider costs.",
    "  node scripts/e2e/playbook-behavior.mjs --list | --selftest",
    "  node scripts/e2e/playbook-behavior.mjs --real --case discovery-unknown --out /tmp/flow-trials",
    "    [--model provider/model] [--thinking high] [--harness codex] [--skill-path /path/to/skill]",
    "    [--agent-dir /path/to/real/pi/agent] [--timeout-ms 420000]",
    "  node scripts/e2e/playbook-behavior.mjs --verify /tmp/flow-trials",
    "An oracle pass still requires independent review. --verify recomputes current-case checks.",
    "Retained sessions/evidence are private; credential directories are never exported.",
    "Old evidence bundles without retained artifacts are unqualified; rerun, do not migrate pass flags.",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { model: "openai-codex/gpt-5.6-sol", thinking: "high", harness: "codex", timeoutMs: 420000 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (["--list", "--selftest", "--real"].includes(arg)) options[arg.slice(2)] = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (["--case", "--out", "--model", "--thinking", "--harness", "--skill-path", "--agent-dir", "--timeout-ms", "--verify"].includes(arg)) {
      if (!argv[i + 1]) throw new Error(arg + " requires a value");
      options[arg.slice(2).replace(/-([a-z])/g, (_m, x) => x.toUpperCase())] = argv[++i];
    } else throw new Error("Unknown option " + arg);
  }
  options.timeoutMs = Number(options.timeoutMs);
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1000) throw new Error("Invalid timeout");
  return options;
}

export function parsePiTrace(raw) {
  const events = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line);
      if (event && typeof event === "object" && typeof event.type === "string") events.push(event);
    } catch { /* non-event lines are not evidence */ }
  }
  const calls = new Map(), assistantTexts = [], assistantMessages = [];
  for (const event of events) {
    if (event.type === "tool_execution_start") {
      calls.set(String(event.toolCallId ?? "unidentified-" + calls.size), {
        name: String(event.toolName ?? "unknown"), args: event.args ?? {},
      });
    }
    if (event.type === "tool_execution_end" && calls.has(String(event.toolCallId))) {
      const call = calls.get(String(event.toolCallId));
      call.result = resultEnvelope(event.result);
      call.visibleText = (event.result?.content ?? []).filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text).join("\n");
      // Native schema errors can precede Flow's envelope. Other unclassified errors stay unknown.
      call.validationRejected = !call.result && (event.result?.details?.code === "request_invalid" ||
        ((event.isError === true || event.result?.isError === true) &&
          /^(?:Error: )?(?:Validation failed for tool|Invalid arguments for tool)\b/.test(call.visibleText)));
    }
    if (event.type === "message_end" && event.message?.role === "assistant") {
      const text = (Array.isArray(event.message.content) ? event.message.content : [])
        .filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text).join("\n");
      if (text.trim()) assistantTexts.push(text);
      assistantMessages.push(event.message);
    }
  }
  const lastSettlement = events.filter((event) => event.type === "agent_settled").at(-1);
  const readPaths = [...calls.values()].filter((call) => call.name === "read")
    .map((call) => String(call.args?.path ?? call.args?.file_path ?? call.args?.filePath ?? ""));
  return {
    events: events.length, toolCalls: [...calls.values()], final: assistantTexts.at(-1) ?? "",
    settled: Boolean(lastSettlement && lastSettlement.aborted === false),
    finalStopReason: assistantMessages.at(-1)?.stopReason ?? null,
    readPaths, patternGuidesRead: readPaths.filter((name) => name.includes("/patterns/") && name.endsWith(".md")),
  };
}

export function inventory(dir) {
  const out = {};
  function visit(current) {
    if (!lstatSync(current).isDirectory()) throw new Error("Expected an artifact directory");
    for (const ent of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(current, ent.name);
      if (ent.isSymbolicLink()) throw new Error("Artifact symlinks are not permitted");
      if (ent.isDirectory()) visit(full);
      else if (ent.isFile()) out[relative(dir, full).split(sep).join("/")] = sha(readFileSync(full));
    }
  }
  visit(dir);
  return out;
}

function evidenceSummaries(dir) {
  return Object.keys(inventory(dir)).filter((name) => basename(name) === "summary.json").map((file) => {
    const record = readJSON(join(dir, file));
    const summary = record.summary;
    if (!summary || !nonempty(summary.status)) throw new Error("Invalid child summary: " + file);
    const events = readFileSync(join(dir, dirname(file), "events.ndjson"), "utf8").trim()
      .split("\n").map((line) => JSON.parse(line));
    if (!nonempty(record.runId) || basename(dirname(file)) !== record.runId ||
        !events.some((event) => event.runId === record.runId && event.type === "run_started") ||
        !events.some((event) => event.runId === record.runId && event.type === "run_finished")) {
      throw new Error("Child summary lacks matching run events: " + file);
    }
    const launch = events.find((event) => event.type === "launch_resolved")?.data?.configuration;
    return { file, runId: record.runId, status: summary.status,
      harness: launch?.harness ?? record.metadata?.harness ?? summary.harness ?? summary.backend ?? null,
      canonicalText: typeof summary.result === "string" ? summary.result : null };
  });
}

// Allowlist the two evidence roots, never the credential-bearing agent directory.
// Contents may still be sensitive; this is retention, not a transcript secret scrubber.
export function retainTrialArtifacts(scratch, runDir) {
  const hashes = {};
  const excluded = new Set(["auth.json", "models.json", ".credentials.json", "credentials.json"]);
  for (const kind of ["sessions", "evidence"]) {
    const source = join(scratch, kind), dest = join(runDir, kind);
    if (!lstatSync(source).isDirectory()) throw new Error("Missing artifact directory: " + kind);
    mkdirSync(dest, { recursive: true, mode: 0o700 });
    for (const file of Object.keys(inventory(source))) {
      if (file.split("/").some((part) => excluded.has(part) || part === ".env")) continue;
      const output = join(dest, file);
      mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
      copyFileSync(join(source, file), output);
      chmodSync(output, 0o600);
    }
    hashes[kind] = inventory(dest);
  }
  writeJSON(join(runDir, "artifacts.json"), { version: 1, sha256: hashes });
  return hashes;
}

export function evaluateTrial(testCase, evidence) {
  const observed = evidence.trace;
  const invocations = invocationCounts(observed);
  const roots = invocations.admitted.map((entry) => entry.call);
  const children = evidence.summaries.filter((summary) => !summary.file.split(/[\\/]/).some((part) => part.startsWith("wf_")));
  const successfulChildren = children.filter((summary) => summary.status === "done");
  const facts = testCase.expect.facts.map((token) => ({ token, present: observed.final.includes(token) }));
  const exp = testCase.expect;
  const checks = [
    { id: "real-pi-process", pass: evidence.exitCode === 0 && evidence.timedOut === false && observed.events > 0 },
    { id: "agent-settled", pass: observed.settled === true && !["error", "aborted"].includes(observed.finalStopReason) },
    { id: "assistant-completed", pass: observed.final.length > 0 },
    { id: "evidence-coverage", pass: facts.every((fact) => fact.present), detail: facts },
    { id: "fixture-unchanged", pass: isDeepStrictEqual(evidence.before, evidence.after) },
  ];
  checks.push({ id: "external-admission-known", pass: invocations.unresolved === 0 });
  if (exp.minExternalRoots !== undefined) checks.push({ id: "external-used", pass: roots.length >= exp.minExternalRoots });
  if (exp.maxExternalRoots !== undefined) checks.push({ id: "no-extra-external-runs", pass: roots.length <= exp.maxExternalRoots });
  if (exp.minChildren !== undefined) checks.push({ id: "successful-child-evidence", pass: successfulChildren.length >= exp.minChildren });
  const pagination = exp.requirePagedSource
    ? paginationAssessment(observed, evidence.summaries, testCase.files[exp.requirePagedSource]) : null;
  if (pagination) {
    checks.push({ id: "complete-referenced-output", pass: pagination.retrievalFidelity === "matched" });
    checks.push({ id: "exact-source-copy", pass: pagination.sourceFidelity === "matched" });
  }
  if (exp.requireBackground) {
    checks.push({ id: "background-invocation", pass: roots.some((call) => call.args?.background === true) });
    checks.push({ id: "no-immediate-wait", pass: !observed.toolCalls.some((call) => call.name === "external_runs" && call.args?.action === "wait") });
    checks.push({ id: "handle-reported", pass: /\b(?:run|wf)_[A-Za-z0-9_-]+\b/.test(observed.final) });
  }
  const failed = checks.filter((check) => !check.pass).map((check) => check.id);
  const comparison = harnessControl(evidence);
  const qualificationBlockers = [
    ...(comparison.qualified ? [] : ["fixed-harness-comparison-unqualified"]),
    ...(pagination && pagination.cursorVisibility !== "visible_in_tool_text" ? ["model-visible-pagination-unqualified"] : []),
  ];
  return {
    caseId: testCase.id, pattern: testCase.pattern, automaticChecks: checks,
    oraclePassed: failed.length === 0, failedChecks: failed,
    childReceipts: children.length, successfulChildReceipts: successfulChildren.length,
    rootToolCalls: invocations.attempts, admittedRuns: roots.length,
    admittedRunIds: invocations.admitted.map((entry) => entry.runId),
    rejectedInvocations: invocations.rejected, argumentRejections: invocations.argumentRejections,
    unresolvedInvocations: invocations.unresolved, patternGuidesRead: observed.patternGuidesRead,
    comparison, pagination, qualificationBlockers,
    behavioralStatus: failed.length ? "failed-oracle" : "awaiting-independent-review", reviewCriteria: testCase.review,
  };
}

// Rebuild from current case + retained files; result.json is a cache, never a pass authority.
export function verifyTrial(runDir, cases = behavioralCases) {
  let caseId = null;
  try {
    const processRecord = readJSON(join(runDir, "process.json"));
    caseId = processRecord.caseId;
    const testCase = cases.find((item) => item.id === caseId);
    if (!testCase || processRecord.version !== 2 || processRecord.caseDigest !== sha(JSON.stringify(testCase))) {
      throw new Error("Unknown or stale case definition; rerun against current scenarios");
    }
    const fixture = readJSON(join(runDir, "fixture-manifest.json"));
    const expected = Object.fromEntries(Object.entries(testCase.files).map(([name, value]) => [name, sha(value)]));
    if (fixture.caseId !== caseId || !isDeepStrictEqual(fixture.files, testCase.files) ||
        !isDeepStrictEqual(fixture.sha256, expected)) throw new Error("Fixture manifest does not match the current case");
    const after = readJSON(join(runDir, "fixture-after.json"));
    const artifacts = readJSON(join(runDir, "artifacts.json"));
    if (artifacts.version !== 1) throw new Error("Unknown artifact format");
    for (const kind of ["sessions", "evidence"]) {
      if (!isDeepStrictEqual(artifacts.sha256?.[kind], inventory(join(runDir, kind)))) {
        throw new Error("Missing or changed retained " + kind + " artifacts");
      }
    }
    if (!Object.keys(artifacts.sha256.sessions).some((name) => name.endsWith(".jsonl"))) {
      throw new Error("No retained parent session");
    }
    const trace = parsePiTrace(readFileSync(join(runDir, "pi-events.jsonl"), "utf8"));
    const settingsPath = join(runDir, "trial-settings.json");
    const trialSettings = existsSync(settingsPath) ? readJSON(settingsPath) : null;
    if (trialSettings && processRecord.trialSettingsDigest !== sha(JSON.stringify(trialSettings))) {
      throw new Error("Trial settings snapshot does not match process record");
    }
    const score = evaluateTrial(testCase, {
      ...processRecord, trialSettings, trace, summaries: evidenceSummaries(join(runDir, "evidence")), before: expected, after,
    });
    const review = readJSON(join(runDir, "review.json"));
    const reviewOK = review.caseId === caseId && review.verdict === "pass" && nonempty(review.reviewer) &&
      Array.isArray(review.criteria) && review.criteria.length === testCase.review.length &&
      review.criteria.every((criterion, index) => criterion?.question === testCase.review[index] &&
        Number.isInteger(criterion.rating) && criterion.rating >= 1 && criterion.rating <= 2 && nonempty(criterion.evidence));
    return { ...score, caseId, pass: score.oraclePassed && reviewOK && score.qualificationBlockers.length === 0,
      failedChecks: [...score.failedChecks, ...score.qualificationBlockers, ...(reviewOK ? [] : ["current-case-review"])],
      verdict: review.verdict };
  } catch (error) {
    return { caseId, pass: false, oraclePassed: false, failedChecks: [String(error.message || error)] };
  }
}

export function verifyReviewed(output, cases = behavioralCases) {
  return readdirSync(output, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => ({ directory: entry.name, ...verifyTrial(join(output, entry.name), cases) }));
}

function ensureFixturePath(base, name) {
  if (typeof name !== "string" || isAbsolute(name)) throw new Error("Invalid fixture name");
  const full = resolve(base, name);
  if (!full.startsWith(base + sep)) throw new Error("Fixture escapes its temporary workspace");
  return full;
}
function createFixture(dir, files) {
  mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const full = ensureFixturePath(dir, name);
    mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, content);
  }
}
function commandPresent(name) { return spawnSync("which", [name], { stdio: "ignore" }).status === 0; }
async function spawnCaptured(command, argv, options) {
  return await new Promise((done) => {
    const proc = spawn(command, argv, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false, resolved = false, forceKill;
    const timeout = setTimeout(() => {
      timedOut = true; proc.kill("SIGTERM"); forceKill = setTimeout(() => proc.kill("SIGKILL"), 3000); forceKill.unref();
    }, options.timeoutMs);
    const finish = (result) => {
      if (resolved) return; resolved = true; clearTimeout(timeout); if (forceKill) clearTimeout(forceKill);
      done({ ...result, stdout, stderr, timedOut });
    };
    proc.stdout.on("data", (buf) => { stdout += buf.toString(); if (stdout.length > 64 * 1024 * 1024) proc.kill("SIGTERM"); });
    proc.stderr.on("data", (buf) => { stderr += buf.toString(); if (stderr.length > 8 * 1024 * 1024) proc.kill("SIGTERM"); });
    proc.on("error", (error) => finish({ exitCode: -1, spawnError: error.message }));
    proc.on("close", (exitCode, signal) => finish({ exitCode, signal }));
  });
}

async function runReal(testCase, options, output) {
  if (!commandPresent("pi")) throw new Error("Missing real pi CLI; --selftest does not qualify real behavior");
  if (!commandPresent(options.harness)) throw new Error("Missing external CLI " + options.harness);
  if (!["codex", "claude", "grok", "muse"].includes(options.harness)) throw new Error("Trial requires a harness supporting the readonly tier");
  const agentRoot = resolve(options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"));
  const scratch = mkdtempSync(join(tmpdir(), "flow-playbook-live-")); chmodSync(scratch, 0o700);
  const workspace = join(scratch, "fixture"), agent = join(scratch, "agent"), sessions = join(scratch, "sessions"), evidence = join(scratch, "evidence");
  const runDir = join(output, testCase.id + "-" + randomUUID().slice(0, 8));
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  mkdirSync(agent, { recursive: true }); mkdirSync(sessions); mkdirSync(evidence);
  try {
    createFixture(workspace, testCase.files);
    const before = inventory(workspace);
    for (const name of ["auth.json", "models.json"]) {
      const from = join(agentRoot, name);
      if (existsSync(from)) { copyFileSync(from, join(agent, name)); chmodSync(join(agent, name), 0o600); }
    }
    const skill = resolve(options.skillPath ?? join(root, "skills/pi-flow-orchestration"));
    if (!existsSync(join(skill, "SKILL.md"))) throw new Error("Skill not found: " + skill);
    mkdirSync(join(agent, "skills"), { recursive: true }); cpSync(skill, join(agent, "skills/pi-flow-orchestration"), { recursive: true });
    const settings = join(agent, "pi-flow-external/settings.json"); mkdirSync(dirname(settings), { recursive: true });
    const trialSettings = fixedHarnessSettings(options.harness, options.timeoutMs);
    writeJSON(settings, trialSettings);
    writeJSON(join(runDir, "trial-settings.json"), trialSettings);
    const prompt = [
      "You are working in this isolated test project: " + workspace,
      "Complete the user's task with the tools and resources available to you.",
      "Use appropriate external help when helpful; do not invent files or claim success without evidence.",
      "Do not edit any files. Report source IDs and missing evidence where asked.", "", testCase.goal,
    ].join("\n");
    const promptFile = join(scratch, "request.txt"); writeFileSync(promptFile, prompt);
    const argv = ["-p", "--mode", "json", "--model", options.model, "--thinking", options.thinking,
      "--session-dir", sessions, "--no-extensions", "--extension", join(root, "index.ts"),
      "--no-prompt-templates", "--no-themes", "--no-context-files",
      "--tools", "read,ls,find,grep,external_delegate,external_workflow,external_runs,external_help", "--approve", "@" + promptFile];
    const proc = await spawnCaptured("pi", argv, {
      cwd: workspace, timeoutMs: options.timeoutMs,
      env: { ...process.env, PI_CODING_AGENT_DIR: agent, PI_FLOW_EXTERNAL_RUNS_DIR: evidence },
    });
    const processRecord = { version: 2, caseId: testCase.id, caseDigest: sha(JSON.stringify(testCase)),
      model: options.model, thinking: options.thinking, harness: options.harness, skillPath: skill,
      trialSettingsDigest: sha(JSON.stringify(trialSettings)),
      exitCode: proc.exitCode, timedOut: proc.timedOut, spawnError: proc.spawnError ?? null, signal: proc.signal ?? null };
    writeJSON(join(runDir, "process.json"), processRecord);
    writeFileSync(join(runDir, "pi-events.jsonl"), proc.stdout, { mode: 0o600 });
    writeFileSync(join(runDir, "pi-stderr.log"), proc.stderr, { mode: 0o600 });
    writeJSON(join(runDir, "fixture-manifest.json"), { caseId: testCase.id, files: testCase.files, sha256: before });
    const after = inventory(workspace); writeJSON(join(runDir, "fixture-after.json"), after);
    const score = evaluateTrial(testCase, { ...processRecord, trialSettings, before, after, trace: parsePiTrace(proc.stdout), summaries: evidenceSummaries(evidence) });
    writeJSON(join(runDir, "result.json"), { ...score, testedAt: new Date().toISOString() });
    writeJSON(join(runDir, "review.json"), { caseId: testCase.id, reviewer: null,
      criteria: testCase.review.map((question) => ({ question, rating: null, evidence: null })), verdict: "unreviewed", notes: "" });
    return { caseId: testCase.id, runDir, score };
  } finally {
    // Retain even failing trials; failure to retain cannot leave credential copies behind.
    try { retainTrialArtifacts(scratch, runDir); }
    finally { rmSync(scratch, { recursive: true, force: true }); }
  }
}

function selftest() {
  if (!Array.isArray(behavioralCases) || behavioralCases.length < 7) throw new Error("Missing behavioral cases");
  const item = behavioralCases.find((c) => c.id === "parallel-known");
  const raw = [
    { type: "tool_execution_start", toolCallId: "first", toolName: "external_workflow", args: {} },
    { type: "tool_execution_end", toolCallId: "first", result: { structuredContent: { ok: true, data: { run: { runId: "wf_selftest" } } } } },
    { type: "message_end", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Evidence CACHE-LOCK-27 and RETRY-WINDOW-81" }] } },
    { type: "agent_settled", aborted: false },
  ].map((event) => JSON.stringify(event)).join("\n");
  const evidence = { trace: parsePiTrace(raw), exitCode: 0, timedOut: false, summaries: [
    { file: "run_a/summary.json", status: "done" }, { file: "run_b/summary.json", status: "done" },
  ], before: { a: "digest" }, after: { a: "digest" } };
  const score = evaluateTrial(item, evidence);
  if (!score.oraclePassed || score.behavioralStatus !== "awaiting-independent-review") throw new Error("Expected review hold");
  evidence.after.a = "changed";
  if (evaluateTrial(item, evidence).oraclePassed) throw new Error("Changed fixture must fail");
  if (parsePiTrace('{"type":"message_end","message":{"role":"user","content":[{"type":"text","text":"fake pass"}]}}').final) throw new Error("User input is not an answer");
  console.log("Selftest passed: output oracles and review hold; synthetic checks do not establish provider provenance.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (options.list) { for (const item of behavioralCases) console.log(item.id + " (" + item.pattern + "): " + item.review[0]); return; }
  if (options.selftest) { selftest(); return; }
  if (options.verify) {
    const rows = verifyReviewed(resolve(options.verify));
    for (const row of rows) console.log(JSON.stringify(row));
    const expected = new Set(behavioralCases.map((item) => item.id)), observed = new Set(rows.map((row) => row.caseId));
    if (rows.length < behavioralCases.length || observed.size !== expected.size ||
        [...expected].some((id) => !observed.has(id)) || rows.some((row) => !row.pass)) throw new Error("Behavioral suite unqualified: every current case needs retained evidence and matching review");
    console.log("PASS: task checks, fixed-harness evidence and matching reviews qualified (not provider attestation)."); return;
  }
  if (!options.real || !options.out || !options.case) throw new Error("Use --real --out DIR --case ID (or --case all). Run --help.");
  const selected = options.case === "all" ? behavioralCases : behavioralCases.filter((item) => item.id === options.case);
  if (!selected.length) throw new Error("Unknown case " + options.case);
  const output = resolve(options.out); mkdirSync(output, { recursive: true, mode: 0o700 });
  let failed = false;
  for (const item of selected) {
    const result = await runReal(item, options, output);
    console.log(JSON.stringify({ caseId: item.id, oraclePassed: result.score.oraclePassed,
      qualificationBlockers: result.score.qualificationBlockers, behavioralStatus: result.score.behavioralStatus, evidence: result.runDir }));
    if (!result.score.oraclePassed) failed = true;
  }
  if (failed) process.exitCode = 1;
  else console.log("Output oracles passed. Complete review.json from retained evidence, then run --verify.");
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error("Playbook trial failed: " + error.message); process.exitCode = 1; });
}
