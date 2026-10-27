# Orchestration playbook

Flow helps a parent agent delegate useful work and use the results. Direct work and `external_delegate` remain normal for independent assignments. `external_workflow` earns its place through dependencies, high-volume processing or grouped supervision—not merely a fixed number of agents.

## Discover a pattern when needed

The packaged [pi-flow-orchestration skill](../skills/pi-flow-orchestration/SKILL.md) is the task-based index. It advertises seven patterns: **parallel work, batch map–reduce, pipeline, routing, discover-and-delegate, independent review, and bounded refinement**.

The loading path is **short skill index → one chosen pattern guide → its script/example → exact technical help only as needed**. Native skill discovery exposes the skill's description; it does not eagerly load all guides. No new automatic loader, workflow registry, routing engine or task-management layer is introduced.

For example, “summarize hundreds of transcripts and report recurring themes” leads to [batch map–reduce](../skills/pi-flow-orchestration/patterns/batch-map-reduce.md), not hundreds of manual delegation messages. “Review this existing proposal” leads to [independent review](../skills/pi-flow-orchestration/patterns/independent-review.md), without a mandatory drafting step.

## Run or adapt an example

A pattern guide may contain a complete inline JavaScript example or link to a standalone recipe. Read only the selected example and pass its source as `external_workflow({script, args})`. To reuse a workflow later, save it inside an allowed workflow directory and use `scriptPath` or its registered saved name. **Bundled recipe paths are not automatically saved-workflow names.**

The [batch map–reduce script](../skills/pi-flow-orchestration/recipes/batch-map-reduce.js) and [independent-review script](../skills/pi-flow-orchestration/recipes/independent-review.js) extend the examples. The original parallel-sweep, branch-and-converge, adversarial-review and bounded-repair files retain their contracts. Patterns are broader than files: pipeline, routing and discover-and-delegate have runnable examples in their focused guides.

## The parent remains in charge

Brief the useful outcome, source facts, absolute workspace/file paths and allowed changes; let helpers choose their methods. Before coordinated work, explain assignments, order, allowed changes and deliverable. Follow the user's existing approval policy without inventing another gate. Use `meta.phases` and `phase()` for meaningful progress; existing phase-less saved scripts remain valid.

Parallel editors need non-overlapping ownership or separate workspaces: Flow does not isolate working trees. Failed runs and model/harness switches require user authorization; Agy's disclosed infrastructure retry is the automatic exception. Foreground is natural when you need the result next; background is useful when you have other work before collection.

Read results, retrieve referenced output, account for missing work and finish the original task. A complete workflow is not proof its conclusions are right. For large corpora, individual records, source IDs and missing-item lists matter as much as the final synthesis.

## Exact references

[Workflows](workflows.md) and `external_help({topic:"workflow"})` explain helpers and execution. [Public contract](public-contract.md) covers envelopes and paged results. [Harness reference](harness-reference.md) and `external_help({topic:"capabilities"})` describe backend differences. [Supervision](supervision-and-runtime.md) covers background runs and cancellation. None is a prerequisite to an ordinary direct delegation.
