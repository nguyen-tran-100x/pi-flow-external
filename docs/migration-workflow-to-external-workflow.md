# Migration Guide: `workflow` Tool Renamed to `external_workflow`

The orchestration tool formerly named `workflow` is now `external_workflow`, alongside `external_delegate`, `external_runs`, and `external_help`. This follows the direct tool rename in [PR #86](https://github.com/tranhoangnguyen03/pi-flow-external/pull/86).

## No Alias

Flow no longer registers `workflow`. Old calls are not translated. A stale call fails, or reaches another extension's `workflow` tool if one is registered. Update every caller, then reload or restart Pi.

## What to Update

| Where | Before | After |
|---|---|---|
| Codemode calls | `tools.workflow({...})` | `tools.external_workflow({...})` |
| Codemode discovery | `describeTool("workflow")` | `describeTool("external_workflow")` |
| Exact-name hooks (`tool_call`, `tool_result`, `event.toolName`), handlers, and tool allow-lists such as `--tools` | `"workflow"` | `"external_workflow"` |
| Result discriminator: envelope `tool` field | `tool: "workflow"` | `tool: "external_workflow"` |
| `pi-cc-extensions` `excludeRenderers` | `"workflow"` | `"external_workflow"`, then restart Pi. Keep `"workflow"` only if another extension needs it. |

```ts
const receipt = await tools.external_workflow({
  script: `export const meta = {
    apiVersion: 1, name: "review", description: "Review the change without edits",
    phases: [{ title: "Review", detail: "Claude reviews the change with readonly access." }],
  };
  phase("Review");
  return await agent("Review the change without editing files", {
    description: "Review change", role: "reviewer", harness: "claude", permission: "readonly",
  });`,
});
if (!receipt.ok) return receipt.error;
return receipt.data.run;
```

## What Does Not Change

- Inputs: `script`, `name`, `scriptPath`, `args`, `background`, and `resumeFromRunId` are unchanged.
- Script API: `meta.apiVersion: 1`, `agent()`, `parallel()`, `pipeline()`, `phase()`, and `log()` keep their names. Existing saved scripts do not need rewriting.
- Envelope: `contractVersion: 1`, `action: "run"`, run `kind: "workflow"`, and `wf_...` run IDs are unchanged.
- Settings stay at version 5. No settings conversion or saved-run rewrite is needed. The extension option `{ workflow: false }`, help topic `workflow`, workflow directories, and E2E `--workflow` flag are unchanged.
- `external_delegate`, `external_runs`, and `external_help` keep their names. No bridge-compatibility fix is claimed by this rename.

## Explain Work Before Launch

Parent guidance now requires a short plain-language briefing: purpose, assignments, parallel/sequential order, allowed changes, and deliverable. Put the roadmap in the existing optional `meta.phases` and use `phase()` at actual transitions. Phase details now display on the live card.

This is an instruction to the agent, not a runtime check that a chat message was sent. Planned phases describe intent; child states and activity describe observed execution. Existing saved scripts without phases remain valid. Follow the user's existing approval policy rather than treating every briefing as a new approval gate.

Background work still needs collecting through `external_runs`; its launch receipt is not a live monitor. Inspect `view: "launch"` to retrieve the recorded purpose and phase plan during or after execution. That explicit view also contains sensitive script/argument evidence. See [Workflows](workflows.md) for details.
