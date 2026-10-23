# Orchestration playbook

**Goal:** Help Pi choose and run effective multi-agent workflows with external_workflow, rather than falling back to one vague delegation or shallow parallel calls.

The package now installs a discoverable Pi skill, [pi-flow-orchestration](../skills/pi-flow-orchestration/SKILL.md). Use it when the task needs independent scopes, sequential evidence, an adversarial check, or a limited fix/test loop. The skill is deliberately on demand: simple work should still use external_delegate.

## Getting started

Install or update pi-flow-external, then ask Pi:

> Audit authentication across routes, middleware, and tokens. Use the pi-flow-orchestration skill to choose a plan, run independent checks, and tell me which scopes were not verified.

You can also ask for a specific pattern: "Use branch and converge to examine three implementation approaches, then challenge the conclusion."

If skill discovery is unavailable in a custom Pi setup, read [the skill](../skills/pi-flow-orchestration/SKILL.md) directly and call external_help({topic:"workflow"}) for the current helper syntax.

## Pattern library

| Pattern | Typical task | Flow behavior |
| --- | --- | --- |
| Delegate | One bounded question | external_delegate; do not pay for a workflow |
| Parallel sweep | Audit independent routes, sources, topics | parallel() with scoped children; retain failures |
| Pipeline | Draft -> verification -> output | Sequential await or pipeline() stages |
| Branch and converge | Compare independent alternatives | Parallel branches, bounded evidence, final synthesis; optional scope discovery first |
| Adversarial review | Challenge a plan or set of claims | Independent reviewer checks sources, not just agreement |
| Bounded repair | Fix code and run explicit checks | One editor, read-only QA, capped retries if authorized |

The recipes are in [skills/pi-flow-orchestration/recipes](../skills/pi-flow-orchestration/recipes). They are trusted JavaScript scripts run by external_workflow. They are **not** new global helper functions.

## Running a saved recipe

Copy one recipe to an allowed workflow root, for example the session's trusted project .pi/workflows or the user's workflow directory, and call external_workflow with its saved name or scriptPath and **args**. The skill's own package directory is not automatically an allowed scriptPath.

Example for parallel-sweep.js:

    {
      "scriptPath": "<allowed absolute workflow path>/parallel-sweep.js",
      "args": {
        "task": "Check repository auth enforcement",
        "scopes": ["routes", "middleware", "tokens"],
        "harness": "codex"
      }
    }

Before launch the parent should explain the split, selected harnesses, permissions, which checks run in parallel, and what evidence will come back. Foreground is the default when the result is needed next.

The example pins Codex because it supports the explicit readonly tier; **it does not automatically switch backends**. For the read-only recipes, set harness to a verified available backend that enforces the required tier. Antigravity supports only danger, so these restricted examples do not work on it.

**Bounded repair is Codex-only.** It rejects other harnesses before any editor starts. Supporting edit and readonly tiers is not enough: QA must also have shell access and structured output. OpenCode rejects the required schema, while Claude, Muse, and named Pi harnesses cannot shell-run tests at readonly. Before launch, confirm Codex is available and the checks can run in its read-only sandbox; checks that need workspace writes or network access may fail. Do not silently raise permissions to run them.

## What good behavior looks like

- The parent decides the smallest useful workflow; multiple agents are never mandatory.
- Each agent has a distinct scope, a deliverable, the required context and a check.
- The parent preserves failures, uncertainties, and evidence omissions.
- Only explicit results become handoffs; sibling history is not shared.
- No claim of read-only safety rests on prompt wording alone.
- Same-worktree concurrent edits are avoided unless truly disjoint; no worktree isolation is provided.
- The final answer names unresolved issues and verifies the work against the user's goal.

Read [Workflows](workflows.md) for exact runtime syntax and [Public Contract](public-contract.md) for receipts, outcomes, and context boundaries. For evaluation tasks and acceptance criteria, see [Orchestration Evaluation](maintainer/orchestration-evaluation.md).

## Explicit limits of v1

This does not add new JS runtime helpers, automatic skill invocation outside native Pi discovery, cross-harness model routing policies, worktree isolation, or a workflow TUI. There is no fixed orchestration size or forced approval gate. The parent still chooses whether a delegation is worth its cost and owns task acceptance.
