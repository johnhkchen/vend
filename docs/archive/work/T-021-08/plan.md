# T-021-08 — Plan: calibration-loop-demo

## Testing strategy

- **Unit-level (hermetic, fast):** drive `runCalibrationDemo` over a fabricated `miniGraph` and a
  `mkdtemp` preset dir. Covers the four AC relationships (knob flip, render differs, IR differs,
  reload reproduces) without I/O on the live board.
- **Integration / AC (live board):** drive it over `await loadWorkGraph()` and a temp preset dir,
  byte-hashing `docs/active/**` before and after to prove the one-way-authority half of the AC.
- No new logic in the composed legs → no new tests there; their existing suites still cover them.
- Everything is deterministic (no clock/random) → assertions are exact equality, not tolerances.

## Step 1 — Demo module skeleton + types

Create `src/present/calibration-demo.ts`: header comment, imports, `KnobFlip`,
`CalibrationDemoOptions`, `CalibrationDemo`, and the `runCalibrationDemo` signature returning a
`TODO`-thrown body (compiles, types resolve).

**Verify:** `bun run check:typecheck` clean for the new file's types.

## Step 2 — Implement `runCalibrationDemo`

Fill the 6-step body from structure.md §"The one public function": resolve opts → base from
`defaultPresetForSeat` → render/project before → flip density → render/project after → save+reload
→ render reproduced → return the record. Add the small pure `describeFlip` helper.

**Verify:** typecheck clean; a scratch `bun -e` (or the Step 3 tests) shows `before !== after` and
`reproduced === after` over a fabricated graph.

## Step 3 — Unit tests over a fabricated graph

Create `src/present/calibration-demo.test.ts` with the `freshDir`/`afterAll`, `miniGraph`, and
`hashTree` helpers, and the `describe("runCalibrationDemo — pure over a fabricated graph")` block:
- knob flip descriptor + `before !== after`;
- IR carries the knob (`baseProjection.density==="low"`, `tunedProjection.density==="full"`,
  stringified projections differ);
- `reloadedSpec toEqual tunedSpec` and `reproduced === after`;
- `savedPath` is under the temp dir and contains no `docs/active`;
- determinism: two runs → equal `after`.

**Verify:** `bun test src/present/calibration-demo.test.ts` green.

## Step 4 — AC test over the live board

Add the `describe("T-021-08 — AC (live board)")` block:
- `loadWorkGraph()` → `tickets.length > 0`; `hashTree("docs/active")` (size > 0) before;
- run demo with the live graph + a temp preset dir; assert `before !== after`,
  `reproduced === after`, `reloadedSpec toEqual tunedSpec`;
- `hashTree("docs/active")` after → equal to before (no added/removed/changed paths).

**Verify:** `bun test src/present/calibration-demo.test.ts` green (both blocks).

## Step 5 — Full gate + commit

Run the whole suite and the committed-source gate, then commit the two new files only.

**Verify:**
- `bun run check` → `baml:gen` ok, `tsc --noEmit` clean, full `bun test` green (≥ 713 + new).
- `bun run check:committed` ok.
- `git add src/present/calibration-demo.ts src/present/calibration-demo.test.ts` (this ticket's
  files only — leave any sibling artifacts untouched, the D-005/T-021-07 precedent), commit with a
  `feat(present): …(T-021-08)` message.

## Commit plan

One implementation commit (module + tests land together — the test is the demo's proof and they
are meaningless apart). Then the standard docs/work artifacts are detected by Lisa.

- `feat(present): calibration-loop demo — flip a knob, re-render, save/reload (T-021-08)`

## Rollback / contingency

- If the live-board AC test ever shows `before === after` (e.g. a future renderer change), the
  fallback is to flip a knob with a guaranteed body effect (`groupBy`) — but the density+header
  guarantee makes this near-impossible (any knob shows in the preset header). Documented in
  design D2 so a future maintainer knows the lever.
- If `hashTree` flags drift, the culprit is a stray write — inspect `savedPath`; it must be the
  temp dir, never `docs/active`.
