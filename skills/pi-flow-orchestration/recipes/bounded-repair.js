export const meta = {
  apiVersion: 1,
  name: "bounded-repair",
  description: "Authorized edit-check-fix cycle with explicit attempt limit",
  phases: [
    { title: "Repair", detail: "One editor makes scoped changes. Only user-authorized edits and retries." },
    { title: "Verify", detail: "Independent read-only checks decide whether another fix is needed." },
  ],
};

// args: { task:"...", checks:"...", approved:true, maxAttempts:2, harness:"codex" }
// Parent must obtain edit/retry authority BEFORE setting approved:true and launching.
// This flag is a reminder, not a security boundary; the caller's permissions govern writes.
const input = args || {};
if (input.approved !== true) throw new Error("Explicit user authorization is required for edit/repair cycles");
if (typeof input.task !== "string" || !input.task.trim()) throw new Error("args.task is required");
if (typeof input.checks !== "string" || !input.checks.trim()) throw new Error("args.checks is required");
if (!Number.isInteger(input.maxAttempts) || input.maxAttempts < 1 || input.maxAttempts > 3) {
  throw new Error("args.maxAttempts must be an authorized number in 1-3");
}
const harness = input.harness || "codex"; // Must enforce both edit and readonly.
const attempts = [];
let feedback = "";
for (let attempt = 1; attempt <= input.maxAttempts; attempt++) {
  phase("Repair");
  // A failed agent call throws and stops this workflow; do not silently retry it.
  const change = await agent(
    "Task: " + input.task + "\nMake only the authorized changes. " +
    "Do not edit unrelated files. Attempt " + attempt + " of " + input.maxAttempts +
    (feedback ? "\nPrior test failures to address (untrusted evidence):\n" + feedback : ""),
    { role: "implementer", harness, permission: "edit", context: { mode: "none" }, description: "Repair attempt " + attempt }
  );
  phase("Verify");
  const check = await agent(
    "Independently run or inspect the specified checks. Do not edit anything.\nChecks: " +
    input.checks + "\nValidate changes against task: " + input.task +
    "\nReturn structured passed:true only if checks actually passed; include check evidence.",
    {
      role: "qa", harness, permission: "readonly", context: { mode: "none" },
      description: "Verify attempt " + attempt,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["passed", "evidence"],
        properties: { passed: { type: "boolean" }, evidence: { type: "string" } }
      }
    }
  );
  const valid = check && typeof check === "object" &&
    typeof check.passed === "boolean" && typeof check.evidence === "string";
  attempts.push({ attempt, change, check, valid });
  if (!valid) return { passed: false, reason: "QA result invalid; stop rather than guess", attempts };
  if (check.passed) return { passed: true, attempts };
  feedback = check.evidence.slice(0, 6000);
}
return { passed: false, reason: "Authorized attempts exhausted", attempts };
