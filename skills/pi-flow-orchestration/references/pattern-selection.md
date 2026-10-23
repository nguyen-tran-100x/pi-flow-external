# Pattern selection: optimize outcomes, not fan-out

Pick a pattern from the shape of the work. Start with one agent unless an additional independent result, specialty, or check has a clear payoff.

| Pattern | Use when | Avoid when | Acceptance check |
| --- | --- | --- | --- |
| Delegate | One bounded task, no benefit from split | Multi-scope tasks would swamp one context | One checked deliverable |
| Parallel sweep | Independent scopes can be inspected at once | Branches need each other's findings; edits overlap | Every scope accounted for, failed scopes visible |
| Pipeline | An artifact or decision must pass several stages | Stages don't depend on each other | Each stage checked before next step |
| Branch and converge | Separate scopes need a single synthesis (discover the split first only if unknown) | No clear partition or final synthesis requirement | All branches accounted for, disagreements surfaced |
| Adversarial review | Need to challenge a draft/claim/decision | Low-impact routine work | Critique independently checks claims, cites flaws and open questions |
| Bounded repair | User authorized an edit/test/fix cycle | No edit approval, no reliable test signal, unknown write boundaries | Tests pass within explicit attempts; otherwise report failure |

## Default decisions

- **Decomposition:** Split by clear scopes or methods. Do not assign identical vague tasks to many agents and call it coverage.
- **Fan-out:** Start with 2–4 independent branches for normal work. Grow only for real partitions; note cost and concurrency caps.
- **Harness:** Choose capability, permission support, availability, and price. Different harnesses do not automatically mean better independent evidence.
- **Context:** Fresh context is better for independent critiques; selected, bounded evidence is better for dependent steps. Conversation sharing is not a magic shared blackboard.
- **Failure:** Decide up front whether a failed child means stop, reduced coverage, or a *user-authorized* recovery. Do not hide it in a synthesized answer.
- **Edit safety:** Make the first fan-out read-only where possible. A single implementer can edit after the work split; independent QA can then validate it. With concurrent edits, define disjoint files and confirm they do not conflict. Flow offers no built-in worktrees.
- **Stop rule:** A workflow should stop after meeting the check, reaching a limit, or encountering an unsafe condition. Avoid open-ended self-improvement loops.
- **No ceremony:** Do not launch a planner, reviewer, and integrator for a simple lookup. Do not require the user to approve a fixed team size.

## How to compose patterns

- Research: partition sources/topics -> parallel evidence collection -> converge -> independent claim check.
- Code audit: independent file groups -> merge findings -> verify only high-risk items in original sources.
- Change request: one implementer -> independent read-only QA -> bounded fix cycle only if user authorized repeated attempts.
- Decision support: independent assumptions/alternatives -> adversarial critique -> parent-owned recommendation.

At every stage state what the next child **needs**, not everything the prior child said. A good plan minimizes duplicate work and irrelevant context.
