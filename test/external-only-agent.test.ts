import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { defaultProfileNames } from "../src/defaults.ts";
import { filterExternalAgentProfiles, getSubagentProfiles } from "../src/profiles.ts";
import { getConfiguredHarnessNames } from "../src/harnesses.ts";
import { setupPiSubagentTestHarness } from "./helpers/pi-subagent-harness.ts";

describe("external-only external_delegate policy", () => {
  let agentDir = "";
  const { createSession, disposeSession } = setupPiSubagentTestHarness((state) => {
    agentDir = state.agentDir;
  });

  it("filters built-in pi-backed profiles out of the external_delegate roster", () => {
    const profiles = filterExternalAgentProfiles(getSubagentProfiles(agentDir, { legacyInspection: true }));
    expect(profiles.has("general-purpose")).toBe(false);
    expect(profiles.has("explorer")).toBe(false);
  });

  it("rejects an unknown exact profile instead of sending the caller to native subagents", async () => {
    const { session, registration } = await createSession();
    let rootContinuation = "";
    registration.setResponses([
      fauxAssistantMessage([fauxToolCall("external_delegate", {
        description: "Explore repo",
        subagent_type: "explorer",
        prompt: "Map the repository.",
      })], { stopReason: "toolUse" }),
      (context) => {
        rootContinuation = JSON.stringify(context.messages);
        return fauxAssistantMessage("reported");
      },
    ]);

    await session.prompt("Use the old explorer profile.");

    expect(rootContinuation).toContain("Unknown external subagent_type");
    expect(rootContinuation).not.toContain("native subagent");
    disposeSession(session);
  });

  it("keeps explicit Claude/Codex/Antigravity custom profiles in the external roster", () => {
    const overridesDir = join(agentDir, "pi-flow-external", "overrides");
    const subagentsDir = join(agentDir, "subagents");
    mkdirSync(overridesDir, { recursive: true });
    mkdirSync(subagentsDir, { recursive: true });
    writeFileSync(join(overridesDir, "claude-explorer.md"), `---\ndescription: Explore through Claude Code.\nbackend: claude\nmodel: sonnet\n---\n\nExplore read-only.\n`);
    writeFileSync(join(overridesDir, "codex-reviewer.md"), `---\ndescription: Review through Codex CLI.\nbackend: codex\nmodel: gpt-5.4-mini\n---\n\nReview read-only.\n`);
    writeFileSync(join(overridesDir, "agy-planner.md"), `---\ndescription: Plan through Antigravity.\nbackend: agy\nmodel: default\n---\n\nPlan read-only.\n`);
    writeFileSync(join(overridesDir, "local-reviewer.md"), `---\ndescription: Local pi reviewer.\nbackend: pi\n---\n\nReview locally.\n`);
    writeFileSync(join(subagentsDir, "scout.md"), `---\ndescription: Native Pi scout.\nbackend: pi\n---\n\nNative work.\n`);

    const profiles = filterExternalAgentProfiles(getSubagentProfiles(agentDir, { legacyInspection: true }));
    expect([...profiles.keys()].sort()).toEqual([...defaultProfileNames()].sort());
    expect(profiles.get("claude-explorer")).toMatchObject({ backend: "claude", model: "sonnet" });
    expect(profiles.get("codex-reviewer")).toMatchObject({ backend: "codex", model: "gpt-5.4-mini" });
    expect(profiles.get("agy-planner")).toMatchObject({ backend: "agy", model: "default" });
    expect(profiles.has("local-reviewer")).toBe(false);
    expect(profiles.has("scout")).toBe(false);
  });

  it("includes a registered pi-* harness's on-disk or synthesized role profiles in the external roster", () => {
    mkdirSync(join(agentDir, "pi-flow-external", "overrides"), { recursive: true });
    mkdirSync(join(agentDir, "subagents"), { recursive: true });
    writeFileSync(
      join(agentDir, "pi-flow-external", "settings.json"),
      JSON.stringify({ version: 4, harnesses: { "pi-deepseek": { model: "deepseek/deepseek-chat", thinking: "high" } } }),
    );
    writeFileSync(
      join(agentDir, "pi-flow-external", "overrides", "pi-deepseek-reviewer.md"),
      `---\ndescription: Security review through pi-deepseek.\nbackend: pi\nharness: pi-deepseek\n---\n\nReview for security defects.\n`,
    );
    writeFileSync(
      join(agentDir, "subagents", "pi-deepseek-worker.md"),
      `---\ndescription: Native-looking worker.\nbackend: pi\nharness: pi-deepseek\n---\n\nIgnored.\n`,
    );

    const configuredPiHarnesses = getConfiguredHarnessNames(agentDir);
    const profiles = filterExternalAgentProfiles(getSubagentProfiles(agentDir, { legacyInspection: true }), configuredPiHarnesses);
    expect(profiles.has("pi-deepseek-reviewer")).toBe(true);
    expect(profiles.get("pi-deepseek-reviewer")).toMatchObject({
      backend: "pi",
      harness: "pi-deepseek",
      description: "Security review through pi-deepseek.",
    });
    expect(profiles.get("pi-deepseek-worker")?.description).toContain("pi-deepseek");
    expect(profiles.get("pi-deepseek-worker")?.description).not.toBe("Native-looking worker.");
    expect(profiles.has("scout")).toBe(false);
  });
});

describe("tool loadout restored from a pre-rename transcript", () => {
  const { createSession } = setupPiSubagentTestHarness();
  const legacyLoadout = ["read", "bash", "edit", "write", "Agent", "workflow", "external_help", "external_runs"];

  // Pi restores the transcript loadout when it opens a saved session, and again
  // on tree navigation after extensions are bound.
  async function restoredLoadouts(transcriptToolNames: string[]) {
    const { session } = await createSession({ transcriptToolNames });
    const opened = session.getActiveToolNames();
    await session.navigateTree(session.sessionManager.getEntries()[0].id);
    return [opened, session.getActiveToolNames()];
  }

  it("activates both launchers when a restored loadout keeps the companions but names neither launcher", async () => {
    for (const active of await restoredLoadouts(legacyLoadout)) {
      expect(active).toEqual(expect.arrayContaining(["external_delegate", "external_workflow", "external_help", "external_runs"]));
    }
  });

  it("keeps a launcher off when the restored loadout still names the other one", async () => {
    for (const active of await restoredLoadouts([...legacyLoadout, "external_delegate"])) {
      expect(active).toContain("external_delegate");
      expect(active).not.toContain("external_workflow");
    }
  });
});
