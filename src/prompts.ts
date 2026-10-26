import { EXTERNAL_RUNS_EXAMPLES } from "./contract/runs.ts";
import type { SavedWorkflow } from "./workflow/registry.ts";
import { EXTERNAL_HARNESSES, type PermissionTier, type SubagentProfile } from "./types.ts";
import { externalProfileRole, externalRoleAvailability } from "./profiles.ts";

export const AGENT_PROMPT_SNIPPET =
  "Delegate one independent assignment to a configured external CLI or named Pi harness; use several direct calls for unrelated jobs.";

export const WORKFLOW_PROMPT_SNIPPET =
  "Coordinate related assignments and dependencies through JavaScript orchestration; the pi-flow-orchestration skill offers optional recipes. Use external_help for precise syntax.";

export const EXTERNAL_HELP_PROMPT_SNIPPET =
  "Show the delegation playbook, role details, permission behavior, workflow guidance, public contracts, or harness capabilities on demand.";

export const EXTERNAL_RUNS_PROMPT_SNIPPET =
  "Supervise session-owned external runs (supply only fields for the chosen action): list (optional workflowRunId, limit, cursor, workflowCursor), inspect (runIds: 1 ID with any view, or 2-20 IDs for summary batch), wait (runIds 1-100, optional mode/limitBytes), or cancel (runIds: 1 ID, optional reason). view: final returns only a verified terminal answer, empty until one exists.";

// Only elide the "(harness only)" suffix when every configured harness
// carries the role; a role available on all configured CLIs but no pi harness
// still gets the suffix, so callers see the true availability rather than
// a stale "no suffix means universal" assumption.
function roleLabel(role: string, harnesses: string[], configuredHarnesses: readonly string[]): string {
  return `${role}${harnesses.length === configuredHarnesses.length ? "" : ` (${harnesses.join(", ")} only)`}`;
}

export function formatExternalRoleCatalog(
  profiles: Map<string, SubagentProfile>,
  defaultHarness: string,
  configuredHarnessNames: readonly string[] = EXTERNAL_HARNESSES,
): string {
  const roles = [...externalRoleAvailability(profiles)].map(([role, harnesses]) => roleLabel(role, harnesses, configuredHarnessNames));
  const exactProfiles = [...profiles.values()]
    .filter((profile) => !profile.configurationError && !externalProfileRole(profile))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((profile) => `${profile.name} (${profile.harness ?? profile.backend})`);
  return [
    `Harnesses: ${configuredHarnessNames.map((harness) => harness === defaultHarness ? `${harness} (default)` : harness).join(", ")}.`,
    `Roles: ${roles.join(", ") || "none"}.`,
    ...(exactProfiles.length ? [`Exact-only profiles: ${exactProfiles.join(", ")}.`] : []),
  ].join("\n");
}

export function formatExternalRoleHelp(
  profiles: Map<string, SubagentProfile>,
  defaultHarness: string,
  harness?: string,
): string {
  const selectedProfiles = [...profiles.values()]
    .filter((profile) => !harness || (profile.harness ?? profile.backend) === harness)
    .sort((a, b) => a.name.localeCompare(b.name));
  const roles = externalRoleAvailability(new Map(selectedProfiles.map((profile) => [profile.name, profile])));
  const roleLines = [...roles].flatMap(([role, harnesses]) => [
    `- ${role} (${harnesses.join(", ")})`,
    ...harnesses.map((availableHarness) => {
      const profile = profiles.get(`${availableHarness}/${role}`) ?? profiles.get(`${availableHarness}-${role}`);
      return `  - ${profile?.name}: ${profile?.description ?? role}`;
    }),
  ]);
  const exactLines = selectedProfiles
    .filter((profile) => !profile.configurationError && !externalProfileRole(profile))
    .map((profile) => `- ${profile.name} (${profile.harness ?? profile.backend}): ${profile.description}`);
  return [
    `External roles${harness ? ` on ${harness}` : ""}. Default harness: ${defaultHarness}.`,
    roleLines.join("\n") || "- none",
    ...(exactLines.length ? ["Exact-only profiles (use legacy subagent_type):", exactLines.join("\n")] : []),
    "Availability reflects built-in and authored roles, not CLI installation or authentication.",
    "Role selection never falls back to another harness.",
  ].join("\n\n");
}

function truncateWorkflowText(text: string, maxLength = 180): string {
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export function formatSavedWorkflows(workflows: SavedWorkflow[], maxItems = 20): string {
  if (workflows.length === 0) return "Saved workflows: none.";
  const shown = workflows.slice(0, maxItems);
  const lines = shown.map(
    (workflow) => `- ${workflow.name} (${workflow.scope}): ${truncateWorkflowText(workflow.description)}`,
  );
  if (workflows.length > shown.length) {
    lines.push(`- … ${workflows.length - shown.length} more saved workflow(s) not shown.`);
  }
  return `Saved workflows:\n${lines.join("\n")}`;
}


export function buildCoordinatorPrompt(
  profiles: Map<string, SubagentProfile>,
  defaultHarness: string,
  configuredHarnessNames: readonly string[] = EXTERNAL_HARNESSES,
): string {
  return `# External delegation

${formatExternalRoleCatalog(profiles, defaultHarness, configuredHarnessNames)}

Flow extends your ability to do the user's work; it is not a required orchestration ceremony.

- **Choose by how the work connects.** Work directly when useful. Use external_delegate for a bounded independent assignment; several independent jobs can use several direct delegations. Use external_workflow when jobs share dependencies, a coordinated plan, or one grouped result. Multiple tasks alone do not require a workflow.
- **Brief and trust the child.** State the outcome, relevant context and constraints, what may change, and what a useful result looks like. Use absolute workspace/file paths because nested agents may start in another workspace. Leave its investigation and implementation method to the child. A general worker is fine; specialize a role when it helps. Role instructions describe the job; permission controls allowed access (omission uses the configured default, which may be danger).
- **Choose a fitting environment.** Prefer the configured default harness when it can do the job; select another for real capability, availability or user preference. Share selected parent context only if needed. Use fresh context for genuinely independent judgments; pass a previous child result explicitly to a dependent one.
- **Launch naturally.** Before coordinated work, explain the purpose, assignments, parallel/sequential order, allowed changes and deliverable. Follow the user's existing approval policy; do not invent an extra gate. Use short scripts with agent(), parallel() or sequential awaits. Show the same useful roadmap in meta.phases and mark transitions with phase(); older saved scripts without phases remain valid. Foreground is normal when you need the answer next; background is useful when you can do independent work before collection or the user wants work left running.
- **Keep moving.** Read the canonical result, integrate useful findings and decide the next action. Handle missing scopes honestly; read referenced output through external_runs when not inline. A successful tool receipt is not automatic task acceptance. Retry a failed run, or switch its model or harness, only with user authorization. Agy's one disclosed infrastructure retry is the automatic exception.

For nontrivial composition, consult the installed pi-flow-orchestration skill and its recipes only when it helps. For exact syntax and advanced backend behavior use external_help topics workflow, contracts, capabilities, roles or permissions. No fixed agent count, required pattern name or mandatory skill read.`;
}

export interface UsageAgentExample {
  description: string;
  prompt: string;
  role: string;
  harness: string;
  /** Omit on ordinary calls so defaultPermission applies. Set only to confine the tier. */
  permission?: PermissionTier;
  background?: boolean;
  resume?: string;
  context?: { mode: "none" } | { mode: "recent"; turns: number } | { mode: "full" };
}

/** One self-contained external_delegate call. Valid against the external_delegate tool schema. Permission stays omitted. */
export const USAGE_ONE_AGENT: UsageAgentExample = {
  description: "Map the repository",
  prompt: "Map /absolute/repo. Read only. Return the important files and how they fit together. Do not edit.",
  role: "explorer",
  harness: "claude",
};

/** Fresh reviewer on the default tier, so the shell stays available. The prompt forbids edits. */
export const USAGE_INDEPENDENT_REVIEW: UsageAgentExample = {
  description: "Independent review",
  prompt: "Review /absolute/repo read-only. Report defects with file paths. Do not edit.",
  role: "reviewer",
  harness: "codex",
  context: { mode: "none" },
};

/** Returns after registration. The parent does independent local work first or defers collection across turns before reading through external_runs. */
export const USAGE_BACKGROUND_AGENT: UsageAgentExample = {
  description: "Background map",
  prompt: "Map /absolute/repo read-only and return a short file list. Do not edit.",
  role: "explorer",
  harness: "claude",
  background: true,
};

/** Single-id inspect with final view, shared with the authoritative external_runs contract examples. */
export const USAGE_RUNS_FINAL = EXTERNAL_RUNS_EXAMPLES.inspectSingle;

/** Continues a CLI child that stored a session id. Named pi-* harnesses cannot resume. */
export const USAGE_RESUME_AGENT: UsageAgentExample = {
  description: "Continue the map",
  prompt: "Continue the map of /absolute/repo. Add the missing test entry points you already found. Do not expand scope.",
  role: "explorer",
  harness: "claude",
  resume: "run_example",
};

/** The one call that sets permission. Use it to confine a tier the harness can enforce. */
export const USAGE_RESTRICTED_AGENT: UsageAgentExample = {
  description: "Confined lookup",
  prompt: "List the public entry points in /absolute/repo. Read only. Do not edit.",
  role: "explorer",
  harness: "claude",
  permission: "readonly",
};

export const USAGE_WORKFLOW_CALLS: { prompt: string; options: { description: string; role: string; harness: string; permission?: PermissionTier } }[] = [
  {
    prompt: "Map /absolute/repo read-only. Return important paths. Do not edit.",
    options: { description: "map", role: "explorer", harness: "claude" },
  },
  {
    prompt: "Review /absolute/repo read-only. Report defects with paths. Do not edit.",
    options: { description: "review", role: "reviewer", harness: "codex" },
  },
];

/** Parallel workflow whose branches catch ChildRunError so one failure does not drain the other. */
export function usageWorkflowScript(): string {
  const branches = USAGE_WORKFLOW_CALLS.map((call) => `  async () => {
    try {
      return { ok: true, value: await agent(${JSON.stringify(call.prompt)}, ${JSON.stringify(call.options)}) };
    } catch (error) {
      return { ok: false, runId: error.runId, outcome: error.outcome, message: error.message };
    }
  }`);
  return [
    'export const meta = { apiVersion: 1, name: "parallel-review", description: "Review in parallel and keep a sibling failure", phases: [{ title: "Review", detail: "Claude maps the repository while Codex reviews concurrency; neither is assigned to edit files." }, { title: "Collect", detail: "Return both findings, including any failed check." }] };',
    'phase("Review");',
    "const settled = await parallel([",
    branches.join(",\n"),
    "]);",
    'phase("Collect");',
    "return { settled };",
    "",
  ].join("\n");
}

function jsonBlock(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Worked playbook served by external_help topic "usage". Examples are the exported constants. */

export function formatUsagePlaybook(): string {
  return `# Flow: delegate work, use results, keep moving

**Choose by the work.** Work directly when useful. Use external_delegate for an independent assignment (several independent assignments may use several direct calls). Use external_workflow when jobs depend on each other, share one plan, or need a grouped result. No compulsory pattern name, team size, or planning stage.

**Brief and launch.** Give the child a goal, relevant context, what it may change and what it should return. Prefer the configured default harness if suitable; use a specialist role when it helps, otherwise worker. Roles give instructions, not permissions: an omitted permission uses the configured default (which may be danger). Omit parent history unless useful; choose fresh context for independent critique and pass selected evidence explicitly for dependent steps.

**Use the result.** Foreground is simplest when the next action needs the answer. Background is for useful independent parent work or a user-requested deferred run; collect through external_runs when needed. Inspect the result (inline or refs.final), make sense of missing checks, integrate findings, and choose the next action. Operation success is not task acceptance.

One independent assignment (select a working harness for your environment):
${jsonBlock(USAGE_ONE_AGENT)}

One grouped parallel workflow (pass as external_workflow script; this is illustrative rather than a required method):
${usageWorkflowScript()}

**Need something more specific?** Read the installed pi-flow-orchestration skill for patterns and adaptable recipe files, or call external_help with:
- topic: "workflow" for script helpers, saved workflows, failure handling, background supervision and replay;
- topic: "contracts" (optionally tool: "external_workflow" or "external_delegate") for exact arguments, result envelopes and paging;
- topic: "capabilities" for current harness constraints, tools and availability limitations;
- topic: "roles" or "permissions" when a role or permission tier needs explanation.

Bundled skill recipes are examples, not registered saved-workflow names. Use them as inline scripts or copy into an allowed workflow directory. A user's existing authorization determines what children may change. The parent remains responsible for finishing the original task.`;
}
