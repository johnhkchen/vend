# T-059-03 — Plan: ordered steps + verification

Two tracks: the **free track** (executed now, autonomously — deterministic proof + preflight)
and the **metered track** (handed off, human-authorized — the one billed cast). Each step has
an explicit verification criterion grounded in a real exit code / output, per honest-on-outcome
discipline.

## Track 1 — FREE (executed this session)

### Step 1 — Confirm the wiring compiles and its unit tests pass
- `bun run check:typecheck` → clean.
- `bun test src/play/project-context.test.ts src/init/init-core.test.ts
  src/init/init-effect.test.ts` → all pass.
- **Verify:** typecheck exit 0; tests `0 fail`. (This pins the T-059-01/02 wiring the drive
  depends on.)

### Step 2 — Build a throwaway sandbox of the seed
- `SANDBOX=$(mktemp -d …/vend-seed-redrive-XXXX)`; `cp -R
  examples/templates/hackathon-seed/. "$SANDBOX/"`; clean `node_modules/.astro/.vend`.
- **Verify:** sandbox exists; the committed template is never written (the drive only reads
  it). `git status examples/` stays clean of new mutations.

### Step 3 — Free preflight (the shipped flow, no cast)
- `lisa init` → "Initialization complete".
- `vend init --template hackathon` → "N created / M skipped" (no-clobber: the seed's real
  `SEED.md` is preserved; `docs/knowledge/charter.md` is the hackathon charter).
- `vend doctor` → "ok — 4 check(s) passed".
- `vend svg` → writes a valid (honest-empty) SVG.
- **Verify:** each command exit 0 with the expected line; record the exact counts.

### Step 4 — The make-or-break input proof (deterministic, zero spend)
- Assemble steer's input on the sandbox **without casting** (a scratchpad harness importing
  `assembleSteerInputs`); dump `{project, charter}`.
- **Verify (the load-bearing assertion):** the dumped `project` contains a `## Stated intent
  (SEED.md)` section with the team-finder line ("matches hackathon-goers by skill + idea
  overlap"); the `charter` is the hackathon value function, not `CHARTER_STUB`. Capture stdout
  to `steer-input.proof.txt`.
- **Meaning:** the exact A3 root cause (SEED.md absent from steer's input) is closed —
  deterministically, the strongest evidence obtainable without spend.

### Step 5 — Write the positive gold-master scaffold + progress log
- Write `EXPECTED-OUTCOME.positive-scaffold.md` (structure.md shape): input-fix proof filled
  ✅; all metered slots `⟪FILL FROM LIVE RUN⟫`; loud "NOT YET CAPTURED" banner.
- Write `progress.md` recording Steps 1–4 with real output + the honest boundary at Step 6.
- **Verify:** scaffold contains no pre-filled metered number; committed `EXPECTED-OUTCOME.md`
  untouched.

## Track 2 — METERED (handed off, human-authorized P7)

> These steps spend real money and require the live model under Doppler secrets. An
> autonomous agent must not run them (AC4/P7). They are specified so the human runs and pastes.

### Step 6 — The one metered cast: `vend steer`
```bash
# in the SAME sandbox shape as Steps 2–3, under Doppler secrets:
doppler run -- bun run "$VEND" steer --budget 7200000,400000   # fund time generously (finding #2)
```
- **Expect:** a **non-empty, grounded** board staged at `docs/active/pm/staged/steer.md` —
  ≥1 signal tracing to the team-finder line; genuine forks. (The honest-empty rule has no
  grounds to fire now that the input carries a real demand gradient — see Step 4.)
- **Verify:** staged file is a ranked board (not an honest-empty abstention); record the
  signal count, fork count, and the real `runs.jsonl` line (tokens/ms) + spend.

### Step 7 — Render + (optionally) continue the slice
- `vend svg` → render the staged board beside the running Astro preview (the designer's view).
- `vend work --budget 7300000,500000 --no-intervened --stale-ok` (optional) → expect
  propose-epic to clear, then a **decompose andon: `missing-capability —
  codebase-memory-mcp`** (finding #3 — the honest stop; a *full* slice clear is out of scope).
- **Verify:** record exactly where the drive stops; do not paper over the andon.

### Step 8 — Capture the positive gold master + forward-E1
- Fill every `⟪…⟫` slot in the scaffold with the **observed** values; flip the banner to
  CAPTURED with the real date/host/model/spend; copy it over
  `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md`.
- Confirm the forward-E1 record accrued (propose-epic record carries `intervened:false`).
- Record A3 as **closed**.
- **Verify:** `EXPECTED-OUTCOME.md` now headed "✅ CAPTURED"; numbers are the run's; re-run
  block reproduces a *comparable* drive.

## Testing strategy

- **No automated tests added** — by design (T-058-05 precedent): the seed is outside vend's
  `tsconfig include:["src"]`; there is no code to unit-test. The deliverable is a captured
  artifact. The correct gates are the per-step CLI assertions above (real exit codes /
  output / run-log).
- **Vend's own suite stays green** — this ticket adds only markdown, so `bun test` and
  `check:typecheck` must remain unchanged from the pre-ticket baseline (verified in Step 1).
- **The product-level test is re-runnability** — encoded in the re-run block of the gold
  master; "comparable, not identical" is the bar.

## Atomic-commit boundaries

- Commit 1: the R/D/S/P artifacts.
- Commit 2 (Implement): `progress.md` + `steer-input.proof.txt` + the positive scaffold —
  the free proof. Scoped `git add` of only `docs/active/work/T-059-03/` so the other tickets'
  uncommitted working-tree changes are not swept in.
- The metered capture (Step 8) is the human's commit, after the authorized drive.
