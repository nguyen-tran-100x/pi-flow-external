/** Evidence interpretation for the opt-in playbook trials; no execution or provider calls. */
export const TRIAL_HARNESSES = ["claude", "codex", "agy", "grok", "muse", "opencode"];
const text = (value) => typeof value === "string" && value.trim().length > 0;
const runId = (value) => typeof value === "string" && /^(?:run|wf)_[A-Za-z0-9_-]+$/.test(value);
const envelope = (value) => value && typeof value === "object" && typeof value.ok === "boolean";

// Current Pi preserves the public envelope here. details/content are legacy fallbacks,
// never allowed to override a structuredContent envelope (including a failure).
export function resultEnvelope(result) {
  if (envelope(result?.structuredContent)) return result.structuredContent;
  if (envelope(result?.details)) return result.details;
  for (const part of result?.content ?? []) {
    if (part?.type !== "text") continue;
    try { const value = JSON.parse(part.text); if (envelope(value)) return value; } catch { /* display text */ }
  }
  return null;
}

export function invocationCounts(trace) {
  const attempts = trace.toolCalls.filter((call) => ["external_delegate", "external_workflow"].includes(call.name));
  const admitted = new Map();
  let rejected = 0, argumentRejections = 0, unresolved = 0;
  for (const call of attempts) {
    const run = call.result?.data?.run;
    // A recorded run counts even when it failed after admission. ok alone is not a run ID.
    if (runId(run?.runId)) {
      admitted.set(run.runId, { runId: run.runId, call });
    } else if (call.result?.ok === false && call.result.data?.run === null) {
      rejected++;
      if (call.result.error?.code === "request_invalid") argumentRejections++;
    } else if (call.validationRejected === true) {
      rejected++; argumentRejections++;
    } else {
      // Never silently treat an incomplete/unknown response as either a launch or a rejection.
      unresolved++;
    }
  }
  return { attempts: attempts.length, admitted: [...admitted.values()], rejected, argumentRejections, unresolved };
}

export function fixedHarnessSettings(harness, timeoutMs) {
  if (!TRIAL_HARNESSES.includes(harness)) throw new Error("Unknown trial harness: " + harness);
  return {
    version: 5, defaultHarness: harness, defaultPermission: "readonly",
    maxConcurrentSubagents: 4, subagentTimeoutMs: timeoutMs,
    harnesses: Object.fromEntries(TRIAL_HARNESSES.map((name) => [name, { enabled: name === harness }])),
    disabledHarnesses: TRIAL_HARNESSES.filter((name) => name !== harness),
  };
}

// Assess the recorded availability constraint AND the actual receipts. A default is not a restriction.
// Old bundles can be rescored for task outcomes without silently becoming controlled comparisons.
export function harnessControl(evidence) {
  const expected = evidence.harness;
  const settings = evidence.trialSettings;
  const disabled = new Set(settings?.disabledHarnesses ?? []);
  const onlyExpected = TRIAL_HARNESSES.includes(expected) && settings?.version === 5 &&
    settings.defaultHarness === expected && settings.defaultPermission === "readonly" &&
    TRIAL_HARNESSES.every((name) => name === expected
      ? settings.harnesses?.[name]?.enabled === true && !disabled.has(name)
      : settings.harnesses?.[name]?.enabled === false && disabled.has(name)) &&
    Object.keys(settings.harnesses ?? {}).every((name) => TRIAL_HARNESSES.includes(name)) &&
    Object.keys(settings.exact ?? {}).length === 0;
  const receipts = evidence.summaries.filter((item) => item.runId?.startsWith("run_") ||
    !item.file.split(/[\\/]/).some((part) => part.startsWith("wf_")));
  const unknown = receipts.filter((item) => !text(item.harness)).map((item) => item.runId ?? item.file);
  const unexpected = receipts.filter((item) => text(item.harness) && item.harness !== expected)
    .map((item) => ({ runId: item.runId ?? item.file, harness: item.harness }));
  const unbackedRuns = invocationCounts(evidence.trace).admitted.filter((entry) =>
    entry.runId.startsWith("run_") && !receipts.some((item) => item.runId === entry.runId))
    .map((entry) => entry.runId);
  const selected = [...new Set(receipts.map((item) => item.harness).filter(text))];
  const applicable = receipts.length > 0 || invocationCounts(evidence.trace).attempts > 0;
  return {
    expected: expected ?? null, observed: selected, applicable,
    configurationRestricted: Boolean(onlyExpected), unknownReceipts: unknown, unexpectedReceipts: unexpected, unbackedRuns,
    qualified: !applicable || Boolean(onlyExpected && unknown.length === 0 && unexpected.length === 0 && unbackedRuns.length === 0),
  };
}

// Page linkage is assessed independently of what the child ought to have copied.
export function pageChains(trace) {
  const groups = new Map();
  for (const call of trace.toolCalls) {
    if (call.name !== "external_runs" || call.args?.action !== "inspect" || call.args?.view !== "final" ||
        call.result?.ok !== true || call.args?.runIds?.length !== 1) continue;
    const id = call.args.runIds[0], page = call.result.data?.page;
    if (!runId(id) || !page || typeof page.text !== "string" ||
        (call.result.data.run?.runId && call.result.data.run.runId !== id)) continue;
    if (page.nextCursor !== undefined && page.nextCursor !== null && !text(page.nextCursor)) continue;
    const pages = groups.get(id) ?? [];
    pages.push({ cursor: call.args.cursor ?? null, next: page.nextCursor ?? null, text: page.text,
      visibleText: call.visibleText ?? "" });
    groups.set(id, pages);
  }
  const chains = [];
  for (const [id, pages] of groups) {
    let cursor = null, combined = "", count = 0, complete = false, visible = true;
    const visited = new Set();
    for (const page of pages) {
      if (page.cursor !== cursor || visited.has(cursor)) continue;
      visited.add(cursor); combined += page.text; count++;
      // Do not count a cursor occurring incidentally inside the source payload as continuation guidance.
      if (page.next !== null && !page.visibleText.replace(page.text, "").includes(page.next)) visible = false;
      cursor = page.next;
      if (cursor === null) { complete = true; break; }
    }
    chains.push({ runId: id, pages: count, complete, text: combined,
      bytes: Buffer.byteLength(combined), modelVisibleContinuation: complete && visible });
  }
  return chains;
}

// Preserve the existing pure linkage helper for its contract tests.
export function completePagedResult(trace, expectedText) {
  return pageChains(trace).some((chain) => chain.complete && chain.pages > 1 && chain.bytes > 16384 && chain.text === expectedText);
}

export function paginationAssessment(trace, summaries, sourceText) {
  const assessments = pageChains(trace).map((chain) => {
    const receipt = summaries.find((item) => item.runId === chain.runId && item.status === "done");
    const canonical = typeof receipt?.canonicalText === "string" ? receipt.canonicalText : null;
    return {
      runId: chain.runId, pages: chain.pages, bytes: chain.bytes, complete: chain.complete,
      retrievalFidelity: canonical === null ? "unverified" :
        chain.complete && chain.pages > 1 && chain.bytes > 16384 && chain.text === canonical ? "matched" : "mismatch",
      sourceFidelity: canonical === null ? "unverified" : canonical === sourceText ? "matched" : "mismatch",
      canonicalBytes: canonical === null ? null : Buffer.byteLength(canonical), sourceBytes: Buffer.byteLength(sourceText),
      cursorVisibility: chain.modelVisibleContinuation ? "visible_in_tool_text" : "not_established_on_tool_text",
    };
  });
  // Select one complete retrieved run, not unrelated positive checks from different runs.
  return assessments.find((item) => item.retrievalFidelity === "matched") ?? assessments[0] ?? {
    runId: null, pages: 0, complete: false, retrievalFidelity: "unverified", sourceFidelity: "unverified",
    cursorVisibility: "not_established_on_tool_text",
  };
}
