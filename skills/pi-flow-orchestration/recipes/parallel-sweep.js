export const meta = {
  apiVersion: 1,
  name: "parallel-sweep",
  description: "Inspect independent scopes and preserve partial failures",
  phases: [
    { title: "Sweep", detail: "Inspect separate scopes in parallel using enforced read-only access." },
    { title: "Collect", detail: "Return every scope, including failed checks; parent verifies coverage." },
  ],
};

// Call external_workflow with args: { task: "...", scopes: ["...", "..."], harness: "codex" }.
// Scope list is an explicit parent choice; do not ask children to invent extra tasks.
const input = args || {};
if (typeof input.task !== "string" || !input.task.trim()) throw new Error("args.task is required");
if (!Array.isArray(input.scopes) || input.scopes.length < 2 || input.scopes.length > 8 ||
    input.scopes.some((scope) => typeof scope !== "string" || !scope.trim())) {
  throw new Error("args.scopes must contain 2-8 nonempty strings");
}
const harness = input.harness || "codex"; // Replace only with a harness supporting readonly.
phase("Sweep");
const results = await parallel(input.scopes.map((scope) => async () => {
  try {
    const value = await agent(
      "Task: " + input.task + "\nIndependent scope: " + scope +
      "\nRead sources directly. Report evidence, paths, and gaps. Do not edit.",
      { role: "explorer", harness, permission: "readonly", context: { mode: "none" }, description: "Inspect " + scope }
    );
    return { scope, ok: true, value };
  } catch (error) {
    return { scope, ok: false, outcome: error.outcome || "failed", message: String(error.message || error) };
  }
}));
phase("Collect");
return {
  task: input.task,
  results,
  coveredScopes: results.filter((item) => item.ok).map((item) => item.scope),
  failedScopes: results.filter((item) => !item.ok).map((item) => item.scope),
};
