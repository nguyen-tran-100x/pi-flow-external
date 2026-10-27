#!/usr/bin/env node
/**
 * Opt-in REAL parent/child agent trials for the orchestration playbook.
 * npm test never launches providers or runs this script. Do not interpret a
 * passed deterministic fixture as a behavioral pass.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync,
  readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifest = JSON.parse(readFileSync(join(root, "test/fixtures/playbook-behavior/scenarios.json"), "utf8"));
export const behavioralCases = manifest.cases;

function usage() {
  return [
    "Opt-in parent+child behavioral trials. Each case may incur model/provider costs.",
    "  node scripts/e2e/playbook-behavior.mjs --list",
    "  node scripts/e2e/playbook-behavior.mjs --selftest",
    "  node scripts/e2e/playbook-behavior.mjs --real --case discovery-unknown --out /tmp/flow-trials",
    "    [--model provider/model] [--thinking high] [--harness codex] [--skill-path /path/to/skill]",
    "    [--agent-dir /path/to/real/pi/agent] [--timeout-ms 420000]",
    "  node scripts/e2e/playbook-behavior.mjs --verify /tmp/flow-trials",
    "",
    "An automatic oracle PASS only means test evidence is ready for human review.",
    "The --verify command requires reviewed ratings for EVERY selected case.",
    "The isolated agent directory mirrors root authentication in temporary files and is deleted on exit.",
    "Review exported transcripts privately: they may contain sensitive prompts and source material.",
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
    } catch { /* stderr and non-event lines are not evidence */ }
  }
  const calls = new Map();
  const assistantTexts = [];
  const assistantMessages = [];
  for (const event of events) {
    if (event.type === "tool_execution_start") {
      const id = String(event.toolCallId ?? event.toolCall?.id ?? "uncategorized-" + calls.size);
      calls.set(id, {
        name: String(event.toolName ?? event.tool?.name ?? "unknown"),
        args: event.args ?? event.arguments ?? {},
      });
    }
    // Root assistant text must come from a completed message, not from the user's prompt.
    if (event.type === "message_end" && event.message?.role === "assistant") {
      const parts = Array.isArray(event.message.content) ? event.message.content : [];
      const text = parts.filter((part) => part?.type === "text" && typeof part.text === "string")
        .map((part) => part.text).join("\n");
      if (text.trim()) assistantTexts.push(text);
      assistantMessages.push(event.message);
    }
  }
  const settlements = events.filter((event) => event.type === "agent_settled");
  const lastSettlement = settlements.at(-1);
  const readPaths = [...calls.values()].filter((call) => call.name === "read").map((call) =>
    String(call.args?.path ?? call.args?.file_path ?? call.args?.filePath ?? ""));
  return {
    events: events.length, toolCalls: [...calls.values()], final: assistantTexts.at(-1) ?? "",
    settled: Boolean(lastSettlement && lastSettlement.aborted === false),
    finalStopReason: assistantMessages.at(-1)?.stopReason ?? null,
    readPaths, patternGuidesRead: readPaths.filter((name) => name.includes("/patterns/") && name.endsWith(".md")),
  };
}

function sha(text) { return createHash("sha256").update(text).digest("hex"); }
function inventory(dir) {
  const out = {};
  function visit(current) {
    for (const ent of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, ent.name);
      if (ent.isSymbolicLink()) throw new Error("Fixture symlinks are not permitted");
      if (ent.isDirectory()) visit(full);
      else if (ent.isFile()) out[relative(dir, full).split(sep).join("/")] = sha(readFileSync(full));
    }
  }
  visit(dir);
  return out;
}

function evidenceSummaries(dir) {
  const summaries = [];
  if (!existsSync(dir)) return summaries;
  function visit(current) {
    for (const ent of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, ent.name);
      if (ent.isDirectory()) visit(full);
      else if (ent.name === "summary.json") {
        try {
          const data = JSON.parse(readFileSync(full, "utf8"));
          summaries.push({ file: relative(dir, full), status: data.summary?.status ?? "unknown" });
        } catch {
          summaries.push({ file: relative(dir, full), status: "invalid" });
        }
      }
    }
  }
  visit(dir);
  return summaries;
}

export function evaluateTrial(testCase, evidence) {
  const observed = evidence.trace;
  const roots = observed.toolCalls.filter((call) => ["external_delegate", "external_workflow"].includes(call.name));
  const children = evidence.summaries.filter((summary) => !summary.file.startsWith("wf_"));
  const successfulChildren = children.filter((summary) => summary.status === "done");
  const facts = testCase.expect.facts.map((token) => ({
    token, present: observed.final.includes(token),
  }));
  const exp = testCase.expect;
  const checks = [
    { id: "real-pi-process", pass: evidence.exitCode === 0 && !evidence.timedOut && observed.events > 0 },
    { id: "agent-settled", pass: observed.settled === true && !["error", "aborted"].includes(observed.finalStopReason) },
    { id: "assistant-completed", pass: observed.final.length > 0 },
    { id: "evidence-coverage", pass: facts.every((fact) => fact.present), detail: facts },
    { id: "fixture-unchanged", pass: JSON.stringify(evidence.before) === JSON.stringify(evidence.after) },
  ];
  if (exp.minExternalRoots !== undefined) checks.push({ id: "external-used", pass: roots.length >= exp.minExternalRoots });
  if (exp.maxExternalRoots !== undefined) checks.push({ id: "no-extra-external-runs", pass: roots.length <= exp.maxExternalRoots });
  if (exp.minChildren !== undefined) checks.push({
    id: "successful-child-evidence", pass: successfulChildren.length >= exp.minChildren,
  });
  if (exp.requireBackground) {
    checks.push({ id: "background-invocation", pass: roots.some((call) => call.args?.background === true) });
    checks.push({ id: "no-immediate-wait", pass: !observed.toolCalls.some((call) =>
      call.name === "external_runs" && call.args?.action === "wait") });
    checks.push({ id: "handle-reported", pass: /\b(?:run|wf)_[A-Za-z0-9_-]+\b/.test(observed.final) });
  }
  const failed = checks.filter((check) => !check.pass).map((check) => check.id);
  return {
    caseId: testCase.id, pattern: testCase.pattern, automaticChecks: checks,
    oraclePassed: failed.length === 0, failedChecks: failed,
    childReceipts: children.length, successfulChildReceipts: successfulChildren.length,
    rootToolCalls: roots.length, patternGuidesRead: observed.patternGuidesRead,
    // An actual provider and a passed output oracle are necessary but never sufficient.
    behavioralStatus: failed.length ? "failed-oracle" : "awaiting-independent-review",
    reviewCriteria: testCase.review,
  };
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
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

function commandPresent(name) {
  return spawnSync("which", [name], { stdio: "ignore" }).status === 0;
}
async function spawnCaptured(command, argv, options) {
  return await new Promise((done) => {
    const proc = spawn(command, argv, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "", timedOut = false, resolved = false;
    let forceKill;
    const timeout = setTimeout(() => {
      timedOut = true; proc.kill("SIGTERM");
      forceKill = setTimeout(() => proc.kill("SIGKILL"), 3000);
      forceKill.unref();
    }, options.timeoutMs);
    const finish = (result) => {
      if (resolved) return; resolved = true; clearTimeout(timeout);
      if (forceKill) clearTimeout(forceKill);
      done({ ...result, stdout, stderr, timedOut });
    };
    proc.stdout.on("data", (buf) => { stdout += buf.toString(); if (stdout.length > 64 * 1024 * 1024) proc.kill("SIGTERM"); });
    proc.stderr.on("data", (buf) => { stderr += buf.toString(); if (stderr.length > 8 * 1024 * 1024) proc.kill("SIGTERM"); });
    proc.on("error", (error) => finish({ exitCode: -1, spawnError: error.message }));
    proc.on("close", (exitCode, signal) => finish({ exitCode, signal }));
  });
}

async function runReal(testCase, options, output) {
  if (!commandPresent("pi")) throw new Error("Missing real pi CLI; run --selftest for local checks only");
  if (!commandPresent(options.harness)) throw new Error("Missing external CLI " + options.harness);
  if (!["codex", "claude", "grok", "muse"].includes(options.harness)) {
    throw new Error("This trial requires a harness with enforceable readonly access");
  }
  const agentRoot = resolve(options.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent"));
  const scratch = mkdtempSync(join(tmpdir(), "flow-playbook-live-"));
  chmodSync(scratch, 0o700);
  const workspace = join(scratch, "fixture"), agent = join(scratch, "agent");
  const sessions = join(scratch, "sessions"), evidence = join(scratch, "evidence");
  mkdirSync(agent, { recursive: true }); mkdirSync(sessions); mkdirSync(evidence);
  let report;
  try {
    createFixture(workspace, testCase.files);
    const before = inventory(workspace);
    // Source credentials are never changed; ephemeral copies are removed in finally.
    for (const name of ["auth.json", "models.json"]) {
      const from = join(agentRoot, name);
      if (existsSync(from)) {
        copyFileSync(from, join(agent, name));
        chmodSync(join(agent, name), 0o600);
      }
    }
    const skill = resolve(options.skillPath ?? join(root, "skills/pi-flow-orchestration"));
    if (!existsSync(join(skill, "SKILL.md"))) throw new Error("Skill not found: " + skill);
    mkdirSync(join(agent, "skills"), { recursive: true });
    cpSync(skill, join(agent, "skills/pi-flow-orchestration"), { recursive: true });
    const settings = join(agent, "pi-flow-external/settings.json");
    mkdirSync(dirname(settings), { recursive: true });
    writeFileSync(settings, JSON.stringify({
      version: 5, defaultHarness: options.harness, defaultPermission: "readonly",
      maxConcurrentSubagents: 4, subagentTimeoutMs: options.timeoutMs,
    }));
    const prompt = [
      "You are working in this isolated test project: " + workspace,
      "Complete the user's task with the tools and resources available to you.",
      "Use appropriate external help when helpful; do not invent files or claim success without evidence.",
      "Do not edit any files. Report source IDs and missing evidence where asked.",
      "",
      testCase.goal,
    ].join("\n");
    const promptFile = join(scratch, "request.txt");
    writeFileSync(promptFile, prompt);
    const argv = [
      "-p", "--mode", "json", "--model", options.model, "--thinking", options.thinking,
      "--session-dir", sessions, "--no-extensions", "--extension", join(root, "index.ts"),
      "--no-prompt-templates", "--no-themes", "--no-context-files",
      "--tools", "read,ls,find,grep,external_delegate,external_workflow,external_runs,external_help",
      "--approve", "@" + promptFile,
    ];
    const proc = await spawnCaptured("pi", argv, {
      cwd: workspace, timeoutMs: options.timeoutMs,
      env: { ...process.env, PI_CODING_AGENT_DIR: agent, PI_FLOW_EXTERNAL_RUNS_DIR: evidence },
    });
    const trace = parsePiTrace(proc.stdout);
    const summaries = evidenceSummaries(evidence);
    report = {
      testCase: testCase.id, pattern: testCase.pattern, version: 1, model: options.model,
      harness: options.harness, skillPath: skill, exitCode: proc.exitCode,
      spawnError: proc.spawnError ?? null, timedOut: proc.timedOut, signal: proc.signal ?? null,
      before, after: inventory(workspace), trace, summaries,
    };
    const score = evaluateTrial(testCase, report);
    const runDir = join(output, testCase.id + "-" + randomUUID().slice(0, 8));
    mkdirSync(runDir, { recursive: true });
    writeFileSync(join(runDir, "result.json"), JSON.stringify({ ...score, testedAt: new Date().toISOString(), report }, null, 2));
    writeFileSync(join(runDir, "pi-events.jsonl"), proc.stdout);
    writeFileSync(join(runDir, "pi-stderr.log"), proc.stderr);
    writeFileSync(join(runDir, "review.json"), JSON.stringify({
      caseId: testCase.id, reviewer: null,
      criteria: testCase.review.map((question) => ({ question, rating: null, evidence: null })),
      verdict: "unreviewed", notes: "",
    }, null, 2));
    return { caseId: testCase.id, runDir, score };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function verifyReviewed(output) {
  const rows = [];
  for (const dir of readdirSync(output, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const resultPath = join(output, dir.name, "result.json");
    const reviewPath = join(output, dir.name, "review.json");
    if (!existsSync(resultPath) || !existsSync(reviewPath)) continue;
    const saved = JSON.parse(readFileSync(resultPath, "utf8"));
    const review = JSON.parse(readFileSync(reviewPath, "utf8"));
    const pass = saved.oraclePassed && existsSync(join(output, dir.name, "pi-events.jsonl")) &&
      behavioralCases.some((item) => item.id === saved.caseId) &&
      review.verdict === "pass" &&
      typeof review.reviewer === "string" && review.reviewer.trim().length > 0 &&
      review.criteria.length === saved.reviewCriteria.length &&
      review.criteria.every((criterion) => Number.isInteger(criterion.rating) && criterion.rating >= 1 &&
        criterion.rating <= 2 && typeof criterion.evidence === "string" && criterion.evidence.trim());
    rows.push({ caseId: saved.caseId, pass, oraclePassed: saved.oraclePassed, verdict: review.verdict });
  }
  return rows;
}

function selftest() {
  if (!Array.isArray(behavioralCases) || behavioralCases.length < 7) throw new Error("Missing behavioral cases");
  const item = behavioralCases.find((c) => c.id === "parallel-known");
  const mock = [
    JSON.stringify({ type: "tool_execution_start", toolCallId: "first", toolName: "external_workflow", args: { background: false } }),
    JSON.stringify({ type: "message_end", message: { role: "assistant", stopReason: "stop", content: [{ type: "text", text: "Evidence CACHE-LOCK-27 and RETRY-WINDOW-81" }] } }),
    JSON.stringify({ type: "agent_settled", aborted: false }),
  ].join("\n");
  const trace = parsePiTrace(mock);
  const evidence = { trace, exitCode: 0, timedOut: false, summaries: [
    { file: "run_a/summary.json", status: "done" }, { file: "run_b/summary.json", status: "done" },
  ], before: { a: "digest" }, after: { a: "digest" } };
  const pass = evaluateTrial(item, evidence);
  if (!pass.oraclePassed || pass.behavioralStatus !== "awaiting-independent-review") throw new Error("Expected a review-needed oracle success");
  evidence.after.a = "tampered";
  const fail = evaluateTrial(item, evidence);
  if (fail.oraclePassed || !fail.failedChecks.includes("fixture-unchanged")) throw new Error("Tampering must fail");
  if (parsePiTrace('{"type":"message_end","message":{"role":"user","content":[{"type":"text","text":"fake pass"}]}}').final) {
    throw new Error("User prompts must never count as assistant evidence");
  }
  console.log("Selftest passed: real-event-only parsing, oracle coverage, manual-review hold, tamper rejection.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(usage()); return; }
  if (options.list) {
    for (const item of behavioralCases) console.log(item.id + " (" + item.pattern + "): " + item.review[0]);
    return;
  }
  if (options.selftest) { selftest(); return; }
  if (options.verify) {
    const rows = verifyReviewed(resolve(options.verify));
    for (const row of rows) console.log(JSON.stringify(row));
    const expected = new Set(behavioralCases.map((item) => item.id));
    const observed = new Set(rows.map((row) => row.caseId));
    if (rows.length !== behavioralCases.length || observed.size !== expected.size ||
        [...expected].some((id) => !observed.has(id)) || rows.some((row) => !row.pass)) {
      throw new Error("Behavioral suite unqualified: each unique case needs real oracle evidence and independent review");
    }
    console.log("PASS: all behavioral cases independently reviewed");
    return;
  }
  if (!options.real || !options.out || !options.case) throw new Error("Use --real --out DIR --case ID (or --case all). Run --help.");
  const selected = options.case === "all" ? behavioralCases : behavioralCases.filter((item) => item.id === options.case);
  if (!selected.length) throw new Error("Unknown case " + options.case);
  const output = resolve(options.out);
  mkdirSync(output, { recursive: true });
  let failed = false;
  for (const item of selected) {
    const result = await runReal(item, options, output);
    console.log(JSON.stringify({ caseId: item.id, oraclePassed: result.score.oraclePassed,
      behavioralStatus: result.score.behavioralStatus, evidence: result.runDir }));
    if (!result.score.oraclePassed) failed = true;
  }
  if (failed) process.exitCode = 1;
  else console.log("Automated oracles passed. Not certified: complete review.json with evidence, then run --verify.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error("Playbook trial failed: " + error.message); process.exitCode = 1; });
}
