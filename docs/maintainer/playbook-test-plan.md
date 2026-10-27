# Playbook verification: mechanical evidence and live-agent trials

**Scope:** PR #103. Offline checks have run; live parent/child trials and the matched comparison have not. A runnable behavioral suite is not behavioral qualification. Keep the draft/release hold.

## Read the matrix honestly

[playbook-coverage.json](playbook-coverage.json) inventories 22 declared recommendations: seven patterns and fifteen shared journey decisions. Each mechanical reference now says **direct** or **supporting**, with an explicit limit:

- **Direct:** the named assertion exercises the stated mechanical slice. It does not prove model judgment or the entire recommendation.
- **Supporting:** related infrastructure, not direct proof. Examples: a tool exists, a guide is reachable, or phase metadata parses.
- **Behavioral scenario defined / not run:** a task and review criteria exist, but no live result has been observed. This status must not be reported as a pass.

[test/playbook-coverage.test.mjs](../../test/playbook-coverage.test.mjs) checks mapping consistency, references, fixture provenance and package resources. It **cannot determine semantic adequacy** from the presence of a test name. Maintainers must review new recommendations and classify the actual assertions; do not preserve prompt sentences merely to fill a matrix cell.

In particular, read-only concurrency does not prove worktree isolation. Flow has no built-in worktree isolation or merge arbitration. The live overlapping-edit planning case assesses the parent's decision, not a nonexistent runtime guarantee. Likewise, parser tests support phase display but do not prove the human received a proper briefing. Applicable live cases now explicitly rate that briefing.

## Mechanical regression coverage

| Pattern | Direct executable checks | Still a behavioral question |
| --- | --- | --- |
| Parallel work | Scope collection, partial failure, explicit synthesis handoff and omissions | Useful division of work and truthful integration |
| Batch map–reduce | Uneven 240-item batch, bounded concurrency, stable IDs, failed/unreadable sources, malformed and duplicate/missing records, size blockage and failed reductions | Extraction accuracy, quantitative claims and preservation of important detail |
| Pipeline | Actual prior evidence passed onward; failure and oversized handoff stop the dependent call | Whether the downstream answer correctly uses evidence |
| Routing | Both bug and feature branches; unknown-category rejection | Whether the parent chooses the appropriate treatment |
| Discover and delegate | Structured bounds, empty/invalid/duplicate scopes, exact objective/question/target handoff, concurrency and partial failure | Grounded, useful, nonredundant and genuinely independent work discovery |
| Independent review | Fresh calls, no sibling verdict handoff, no forced drafting, partial/all failure | Actual criticism quality and source fidelity |
| Bounded refinement | Authorization flag, compatible backend, feedback, stop on pass/invalid QA, exhaust all allowed attempts while checks keep failing | Useful revisions and sound assessment criteria |

The tests execute the actual recipes and code extracted from the guides through Flow's runtime with deterministic child substitutes. Those substitutes are not real model decisions. Run:

```sh
npm run check
npm pack --dry-run --json
node scripts/e2e/playbook-behavior.mjs --selftest
```

The verifier's regressions separately exercise retention after cleanup, exclusion of credential copies, missing facts/calls/receipts, altered manifests, stale scenarios, mismatched review IDs/questions and the reported all-cases false-pass reproduction. They intentionally construct synthetic artifacts to test consistency; they do not attest a provider run.

## Fifteen live scenarios, not fifteen completed results

The original task fixtures remain in [scenarios.json](../../test/fixtures/playbook-behavior/scenarios.json). A deterministic [large-output fixture](../../test/fixtures/playbook-behavior/large-output.mjs) adds a roughly 30 KB, 160-row source. The runner exports the full scenario list, including an explicit briefing/phase review criterion for coordinated-work cases.

`large-output-inspection` requires a helper to return the whole source and the parent to retrieve its canonical result through final-result pages of at most 4096 bytes. Its oracle reconstructs a linked cursor sequence to the last page and compares the complete bytes against the source. Merely repeating the first/middle/last IDs cannot pass. The twelve-short-transcript corpus is no longer presented as evidence of large-output paging.

Discovery has separate natural-choice, explicit discovery-child, and already-known-split cases. Several fixtures still contain easy clues and explicit delegation requests. They are execution/reading smoke tests, **not strong evidence of autonomous investigation or better ergonomics**. Do not compensate for these limitations by adding another evaluation framework. Start with the small matched comparison below and inspect the traces.

## Retained trial evidence

A real trial uses a temporary private agent directory with copies of the root model authentication files. Original user credentials are never edited. Before cleanup, the runner copies **only** the session and child-evidence roots into a private trial directory, preserving child prompts, tool activity, results and summaries. It does not copy the agent credential directory; known credential filenames and symlinks are excluded or rejected. The temporary directory is removed even when retention fails.

Each trial retains:

| Artifact | Purpose |
| --- | --- |
| `sessions/`, `evidence/` | Actual parent session and child run records; remain readable after scratch cleanup |
| `artifacts.json` | Inventory/checksums of those retained files; detects missing or changed records |
| `pi-events.jsonl`, `pi-stderr.log` | Parent tool events, answers and diagnostics |
| `process.json` | Process outcome, model/harness and current scenario digest |
| `fixture-manifest.json`, `fixture-after.json` | Source snapshot and before/after hashes |
| `result.json` | Convenience cached score, **never authority for verification** |
| `review.json` | Current case ID, exact review questions, reviewer, ratings and cited evidence |

These artifacts may contain sensitive source material or conversations. Keep them private. Credential-file exclusion is not a transcript secret scrubber.

## Running and reviewing real trials

Use an authenticated Pi parent and working compatible child CLI. All calls are opt-in and may incur provider charges. Use model names actually available in that installation.

```sh
node scripts/e2e/playbook-behavior.mjs --list
node scripts/e2e/playbook-behavior.mjs --real \
  --case discovery-child-decomposition --out /tmp/flow-trials \
  --model openai-codex/gpt-5.6-sol --harness codex
node scripts/e2e/playbook-behavior.mjs --real \
  --case large-output-inspection --out /tmp/flow-trials \
  --model openai-codex/gpt-5.6-sol --harness codex
```

A reviewer must inspect the retained source/session/child records, not infer child behavior from the parent's final prose. Give each current question **0 fail / 1 adequate / 2 strong**, cite the concrete retained file/event supporting the rating, and mark `verdict: "pass"` only if every criterion is at least adequate. Do not rename, drop, substitute or reorder the generated questions.

```sh
node scripts/e2e/playbook-behavior.mjs --real --case all --out /tmp/flow-trials
node scripts/e2e/playbook-behavior.mjs --verify /tmp/flow-trials
```

`--verify` reloads the **current** scenario, checks its digest and complete fixture manifest, checks retained artifact inventories, re-parses parent events and child receipts, and recomputes the automatic checks. It ignores `result.json` pass flags and compares review IDs/questions to the current definition. Missing or stale artifacts and mismatched reviews fail. Legacy bundles that deleted their evidence cannot be migrated into passing records; rerun them.

This is ordinary consistency checking, **not tamper-proof provider attestation or proof of reviewer independence**. A complete synthetic forgery is outside its claim. Human review must still establish the records came from the intended genuine trial and that conclusions are sound.

## Small matched baseline/candidate comparison

Before claiming improved agent experience, run the same local task, corpus task, unknown-split investigation and missing-source case against a baseline skill snapshot and the PR snapshot. Keep the same runner, runtime, model/harness, fixtures and approval settings; record both git SHAs and use separate output directories. `--skill-path` selects the snapshot under comparison.

```sh
for condition in baseline candidate; do
  # Point /tmp/flow-<condition> at the corresponding recorded repository snapshot.
  for task in local-baseline batch-corpus discovery-unknown missing-source-no-retry; do
    node scripts/e2e/playbook-behavior.mjs --real --case "$task" \
      --skill-path "/tmp/flow-$condition/skills/pi-flow-orchestration" \
      --out "/tmp/flow-comparison-$condition"
  done
done
```

Compare completed task quality, missing evidence, useful versus redundant delegation and human correction. Help-read count is secondary. Different work splits can be equally good. The missing-source case tests limitation reporting, not a forced backend failure. These smoke fixtures and a small comparison are only initial evidence; don't generalize them into broad performance claims.

## Release status

Live qualification and the comparison remain unrun. The provider/routing requirements in [field testing](field-testing.md) still apply independently. Keep PR #103 draft and unmerged until live evidence and version/lockfile/changelog/release-label preparation are resolved. Do not use `release:none` to bypass release policy for shipped skills.
