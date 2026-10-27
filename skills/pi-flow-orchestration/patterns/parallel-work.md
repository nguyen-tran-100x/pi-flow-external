# Parallel work

**Use when:** you already know several useful independent scopes. Examples: inspect three modules, compare alternatives, research distinct sources. For a few unrelated jobs, direct `external_delegate` calls can be simpler; use a workflow for grouped progress, collection or a dependent synthesis.

**Shape:** known scopes → concurrent work → parent combines results (or a useful synthesis child).

## Choose an example

- [parallel-sweep.js](../recipes/parallel-sweep.js) returns separate findings and failed scopes. Inputs: `{ task, scopes: ["..."], harness: "codex" }`.
- [branch-and-converge.js](../recipes/branch-and-converge.js) adds a synthesis child with explicit evidence packets. Inputs add optional `synthesisHarness` and `maxEvidenceChars`.

Both existing examples accept **2–8 scopes**. That is a recipe limit, not Flow's concurrency limit. A hundred similar work items belong in [batch map–reduce](batch-map-reduce.md), not eight vaguely defined buckets.

```json
{
  "task": "Inspect /work/shop for checkout failures. Return source references; do not edit.",
  "scopes": ["retry handling", "idempotency", "payment callbacks"],
  "harness": "codex"
}
```

Load the selected script as `external_workflow({ script, args })`. Use an available backend with the required read-only tier; the examples do not choose a fallback. `parallel()` receives functions, not started promises. The shared Flow limiter queues child calls above its configured concurrency.

## Use the findings

The parent can group or compare the reports itself. Do not add a synthesizer just to rename that work. Branch-and-converge is useful when the synthesis is itself substantial; it preserves missing/truncated evidence in its return. Its current packet limit uses explicit character clipping, so inspect original branch results before relying on omitted detail.

Failed scopes remain gaps, not favorable reviews. Parallel editors need non-overlapping ownership or separate workspaces; Flow supplies neither worktree isolation nor merge arbitration. Use [independent review](independent-review.md) when the scopes are fresh judgments of the same artifact rather than separate investigation areas.

Exact helper/error behavior: [runtime rules](../references/runtime-rules.md). Evidence transfer: [handoffs](../references/handoffs.md).
