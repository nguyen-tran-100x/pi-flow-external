import { StringEnum } from "@earendil-works/pi-ai";
import {
  defineTool,
  getAgentDir,
  type ExtensionContext,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { Type, type Static } from "typebox";
import { filterProfilesForModelRegistry } from "./core/model.ts";
import { disabledHarnessMessage, loadExternalCatalog } from "./profiles.ts";
import { loadHarnessConfigs } from "./harnesses.ts";
import {
  EXTERNAL_HELP_PROMPT_SNIPPET,
  formatExternalRoleHelp,
  formatSavedWorkflows,
  formatUsagePlaybook,
} from "./prompts.ts";
import { listSavedWorkflows } from "./workflow/registry.ts";
import { EXTERNAL_HARNESSES, type ExternalHarness } from "./types.ts";

const externalHelpParameters = Type.Object({
  topic: StringEnum(["usage", "roles", "permissions", "workflow"] as const, {
    description: "Help topic: usage playbook, role descriptions/configured profile availability, harness permissions, or workflow syntax and saved workflows.",
  }),
  harness: Type.Optional(Type.String({
    description: "Optional harness filter for roles or permissions: agy, claude, codex, grok, muse, opencode, or a registered pi-* harness. usage and workflow describe every harness.",
  })),
});

type ExternalHelpParams = Static<typeof externalHelpParameters>;

export interface CreateExternalHelpToolOptions {
  getDefaultHarness: (ctx: ExtensionContext) => string;
  workflowEnabled: boolean;
}

function isProjectTrusted(ctx: ExtensionContext): boolean {
  try {
    return ctx.isProjectTrusted();
  } catch {
    return false;
  }
}

const PERMISSION_HELP_BY_BACKEND: Record<ExternalHarness | "pi", string> = {
  agy: "agy: autonomous only. Every accepted run uses --dangerously-skip-permissions and is unsandboxed. readonly and edit are rejected instead of being broadened to that mode.",
  claude: "claude: readonly uses --permission-mode plan, edit uses --permission-mode acceptEdits, and danger uses --dangerously-skip-permissions (--permission-mode auto under effective UID 0). Headless readonly/edit deny Bash. The requested tier is used as-is; role names do not raise it.",
  codex: "codex: readonly, edit, and danger map to read-only, workspace-write, and danger-full-access sandboxes. This governs model-generated shell commands, not MCP/plugins/hooks.",
  grok: "grok: readonly uses --sandbox read-only, edit uses --sandbox workspace, and danger uses --sandbox off, always alongside --permission-mode bypassPermissions. Enforced by a kernel sandbox, but network blocking is Linux-only; edit limits writes to the workspace.",
  muse: "muse: readonly uses --disable-approval --disable-write --disable-shell (approval, non-shell writes, and shell execution all disabled), edit uses --disable-approval alone (the sandbox stays enabled by default; writes and shell remain available within it), and danger uses --yolo, which disables approval and the sandbox and additionally trusts this workspace (loads its skills/rules) for this run — a broader grant than an unsandboxed run alone. Native provider retries (up to 10 attempts) are disclosed via activity narration, not performed by this extension.",
  opencode: "opencode (OpenCode 2): every run is `opencode run --standalone`, a private server this run owns, never the shared background service. readonly and edit run under a per-run agent injected through OPENCODE_CONFIG_CONTENT and selected with --agent on every run, resumes included, whose permission rules deny every tool except read/grep/glob (readonly) or those plus edit/write/patch (edit); shell, subagent, web, MCP, and plugin tools are hidden, and edits outside the workspace are denied. Resuming a session with its own permission rules at readonly/edit, or a restricted session at danger, is refused. These are OpenCode application rules, not an OS sandbox, and project or user plugins and MCP servers still load and run their code. danger uses --auto, which approves every permission ask except explicit denies. OpenCode retries transient provider errors itself (up to 10 retries); this extension does not retry.",
  pi: "pi-* (named Pi harness configs): run in-process, not as a CLI. Tiers gate a curated built-in tool list (read/bash/edit/write/grep/find/ls). That list is not an OS sandbox; danger-tier bash has host access. Each registration selects preset minimal (the default when the field is absent; skills stay unloaded) or skills (installed skills load; project skills load only when the project is trusted). Extensions, prompt templates, and themes stay unloaded. Retry is disabled per child regardless of Pi's own settings.",
};

/** Resolve a requested, already-validated harness name to its permission-semantics backend. */
function permissionHelpBackend(harness: string, configuredPiHarnesses: ReadonlySet<string>): ExternalHarness | "pi" {
  if ((EXTERNAL_HARNESSES as readonly string[]).includes(harness)) return harness as ExternalHarness;
  // Callers only reach here after validateHarnessFilter, so any name that is
  // not one of the external harnesses is guaranteed to be a registered
  // pi-* harness at this point — never an unrecognized string silently
  // treated as "pi".
  return "pi";
}

function permissionHelp(harness: string | undefined, configuredPiHarnesses: ReadonlySet<string>): string {
  const backends: (ExternalHarness | "pi")[] = harness
    ? [permissionHelpBackend(harness, configuredPiHarnesses)]
    : [...EXTERNAL_HARNESSES, ...(configuredPiHarnesses.size ? (["pi"] as const) : [])];
  return [
    "External CLIs and pi-* harnesses run with host access; use them only in trusted repositories. Permission is the call's explicit tier, otherwise the global defaultPermission (danger unless changed). A role describes intent and does not change that tier. Antigravity rejects readonly and edit.",
    ...backends.map((name) => PERMISSION_HELP_BY_BACKEND[name]),
    "Failed or aborted runs are not silently retried. Only agy may retry once for an infrastructure-classified auth, eligibility, or network failure, and the receipt discloses it.",
  ].join("\n\n");
}

/**
 * Reject an unknown harness filter up front, listing the live configured
 * set, rather than letting it silently fall through to "pi" (permissions)
 * or an empty catalog (roles). "Configured" means what a caller could
 * actually select today: the external CLIs plus any registered
 * pi-* harness — never a raw guess at what might exist.
 */
function validateHarnessFilter(harness: string | undefined, configuredPiHarnesses: ReadonlySet<string>): void {
  if (harness === undefined) return;
  if ((EXTERNAL_HARNESSES as readonly string[]).includes(harness) || configuredPiHarnesses.has(harness)) return;
  const configured = [...EXTERNAL_HARNESSES, ...configuredPiHarnesses].sort();
  throw new Error(
    `Unknown harness "${harness}". Configured harnesses: ${configured.join(", ") || "none"}.`,
  );
}

function workflowHelp(workflowsEnabled: boolean, workflows: ReturnType<typeof listSavedWorkflows>): string {
  const availability = workflowsEnabled ? "The external_workflow tool is enabled." : "The external_workflow tool is disabled for this extension instance.";
  return `${availability} It runs trusted JavaScript, not a sandbox.

Provide exactly one workflow source: name, scriptPath, or script. Every script starts with the literal current declaration export const meta = { apiVersion: 1, name, description }, calls agent() at least once, awaits every started call, and returns JSON-serializable data. Missing/unsupported API versions fail before any child launches. Project .pi/workflows are visible only when the project is trusted.

Before calling external_workflow, explain the purpose, assignments, parallel/sequential order, allowed changes, and deliverable in plain language. Add the same roadmap as meta.phases: [{ title: "Review", detail: "Who checks what and whether files may change" }, ...], and call phase("Review") when that stage actually starts. Planned phases and details remain visible on the live card; they describe intent, while child states/activity show observed execution. Explain material plan changes and follow the user's existing approval policy. The briefing is an agent instruction, not a runtime-verified chat message; phases remain optional for existing saved scripts. Use external_runs inspect view launch to retrieve the recorded purpose and plan (also includes sensitive script/args); background receipts are not live monitors.

APIs: agent(prompt, { description, label, role, harness, subagent_type, permission, max_budget_usd, resume, context, schema, phase }); parallel(thunks); pipeline(items, ...stages); phase(title); log(message). Globals: args and cwd. Agent options other than the profile selector are optional. "description" is the common task-name option shared with the direct external_delegate tool; "label" is a compatible alias — set only one, or both to the same value. Choose role/harness or legacy exact subagent_type, never both. Use unique descriptions/labels and clear task prompts. An agent() succeeds with its value or throws ChildRunError { runId, outcome, message, outputRef, diagnosticsRef }; catch optional failures explicitly. Uncaught failures terminate the workflow and drain siblings. Helpers never convert failures to null. Context options: {mode:"none"} (default), {mode:"recent",turns:N} (positive integer, includes current user turn), or {mode:"full"} (available context after compaction). All children share invocation-time context/settings; earlier child results must still be passed explicitly. Context excludes thinking/system instructions and pending calls; images and snapshots over 1 MiB fail without truncation. Context sharing cannot be combined with resume. Use schema for results that control branching or aggregation. Imports, filesystem globals, Date APIs, and Math.random() are unavailable.

Execution mode: foreground is blocking by default when you need the result next, including parallel workflows. Pass background:true when you have independent local work (read, edit, bash) that does not touch files the workflow may change, or on an explicit background request; do that independent work first and never launch background then immediately wait. Ending a turn does not stop a background run: if the user asks to leave the workflow running, switch tasks, or check back later, report the runId and work on the other task or end your turn without waiting; otherwise retain the ID and collect it after your independent work finishes. Both modes support parallel([() => agent(...), ...]) under the same maxConcurrentSubagents cap; sequential awaits stay serial. Background changes neither permissions nor budget enforcement. Its stable handle means accepted, not completed; the receipt is not a live monitor, though UI sessions show active background runs in the status bar and wake the session with a follow-up message when an uncollected background run settles across turns. Keep the session open: orderly shutdown requests cancellation with bounded cleanup; crashes leave uncertain evidence and restart does not adopt work. Topic usage contains the worked collection guidance.

Supervision: external_runs selects targets with runIds. list takes optional workflowRunId, cursor, workflowCursor, and limit. inspect with one id reads summary/output/diagnostics/final/launch and pages with cursor and limitBytes; several ids (up to 20) batch summary only. wait takes up to 100 runIds in mode any or all; check ok for the operation, then each completed run's outcome and pending IDs. It never cancels pending work and can return early on a failed workflow even in all mode. If settlement is already known, skip wait. Use inline successful output when available; otherwise inspect final and follow nextCursor. Failures need diagnostics/output, not final. Follow nextWorkflowCursor for workflow listings too. Foreground-call interruption cancels that call; interrupting wait only stops waiting. Use cancel with one id and an optional reason to stop background work. Cancelling a workflow stops active children; cancelling one child is a catchable workflow error. There is no live steering.

Replay: resumeFromRunId works only with persisted scriptPath and starts an explicit new attempt. It reuses the longest unchanged prefix of successful child calls; the first changed/failed/cancelled/timed-out call and its suffix run again. Script recomposition is cheap, but child reruns can cost money or repeat side effects. There is no automatic repaired-script replay.

Background is an external_workflow tool call parameter ({ script, background: true }), never a meta field — meta.background is silently ignored and does not run the workflow in the background.

Example (blocking by default; pass background:true on the external_workflow call when doing independent local work first or on a background request):
export const meta = {
  apiVersion: 1, name: "review", description: "Map and review a repository",
  phases: [
    { title: "Check", detail: "The default harness maps the repository while Codex reviews it; neither is assigned edits." },
    { title: "Collect", detail: "Return both reports for the parent to compare." },
  ],
};
phase("Check");
const [map, review] = await parallel([
  () => agent("Map /absolute/repo read-only.", { label: "map", role: "explorer" }),
  () => agent("Review /absolute/repo read-only.", { label: "review", role: "reviewer", harness: "codex" }),
]);
phase("Collect");
return { map, review };

${formatSavedWorkflows(workflows)}`;
}

export function createExternalHelpTool(
  options: CreateExternalHelpToolOptions,
): ToolDefinition<typeof externalHelpParameters, { topic: ExternalHelpParams["topic"]; harness?: string }> {
  return defineTool({
    name: "external_help",
    label: "External Help",
    description: "Read-only help on demand: usage playbook, role details, permission behavior, and workflow usage (including background runs, external_runs supervision syntax, and replay) or saved-workflow discovery.",
    promptSnippet: EXTERNAL_HELP_PROMPT_SNIPPET,
    parameters: externalHelpParameters,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      // A schema-conversion layer downstream of this tool's declaration may
      // present `harness` as required (#62); treat a blank/whitespace
      // placeholder as omitted. usage and workflow describe every harness, so
      // an explicit harness is not a filter and does not error.
      const harness = params.harness?.trim() ? params.harness.trim() : undefined;
      let text: string;
      const catalog = loadExternalCatalog(getAgentDir());
      const harnessConfigs = catalog.harnessConfigs;
      const configuredPiHarnesses = new Set(harnessConfigs.keys());
      // usage and workflow describe every harness. A supplied harness is not a
      // filter, including a blank placeholder forced by a downstream schema.
      if (params.topic === "roles" || params.topic === "permissions") {
        validateHarnessFilter(harness, configuredPiHarnesses);
      }
      if (params.topic === "usage") {
        text = formatUsagePlaybook();
      } else if (params.topic === "roles") {
        text = catalog.blocked ? catalog.diagnostics.join(" ")
          : harness && catalog.disabledHarnesses.has(harness) ? disabledHarnessMessage(harness)
          : formatExternalRoleHelp(catalog.profiles, options.getDefaultHarness(ctx), harness);
      } else if (params.topic === "permissions") {
        text = permissionHelp(harness, configuredPiHarnesses);
      } else {
        const wfText = workflowHelp(options.workflowEnabled, listSavedWorkflows({
          agentDir: getAgentDir(),
          cwd: ctx.cwd,
          projectTrusted: isProjectTrusted(ctx),
        }));
        text = harness
          ? `${wfText}\n\nNote: Workflows orchestrate across multiple harnesses (including "${harness}"); workflow syntax is uniform across backends.`
          : wfText;
      }
      return {
        content: [{ type: "text" as const, text }],
        details: { topic: params.topic, ...(harness ? { harness } : {}) },
      };
    },
  });
}
