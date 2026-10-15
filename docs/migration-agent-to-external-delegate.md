# Migration Guide: `Agent` Tool Renamed to `external_delegate`

The direct delegation tool formerly named `Agent` is now `external_delegate` ([issue #85](https://github.com/tranhoangnguyen03/pi-flow-external/issues/85)). It joins `external_help` and `external_runs` as one tool family and no longer shares a name with Claude Code's built-in `Agent` tool.

This guide covers only the tool rename. For settings conversion, see the [v4 → v5 Migration Guide](migration-v4-to-v5.md).

---

## No Alias

`Agent` is not kept as a second name, and old calls are not translated. Keeping both names would bring back the name clash and add a duplicate tool to every session. A stale `Agent` call fails, or reaches another extension's `Agent` tool if one is registered, so update every caller.

The rename was motivated by `Agent` going missing when Claude runs through `pi-claude-bridge`. A live smoke test on 2026-10-13 still reported the renamed tool unavailable while the other three Flow tools were visible. No delegation was made. The rename is therefore not a confirmed fix for bridge visibility; that integration remains unresolved.

---

## What to Update

| Where | Before | After |
|---|---|---|
| Codemode calls | `tools.Agent({...})` | `tools.external_delegate({...})` |
| Codemode discovery | `describeTool("Agent")` | `describeTool("external_delegate")` |
| Hooks and handlers that match an exact tool name (`tool_call`, `tool_result`, `event.toolName === ...`) and tool allow-lists such as `--tools` | `"Agent"` | `"external_delegate"` |
| Result discriminator: the envelope `tool` field | `tool: "Agent"` | `tool: "external_delegate"` |
| `pi-cc-extensions` `excludeRenderers` | `"Agent"` | `"external_delegate"`, then restart Pi. Keep `"Agent"` only if another extension needs it (see [Troubleshooting](troubleshooting.md#third-party-ui-compatibility-pi-cc--ccstyle)) |

Example:

```ts
const receipt = await tools.external_delegate({
  description: "Check build",
  role: "worker",
  prompt: "Run the build and report.",
});
if (!receipt.ok) return receipt.error;
return receipt.data.run;
```

---

## What Does Not Change

- **Input parameters:** `role`, `harness`, `subagent_type`, `permission`, `context`, `resume`, `background`, and the other arguments are the same.
- **Envelope:** `contractVersion` is still `1`. `action` is still `"delegate"`, and runs still report `kind: "agent"`. `ok`, `data`, `error`, and `warnings` keep their meaning. See [Public Contract v1](public-contract.md).
- **Settings and saved runs:** settings stay at version 5. No settings conversion or saved-run rewrite is needed.
- **Workflows:** the workflow `agent()` function keeps its name. It exists only inside workflow scripts and never appears in a tool list.
- **Other tools:** `workflow`, `external_runs`, and `external_help` keep their names.

---

## Background Runs Still Need Collecting

A background run does not notify or resume the session when it finishes. Ending the turn does not bring the result back. Collect it with `external_runs`:

```ts
const receipt = await tools.external_delegate({
  description: "Audit endpoints",
  role: "reviewer",
  prompt: "Audit the endpoints read-only.",
  background: true,
});
if (!receipt.ok) return receipt.error;
const runId = receipt.data.run.runId;

await tools.external_runs({ action: "wait", runIds: [runId], mode: "all" });
const final = await tools.external_runs({ action: "inspect", runIds: [runId], view: "final" });
```

`final` holds only a verified successful answer. For a failed run, read the outcome from `wait` and the details with `view: "diagnostics"`.
