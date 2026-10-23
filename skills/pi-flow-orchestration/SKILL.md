---
name: pi-flow-orchestration
description: Choose and author effective external_workflow plans for pi-flow-external. Use when a task benefits from multiple external agents, independent checks, bounded repair, or cross-harness handoffs; keep single tasks as external_delegate. Includes tested JS recipes and Flow-specific safety rules.
---

# Orchestrate with pi-flow-external

You are the **parent**. You choose the work split, authority, evidence, stop rule, and final acceptance. Children do bounded work and return evidence. **More agents is not the goal.** Use external_delegate for a single bounded task.

## Before you call external_workflow

1. Write down the desired deliverable and an observable acceptance check.
2. Identify work that can genuinely run independently. Only parallelize it if the benefit exceeds cost, context handoff, and conflict risk.
3. Select the **smallest** fitting pattern in [pattern-selection](references/pattern-selection.md). If none fits, delegate once or work locally. Do not require a planning agent just to choose a pattern.
4. Assign a role and harness for each child. Verify availability with /external doctor or external_help({topic:"roles"}). Use explicit supported permission tiers, not role names or prompt wording, to enforce authority.
5. Choose what each child sees: no shared context for independent checks; include selected evidence explicitly when a later stage depends on earlier results. Set a bounded fan-out and stop condition. Plan how to handle partial failure.
6. Tell the user **before launch** the purpose, who does what, what runs together, what can change, and what is returned. Follow the user's normal approval rules; this is not a new approval gate.
7. Author the script with apiVersion:1, meta.phases and matching phase() calls. Return structured results including failed or unverified work, rather than concealing gaps.
8. Check the tool receipt, child outcomes, and whether the output really meets the user's request. The parent remains responsible for verification and synthesis.

## Quick pattern chooser

| Situation | Best initial choice |
| --- | --- |
| One bounded task, one output | external_delegate (no workflow) |
| Independent files, topics, or viewpoints | Parallel sweep |
| A depends on B's result | Pipeline or sequential awaits |
| Several distinct scopes need one combined answer | Branch and converge (discover scopes first only if needed) |
| High-stakes claims or important decisions | Adversarial review |
| Authorized edits followed by tests and limited fixes | Bounded repair |
| Several of the above | Compose them, but only where the task justifies it |

Read [pattern-selection.md](references/pattern-selection.md) for failure modes and when **not** to split work. Use the recipes only after understanding the pattern:
- [parallel-sweep.js](recipes/parallel-sweep.js) — independent scopes, partial failures kept.
- [branch-and-converge.js](recipes/branch-and-converge.js) — parallel discovery with explicit evidence handoff into a final synthesis.
- [adversarial-review.js](recipes/adversarial-review.js) — draft and independent critique (not a self-review).
- [bounded-repair.js](recipes/bounded-repair.js) — authorized edits, structured checks, limited iterations.

These are adaptable **examples**, not new runtime functions. Copy a recipe into a trusted saved workflow root or pass its text as the script to external_workflow, and pass JSON inputs through the tool's args. A scriptPath must be inside an allowed workflow root; a package skill directory is not automatically such a root. Recipes assume Codex as a restricted-permission demonstration backend, not an automatic fallback. Set harness inputs to an available backend that enforces the required tier.

## Flow rules that prevent common failures

Read [runtime-rules.md](references/runtime-rules.md) before writing custom scripts and [handoffs.md](references/handoffs.md) before passing child evidence to another harness.

- Scripts are trusted JavaScript in an isolated worker, **not** a general filesystem or network environment. Only documented helpers are available; no imports, Date or Math.random.
- agent() **throws ChildRunError** on failed/cancelled/timed-out children. Handle *optional* branch failures locally and return them visibly; let required failures stop the workflow.
- Every agent() call must be awaited or returned. parallel() takes functions, not started promises. Child outputs are not written into sibling or parent history.
- Roles describe intent; permission sets allowed access. The default permission can be danger. agy rejects readonly and edit. Never silently broaden a restricted task to danger.
- Same-workspace parallel edits are unsafe without explicit non-overlap or separately managed isolation. **Flow does not provide git worktree isolation**. Prefer parallel read-only work, then one editor, then verification.
- Prefer foreground when you need the result next. Background is for independent local work or a request to leave a run active; don't launch then immediately wait.
- Replay is explicit and only for saved scripts via scriptPath + resumeFromRunId. It reuses an unchanged successful prefix, not arbitrary side effects.
- Schema-valid output is not task acceptance. Check the evidence and the user's constraints.

## Learn whether the plan helped

Compare a baseline parent without this skill against one using it on the same task, runtime, and model. Score task success, verified coverage, unsafe edits, unnecessary agents, failed handoffs, total cost, and elapsed time. **Never score the number of agents as success.** The repository has an additional guide at docs/maintainer/orchestration-evaluation.md for offline tests and optional real-model trials; it is not included in the published package.

For exact tool syntax call external_help({topic:"workflow"}) or external_help({topic:"contracts",tool:"external_workflow"}). The on-demand contract is authoritative if an example drifts.
