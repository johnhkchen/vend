import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import { auditWalkAway, formatWalkAwayFindings, type WalkAwayReport } from "../ledger/walk-away.ts";
import type { ShelfRow } from "./shelf-row.ts";
import { renderMenu } from "./menu.ts";
import { homeLedgerLine, renderHome } from "./home.ts";

// T-031-01 home composite: the PURE DL-6 Home composer. No fs/clock/spawn and NO BAML — fixtures
// fabricate RunRecords via the exported pure writer (the recalibrate/shelf-row precedent), derive a
// real WalkAwayReport via the pure `auditWalkAway`, and build ShelfRow literals directly. We pin only
// the composition: the provenance-split foot, honest-empty (no fabricated number), no-drift vs
// `formatWalkAwayFindings`, and the three-region order. The audit math itself is walk-away.test.ts's.

/** A run record with overridable intervention bits — exercises the E-028 forward/attested split. */
const recordOf = (
  over: { play?: string; outcome?: RunOutcome } & Partial<RunRecordInput> = {},
): RunRecord => {
  const { play = "p", outcome = "success", ...rest } = over;
  const start = "2026-06-18T00:00:00.000Z";
  const end = new Date(Date.parse(start) + 60_000).toISOString();
  return buildRunRecord({
    runId: "r",
    play,
    epic: "E-001",
    model: "m",
    outcome,
    usage: { input_tokens: 1000 },
    startedAt: start,
    endedAt: end,
    ...rest,
  });
};

/** A real WalkAwayReport over fixture records (pure — `auditWalkAway` does no I/O). */
const reportOf = (records: readonly RunRecord[]): WalkAwayReport => auditWalkAway(records);

const shelfRow = (over: Partial<ShelfRow> = {}): ShelfRow => ({
  name: "survey",
  summary: "read the project into a ranked demand board",
  envelope: { timeMs: 7_200_000, tokens: 50_000 },
  confidence: { kind: "default" },
  ...over,
});

describe("homeLedgerLine — the provenance-split foot (AC #1, DL-6/DL-8/E-028)", () => {
  // 4 forward reports (2 intervened → 50% walk-away) + 4 attested (1 intervened → 75% walk-away).
  const forward = [
    recordOf({ intervened: true }),
    recordOf({ intervened: true }),
    recordOf({ intervened: false }),
    recordOf({ intervened: false }),
  ];
  const attested = [
    recordOf({ intervened: true, intervenedAttested: true }),
    recordOf({ intervened: false, intervenedAttested: true }),
    recordOf({ intervened: false, intervenedAttested: true }),
    recordOf({ intervened: false, intervenedAttested: true }),
  ];
  const report = reportOf([...forward, ...attested]);

  test("renders the combined walk-away rate, (k/n), and the forward·attested split", () => {
    const line = homeLedgerLine(report);
    expect(line).toContain("E1 walk-away");
    // combined: 3 of 8 intervened → walk-away 1 − 3/8 = 0.625 → 63%, (5/8) ran untouched.
    expect(line).toContain("63% (5/8)");
    expect(line).toContain("└ forward 50% · attested 75%");
  });

  test("no drift: the foot's percentages match formatWalkAwayFindings exactly", () => {
    const line = homeLedgerLine(report);
    const full = formatWalkAwayFindings(report);
    // The combined walk-away percent (63%) and both split percents (50%, 75%) appear identically in
    // the multi-line `vend audit` readout — same `pct` rounding seam, so Home can never diverge.
    expect(line).toContain("63%");
    expect(full).toContain("63%"); // combined walk-away rate, rounded identically
    expect(full).toContain("forward (live): 50%");
    expect(full).toContain("attested back-fill: 75%");
  });

  test("an empty provenance partition reads `none yet`, never a fabricated 0%", () => {
    // Only forward reports — the attested partition is empty.
    const line = homeLedgerLine(reportOf(forward));
    expect(line).toContain("forward 50%");
    expect(line).toContain("attested none yet");
    expect(line).not.toContain("attested 0%");
  });
});

describe("homeLedgerLine — honest-empty, no fabricated trust number (AC #1, E-026/IA-8)", () => {
  test("no runs at all → `no runs yet`, and the line carries no percentage", () => {
    const line = homeLedgerLine(reportOf([]));
    expect(line).toBe("ledger   E1 walk-away — no runs yet");
    expect(line).not.toContain("%");
  });

  test("runs present but no intervention bit recorded → `no self-reports yet (N runs)`, no percentage", () => {
    const line = homeLedgerLine(reportOf([recordOf(), recordOf(), recordOf()]));
    expect(line).toBe("ledger   E1 walk-away — no self-reports yet (3 runs)");
    expect(line).not.toContain("%");
  });

  test("a single run reads singular `1 run`", () => {
    expect(homeLedgerLine(reportOf([recordOf()]))).toContain("(1 run)");
  });
});

describe("renderHome — composes the three DL-6 regions (AC #2/#3, DL-1/DL-9)", () => {
  const board = renderMenu([
    { id: "E-002", title: "ci-backstop", tier: "high", readiness: "ready", budget: { timeMs: 7_200_000, tokens: 50_000 } },
  ]);
  const rows = [shelfRow(), shelfRow({ name: "work", summary: "clear the board's top pull", confidence: { kind: "measured", runs: 5 } })];
  const ledger = homeLedgerLine(reportOf([recordOf({ intervened: false })]));

  test("populated: board leads, shelf recedes beneath, ledger at the foot — in that order", () => {
    const out = renderHome({ boardMenu: board, shelfRows: rows, ledger });
    const boardAt = out.indexOf("ci-backstop");
    const shelfAt = out.indexOf("shelf —");
    const ledgerAt = out.indexOf("E1 walk-away");
    expect(boardAt).toBeGreaterThanOrEqual(0);
    expect(boardAt).toBeLessThan(shelfAt);
    expect(shelfAt).toBeLessThan(ledgerAt);
  });

  test("empty board → the renderMenu guidance line passes through untouched", () => {
    const out = renderHome({ boardMenu: renderMenu([]), shelfRows: rows, ledger });
    expect(out).toContain("(no actions)");
  });

  test("empty ledger → the honest `no runs yet` foot, no fabricated number", () => {
    const out = renderHome({ boardMenu: board, shelfRows: rows, ledger: homeLedgerLine(reportOf([])) });
    expect(out).toContain("— no runs yet");
    // The foot carries no percent; the only `%` could be the regions — board/shelf here have none.
    expect(out.split("ledger   E1")[1] ?? "").not.toContain("%");
  });

  test("empty shelf → renderShelf's `(no playbooks)` passes through", () => {
    const out = renderHome({ boardMenu: board, shelfRows: [], ledger });
    expect(out).toContain("(no playbooks)");
  });

  test("no card chrome (DL-9): no box-drawing characters in the board/shelf regions", () => {
    // The ledger foot uses `└` as a textual continuation glyph (mirrors formatWalkAwayFindings), not
    // box chrome — so the chrome assertion is scoped to everything above the ledger line.
    const out = renderHome({ boardMenu: board, shelfRows: rows, ledger });
    const aboveLedger = out.slice(0, out.indexOf("ledger   E1"));
    expect(aboveLedger).not.toMatch(/[|┌┐└┘├┤┬┴┼─│[\]]/u);
  });
});
