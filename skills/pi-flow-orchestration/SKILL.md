---
name: pi-flow-orchestration
description: Choose useful delegation patterns for pi-flow-external: parallel work, bulk transcript/document map-reduce, pipelines, routing, discovering subtasks, independent review, and bounded refinement. Load just the matching pattern guide and example when coordinated work helps.
---

# Delegate work, keep moving

Start with the user's task. Work locally or use `external_delegate` for an independent assignment; several unrelated jobs can use several direct calls. Use `external_workflow` when dependencies, a large collection, or grouped supervision make coordination worthwhile. No pattern name or skill read is required before ordinary delegation.

## Load only what helps this job

Choose a row from the task, then read **that guide**, not the whole library. Each guide supplies its own example or a link to the exact recipe. Open technical references only for a question the example leaves unanswered. You may adapt or compose patterns rather than follow a fixed process.

| The work in front of you | Pattern guide | Example available there |
| --- | --- | --- |
| Inspect several known areas; optionally combine findings | [Parallel work](patterns/parallel-work.md) | Parallel sweep; branch and converge |
| Process many transcripts/documents with per-item results and an optional overall summary | [Batch map–reduce](patterns/batch-map-reduce.md) | Size-aware batches, bounded pool, hierarchical reduction |
| One result must feed the next step | [Pipeline](patterns/pipeline.md) | Extract evidence → draft from evidence |
| Different kinds of input need different treatments | [Routing](patterns/routing.md) | Dispatch by a known category, without an extra classifier |
| The work split is not known until sources are inspected | [Discover and delegate](patterns/discover-and-delegate.md) | Discover bounded tasks → process them |
| Check an existing artifact through fresh perspectives | [Independent review](patterns/independent-review.md) | Separate assessments; optional draft-then-critic variant |
| Improve a candidate against clear feedback or tests | [Bounded refinement](patterns/bounded-refinement.md) | Existing authorized fix/test recipe; stop on criterion or limit |

These are reusable work shapes, not seven mandatory agent roles. The parent still chooses the scope and judges the result; children choose their working methods.

## Brief, run, use the result

Give each helper the goal, necessary facts and **absolute workspace/file paths**, allowed changes, and the result you need. Prefer a known suitable harness; `worker` is a useful generalist. For independent judgment use a fresh child without parent history; explicitly pass selected evidence to dependent steps.

Before coordinated work, explain assignments, order, allowed changes and deliverable. Follow the user's existing approval policy; do not invent another gate. Put a useful roadmap in `meta.phases` and mark transitions with `phase()`; older saved scripts without phases remain valid.

Parallel editing requires verified non-overlapping ownership or separate workspaces; Flow does not isolate working trees. A role is intent, not access: choose a supported permission tier for the assignment. Retry a failed run or switch its model/harness only with user authorization; Agy's disclosed infrastructure retry remains the automatic exception.

Use foreground when the answer is needed next. Background is for independent parent work or a user-requested deferred run; collect with `external_runs`. Read the returned result, retain missing work, and continue the original task. A successful call is not automatic task acceptance.

## Run an example without installing another workflow system

Read a linked script, then submit its text as `external_workflow({ script, args })`; for reuse, save it inside an allowed workflow root and use `scriptPath`. Bundled recipe files are **not registered saved-workflow names**. For example, the [batch map–reduce script](recipes/batch-map-reduce.js) is a file to load, not an `external_workflow` name alias.

For an exact question: [composition notes](references/pattern-selection.md), [handoffs](references/handoffs.md), [runtime rules](references/runtime-rules.md), or `external_help` topics `workflow`, `contracts`, `roles`, `capabilities`, and `permissions`. No new runtime helpers or automatic routing are added by this skill.
