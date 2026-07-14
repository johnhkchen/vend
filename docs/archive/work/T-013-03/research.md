# T-013-03 — Research

*Descriptive map of the codebase the bias-correction rung lands on. What exists, where,
how it connects. No solutions — that is Design.*

This ticket is the third rung of E-013 (measured-envelopes). T-013-01 made the run log
**readable** (the read face + an allocated `envelope` field). T-013-02 added the
**recalibrate** core (a measured envelope from a play's own percentile history). This rung
adds **reference-class bias correction** (IA-16): learn the systematic estimate-vs-actual
ratio per {play, project} and correct a raw estimate, with hierarchical partial pooling
(project → generic play prior → authored default).

---

## The run log — `src/log/run-log.ts` (T-001-04, extended T-013-01)

The ledger and its two faces. Relevant facts for this rung:

- **Record shape** (`RunRecord`, lines 113–129): `v, runId, play, epic, model, outcome,
  usage, costUsd, gateResults, envelope?, startedAt, endedAt`. There is **no project
  field** — runs are groupable by `play` (and `epic`) only. This is the one dataset-shape
  gap AC1 fills.
- **`envelope?: Envelope`** (lines 79–82, 126) — the **allocated** ceiling a cast ran
  under (`{ timeMs, tokens }`), added by T-013-01. Present only when the cast supplied one;
  **omitted when absent** (a zeroed envelope would be an invalid budget the recalibrator
  can't distinguish from a real allocation). This is the `allocated` half of the
  (allocated, actual) pair the bias factor needs.
- **The optional-field idiom** (lines 167–173, 200–212, 284–306): `envelope` is the live
  template for adding a backward-compatible optional field. `normalizeEnvelope` returns
  `undefined` when absent (field omitted, never zeroed); `buildRunRecord` spreads it only
  when present (`...(envelope ? { envelope } : {})`); `reviveRecord` keeps it only when
  both numbers are finite, dropping a malformed one without rejecting the record. AC1's
  `project` field follows this idiom exactly.
- **The read face** (lines 229–409), all PURE except `loadRunLog`:
  - `reviveRecord(parsed)` — total, never throws; drops unusable records.
  - `readRuns(jsonl)` / `loadRunLog(opts)` — parse text / read+parse the file.
  - **`forPlay(records, play, { outcome? })`** (lines 346–352) — the filter seam. AC1's
    "group by project" extends this opts bag with a `project?` field (the minimal,
    backward-compatible move).
  - **`totalTokens(r)`** (371–374) — `actual` tokens (sum of the four usage sub-counts).
  - **`wallClockMs(r)`** (359–364) — `actual` wall-clock ms, or `null` on unparseable
    stamps (a consumer must branch).
- **Two opposite boundary stances** (lines 232–236): the WRITE face asserts loudly (caller
  bug); the READ face degrades quietly (a torn ledger line is expected). The new project
  field honors both — `assertNonEmpty`-style on write is **not** wanted (absent is legal),
  so write omits-when-absent and read derives a default.
- **Zero-coupling invariant** (lines 19–24): `run-log.ts` imports nothing from
  `src/executor/` or `src/budget/`. `Envelope` is declared locally so `Budget` duck-types
  onto it. The new project field is a plain `string` — no new coupling.

## The recalibrate core — `src/ledger/recalibrate.ts` (T-013-02)

The module this rung **extends** (the ticket cites `src/budget/recalibrate.ts`; it actually
landed at `src/ledger/recalibrate.ts` — Decision A of T-013-02's design: a new node that
depends *up* onto both leaves). Relevant facts:

- **PURE core, type-only budget imports** (lines 20–30): imports `forPlay`, `totalTokens`,
  `wallClockMs` (pure record helpers) plus `type Budget`, `type ValueTier`. The ledger is
  "the consumer where the two leaves meet; nothing imports the Ledger back." The new
  `calibrate` lives here, beside `recalibrate`, sharing exactly this footprint.
- **`percentile(sortedAsc, p)`** (109–113) — exact nearest-rank, conservative on small N.
  A reusable robust-statistic primitive; the **median** the bias factor needs is
  `percentile(sortedAsc, 0.5)`.
- **`recalibrate(play, records, tier, prior, opts)` → `RecalibrateResult`** (124–164) —
  bounds tokens & wall-clock **independently** at the tier percentile over **successful**
  runs; censored (`budget-exhausted` | `timed-out`) excluded but counted; cold-start
  (`successes < minSuccesses`, default 3) returns the prior verbatim. This produces the
  **measured default** AC4 feeds *through* the bias correction.
- **The censored set** (`CENSORED_OUTCOMES`, line 60) and the **independent-dimensions**
  pattern (152–163, with `wallClockMs` null dropping from the TIME sample only) are the
  precedents the bias-factor extraction mirrors: same success filter (IA-13), same
  per-dimension independence, same positive-int coercion (`positiveInt`, 94–96).
- **`formatEnvelopeLabel(result)`** (173–180) — the honest-label precedent (IA-8). The
  bias-correction surface wants an analogous "× factor, N project / M generic" label.
- **`RecalibrateResult.source: "measured" | "prior"`** — the discriminant idiom for "did
  the fallback fire"; the calibrate result reports its confidence with `{ projectN,
  genericN }` rather than a single discriminant (three levels, not two).

## The writer — `src/engine/cast.ts` (T-007-02)

The single impure orchestrator that calls `appendRunLog` (lines 154–172). It already
stamps `envelope: budget` on every record. Relevant for AC1's write side:

- **`CastOptions.projectRoot?`** (line 44) — the repo root, `?? process.cwd()` (line 80).
  Its **basename** is the natural stable, local-first project identifier (charter P5:
  local-first; a cross-project corpus is a documented follow-up, not this slice).
- The `appendRunLog` input (lines 155–170) is where a `project` field is stamped, exactly
  as `envelope: budget` is. No other caller writes records in the cast path.

## The surface — `src/cli.ts` (T-002-03, extended T-013-02)

- **`vend envelope <play> [--tier <t>]`** — parsed by `parseEnvelopeArgs` (93–106), pure;
  dispatched by the `envelope` arm (277–291): `loadRunLog` → `recalibrate` →
  `formatEnvelopeLabel` → print, always exit 0 (read-only, no actuation). This is the arm
  AC4/AC5 extend with bias correction.
- **`parseBudgetArg(s)`** (48–65) — parses `<ms>,<tokens>` → `Budget`. The exact parser a
  `--estimate <ms>,<tokens>` flag reuses for the raw estimate AC4 supplies.
- **`budgetForTier(tier)`** (`src/shelf/gather.ts:135`) — the authored hand prior the
  envelope arm already passes to `recalibrate`. Pulls in the whole shelf; kept behind the
  lazy `import.meta.main` dispatch (never on the pure-parse path).
- **`ValueTier`** = `"keystone" | "high" | "standard" | "leaf"` (`shelf/menu.ts:23`).

## Tests — the house pattern

- `src/ledger/recalibrate.test.ts` — the template: a `recordOf(over)` fixture factory
  builds real frozen records via `buildRunRecord`, describe-per-AC, fabricated inputs, no
  fs/clock/spawn. The new `calibrate` tests extend this file (same `recordOf`, adding an
  `envelope` and `project` to fixtures).
- `src/log/run-log.test.ts` — `forPlay` tests (297–319) and the T-013-01 envelope/back-
  compat blocks (197–296) are the template for the project-field tests.
- `src/cli.test.ts` — `parseArgs` envelope tests (124–145) are the template for the
  `--estimate` / `--project` parse tests.
- Baseline: **383 tests pass, tsc clean.** `bun run check` = baml:gen → typecheck → test.

## Constraints & assumptions carried into Design

1. **Backward compatibility is non-negotiable** — old records (no `project`, no `envelope`)
   must parse unchanged. The optional-field idiom guarantees byte-identical legacy records.
2. **The (allocated, actual) pair needs an envelope** — only T-013-01+ records carry the
   `allocated` half. Records without an envelope cannot contribute a ratio; they are
   skipped from the bias sample (counted out, not faked).
3. **Successful runs only** (IA-13) — censored runs are right-censored at the envelope;
   their true cost is unobserved, so they cannot supply an actual/allocated ratio.
4. **Pure core, prior-passed-in** — the partial-pooling math is pure (type-only budget
   imports, like `recalibrate`); the caller owns the authored default and computes the
   generic prior. No fs/clock in the core.
5. **Display only, no actuation** (IA-14 deferred) — the surface prints the corrected
   figure; it does not change the budget a real cast dispatches under.
