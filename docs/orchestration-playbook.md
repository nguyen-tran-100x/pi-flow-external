# Orchestration playbook: delegate work, keep moving

**Goal:** Help an agent use Flow naturally: see useful work, hand it to the right helpers, use the results and keep moving.

Flow has two main execution tools. The installed [pi-flow-orchestration skill](../skills/pi-flow-orchestration/SKILL.md) offers examples for nontrivial workflows; ordinary delegation does not need a skill invocation or a predefined plan.

## Choose by how the work connects

| You need | Use | Example |
| --- | --- | --- |
| One external assignment | `external_delegate` | Ask Codex to trace a failing test |
| Several independent assignments | Multiple `external_delegate` calls | Ask one helper to inspect retries, another to map idempotency |
| Connected tasks or one grouped result | `external_workflow` | Explore alternatives in parallel, then use the evidence in a subsequent step |

The parent can also work directly. **Multiple tasks alone do not imply a workflow.** No fixed agent count, template or extra sign-off is required.

## A natural journey

**1. Choose the help.** Decide what another model can usefully do. Pick the role and harness that fit; `worker` is fine for general work. Prefer your configured default harness when it has the needed abilities.

**2. Brief the assignment.** Give a goal, relevant workspace/context, what may change and the useful output. The child can choose its own method. The role gives instructions; the permission tier governs access. An omitted tier uses your configured default.

**3. Delegate.** Use one or several direct calls. Reach for a workflow when child results need to become inputs for later work or when one grouped run genuinely helps supervision.

**4. Use the result.** Read the returned answer and missing work, decide what to check or integrate next, and continue with the original user objective. Use `external_runs` for referenced output or background work; a successful tool call alone does not prove the work met the task.

### Example: one investigation

```ts
const receipt = await tools.external_delegate({
  description: "Trace retry behavior",
  role: "explorer",
  harness: "codex",
  permission: "readonly",
  prompt: "Inspect checkout retry and idempotency code. Explain relevant paths and possible failure cases; do not edit.",
});
if (!receipt.ok) return receipt.error;
// Check run.state.outcome; use inline result or inspect refs.final if delivered by reference.
return receipt.data.run;
```

Codex is illustrative, not the mandatory backend. Confirm availability when uncertain; the configured default harness may be sufficient for other tasks.

### Example: coordinated investigation

Use `external_workflow` when one run should group related investigations. This is an **inline ad-hoc script**, not a registered recipe name:

```js
export const meta = {
  apiVersion: 1,
  name: "checkout-investigation",
  description: "Compare retry and idempotency failure paths",
  phases: [{ title: "Investigate", detail: "Two independent read-only investigations" }],
};
phase("Investigate");
const reports = await parallel([
  () => agent("Inspect retry handling and return evidence.", {
    role: "explorer", harness: "codex", permission: "readonly", context: { mode: "none" },
  }),
  () => agent("Inspect idempotency handling and return evidence.", {
    role: "explorer", harness: "codex", permission: "readonly", context: { mode: "none" },
  }),
]);
return { reports };
```

If one optional investigation may fail without invalidating the others, catch `ChildRunError` within that branch and return a visible failed entry. If later work depends on an earlier answer, use sequential `await` and pass the selected result explicitly.

Before coordinated work, briefly explain the purpose, assignments, parallel/sequential order, allowed changes and deliverable. Follow the user's existing approval policy; do not invent an extra gate. Use `meta.phases` with matching `phase()` calls to show a meaningful roadmap; previously saved workflows without phases remain valid.

## Recipes are starting points

| Existing example | When to adapt it |
| --- | --- |
| [Parallel sweep](../skills/pi-flow-orchestration/recipes/parallel-sweep.js) | Independent scopes, visible partial failure |
| [Branch and converge](../skills/pi-flow-orchestration/recipes/branch-and-converge.js) | Several investigations, one synthesis |
| [Adversarial review](../skills/pi-flow-orchestration/recipes/adversarial-review.js) | Draft something, then obtain a fresh critique |
| [Bounded repair](../skills/pi-flow-orchestration/recipes/bounded-repair.js) | Authorized fix/test iteration, Codex-only in this example |

For an **already-written artifact**, adapt parallel sweep to ask distinct fresh reviewers about the same target; do not automatically run a drafting agent. An independent-review recipe variant may be added separately if usage supports it.

A bundled recipe is a file in the skill, **not** a saved workflow registered by `name`. To use it, read its source and submit through `external_workflow({ script, args })`; or copy it to an allowed global/project workflow directory and use `scriptPath` or a saved `name`. A bundled recipe path is not automatically an allowed script root. See [Workflows](workflows.md) for exact selectors and run mechanics.

## Read the reference that answers your question

- [Skill](../skills/pi-flow-orchestration/SKILL.md) and [work shapes](../skills/pi-flow-orchestration/references/pattern-selection.md): choosing and composing useful delegation.
- [Workflows](workflows.md): exact JavaScript APIs and `ChildRunError` handling.
- [Public contract](public-contract.md) and `external_help({topic:"contracts"})`: result receipts, large-output references and argument shapes.
- `external_help({topic:"capabilities"})`, [harness reference](harness-reference.md) and `/external doctor`: when a backend's abilities matter.
- [Supervision](supervision-and-runtime.md): background runs, monitoring, cancellation and complete evidence.

Default to foreground if the next step requires the result; background is for doing other work while the child runs or leaving work active across turns. Do not pay the overhead of background plus immediate wait when a foreground call is simpler.

**Good orchestration makes delegated work easier to finish, not harder to administer.**
