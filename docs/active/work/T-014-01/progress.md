# T-014-01 — Progress

All plan steps complete. `bun run check:typecheck` clean; full `bun test` green
(**467 pass / 0 fail**, 29 files); `vend audit` smoke-tested live against the real
`.vend/runs.jsonl`.

## Completed

### Step 1 — `intervened` field on the record ✅
`src/log/run-log.ts`:
- `intervened?: boolean` added to `RunRecordInput` and `RunRecord` (docs noting `false` is a
  value, absence is unknown).
- `normalizeIntervened(v)` helper (boolean ⇒ itself, else undefined — coerce, don't assert,
  like `normalizeProject`).
- `buildRunRecord` + `reviveRecord` conditional-spread the field (omit-when-absent), exactly
  mirroring the `envelope`/`project` idiom; no new import (zero-coupling invariant held).
`src/log/run-log.test.ts`: 6 new cases (true/false round-trip, `false`-is-written,
absent-omitted, non-boolean coerced-to-absent on build, malformed dropped on revive,
pre-T-014-01 line parses with `intervened` undefined). **57 pass.**

### Step 2 — write path threading ✅
- `src/engine/cast.ts`: `CastOptions.intervened?: boolean`; conditional-spread into the
  single end-of-cast `appendRunLog` call (append-only invariant untouched — one line, one
  write).
- `src/play/decompose-epic.ts`: `RunOptions.intervened?: boolean`; forwarded in
  `assembleAndCast` → `castPlay` opts.
- `src/play/dispatch.ts`: unchanged (forwards `opts` verbatim — threads through for free).

### Step 3 — the pure audit module ✅
`src/ledger/walk-away.ts` (new): `TIER_ANDON_BUDGET` (IA-12 % side), `auditWalkAway`
(andon-rate vs budget · outcome mix incl. censored subset · cost-vs-envelope median ratios ·
intervention rate + earlier/recent trend), `formatWalkAwayFindings` (the E1 fragment with
honest fallbacks). PURE; type-only + run-log pure-helper imports; nothing imports it back.

### Step 4 — audit tests ✅
`src/ledger/walk-away.test.ts` (new): 13 cases covering every branch — empty slice, andon
rate vs tier budget, censored subset, cost null/non-null + exclusions, intervention
rate/exclusion-of-unrecorded/trend/`reported===0`, play filter, window, and the format
fragment + fallbacks. **13 pass.**

### Step 5 — CLI flag + `audit` verb ✅
`src/cli.ts`: `run` command gains `intervened?` (parsed from `--intervened` /
`--no-intervened` presence flags); new `audit` command variant + `USAGE` line + `parseArgs`
route + `parseAuditArgs` (optional play, `--tier` default standard, `--window` positive int);
read-only `audit` dispatch arm (loads ledger, prints `formatWalkAwayFindings`, exits 0);
`run` dispatch arm forwards `intervened` into `runPlay`.
`src/cli.test.ts`: 10 new parse cases (intervened true/false/absent/+no-gates; audit
default/play/tier+window/bad-tier/bad-window/unknown-flag).

## Live smoke (real ledger, 10 runs)
```
E1 — walk-away trust · all plays · 10 runs [standard]
  walk-away rate: no self-reports yet (10 runs, intervention bit unrecorded)
  andon rate: 40% vs 10% budget — ⚠ over (gates working, not defects)
  outcome mix: 6 success · 3 censored (budget/timeout) · 1 gate-failed · 0 id-collision
  cost vs envelope: no envelope data
```
Honest fallbacks fire correctly: no `intervened` bits recorded yet (the instrument is
forward-looking — the next runs that pass `--no-intervened`/`--intervened` will populate the
trend), and the existing successful records carry no envelope so cost reads "no envelope
data" rather than a fabricated ratio.

## Deviations from plan
None material. Three observations:
1. **Concurrent T-014-02 on the same branch** added `skipGates` (the `--no-gates` E2 arm) to
   `CastOptions`, `RunOptions`, the `run` `ParsedCommand`, `parseRunArgs`, `USAGE`, the run
   dispatch arm, and `cli.test.ts` while this ticket was in flight. My edits are purely
   additive and compose cleanly (e.g. `parseRunArgs` returns both `skipGates` and
   `intervened`; a test asserts they compose). No conflicts; both feature sets coexist. This
   confirms the tickets share files — a soft missing-dependency edge, but the changes are
   orthogonal and the lock + additive edits sufficed.
2. **`window` validation** in `parseAuditArgs` rejects non-positive / non-integer values up
   front (a usage error), matching `parseBudgetArg`'s shape-guard stance.
3. Schema version left at `1` — an optional, omittable field is back-compatible (the
   envelope/project precedent), so no version bump.

## Not done (out of scope — by PRD anti-scope-creep)
- Threading `intervened` through `chain`/`select`/`press` (only the `run` path is the
  forward-looking instrument AC #1 needs; the rest is a documented follow-up).
- A stop-time interactive prompt (the same field is reachable by the flag; a prompt is a
  future ergonomic, not this minimal slice).
- The E2 variance probe / `--no-gates` analysis (**T-014-02**) and the findings note +
  go/reroute (**T-014-03**).
