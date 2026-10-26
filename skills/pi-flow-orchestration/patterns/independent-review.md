# Independent review

**Use when:** an existing design, change, analysis or decision benefits from separate judgments. A single bounded check usually needs only `external_delegate`. Several meaningful perspectives can share one workflow without inheriting each other's conclusions.

**Shape:** same target + relevant facts → fresh assessments → parent weighs findings.

## Review an existing artifact

Load [independent-review.js](../recipes/independent-review.js):

```json
{
  "target": "/work/shop/docs/team-management.md",
  "revision": "replace with the reviewed commit SHA or captured artifact version",
  "references": ["/work/shop/src/teams.ts", "/work/shop/docs/requirements.md"],
  "questions": ["Can a new implementer act without guessing?", "Which trade-offs or failure cases change the design?"],
  "harness": "codex"
}
```

Questions focus attention; they are not permanent specialist roles or a demand to find flaws. The example uses `worker` so reviewing a non-code artifact does not inherit a code-only role. Each initial call uses `context:{mode:"none"}`, no resume, and the same target packet. It does not pass sibling findings or the authoring conversation. Relevant project instructions and source facts remain available; fresh parent context exclusion is not proof of total backend-context isolation.

Choose an available read-only-capable harness. A revision label identifies what should be reviewed but **does not check out, freeze or verify the files**. The parent must supply stable material where that matters; live sources can change. The example uses one chosen harness; deliberately varied harnesses are an optional adaptation, not automatic failover.

## Judge rather than vote

Return individual findings, important disagreements and missing checks. `status:complete` means all requested calls returned, not that the artifact passed review. All failed calls produce `status:failed`; partial results remain useful. The recipe performs no edits, retries, authoring stage, automatic synthesis or approval decision. Concerns can be plausible rather than fully reproduced when their limits are clear.

Need a draft **first**? The existing [adversarial-review.js](../recipes/adversarial-review.js) is the draft-then-critic variant. Do not use its drafting step when the artifact already exists. Re-review only for a material change or unanswered question; the goal is a useful decision, not zero objections.

For deliberate follow-on evidence exchange, use [handoffs](../references/handoffs.md). The parent retains acceptance and any decision to revise or proceed.
