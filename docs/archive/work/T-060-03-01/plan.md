# T-060-03-01 — Plan: the ordered live drive and the flip

Executable, verifiable steps. Each step has a pass condition; honest branches are in `design.md`'s
failure table. The drive is metered (real `claude -p` subscription spend) — the gate is already green,
so no `src/` step precedes it.

## Pre-flight (no spend)

- **P0.** Confirm `bun run check` green on the working tree — **done** (1354 pass / 0 fail).
- **P1.** Confirm `bun`, `lisa`, `claude` on PATH — **done**. `claude` uses subscription auth (Doppler
  keyring error is irrelevant to the drive).

## Stage A — build the sandbox (no spend)

```bash
SANDBOX=$(mktemp -d "${TMPDIR:-/tmp}/vend-seed-drive-XXXX")
cp -R examples/templates/hackathon-seed/. "$SANDBOX/"
rm -rf "$SANDBOX/node_modules" "$SANDBOX/.astro" "$SANDBOX/.vend"
VEND="$PWD/src/cli.ts"
```

- **A1.** `( cd "$SANDBOX" && lisa init )` — non-interactive; mints `CLAUDE.md` + `.lisa.toml` + the
  `docs/` tree. **Pass:** exit 0.
- **A2.** `( cd "$SANDBOX" && bun run "$VEND" init --template hackathon )` — overlay the vend wiring.
  **Pass:** exit 0; `SEED.md` **skipped** (no-clobber, rich seed survives); `docs/knowledge/charter.md`
  carries the tuned `HACKATHON_CHARTER`. **Verify:** `grep -q "hackathon" "$SANDBOX/docs/knowledge/charter.md"`.
- **A3.** `( cd "$SANDBOX" && bun run "$VEND" doctor )` — **Pass:** green (lisa / claude / BAML /
  executor). Confirms the executor is live before any metered cast.
- **A4.** Confirm **no** `.mcp.json` in the sandbox (so decompose will degrade): `ls "$SANDBOX/.mcp.json"`
  should be absent. This is the reduced-grounding precondition.
- **A5.** `( cd "$SANDBOX" && bun run "$VEND" svg )` — pre-drive honest-empty SVG. **Pass:** writes a
  valid `.vend/work-graph.svg` (0 cards). (No spend — render only.)

## Stage B — the two gestures (METERED)

- **B1 — `vend steer` (shipped flow, no hack).**
  ```bash
  ( cd "$SANDBOX" && bun run "$VEND" steer --budget 600000,400000 )
  ```
  **Pass:** exit 0 AND a **non-empty coherent board** + forks staged at
  `docs/active/pm/staged/steer.md` (grounded in the team-finder seed). **Fail → STOP, do not flip**
  (E-059 regression). Timeout: allow up to 600 s.
  **Verify:** `test -s "$SANDBOX/docs/active/pm/staged/steer.md"` and inspect for ranked signals +
  `vend chain "…"` lines + forks.

- **B2 — `vend work` (calibrated default budget, walk-away).**
  ```bash
  ( cd "$SANDBOX" && bun run "$VEND" work --no-intervened )
  ```
  Omit `--budget` ⇒ the calibrated cold-start envelope (T-060-02-02). `--no-intervened` ⇒ forward-E1.
  **Pass:** **no instant budget-exhausted**; the propose→decompose chain casts; propose mints an epic;
  decompose **degrades-and-clears** (stdout `· reduced grounding …`) minting stories/tickets; ≥1 slice
  cleared. Timeout: allow up to 600 s.
  **Branches (design.md table):** if it blocks on board staleness → re-run with `--stale-ok` (note the
  deviation). If it instant-exhausts → fall back to an explicit generous `--budget` (note the
  discrepancy vs the unit tests). If decompose andons → STOP, do not flip.

- **B3 — `vend svg` (populated).**
  ```bash
  ( cd "$SANDBOX" && bun run "$VEND" svg )
  ```
  **Pass:** renders the populated work-graph (now with decomposed slices — > 0 cards).

## Stage C — capture the evidence (no spend)

- **C1.** Copy the run-log: `cp "$SANDBOX/.vend/runs.jsonl" docs/active/work/T-060-03-01/runs.jsonl`.
- **C2.** Inspect the records and confirm the AC markers:
  - a chain/decompose record with `intervened:false` (forward-E1),
  - `reducedGrounding:true` on the degraded cast,
  - propose/decompose `outcome` = cleared (no `missing-capability`, no budget-exhausted on the first pull).
  Use `bun -e` or `grep`/`jq` to read fields; transcribe the real numbers (tokens, ms, $, turns, ids).
- **C3.** Record total `$` spend (sum `costUsd`) and the per-cast breakdown for the gold-master banner.

## Stage D — flip the gold master + write artifacts (no spend)

- **D1.** Write `progress.md` — the drive as run (steps vs plan, the 3-4 run records verbatim,
  deviations, what cleared, any honest shortfall).
- **D2.** Rewrite `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` to the positive form per
  `structure.md` §"positive shape" — restamped banner, flipped verdict/table/board/forks/slice,
  closed follow-ups + residual-imperfections, shipped re-run block (no diagnostic hack).
- **D3.** Re-run `bun run check` — **Pass:** still 1354 pass / 0 fail (no `src/` change).

## Stage E — commit (own files only)

- **E1.** `git add examples/templates/hackathon-seed/EXPECTED-OUTCOME.md docs/active/work/T-060-03-01/`.
  Do **not** add `src/engine/cast.ts`, `src/log/run-log.ts`, the `*.test.ts`, or `justfile`.
- **E2.** Commit:
  `feat(examples): flip hackathon-seed gold master to positive — shipped flow clears a slice (T-060-03-01)`.
  Co-authored trailer per repo convention.
- **E3.** Do NOT touch ticket frontmatter — Lisa advances the phase from the artifacts.

## Testing strategy

This ticket adds **no code**, so there are no new unit tests. Verification is **behavioral + evidence**:

- **Behavioral (live):** the drive itself is the test — B1 renders a board, B2 clears a slice with the
  reduced-grounding marker and no instant exhaustion, accruing a forward-E1 record.
- **Evidence (durable):** `runs.jsonl` captured into the work dir, with the marker fields confirmed.
- **Regression (gate):** `bun run check` green before and after — proves the capture-and-flip changed
  no behavior. The unit coverage for the fixes themselves lives in the dependency tickets
  (T-060-01-02 marker tests in run-log/cast; T-060-02-02 budget tests in work-core).
- **Consistency (gold master):** the flipped `EXPECTED-OUTCOME.md` becomes the new re-runnable bar —
  a future drive should be *comparable* (gated validity, not wording identity).

## Atomicity

One commit. The drive is a single logical unit (capture → flip); there is no partial state worth
committing separately. If the drive fails a STOP branch, no flip is committed and the artifacts record
the honest shortfall instead.

## Risk register

| Risk | Mitigation |
| --- | --- |
| Live `claude -p` auth/spawn fails | `vend doctor` (A3) catches it before metered casts; STOP and report. |
| omit-`--budget` instant-exhausts | Fallback explicit `--budget`; record discrepancy honestly. |
| Board stale-gate blocks work | `--stale-ok`; note deviation. |
| Slice clears but marker absent | Inspect cast.ts wiring; flip only once marker confirmed. |
| Cost overrun | Precedent ~$1; single chain clear; budget bounds the walk-away. |
