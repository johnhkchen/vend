import { describe, expect, test } from "bun:test";
import { classifySweep, donePhaseIds, SWEEP_PREFIXES, type TicketPhase } from "./presweep-core.ts";
import { SOURCE_PREFIXES } from "./committed-core.ts";

// E-061 #9 — the pure "done ⇒ committed" pre-sweep core. Imports only sibling pure modules (no fs,
// no git, no addon), so this is an ordinary pure-function test (the committed-core discipline).

const t = (id: string, phase: string): TicketPhase => ({ id, phase });

describe("SWEEP_PREFIXES — source contract PLUS the board", () => {
  test("is the source contract widened by docs/active/ (the half E-008 omits)", () => {
    for (const p of SOURCE_PREFIXES) expect(SWEEP_PREFIXES).toContain(p);
    expect(SWEEP_PREFIXES).toContain("docs/active/");
  });
});

describe("donePhaseIds — the implication's antecedent", () => {
  test("keeps only phase:done ids, sorted", () => {
    expect(donePhaseIds([t("T-062-02-01", "done"), t("T-062-01-01", "ready"), t("T-062-01-02", "done")]))
      .toEqual(["T-062-01-02", "T-062-02-01"]);
  });
  test("empty when nothing is done", () => {
    expect(donePhaseIds([t("T-1", "ready"), t("T-2", "implement")])).toEqual([]);
  });
});

describe("classifySweep — done ⇒ committed", () => {
  const done = ["T-062-01-01"];

  test("done tickets + CLEAN tree → ok", () => {
    expect(classifySweep({ doneIds: done, porcelain: "" })).toEqual({ ok: true, doneIds: done, offenders: [] });
  });

  test("NO done tickets + dirty tree → ok (vacuous — legitimate in-progress edits)", () => {
    const v = classifySweep({ doneIds: [], porcelain: " M src/foo.ts\n?? docs/active/epic/E-062.md\n" });
    expect(v.ok).toBe(true);
    expect(v.offenders).toEqual([]); // antecedent empty → offenders never gate
  });

  test("done tickets + uncommitted SOURCE → ANDON", () => {
    const v = classifySweep({ doneIds: done, porcelain: " M src/play/decompose-epic.ts\n" });
    expect(v.ok).toBe(false);
    expect(v.offenders).toEqual(["src/play/decompose-epic.ts"]);
  });

  test("done tickets + untracked BOARD → ANDON (the F2 case E-008's source scope misses)", () => {
    const v = classifySweep({ doneIds: done, porcelain: "?? docs/active/epic/E-062.md\n?? docs/active/tickets/T-062-01-01.md\n" });
    expect(v.ok).toBe(false);
    expect(v.offenders).toEqual(["docs/active/epic/E-062.md", "docs/active/tickets/T-062-01-01.md"]);
  });

  test("done tickets + only OUT-OF-SCOPE dirt (.vend/, runtime) → ok", () => {
    const v = classifySweep({ doneIds: done, porcelain: " M .vend/runs.jsonl\n?? scratch.txt\n" });
    expect(v.ok).toBe(true);
    expect(v.offenders).toEqual([]);
  });

  test("reports BOTH source and board offenders together, sorted + deduped", () => {
    const v = classifySweep({
      doneIds: done,
      porcelain: " M src/a.ts\n?? docs/active/stories/S-062-01.md\n M src/a.ts\n",
    });
    expect(v.ok).toBe(false);
    expect(v.offenders).toEqual(["docs/active/stories/S-062-01.md", "src/a.ts"]);
  });
});
