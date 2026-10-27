import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { parseSettings } from "../src/settings.ts";
import { loadV5Catalog } from "../src/catalog-v5.ts";
import { EXTERNAL_HARNESSES } from "../src/types.ts";

// The runner is JS and has no dependency on Pi just to list or rescore evidence.
const { fixedHarnessSettings, TRIAL_HARNESSES } = await import(
  new URL("../scripts/e2e/playbook-observations.mjs", import.meta.url).href
);

describe("trial harness availability uses the actual Flow configuration contract", () => {
  it("stays aligned with built-in harnesses, so a newly added backend cannot silently enter a comparison", () => {
    expect([...TRIAL_HARNESSES].sort()).toEqual([...EXTERNAL_HARNESSES].sort());
  });

  it("allows only Codex profiles without changing the user's settings or relying on the default alone", () => {
    const directory = mkdtempSync(join(tmpdir(), "flow-trial-catalog-"));
    try {
      const parsed = parseSettings(fixedHarnessSettings("codex", 420000));
      expect(parsed.diagnostics).toEqual([]);
      const catalog = loadV5Catalog(directory, { path: join(directory, "settings.json"), ...parsed });
      expect(catalog.blocked).toBe(false);
      const usable = [...catalog.profiles.values()].filter((profile) => !profile.configurationError);
      expect(usable.length).toBeGreaterThan(0);
      expect(usable.every((profile) => profile.harness === "codex")).toBe(true);
      for (const name of EXTERNAL_HARNESSES.filter((name) => name !== "codex")) {
        expect(catalog.disabledHarnesses.has(name)).toBe(true);
        expect(catalog.profiles.get(`${name}/worker`)?.configurationError).toBeTruthy();
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
