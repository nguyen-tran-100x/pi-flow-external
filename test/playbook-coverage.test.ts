import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repo = fileURLToPath(new URL("../", import.meta.url));
const skill = resolve(repo, "skills/pi-flow-orchestration");
const scenarios = JSON.parse(readFileSync(resolve(repo, "test/fixtures/playbook-behavior/scenarios.json"), "utf8"));
const coverage = JSON.parse(readFileSync(resolve(repo, "docs/maintainer/playbook-coverage.json"), "utf8"));
const runner = resolve(repo, "scripts/e2e/playbook-behavior.mjs");
const expectedPatterns = [
  "parallel-work", "batch-map-reduce", "pipeline", "routing",
  "discover-and-delegate", "independent-review", "bounded-refinement",
];

describe("playbook test coverage", () => {
  it("makes every advertised pattern and distinct agent-journey recommendation traceable to both lanes", () => {
    expect(coverage.version).toBe(1);
    expect(scenarios.version).toBe(1);
    const ids = scenarios.cases.map((scenario: any) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(scenarios.cases.filter((scenario: any) => scenario.pattern !== "cross-cutting" &&
      scenario.pattern !== "baseline").map((scenario: any) => scenario.pattern).sort()).toEqual([
        "batch-map-reduce", "bounded-refinement", "discover-and-delegate", "discover-and-delegate", "discover-and-delegate",
        "independent-review", "parallel-work", "pipeline", "routing",
      ]);
    const declared = coverage.requirements.filter((r: any) => r.kind === "pattern");
    expect(declared.map((r: any) => r.id.replace("pattern-", "")).sort()).toEqual([...expectedPatterns].sort());

    const allRefs: string[] = [];
    for (const recommendation of coverage.requirements as any[]) {
      expect(["pattern", "journey"]).toContain(recommendation.kind);
      expect(recommendation.id).toMatch(/^[a-z0-9-]+$/);
      expect(recommendation.mechanical.length, recommendation.id).toBeGreaterThan(0);
      expect(recommendation.behavioral.length, recommendation.id).toBeGreaterThan(0);
      for (const item of recommendation.mechanical) {
        expect(item.file, recommendation.id).toMatch(/^test\/[^/]+\.test\.ts$/);
        const file = resolve(repo, item.file);
        expect(existsSync(file), recommendation.id + " / " + file).toBe(true);
        expect(readFileSync(file, "utf8"), recommendation.id + " / " + item.test).toContain(item.test);
      }
      for (const id of recommendation.behavioral) {
        expect(ids, recommendation.id).toContain(id);
        allRefs.push(id);
      }
    }
    expect(new Set(coverage.requirements.map((r: any) => r.id)).size).toBe(coverage.requirements.length);
    for (const id of ids) expect(allRefs, "orphaned live case: " + id).toContain(id);
  });

  it("seeds distinct hidden evidence and prevents leaking expected answers into test prompts", () => {
    for (const scenario of scenarios.cases as any[]) {
      expect(scenario.goal).toEqual(expect.any(String));
      expect(scenario.goal.length).toBeGreaterThan(20);
      expect(Object.keys(scenario.files).length).toBeGreaterThan(0);
      expect(scenario.review.length).toBeGreaterThan(0);
      const content = Object.entries(scenario.files).map(([key, value]) => String(key) + "\n" + String(value)).join("\n");
      for (const sourceName of Object.keys(scenario.files)) {
        expect(sourceName).not.toContain("..");
        expect(sourceName).not.toMatch(/^\//);
      }
      for (const fact of scenario.expect.facts) {
        expect(content, scenario.id + " fixture is missing oracle " + fact).toContain(fact);
        expect(scenario.goal, scenario.id + " leaked oracle " + fact).not.toContain(fact);
      }
      if (scenario.expect.minChildren !== undefined) expect(scenario.expect.minExternalRoots).toBeGreaterThan(0);
      if (scenario.expect.maxExternalRoots !== undefined && scenario.expect.minExternalRoots !== undefined) {
        expect(scenario.expect.minExternalRoots).toBeLessThanOrEqual(scenario.expect.maxExternalRoots);
      }
    }
    expect(scenarios.cases.find((c: any) => c.id === "discovery-unknown").review.join(" ")).toMatch(/source|ground/i);
    expect(scenarios.cases.find((c: any) => c.id === "discovery-known-skip")).toBeDefined();
  });

  it("runner self-checks event provenance, result oracles, review hold, and tamper detection without providers", () => {
    const result = spawnSync(process.execPath, [runner, "--selftest"], { encoding: "utf8", timeout: 30000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Selftest passed");
    expect(result.stdout).toContain("review");
  });

  it("lists each live case and refuses to spend model tokens without explicit opt-in", () => {
    const listing = spawnSync(process.execPath, [runner, "--list"], { encoding: "utf8", timeout: 30000 });
    expect(listing.status).toBe(0);
    const output = listing.stdout;
    for (const scenario of scenarios.cases as any[]) expect(output).toContain(scenario.id);
    const blocked = spawnSync(process.execPath, [runner], { encoding: "utf8", timeout: 30000 });
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toMatch(/--real|--out|--case/);
  });

  it("keeps skill discovery small while leaving every pattern guide independently readable", () => {
    const index = readFileSync(resolve(skill, "SKILL.md"), "utf8");
    expect(index.length).toBeLessThan(5000);
    for (const pattern of expectedPatterns) {
      expect(index).toContain("patterns/" + pattern + ".md");
      expect(existsSync(resolve(skill, "patterns", pattern + ".md"))).toBe(true);
    }
    // Real parent trials—not this assertion—determine whether it actually chooses an appropriate guide.
  });
});
