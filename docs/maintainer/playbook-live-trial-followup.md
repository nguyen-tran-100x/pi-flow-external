# Nine-run live follow-up: useful evidence, not release qualification

Reviewer report supplied on 2026-10-27, after `aacb2b0` (PR #103). The table below records that report; the raw nine retained bundles were not available in this correction environment for independent rescoring. Do not treat it as a newly executed or controlled comparison.

## What the reported trials established

| Task | Reported outcome |
| --- | --- |
| Local task, baseline and candidate | Correct answer; no unnecessary delegation |
| Twelve-transcript corpus, both versions | All IDs returned; theme counts 4/4/4 |
| Unknown-scope investigation, both versions | Both relevant causes identified; missing production evidence disclosed |
| Missing source, both versions | Evidence gap correctly reported; each parent corrected rejected arguments and launched one child |
| Large-output task, candidate only | Eight pages reconstructed to the entire canonical child answer; that answer omitted one trailing source space |

Six original automatic verdicts passed and three failed, but the checker defects below prevent using those verdicts unchanged. The baseline used more than the intended Codex harness and attempted an unavailable Grok executable. This confounds a controlled comparison, not every individual task result.

The candidate found the batch guide and recipe and changed from discovery to parallel work after inspecting sources itself. It also reread transcripts before delegating them, used 17 parent calls versus 4 in the baseline corpus task, and adapted rather than ran the shipped bulk recipe unchanged. One trial per condition with different child harnesses does **not** establish an efficiency win or loss.

## Narrow runner corrections

1. Parse the public envelope from `result.structuredContent` first. Keep `details` and JSON text only as older-format fallbacks. The regression fixture reproduces the reported field layout; its payloads are explicitly synthetic, not invented live evidence.
2. Report invocation attempts, rejected arguments and unique admitted run IDs separately. A returned run ID counts even if that run fails; a prelaunch rejection with `run:null` does not. Unclassified results remain unknown rather than being assumed safe or labelled a retry. Argument correction is interface friction, not a second executed child.
3. In the temporary version-5 configuration, disable every built-in harness except the selected one. Keep a nonsecret `trial-settings.json` snapshot and validate actual child receipt harnesses. A default-only legacy bundle can retain its task outcome but cannot silently qualify as a fixed-harness comparison. Entirely local trials do not depend on child harnesses.
4. Report three independent pagination observations: linked pages versus the retained canonical child result; canonical result versus source bytes; continuation tokens present in model-facing tool text. A missing trailing source space remains an exact-copy failure, not evidence of retrieval loss.

No runtime API, permission model or workflow recipe is changed. Unit tests cover the reported event shape, rejected-argument recovery, true second-run detection, fixed-harness catalog selection, mixed receipts and eight-page retrieval with a one-space source difference.

## Cursor visibility is explicitly outside this correction

On the reported Pi surface, the continuation token was in structured metadata, not model-visible tool text. The agent searched caches and session logs to recover it; the task used 49 parent tool calls. This is an observed usability defect. It has **not** been established as a regression introduced by the playbook PR.

This correction does not change the runtime's output surface or endorse log excavation as a normal pagination path. `--verify` reports `model-visible-pagination-unqualified` when tool-text continuation is not established. No usable end-to-end pagination claim is made on that surface. A separate focused integration correction and a small targeted rerun are needed before making that claim; do not redesign the whole playbook around the observation.

## Write boundary disclosure

The reviewer observed a baseline Claude child writing a plan under `~/.claude/plans/` despite the no-edits request. The write was outside the fixture and therefore invisible to fixture hashing. The plan was not deleted by this correction; preserve the retained event as evidence.

`fixture-unchanged` means only that the fixture's bytes did not change. Neither it nor the runner's requested `readonly` tier proves no writes elsewhere. The default controlled rerun uses Codex; this avoids the reported Claude confound but does not turn the fixture check into a machine-wide write audit. No redesign of Claude permissions is included here.

## Reassess first; rerun only what needs new execution

Run the corrected `--verify <retained-output-dir>` on existing bundles; it recomputes observations without changing their stored events, verdict caches or review files. Case definitions and digests are unchanged. Expect per-run task results plus comparison and pagination qualification limits; a partial suite still fails whole-suite qualification.

- Existing missing-source bundles can resolve the invocation-count false failures without another child call, provided their retained response envelopes are complete.
- Existing large-output evidence can separate complete retrieval from source-copy mismatch. It cannot prove that continuation was conveniently visible to the model.
- Local-task outcomes need no rerun solely because unused child harnesses were available. A controlled corpus/discovery comparison needs new matched runs where child selection was confounded.
- Rerun exact copying only if exact source reproduction is itself a required claim. Rerun pagination usability after the model-facing continuation surface is fixed, not merely after the parser is fixed.

Keep the draft and release-preparation hold. Record successful task findings without claiming comprehensive behavioral qualification, same-harness control, no writes, or better efficiency.
