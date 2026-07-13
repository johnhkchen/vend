import { describe, expect, test } from "bun:test";
import { buildRunRecord, type RunOutcome, type RunRecord, type RunRecordInput } from "../log/run-log.ts";
import { auditWalkAway, formatWalkAwayFindings, pct, type WalkAwayReport } from "../ledger/walk-away.ts";
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

describe("homeLedgerLine — the plain provenance-split foot (AC #1, DL-6/DL-8/E-028)", () => {
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

  test("renders help-free finishes, (k/n), and when each answer was recorded", () => {
    const line = homeLedgerLine(report);
    expect(line).toContain("finished without help");
    // combined: 3 of 8 intervened → walk-away 1 − 3/8 = 0.625 → 63%, (5/8) ran untouched.
    expect(line).toContain("63% (5/8)");
    expect(line).toContain("└ recorded at the time 50% · filled in later 75%");
  });

  test("no drift: Home and audit render the shared pct values identically", () => {
    const line = homeLedgerLine(report);
    const full = formatWalkAwayFindings(report);
    const combined = pct(5 / 8); // 62.5% rounds to 63% through the shared production seam.
    const atTheTime = pct(1 / 2);
    const filledInLater = pct(3 / 4);
    expect(line).toContain(`finished without help ${combined}`);
    expect(full).toContain(`finished without help: ${combined}`);
    expect(line).toContain(`recorded at the time ${atTheTime}`);
    expect(full).toContain(`recorded at the time: ${atTheTime}`);
    expect(line).toContain(`filled in later ${filledInLater}`);
    expect(full).toContain(`filled in later: ${filledInLater}`);
  });

  test("an empty provenance partition reads `none yet`, never a fabricated 0%", () => {
    // Only forward reports — the attested partition is empty.
    const line = homeLedgerLine(reportOf(forward));
    expect(line).toContain("recorded at the time 50%");
    expect(line).toContain("filled in later none yet");
    expect(line).not.toContain("filled in later 0%");
  });

  test("no legacy operator jargon appears in populated or honest-empty lines", () => {
    const forbidden = /E1[^\n]*walk-away|andon rate|censored|intervention bit unrecorded/i;
    const lines = [
      homeLedgerLine(report),
      homeLedgerLine(reportOf([])),
      homeLedgerLine(reportOf([recordOf()])),
    ];
    for (const line of lines) expect(line).not.toMatch(forbidden);
  });
});

describe("homeLedgerLine — honest-empty, no fabricated trust number (AC #1, E-026/IA-8)", () => {
  test("no runs at all → `no runs yet`, and the line carries no percentage", () => {
    const line = homeLedgerLine(reportOf([]));
    expect(line).toBe("ledger   finished without help — no runs yet");
    expect(line).not.toContain("%");
  });

  test("runs present but no help answer → says what was not recorded, with no percentage", () => {
    const line = homeLedgerLine(reportOf([recordOf(), recordOf(), recordOf()]));
    expect(line).toBe("ledger   finished without help — not recorded yet (3 runs did not say whether anyone stepped in)");
    expect(line).not.toContain("%");
  });

  test("a single run reads singular `1 run`", () => {
    expect(homeLedgerLine(reportOf([recordOf()]))).toContain("(1 run did not say whether anyone stepped in)");
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
    const ledgerAt = out.indexOf("finished without help");
    expect(boardAt).toBeGreaterThanOrEqual(0);
    expect(boardAt).toBeLessThan(shelfAt);
    expect(shelfAt).toBeLessThan(ledgerAt);
  });

  test("cache-stability proxy: the board substring equals boardMenu byte-for-byte (no re-derivation)", () => {
    // T-031-02 press contract: renderHome FRAMES the already-persisted board; it never re-renders or
    // mutates it. So whatever browseShelf wrote to `.vend/menu.json` cannot be perturbed by the Home
    // render — the board region is the input string verbatim, leading at column 0. (HomeRegions.boardMenu
    // is a `string`: a MenuCache is unrepresentable here, so the cache is type-incapable of regressing.)
    const out = renderHome({ boardMenu: board, shelfRows: rows, ledger });
    expect(out.startsWith(board)).toBe(true);
    expect(out).toContain(`${board}\n\n`);
  });

  test("empty board → the renderMenu guidance line passes through untouched", () => {
    const out = renderHome({ boardMenu: renderMenu([]), shelfRows: rows, ledger });
    expect(out).toContain("(no actions)");
  });

  test("empty ledger → the honest `no runs yet` foot, no fabricated number", () => {
    const out = renderHome({ boardMenu: board, shelfRows: rows, ledger: homeLedgerLine(reportOf([])) });
    expect(out).toContain("— no runs yet");
    // The foot carries no percent; the only `%` could be the regions — board/shelf here have none.
    expect(out.split("ledger   finished without help")[1] ?? "").not.toContain("%");
  });

  test("empty shelf → renderShelf's `(no playbooks)` passes through", () => {
    const out = renderHome({ boardMenu: board, shelfRows: [], ledger });
    expect(out).toContain("(no playbooks)");
  });

  test("no card chrome (DL-9): no box-drawing characters in the board/shelf regions", () => {
    // DL-9 forbids box/rule/card chrome — box-drawing glyphs. (renderMenu's `[High]` tier brackets
    // and the foot's `└` continuation glyph are legitimate text, not chrome; the foot is excluded by
    // scoping above the ledger line, and the box-drawing set below deliberately omits `[` `]`.)
    const out = renderHome({ boardMenu: board, shelfRows: rows, ledger });
    const aboveLedger = out.slice(0, out.indexOf("ledger   finished without help"));
    expect(aboveLedger).not.toMatch(/[┌┐└┘├┤┬┴┼─││]/u);
  });
});
