import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { behavioralCases } from "../scripts/e2e/playbook-behavior.mjs";

const repo = fileURLToPath(new URL("../", import.meta.url));
const skill = resolve(repo, "skills/pi-flow-orchestration");
const coverage = JSON.parse(readFileSync(resolve(repo, "docs/maintainer/playbook-coverage.json"), "utf8"));
const runner = resolve(repo, "scripts/e2e/playbook-behavior.mjs");
const expectedPatterns = ["parallel-work", "batch-map-reduce", "pipeline", "routing", "discover-and-delegate", "independent-review", "bounded-refinement"];

describe("playbook coverage bookkeeping, not semantic proof", () => {
  it("keeps declared mappings consistent and distinguishes direct tests from supporting infrastructure", () => {
    expect(coverage.version).toBe(2);
    const ids = behavioralCases.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    const patterns = [...new Set(behavioralCases.filter((item) => !["cross-cutting", "baseline"].includes(item.pattern)).map((item) => item.pattern))];
    expect(patterns.sort()).toEqual([...expectedPatterns].sort());
    expect(coverage.requirements.filter((r) => r.kind === "pattern").map((r) => r.id.replace("pattern-", "")).sort()).toEqual([...expectedPatterns].sort());
    const allRefs = [];
    for (const recommendation of coverage.requirements) {
      expect(["pattern", "journey"]).toContain(recommendation.kind);
      expect(recommendation.id).toMatch(/^[a-z0-9-]+$/);
      expect(recommendation.mechanical.length).toBeGreaterThan(0);
      expect(recommendation.behavioral.length).toBeGreaterThan(0);
      expect(recommendation.behavioralStatus).toBe("not_run");
      expect(recommendation.limits.trim().length).toBeGreaterThan(0);
      for (const item of recommendation.mechanical) {
        expect(["direct", "supporting"]).toContain(item.coverage);
        expect(item.file).toMatch(/^test\/[^/]+\.test\.(?:ts|mjs)$/);
        const file = resolve(repo, item.file);
        expect(existsSync(file), recommendation.id + " / " + item.file).toBe(true);
        expect(readFileSync(file, "utf8"), recommendation.id + " / " + item.test).toContain(item.test);
      }
      for (const id of recommendation.behavioral) { expect(ids).toContain(id); allRefs.push(id); }
    }
    expect(new Set(coverage.requirements.map((r) => r.id)).size).toBe(coverage.requirements.length);
    for (const id of ids) expect(allRefs, "orphaned case: " + id).toContain(id);
    // Existence and labels cannot establish semantic adequacy. That is a review responsibility.
    for (const id of ["parallel-edit-isolation", "phase-roadmap-and-briefing"]) {
      expect(coverage.requirements.find((r) => r.id === id).mechanical.every((r) => r.coverage === "supporting")).toBe(true);
    }
  });

  it("keeps answer markers in source fixtures rather than user prompts", () => {
    for (const item of behavioralCases) {
      expect(item.goal.length).toBeGreaterThan(20);
      expect(item.review.length).toBeGreaterThan(0);
      const sources = Object.entries(item.files).map(([path, value]) => path + "\n" + value).join("\n");
      for (const path of Object.keys(item.files)) { expect(path).not.toContain(".."); expect(path).not.toMatch(/^\//); }
      for (const fact of item.expect.facts) {
        expect(sources, item.id).toContain(fact);
        expect(item.goal, item.id).not.toContain(fact);
      }
    }
  });

  it("forces a real oversized source and full paged-result oracle instead of relying on the tiny corpus", () => {
    const item = behavioralCases.find((item) => item.id === "large-output-inspection");
    expect(item).toBeDefined();
    expect(Buffer.byteLength(item.files[item.expect.requirePagedSource])).toBeGreaterThan(16384);
    expect(item.files[item.expect.requirePagedSource].split("\n")).toHaveLength(160);
    const refs = coverage.requirements.find((r) => r.id === "large-output-and-inspection").behavioral;
    expect(refs).toEqual(["large-output-inspection"]);
  });

  it("self-checks oracles and the review hold without starting providers", () => {
    const result = spawnSync(process.execPath, [runner, "--selftest"], { encoding: "utf8", timeout: 30000 });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("Selftest passed");
    expect(result.stdout).toContain("review");
  });

  it("lists live cases and requires explicit opt-in before running them", () => {
    const listing = spawnSync(process.execPath, [runner, "--list"], { encoding: "utf8", timeout: 30000 });
    expect(listing.status).toBe(0);
    for (const item of behavioralCases) expect(listing.stdout).toContain(item.id);
    const blocked = spawnSync(process.execPath, [runner], { encoding: "utf8", timeout: 30000 });
    expect(blocked.status).not.toBe(0);
    expect(blocked.stderr).toMatch(/--real|--out|--case/);
  });

  it("keeps the index small and guides reachable without claiming that a model chose them", () => {
    const index = readFileSync(resolve(skill, "SKILL.md"), "utf8");
    expect(index.length).toBeLessThan(5000);
    for (const pattern of expectedPatterns) {
      expect(index).toContain("patterns/" + pattern + ".md");
      expect(existsSync(resolve(skill, "patterns", pattern + ".md"))).toBe(true);
    }
  });
});
