# Playbook verification: mechanical and live-agent coverage

**Scope:** PR #103. A passing offline suite is NOT a passing behavioral qualification. Real parent-agent decisions and genuine child output require separate opt-in trials. This document lives in maintainer space and is not shipped to agents by default.

## Source of truth

[playbook-coverage.json](playbook-coverage.json) maps **22 actionable recommendations**—seven advertised patterns and fifteen shared agent-journey decisions—to both:

- A **mechanical test** exercising the Flow runtime, a real executable example, a public contract, or a packaged skill/link. Test references point to actual test files and assertions.
- At least one **behavioral case** in [scenarios.json](../../test/fixtures/playbook-behavior/scenarios.json). These provide realistic fixture files, an uncoached task, hidden checkable evidence, and specific qualitative criteria.

[playbook-coverage.test.ts](../../test/playbook-coverage.test.ts) fails if a pattern or requirement has no mapping, a mapped test is missing, a behavioral case is orphaned, or an expected fact is leaked into the user prompt. It exercises the live runner's selftest, which refuses to mark simulated text as completed real-agent behavior.

**Coverage maintenance:** This matrix cannot infer brand-new recommendations from prose. A contributor reviewing any new or changed normative guidance must register its ID, executable test reference, and real-agent case before advertising it. CI rejects incomplete entries; human review still determines whether the mapping is meaningful. Do not test prompt word choices just to satisfy a matrix row.

## Coverage by advertised pattern

| Pattern | Mechanical lane | Behavioral lane |
| --- | --- | --- |
| Parallel work | Existing parallel sweep, partial failure, optional synthesis | `parallel-known`: two distinct investigations and an integrated answer |
| Batch map–reduce | Uneven 240-item corpus, concurrency, ID completeness, failed and oversize reduction | `batch-corpus`: twelve real source files, per-item results, grounded theme counts |
| Pipeline | Actual output handed to next child; first-stage failure stops dependency | `pipeline-evidence`: extract canary data then recommend with stated limits |
| Routing | Known-category dispatch and rejection of unknown categories | `routing-known`: handle an incident, not a feature-design exercise |
| **Discover and delegate** | Bounded structured output, malformed/duplicate scopes, goal/target fidelity, 8-worker concurrency, failure retention, no scope-authority escalation | **`discovery-unknown`:** parent or helper finds source-grounded scopes; **`discovery-child-decomposition`:** a discovery child proposes substantive scopes that workers then investigate; **`discovery-known-skip`:** avoid a discovery child when the split is already known |
| Independent review | Fresh sibling-independent assessments, no mandatory draft or vote, partial failure | `independent-review`: find a genuine proposal/requirements contradiction |
| Bounded refinement | Authorization, attempt cap, tested QA checks and backend constraints | `bounded-refinement`: revise against a rubric with finite feedback, no unapproved edits |

Shared recommendations are covered by `local-baseline`, `background-progress`, `missing-source-no-retry`, `shared-edit-plan`, `permission-trap`, and the relevant pattern cases. The machine-readable matrix is authoritative; don't treat this prose table as a separate test registry.

## Offline mechanical lane (CI)

```sh
npm run check
npm pack --dry-run --json
node scripts/e2e/playbook-behavior.mjs --selftest
node scripts/e2e/playbook-behavior.mjs --list
```

The workflow tests invoke Flow's **actual JS runtime** with deterministic child substitutes. They prove scheduling, handoff, output shape, failure handling and authority boundaries **as tested**, not model reasoning or semantic task decomposition. No providers are called in the standard suite.

## Real behavioral lane (opt-in, provider-billed)

Use an authenticated Pi installation and independently authenticated external CLI on a trusted machine. The runner invokes `pi -p --mode json` with the actual extension and native skill discovery; each case uses its own temporary, readonly fixture. The real Pi authentication files are copied into an isolated, private agent directory and deleted afterward, not written back to the user's settings.

```sh
# Start with the strongest concern. The user request does NOT name a pattern.
node scripts/e2e/playbook-behavior.mjs --real \
  --case discovery-unknown --out /tmp/flow-playbook-trials \
  --model openai-codex/gpt-5.6-sol --harness codex

# Execute every case before asserting comprehensive behavioral coverage.
node scripts/e2e/playbook-behavior.mjs --real \
  --case all --out /tmp/flow-playbook-trials \
  --model openai-codex/gpt-5.6-sol --harness codex
```

Specify models and harnesses actually available in the testing installation. Each real run stores: `pi-events.jsonl` (tool and message events), `result.json` (observable markers, invocation/child counts and unchanged-fixture checks), and `review.json` (case-specific independent assessment criteria).

**A passed output oracle is not a behavioral pass.** A reviewer must inspect the actual session and child evidence, identify themselves in `reviewer`, rate each criterion **0 fail / 1 adequate / 2 strong**, and attach concrete evidence in every `criteria[].evidence`. Only mark `verdict: "pass"` if every criterion is at least adequate. Then:

```sh
node scripts/e2e/playbook-behavior.mjs --verify /tmp/flow-playbook-trials
```

The verifier fails if any required case lacks real evidence or a complete independent review. An unread or unrun case is not a pass. Retain artifacts privately; sessions may contain sensitive prompts, excerpts or output. Never upload credentials.

## Behavioral evaluation questions

Focus on the **user's completed work** before optimizing away help reads or agent calls.

- **Discovery quality:** Were discovered scopes grounded in inspected files, distinct, sufficient, and appropriate for parallel work? Did the known-split negative case skip extra discovery? Did each child investigate the actual proposed question, rather than simply returning plausible filler?
- **Pattern and progressive discovery:** Did the parent select a defensible plan without needing all seven guides? Loading one useful reference is better than rushing into the wrong workflow. A good task can succeed without loading a guide.
- **Evidence and continuation:** Did evidence flow explicitly across dependent steps? Were missing transcripts, unreadable files, failed children and uncertainty reported? Were source IDs and theme counts checked?
- **Boundaries:** Did independent reviewers start fresh? Did the parent avoid competing editors, unsupported readonly modes, unapproved retries and model switches? Did foreground/background choice match the user's request?
- **User outcome:** Did the final deliverable actually answer the task? An agent count, role count or perfectly formatted result alone is not evidence of quality.

For comparisons, run identical cases against pre-pattern `main` and PR #103 on the same parent model/harness/configuration, keep exact commit SHAs and review both traces. Different decompositions can be equally valid; judge grounded outcomes and wasted orchestration effort, not matching a fixed script.

## Release rule

**Status at authoring: mechanical suite passing; real model trials and independent reviews NOT executed.** The standard test suite must remain provider-free. This opt-in behavioral lane complements—not replaces—the repository's required [field-testing runbook](field-testing.md), including real parent→tool→child routing. Keep PR #103 draft and unmerged until actual live qualification and release metadata are resolved. Do not claim an ergonomics win or use `release:none` to ship modified skills.
