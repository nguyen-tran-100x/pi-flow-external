# Bounded refinement

**Use when:** a candidate can improve against clear feedback or executable checks, and the user has authorized that improvement loop. Examples: fix a parser against specified tests, revise a report against explicit requirements, or improve extraction until a known validation condition holds.

**Shape:** candidate → evaluate → targeted revision → stop on criterion or attempt limit.

## Existing executable fix/test example

Load [bounded-repair.js](../recipes/bounded-repair.js), which is deliberately **Codex-only**. Its QA stage needs shell access at `readonly` and structured output; ordinary support for read/edit permissions is not sufficient.

```json
{
  "task": "Fix the parser bug in /work/shop without unrelated edits.",
  "checks": "In /work/shop run the targeted parser tests and report command/exit-code evidence.",
  "harness": "codex",
  "approved": true,
  "maxAttempts": 2
}
```

`approved:true` records authorization already obtained from the user; it does not create that authorization. Check that the stated tests can run in the read-only sandbox before starting an editor. Tests that write caches, snapshots or generated files may need a different deliberately authorized plan. Never silently broaden permissions just to run them.

The existing recipe stops when structured QA reports a pass, when its attempt bound is reached, or when a call fails. It returns attempts and evidence, not an unquestionable verdict. The parent still judges whether the task is met.

## Refining non-code work

Use the same shape with a small rubric and a finite attempt bound. A critic should identify specific changes that matter; another candidate is useful only when it can address those changes. Model feedback is not an executable test oracle. The parent may decide to accept an explained trade-off rather than repeat until a critic agrees. There is no extra mandatory critic or universal numeric score.

**Refinement is not retry:** a successful assessment saying “needs work” can lead to an authorized next revision; a failed, timed-out or aborted child call must not be automatically retried or moved to another model/harness. Follow the existing user-authorization rule and retain Agy's one disclosed infrastructure-retry exception.

For a one-off judgment without edits use [independent review](independent-review.md). For details of the bounded repair fields and backend behavior, read its script and [runtime rules](../references/runtime-rules.md).
