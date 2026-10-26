---
name: pi-flow-orchestration
description: Help a Pi parent delegate useful work with external_delegate or compose external_workflow when related tasks benefit from coordination. Offers adaptable, tested recipes and pointers to exact Flow contracts.
---

# Delegate work, keep moving

You are already working on a user's task. Flow should extend your capacity, not turn delegation into another project. **The work determines the plan.** You own the outcome; children own their methods.

## Choose the simplest useful action

| Your work | Reach for |
| --- | --- |
| You can finish directly with little overhead | Work locally |
| One independent assignment needs another agent | `external_delegate` |
| Several unrelated assignments can run independently | Several `external_delegate` calls (parallel if convenient) |
| Assignments depend on each other, share a coordinated plan, or need one grouped result | `external_workflow` |

Multiple tasks do **not** automatically require a workflow. You do not need a planner agent, pattern label or skill invocation before ordinary delegation.

## The parent-agent journey

1. **See the work.** Understand what the user wants and what help actually adds value. Split by meaningful outcomes, not arbitrary agent count.
2. **Brief each helper.** Give the goal, relevant sources/context, boundaries on changes, and a useful result to return. Choose a role and fitting harness; `worker` is a legitimate generalist. Let the child find its own method.
3. **Launch.** Use a direct delegation for each independent job. For genuinely coordinated work, write a small JavaScript workflow using `agent()`, `parallel()` and sequential `await`; choose `pipeline()` only when per-item stages fit. A clear one-sentence heads-up to the user describes a coordinated plan; no extra approval step is implied.
4. **Use the result.** Read the canonical output, inspect referenced results when needed, account for missing work, integrate the findings, and decide what is next. Continue, narrow the request, adapt the plan or finish.

When you need a second model's **independent** judgment, use fresh context. For a dependent step, explicitly pass selected prior evidence; sibling history is not automatically shared. Avoid copying the whole parent transcript into every task.

Default to foreground when the result is needed next. Use background when you can do other useful work first or the user wants the delegation left running, then collect through `external_runs`. Do not background-launch simply to wait immediately.

## Recipes: examples, not a ritual

The bundled scripts under [recipes/](recipes/) are examples you can **adapt**, not special runtime functions or compulsory plans:

| Useful work shape | Starting point |
| --- | --- |
| Several independent inspections with missing-scope accounting | [parallel-sweep.js](recipes/parallel-sweep.js) |
| Parallel investigation whose findings feed a combined answer | [branch-and-converge.js](recipes/branch-and-converge.js) |
| Generate a draft, then have a fresh critic challenge it | [adversarial-review.js](recipes/adversarial-review.js) |
| Authorized editing with specified tests and a limited fix cycle | [bounded-repair.js](recipes/bounded-repair.js) |

Already have a draft and just want independent perspectives? Adapt `parallel-sweep` with the **same target** and different review questions; do not run the draft stage from `adversarial-review` unnecessarily. A dedicated independent-review variant can be added later if repeated usage shows that it saves work.

**How to use:** read a recipe and pass its source through `external_workflow({ script, args })` for a one-off task, or copy it into an allowed workflow root and invoke by `scriptPath`. Bundled skill recipe paths are not automatically registered as saved workflow names. The example backends are not automatic fallbacks; choose available harnesses that support the work.

## Where to look only when needed

- [Pattern examples](references/pattern-selection.md): alternative ways to divide and reconnect work, including situations where delegation is not worthwhile.
- [Runtime rules](references/runtime-rules.md): exact JS constraints, supported permissions, backend quirks, replay and cancellation.
- [Handoffs](references/handoffs.md): carrying selected evidence between children.
- `external_help({ topic: "workflow" })` or `external_help({ topic: "contracts", tool: "external_workflow" })`: authoritative API syntax; `capabilities` for backend-specific options; `roles` to see available roles.

A role conveys **intent**; the requested permission tier conveys actual authority. Omission inherits the configured tier, potentially `danger`. Make that choice for the assignment rather than assuming `reviewer` means read-only. The child can still report a plausible concern when no executable check is available.

Workflow scripts start with a literal `export const meta = { apiVersion: 1, name, description }` and return serializable data. Optional `meta.phases` with `phase()` improves visible progress. `agent()` failures throw `ChildRunError`; catch a failed *optional* branch when sibling work remains useful and retain the gap in the result. No imports, file APIs, Date, or Math.random in the worker. These are execution details, not steps to recite before every call.

**The success condition:** real user work advances with fewer unneeded help reads, handoffs, children and corrections—not more elaborate orchestration.
