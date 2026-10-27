# Routing / conditional dispatch

**Use when:** different inputs need different treatment—bug reports versus feature questions, technical versus commercial research, extractable versus already-structured documents. Route using known fields or the parent's judgment first. Do not pay for a classifier when the category is already clear.

**Shape:** inspect category → choose one useful assignment → use the result. Routing differs from parallel work: normally only the matching branch runs.

## Complete inline example

The caller has already assigned `kind` as `bug` or `feature`; no classifier agent is needed. Pass `{kind:"bug", target:"/work/shop", harness:"codex"}`. A general worker gets a task-specific brief without introducing more saved roles.

```js
export const meta = {
  apiVersion: 1, name: "conditional-dispatch", description: "Choose a task from a known input category",
  phases: [{ title: "Dispatch" }],
};
const input = args || {};
const routes = {
  bug: "Investigate the reported failure and return likely causes with evidence. Do not edit.",
  feature: "Assess the feature request and return scope, options and open questions. Do not edit.",
};
if (typeof input.kind !== "string" || !Object.prototype.hasOwnProperty.call(routes, input.kind)) {
  throw new Error("args.kind must be bug or feature; let the parent resolve unknown categories");
}
if (typeof input.target !== "string" || !input.target.trim()) throw new Error("args.target is required");
const harness = input.harness === undefined ? "codex" : input.harness;
if (typeof harness !== "string" || !harness.trim()) throw new Error("args.harness must be nonempty");
phase("Dispatch");
const result = await agent(routes[input.kind] + "\nTarget: " + input.target,
  { role: "worker", harness, permission: "readonly", context: { mode: "none" }, description: "Handle " + input.kind });
return { route: input.kind, result };
```

For genuinely ambiguous inputs, a classifier may return a small structured category, reason and `unknown` option; validate that output against caller-approved routes before dispatch. The parent may instead ask a clarifying question. A model's unsupported category is not permission to invent a role or switch providers.

Keep routing policy explicit and small. This pattern selects a treatment, **not an automatic model/harness fallback after failure**. Failed calls follow the existing retry-authorization rule. For mixed corpora, combine known routing with the batching technique rather than launching a separate orchestrator per row.

Exact selectors and capabilities: `external_help({topic:"contracts", tool:"external_delegate"})` and `external_help({topic:"capabilities"})`.
