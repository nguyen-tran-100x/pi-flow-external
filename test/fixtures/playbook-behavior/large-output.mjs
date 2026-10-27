// Deterministic source data, not model output. Large enough to exceed Flow's inline budget.
const payload = Array.from({ length: 160 }, (_, index) => {
  const id = "ROW-" + String(index).padStart(3, "0");
  return id + "|" + "Archived ledger record; preserve exact source bytes for audit. ".repeat(3);
}).join("\n");
export const largeOutputCase = {
  id: "large-output-inspection", pattern: "cross-cutting",
  goal: "Ask one external helper to return data/ledger.txt verbatim as its full canonical answer, with no extra prose. Retrieve that returned answer through external_runs final-result pages of at most 4096 bytes each, following every continuation cursor. Do not substitute reading the source yourself for collecting the delegated result. Report the first, middle and last row IDs and the row count after collection. No edits.",
  files: { "data/ledger.txt": payload },
  expect: { facts: ["ROW-000", "ROW-080", "ROW-159"], minExternalRoots: 1, minChildren: 1, requirePagedSource: "data/ledger.txt" },
  review: [
    "Was the delegated result actually oversized and retrieved through a complete, linked final-result page sequence, rather than just reading markers locally?",
    "Did the final answer report all requested row IDs and the correct 160-row count without silently omitting evidence?",
  ],
};
