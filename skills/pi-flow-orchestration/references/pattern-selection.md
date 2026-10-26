# Work shapes and composition choices

**Start with the task, not a named pattern.** These examples help you recognize useful compositions. They are not a menu the parent must select from before delegating.

## The primary choice

| Need | Natural action | Why |
| --- | --- | --- |
| Work is best done by the parent | Work directly | No delegation overhead |
| One useful independent result | `external_delegate` | Minimal handoff |
| Several unrelated, self-contained results | Several `external_delegate` calls | Independence does not need a coordinator |
| Tasks depend on earlier findings, require common progress, or produce one coordinated result | `external_workflow` | JavaScript can express dependencies and grouped evidence |

If you are unsure, articulate the tasks and ask **which results need to flow into which other tasks**. That usually settles whether orchestration earns its cost. A direct call can remain valuable even as a larger workflow develops.

## Compose when coordination helps

| Situation | Technique or bundled example | Useful check |
| --- | --- | --- |
| Several independent areas need inspection together | `parallel()` or [parallel sweep](../recipes/parallel-sweep.js) | Findings and gaps remain visible per area |
| One task depends on another | Sequential `await` (or `pipeline()` for repeated per-item stages) | The next child receives selected actual evidence |
| Separate investigations need one integrated answer | [branch and converge](../recipes/branch-and-converge.js) | Claims, disagreements and missing evidence survive synthesis |
| A produced claim needs independent challenge | [adversarial review](../recipes/adversarial-review.js) | Critic works from evidence, not just the author's reasoning |
| An **existing** design needs several fresh opinions | Adapt parallel sweep: shared target, distinct perspectives | Reviews are separate; parent judges them, not a vote |
| A user-authorized change needs bounded tests and fixes | [bounded repair](../recipes/bounded-repair.js) | Stop after the stated attempt limit; keep evidence |

You may combine or invent patterns. Do not add a synthesis agent when the parent can read and compare the results itself. Two useful perspectives are often better than a large undirected group.

## Briefing and receiving work

A useful child brief normally contains the objective, relevant files or facts, task-specific constraints and the expected output. Grant enough latitude for the child to investigate. Choose `worker` for a broad assignment or a specialized role when its existing instructions fit.

Share fresh parent context when true independence matters; pass an explicit compact evidence packet where a later step depends on another result. Names and paths in another agent's output are not automatically verifiable source evidence.

After execution, use the result and decide: accept, check a material uncertainty, send one follow-up, repair within the user's mandate, or finish. Failed or missing branches are gaps to act on, not an instruction to restart everything.

For uncommon runtime behavior, inspect [runtime rules](runtime-rules.md), [handoffs](handoffs.md) and the exact `external_help` contract rather than loading every reference in advance.

## Friction to avoid

- A mandatory planner/reviewer/synthesizer trio around a straightforward task.
- A workflow just because the parent has more than one independent assignment.
- Treating the number of launched agents or objections raised as success.
- Redundant history transfer when a few task facts would suffice.
- Fixed role/persona or backend selection when a capable generalist and default environment fit.
- Repeated review or repair until every critic agrees, without a real decision to make.

The parent remains accountable for the task. The shape of its plan should remain easy to change as evidence arrives.
