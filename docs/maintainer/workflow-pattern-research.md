# Workflow pattern selection for Flow

Research and implementation decision record, 2026-10-27. This is a curated set for Flow's parent-agent journey, **not a measured popularity ranking or evidence that the new guidance improves model behavior**. Runtime contracts remain authoritative.

## What was studied

Primary practitioner documentation and implementations show substantial overlap:

| Source | Useful evidence | What we take, not copy |
| --- | --- | --- |
| [Anthropic: Building effective agents](https://www.anthropic.com/research/building-effective-agents) | Chaining, routing, parallel work, orchestrator–workers and evaluator–optimizer are recurring workflow shapes; use the simplest approach that fits. | A small composable vocabulary, not a framework dependency. This 2024 article now explicitly notes that its tooling discussion has aged. |
| [LangGraph: Workflows and agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) | Runnable examples distinguish fixed chains, conditional routing, parallel branches, dynamically discovered work and feedback loops. | Testable code examples and clear data dependencies. Flow passes evidence explicitly rather than assuming LangGraph state semantics. |
| [Google ADK: Developer's guide to multi-agent patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/) | Sequential pipelines, dispatch, fan-out/gather and generator/critic loops have concrete task uses. | Task-oriented descriptions and the distinction between dispatching one branch and running all branches. No ADK shared-state or automatic-transfer assumptions. |
| [Microsoft: AI agent orchestration patterns](https://learn.microsoft.com/en-us/azure/architecture/ai-ml/guide/ai-agent-design-patterns) | Sequential, concurrent, group-chat, handoff and dynamic planning patterns have different costs and coordination needs. | Select patterns by the work; group chat is not a default substitute for explicit assignments. |
| [LangGraph Graph API: Send](https://docs.langchain.com/oss/python/langgraph/graph-api#send) | Map–reduce handles dynamically sized independent item sets. | Explicit item identity and aggregation rather than treating a corpus as a few unrelated scopes. No dependency on Send or a graph runtime. |
| [LangChain: using LLMs to improve documentation](https://www.langchain.com/blog/llms-to-improve-documentation) | A practical question-analysis workload uses document/question grouping and summarization. | Corpus processing deserves its own example, not only software review. This is one case study, not a universal performance claim. |
| [Agent Skills specification](https://agentskills.io/specification) | Metadata supports discovery, SKILL.md is loaded on activation, and focused references/scripts can be read on demand. | A short task index linking directly to each focused guide, with code loaded only when needed. |

This is enough convergence to choose a useful small library. It does not establish that any fixed number of agents, model mix or batch size is optimal. Those choices depend on the task, environment and evidence.

## Selection criteria

Advertise a pattern when it answers a distinct parent question, recurs across credible sources or a concrete user workload, composes through Flow's current helpers, and can be explained without a new management system. Merge variants when separate entries would make selection harder. Prefer examples that let the parent and child use judgment.

## The seven advertised patterns

| Pattern | Parent's question | Distinct value / implementation |
| --- | --- | --- |
| **Parallel work** | “I know several scopes; can they run together?” | Existing parallel-sweep plus optional branch-and-converge. Synthesis is a variant, not another top-level category. |
| **Batch map–reduce** | “How do I process hundreds of similar items and keep per-item results?” | New bounded worker-pool recipe, size-estimated batches, explicit item coverage and optional hierarchical synthesis. |
| **Pipeline / sequential handoff** | “Which result must feed the next step?” | Complete runnable example in its guide; ordinary sequential awaits. Per-item `pipeline()` semantics are explained separately. |
| **Routing / conditional dispatch** | “Which treatment fits this input?” | Complete example using a known category; optional classification only when it adds value. No automatic provider failover. |
| **Discover and delegate** | “What subtasks exist? I cannot know before looking.” | Complete bounded structured-discovery example; skips planning when the parent already knows the split. |
| **Independent review** | “Does this existing artifact hold up to a fresh reading?” | New same-target parallel review recipe; existing draft-then-critic remains an optional variant. Parent judges, not a vote. |
| **Bounded refinement** | “Can feedback or tests guide a limited improvement cycle?” | Reuses existing Codex-only bounded-repair; also explains non-code feedback and the difference between refinement and retry. |

Direct delegation and local work are the baseline **outside** this catalog. The seven patterns are not seven stages, roles or compulsory files to read. A child may solve its assignment without following a predefined internal method.

## Progressive loading design

Keep the always-loaded coordinator prompt unchanged. Its existing pointer to the native `pi-flow-orchestration` skill suffices. Broaden only the skill's discovery description so corpus summarization, routing and dynamic work are findable.

The skill contains one small task table. Each row links straight to `patterns/<name>.md`, which holds its own use/avoid advice, inputs, an example or direct recipe link, expected results and relevant limits. The parent loads the chosen guide, then that script only if it wants the runnable starting point. Exact contract, backend and recovery references remain targeted reads. `references/pattern-selection.md` stays at its established path as composition notes, not a second full chooser. The public playbook points to this index instead of duplicating every guide.

This is native file-based discovery, not a new automatic skill-selection mechanism. Tests establish reachable packaged files and executable examples; only real parent-agent traces can establish whether discovery works naturally.

## Deliberately not advertised separately

**Branch-and-converge** is the optional synthesis variant of parallel work. **Hierarchical reduction** is part of bulk map–reduce. **Draft-and-critic** is a review variant; it should not force an authoring stage for an existing artifact. **Human approval** is the user's existing policy, not a generic mandatory workflow. **Background execution** is an execution choice shared by patterns, not a pattern itself.

Group chat/debate, automatic majority voting, provider failover, persistent teams and open-ended self-improvement are not in the primary catalog. They either duplicate existing work shapes, require capabilities Flow does not claim, or add process without a clear payoff for the examples at hand. Revisit only after actual work exposes a useful missing shape.

## Implementation and evidence

The original four recipe scripts are unchanged. Two new scripts use only the existing `agent`, `parallel`, `phase` and JSON inputs/outputs. Three guides supply complete inline examples rather than more standalone entrypoints. No dependencies, runtime helpers, tool schemas, permission models, UI, workflow-name registration or retry mechanisms are added.

The bulk recipe uses caller-provided source-size estimates, not a tokenizer. It returns every item ID, keeps unreadable/failed records, uses a bounded local pool under Flow's shared limiter, and returns remaining evidence when a reducer packet cannot fit instead of silently clipping it. Read-only source handling avoids shared output-file races; persistent deliverables require an authorized parent write. Run receipts are not a permanent corpus database.

Verification should include the executable Flow runtime with deterministic children: uneven 240-item input, per-item IDs, partial/all failure, malformed records, reducer size blockage, reducer failure, pool bounds, and independent review without a drafting stage. Guide examples should execute through the same runtime; all linked guides/scripts must appear in the npm tarball. These checks do not establish extraction accuracy, native-model schema fidelity or live workflow selection.

Before release, follow the existing field-testing policy. A small fresh-session trial should include an ordinary single task, mixed known categories, an unknown split and a real uneven corpus. Compare against the pre-catalog revision with the same tools/model, record the guidance actually read, and check task completion, missing evidence and user corrections first. Help-call count is secondary. No real-provider or matched parent-agent improvement is claimed without those traces.
