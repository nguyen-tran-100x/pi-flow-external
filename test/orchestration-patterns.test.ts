import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ConcurrencyLimiter } from "../src/core/concurrency.ts";
import { ChildRunError, parseWorkflowScript, runWorkflow, type WorkflowAgentCall } from "../src/workflow/runtime.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const skill = resolve(root, "skills/pi-flow-orchestration");
const patternNames = ["parallel-work", "batch-map-reduce", "pipeline", "routing", "discover-and-delegate", "independent-review", "bounded-refinement"];
const recipe = (name: string) => readFileSync(resolve(skill, "recipes", name + ".js"), "utf8");
function guideScript(name: string): string {
  const markdown = readFileSync(resolve(skill, "patterns", name + ".md"), "utf8");
  const scripts = [...markdown.matchAll(/```js\n([\s\S]*?)\n```/g)];
  expect(scripts).toHaveLength(1);
  return scripts[0]![1]!;
}
function options(args: Record<string, unknown>, runAgent: (call: WorkflowAgentCall) => Promise<unknown>, limit = 4) {
  return { args, cwd: root, limiter: new ConcurrencyLimiter(limit),
    resolveSubagentType: ({ role, harness }: { role?: string; harness?: string }) => (harness ?? "codex") + "/" + (role ?? "worker"), runAgent };
}
function items(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: "T" + index, source: "/work/transcripts/T" + index + ".txt", estimatedChars: 150 + (index % 7) * 100 }));
}
function manifest(call: WorkflowAgentCall): { id: string; source: string; estimatedChars: number }[] {
  return JSON.parse(call.prompt.split("\nSOURCE_MANIFEST\n")[1]!);
}
function mapped(call: WorkflowAgentCall) {
  return { records: manifest(call).map((item) => ({ id: item.id, status: "summarized", summary: "Finding " + item.id, evidence: [item.source + ":1"] })) };
}
const failed = () => new ChildRunError({ runId: "run_test_failure", outcome: "failed", message: "fixture unavailable" });

describe("progressively loaded pattern library", () => {
  it("links the seven focused guides directly from the installed skill and packages their resources", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.pi.skills).toContain("./skills/pi-flow-orchestration");
    expect(pkg.files).toContain("skills");
    const index = readFileSync(resolve(skill, "SKILL.md"), "utf8");
    expect(index.length).toBeLessThan(5000);
    const linked = [...index.matchAll(/\]\(patterns\/([^/()]+)\.md\)/g)].map((m) => m[1]);
    expect(linked.sort()).toEqual([...patternNames].sort());
    for (const dir of [skill, resolve(skill, "patterns"), resolve(skill, "references")]) {
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".md"))) {
        const file = resolve(dir, name);
        for (const match of readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
          const link = match[1]!.split("#")[0]!;
          if (!link || /^(https?:|mailto:)/.test(link)) continue;
          expect(existsSync(resolve(dirname(file), link)), `${file}: ${link}`).toBe(true);
        }
      }
    }
    for (const name of ["batch-map-reduce", "independent-review"]) {
      expect(parseWorkflowScript(recipe(name)).meta).toMatchObject({ apiVersion: 1, name });
    }
  });
});

describe("batch map-reduce recipe", () => {
  it("maps 240 uneven items with bounded concurrency, stable IDs and no implicit reduction", async () => {
    const source = items(240);
    let active = 0, peak = 0;
    const calls: WorkflowAgentCall[] = [];
    const output = await runWorkflow(recipe("batch-map-reduce"), options(
      { task: "Summarize", items: source, batchChars: 3000, batchItems: 6, concurrency: 3, reduce: false },
      async (call) => {
        calls.push(call); active++; peak = Math.max(peak, active);
        const batch = manifest(call);
        expect(batch.length).toBeLessThanOrEqual(6);
        expect(batch.reduce((sum, item) => sum + item.estimatedChars, 0)).toBeLessThanOrEqual(3000);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--; return mapped(call);
      }, 8));
    const value = output.result as any;
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThanOrEqual(3);
    expect(value.coverage).toEqual({ total: 240, summarized: 240, unreadable: 0, failed: 0 });
    expect(value.records.map((record: any) => record.id)).toEqual(source.map((item) => item.id));
    expect(new Set(value.records.map((record: any) => record.id)).size).toBe(240);
    expect(value.reduction.status).toBe("not_requested");
    expect(calls.every((call) => call.permission === "readonly" && !call.context && !call.resumeRunId)).toBe(true);
  });

  it("keeps unreadable items and failed batches while reducing only available material", async () => {
    const calls: WorkflowAgentCall[] = [];
    const output = await runWorkflow(recipe("batch-map-reduce"), options(
      { task: "Summarize", items: items(5), batchItems: 1, concurrency: 2, reduceFanIn: 2 }, async (call) => {
        calls.push(call);
        if (call.label.startsWith("Reduce")) return "Combined evidence";
        const id = manifest(call)[0]!.id;
        if (id === "T0") throw failed();
        const value = mapped(call);
        if (id === "T1") value.records[0] = { id, status: "unreadable", summary: "Cannot read source", evidence: [] };
        return value;
      }));
    const value = output.result as any;
    expect(value.status).toBe("partial");
    expect(value.coverage).toEqual({ total: 5, summarized: 3, unreadable: 1, failed: 1 });
    expect(value.records).toHaveLength(5);
    expect(value.summary).toBe("Combined evidence");
    for (const call of calls.filter((c) => c.label.startsWith("Reduce"))) {
      const units = JSON.parse(call.prompt.split("\nEVIDENCE\n")[1]!);
      expect(units.flatMap((unit: any) => unit.ids)).not.toContain("T0");
      expect(units.flatMap((unit: any) => unit.ids)).not.toContain("T1");
    }
  });

  it.each(["failure", "bad_ids"])("reports an all-%s map without inventing a synthesis", async (kind) => {
    let calls = 0;
    const output = await runWorkflow(recipe("batch-map-reduce"), options(
      { task: "Summarize", items: items(2), batchItems: 1 }, async () => {
        calls++;
        if (kind === "failure") throw failed();
        return { records: [{ id: "invented", status: "summarized", summary: "bad", evidence: [] }] };
      }));
    const value = output.result as any;
    expect(calls).toBe(2);
    expect(value.status).toBe("failed");
    expect(value.coverage.failed).toBe(2);
    expect(value.summary).toBeNull();
    expect(value.reduction.status).toBe("no_material");
  });

  it("rejects invalid manifests before any child starts", async () => {
    for (const source of [[items(1)[0], items(1)[0]], [{ id: "long", source: "/work/long", estimatedChars: 25000 }]]) {
      let calls = 0;
      await expect(runWorkflow(recipe("batch-map-reduce"), options({ task: "Summarize", items: source }, async () => { calls++; return {}; }))).rejects.toThrow();
      expect(calls).toBe(0);
    }
  });

  it("reduces hierarchically while retaining originals and honoring the shared limiter", async () => {
    let active = 0, peak = 0;
    const output = await runWorkflow(recipe("batch-map-reduce"), options(
      { task: "Summarize", items: items(9), batchItems: 1, concurrency: 4, reduceFanIn: 2 }, async (call) => {
        active++; peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        if (call.label.startsWith("Map")) return mapped(call);
        const units = JSON.parse(call.prompt.split("\nEVIDENCE\n")[1]!);
        expect(units.length).toBeLessThanOrEqual(2);
        return "Summary";
      }, 2));
    const value = output.result as any;
    expect(peak).toBeLessThanOrEqual(2);
    expect(output.agentCount).toBe(17);
    expect(value.reduction).toMatchObject({ status: "complete", levels: 4 });
    expect(value.records).toHaveLength(9);
    expect(value.status).toBe("complete");
  });

  it("returns full material on size blockage rather than clipping or looping", async () => {
    let calls = 0;
    const output = await runWorkflow(recipe("batch-map-reduce"), options(
      { task: "Summarize", items: items(2), batchItems: 1, reduceChars: 100 }, async (call) => {
        calls++; const value = mapped(call); value.records[0]!.summary = "x".repeat(1000); return value;
      }));
    const value = output.result as any;
    expect(calls).toBe(2);
    expect(value.reduction.status).toBe("blocked_by_size");
    expect(value.reduction.remaining).toHaveLength(2);
    expect(value.records.every((record: any) => record.summary.length === 1000)).toBe(true);
    expect(value.status).toBe("partial");
  });

  it("preserves failed reducer inputs and does not retry", async () => {
    let reducers = 0;
    const output = await runWorkflow(recipe("batch-map-reduce"), options(
      { task: "Summarize", items: items(4), batchItems: 1, reduceFanIn: 2 }, async (call) => {
        if (call.label.startsWith("Map")) return mapped(call);
        reducers++;
        if (call.label.endsWith("/1")) throw failed();
        return "Other group summary";
      }));
    const value = output.result as any;
    expect(reducers).toBe(2);
    expect(value.reduction.status).toBe("failed");
    expect(value.reduction.remaining.flatMap((unit: any) => unit.ids).sort()).toEqual(items(4).map((item) => item.id));
    expect(value.records).toHaveLength(4);
  });
});

describe("independent-review recipe", () => {
  it("reviews an existing target without drafting, sharing sibling results or voting", async () => {
    const calls: WorkflowAgentCall[] = [];
    const output = await runWorkflow(recipe("independent-review"), options({ target: "/work/design.md", questions: ["clarity", "fit"], revision: "abc" }, async (call) => {
      calls.push(call);
      return call.label === "Review 1" ? "unique-first-verdict" : "Another assessment";
    }));
    expect(output.agentCount).toBe(2);
    expect(calls[1]!.prompt).not.toContain("unique-first-verdict");
    expect(calls.every((call) => !call.context && !call.resumeRunId && call.permission === "readonly")).toBe(true);
    expect((output.result as any)).toMatchObject({ status: "complete", completed: 2, acceptedByParent: false });
  });
  it.each([1, 2])("retains %i failed assessments as missing coverage", async (failureCount) => {
    let calls = 0;
    const output = await runWorkflow(recipe("independent-review"), options({ target: "/work/design.md", questions: ["clarity", "fit"] }, async () => {
      if (++calls <= failureCount) throw failed();
      return "checked";
    }));
    const value = output.result as any;
    expect(value.status).toBe(failureCount === 2 ? "failed" : "partial");
    expect(value.missing).toHaveLength(failureCount);
    expect(value.reports).toHaveLength(2);
    expect(calls).toBe(2);
  });
});

describe("complete guide examples", () => {
  it("passes actual extraction evidence into the next pipeline step", async () => {
    const calls: WorkflowAgentCall[] = [];
    const result = await runWorkflow(guideScript("pipeline"), options({ source: "/work/T1.txt" }, async (call) => {
      calls.push(call); return calls.length === 1 ? "source-evidence-42" : "draft";
    }));
    expect(calls).toHaveLength(2);
    expect(calls[1]!.prompt).toContain("source-evidence-42");
    expect((result.result as any).draft).toBe("draft");
  });
  it("does not draft after an extraction failure", async () => {
    let calls = 0;
    await expect(runWorkflow(guideScript("pipeline"), options({ source: "/work/T1.txt" }, async () => { calls++; throw failed(); }))).rejects.toThrow();
    expect(calls).toBe(1);
  });
  it("routes one known category and rejects unknown categories before launch", async () => {
    const calls: WorkflowAgentCall[] = [];
    const result = await runWorkflow(guideScript("routing"), options({ kind: "bug", target: "/work/shop" }, async (call) => { calls.push(call); return "causes"; }));
    expect(calls).toHaveLength(1);
    expect((result.result as any).route).toBe("bug");
    await expect(runWorkflow(guideScript("routing"), options({ kind: "__proto__", target: "/work/shop" }, async () => { calls.push({} as any); return "bad"; }))).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });
  it("discovers scopes then delegates, preserving a failed investigation", async () => {
    const calls: WorkflowAgentCall[] = [];
    const result = await runWorkflow(guideScript("discover-and-delegate"), options({ task: "Find risks", target: "/work/shop" }, async (call) => {
      calls.push(call);
      if (call.label === "Discover scopes") return { reason: "Two components", tasks: [{ id: "A", question: "Check A" }, { id: "B", question: "Check B" }] };
      if (call.label === "Investigate B") throw failed();
      return "A evidence";
    }));
    expect(calls).toHaveLength(3);
    expect((result.result as any).missing).toEqual(["B"]);
    expect(calls.every((call) => call.permission === "readonly")).toBe(true);
  });
  it.each([[], [{ id: "A", question: "A" }, { id: "A", question: "Duplicate" }]])("handles empty or duplicate discovery without extra workers", async (tasks) => {
    let calls = 0;
    const run = runWorkflow(guideScript("discover-and-delegate"), options({ task: "Find risks", target: "/work/shop" }, async () => { calls++; return { reason: "Discovery", tasks }; }));
    if (tasks.length) await expect(run).rejects.toThrow();
    else expect((await run).agentCount).toBe(1);
    expect(calls).toBe(1);
  });
});
