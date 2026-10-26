# Working on pi-flow-external

The product goal is simple: **an agent sees useful work, hands it to the right helpers, uses their results, and keeps moving.**

Read [Agent-first development principles](docs/maintainer/agent-first-development.md) when changing tool discovery, prompts, roles, workflows, recipes, help, supervision, or any part of the delegation experience. It is the product/developer decision guide; executable tool contracts and current code remain the source of truth for mechanics.

Contributors and coding agents:
- Start from one realistic parent-agent journey: the user's task, the delegation decision, the call, the result, and what happens next.
- Prefer fewer concepts and less repeated guidance over another feature, mode, required step, or framework. Preserve the parent's freedom to plan and a child's freedom to solve the assigned work.
- Keep ambient context brief. Put runnable examples in the discoverable skill; keep exact schemas, backend-specific limits, and uncommon recovery details in on-demand help.
- Use `external_delegate` for independent assignments; use `external_workflow` when coordination adds value. Several tasks do not automatically require a workflow. Existing runtime contracts are authoritative.
- Preserve real authority boundaries, correct outcome reporting, and existing execution interfaces. Don't equate low friction with silent permission expansion or misleading success.
- Test the user-visible and agent-visible journey, not merely that a prompt contains prescribed words. Label simulated tests separately from real parent-model behavior.
- Avoid altering unrelated subsystems to advance a guidance-only change. Update relevant docs and tests together.

Development checks: `npm run check` (TypeScript and Vitest); `npm test` runs Vitest alone. See [Maintainer documentation](docs/maintainer/README.md) and [Field Testing](docs/maintainer/field-testing.md) for further checks.

This guidance does not add an approval gate or replace established user authorization. Keep instructions proportional to the actual assignment.
