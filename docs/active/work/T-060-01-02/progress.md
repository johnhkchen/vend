# Progress — T-060-01-02: thread-reduced-grounding-marker-onto-run-record

Plan executed in full, in the four planned steps. Gate green at every step.

## Step 1 — run-log.ts: the one-way `reducedGrounding` record field ✅

`src/log/run-log.ts`:
- `RunRecordInput.reducedGrounding?: boolean` added (after `turnsUsed`), documented as a one-way
  marker mirroring `intervenedAttested`.
- `RunRecord.reducedGrounding?: true` added (after `turnsUsed`), documented.
- `normalizeReducedGrounding(v) => v === true ? true : undefined` added next to
  `normalizeIntervenedAttested`.
- `buildRunRecord`: derive + `...(reducedGrounding ? { reducedGrounding } : {})` spread.
- `reviveRecord`: boolean-guarded derive + identical one-way spread (the read boundary re-runs
  the same normalizer, so malformed drops and a legacy line parses with the field absent).

Verify: `tsc --noEmit` clean; `bun test src/log/run-log.test.ts` → 71 pass (unchanged behavior —
the field is absent everywhere existing tests assert).

## Step 2 — run-log.test.ts: read-boundary coverage ✅

Added `describe("reducedGrounding marker — round-trip, absence, one-way, malformed, legacy
(T-060-01-02 AC)")` (5 tests): round-trip true survives build→serialize→revive; absent ⇒ omitted
+ substring excluded; `false` is never written (one-way); malformed-on-revive drops + record
stays valid; pre-T-060-01-02 legacy line parses with field undefined, skipped 0.

Verify: `bun test src/log/run-log.test.ts` → 77 pass (+6).

## Step 3 — cast.ts: thread the marker + honest cast-time note ✅

`src/engine/cast.ts` (in `castPlay`, after the `· turns:` write, AFTER the `!resolved.ok`
early-return):
- `const reducedGrounding = "reducedGrounding" in resolved && resolved.reducedGrounding;` — the
  `in` check narrows the `ResolvedTools` union to the strict variant (typechecks; no cast needed),
  the `&&` collapses strict-but-grounded to `false`.
- One-line honest stdout note emitted when `true`.
- End-of-cast `appendRunLog`: `...(reducedGrounding ? { reducedGrounding: true } : {})` added
  alongside the `intervened` / `turnsUsed` conditional spreads. The andon early-return record is
  untouched (different condition).

Verify: `tsc --noEmit` clean; `bun test src/engine/cast.test.ts` → 2 pass (existing tests use a
no-optionalMcp play ⇒ no marker ⇒ records unchanged).

## Step 4 — cast.test.ts: the AC integration proof ✅

`src/engine/cast.test.ts`:
- Added `groundedEchoPlay` fixture: spreads `echoPlay` + `tools: { optionalMcp:
  ["codebase-memory-mcp"], allow: ["Read","Grep","Glob"] }` (mirrors `DECOMPOSE_TOOLS`).
- Added `reviveRecord` + `writeFile` imports.
- **degraded test**: tmp root with no `.mcp.json` ⇒ cast clears (`success`/materialized), the
  `runs.jsonl` line carries `reducedGrounding === true`, and `reviveRecord` preserves it (read
  boundary closed end-to-end through the real `resolveTools → castPlay → appendRunLog` chain).
- **grounded test**: tmp root whose `.mcp.json` declares `codebase-memory-mcp` ⇒ no marker
  (`"reducedGrounding" in rec === false`, `reviveRecord(...).reducedGrounding === undefined`).

Verify: `bun test src/engine/cast.test.ts` → 4 pass (+2). Observed the `· reduced grounding …`
note fire on the degraded cast in the run output.

## Final gate ✅

`bun run check` (baml:gen + tsc --noEmit + full bun test): **1348 pass / 0 fail**, 81 files.

## Deviations from plan

- None of substance. The union-narrowing risk flagged in plan.md (the `in` operator narrowing
  `ResolvedTools`) resolved cleanly — `tsc` accepted `"reducedGrounding" in resolved &&
  resolved.reducedGrounding` with no fallback needed.
- `groundedEchoPlay` reuses `echoPlay` via spread rather than duplicating the fixture (smaller
  diff, same intent as structure.md's "small sibling").

## Commits

Working-tree changes are staged conceptually as the four atomic steps above. NOT committed in
this session: the working tree carries pre-existing unrelated modifications (`justfile`,
`src/ledger/recalibrate.ts`, `src/ledger/recalibrate.test.ts`) that are not part of this ticket,
so committing here would either entangle them or require partial staging better left to the
human/Lisa. The four logical commit boundaries (one per step) are recorded above and in plan.md
for whoever lands the work.
