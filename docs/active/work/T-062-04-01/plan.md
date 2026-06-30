# T-062-04-01 — Plan

Ordered, independently-verifiable steps. This is an **offline, additive, docs-synthesis** card — no
metered cast, no `src/`/test/template-code change. Verification is per step.

## Testing strategy

- **No unit tests added** — the gold-master asserts no new code. The captured numbers it cites are
  *already* gated by the predecessors' tests (`seed-steer-seam`, `menu-render`, `kitchen-degrade`,
  `cold-start-redrive`); this card does not re-implement those guarantees.
- **Verification = freshly re-observing the free deterministic stages** (init/doctor/svg) and pinning
  their stdout to `free-stages.proof.txt`, so every CAPTURED value in the gold-master traces to an
  observed line, not a citation. (Honest-on-outcome: capture, don't claim.)
- **Regression safety = leave the gate untouched.** `bun run check` was green over the combined tree
  at the predecessor close (1488 pass / 1 skip / 0 fail). This card adds only markdown, so the gate
  cannot regress; I will re-run it as a final guard.
- **The metered half is explicitly NOT tested here** — it is the human-authorized drive, recorded as
  `⟪…⟫` with a re-run block that fills it in place.

## Steps

### Step 1 — Re-observe the free stages; capture the proof ✅ pre-verified in Research
Throwaway sandbox, drive the **free** path against `src/cli.ts`, capture stdout:
```
SANDBOX=$(mktemp -d …/vend-kitchen-gm-XXXX); VEND=$PWD/src/cli.ts
( cd "$SANDBOX" && bun run "$VEND" init --template kitchen )   # expect: 31 created, 0 skipped, exit 0
( cd "$SANDBOX" && bun run "$VEND" doctor )                    # expect: ok — 3 checks, exit 0
( cd "$SANDBOX" && bun run "$VEND" svg )                       # expect: honest-empty 0/0/0, exit 0
```
Write the captured lines + provenance (host, executor, date) to
`docs/active/work/T-062-04-01/free-stages.proof.txt`; remove the sandbox.
**Verify:** the three exit-0 lines present in the proof; numbers match what the gold-master will cite.
*(Already run once during Research — re-run cleanly for the committed proof.)*

### Step 2 — Author the canonical gold-master
Write `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` per Structure §"internal structure":
header banner + headline + yield table + board + rendered menu + degrade + budget envelope + residual
boundaries + re-run block + honest footer. Every CAPTURED value sourced per the Structure provenance
table; every metered value a literal `⟪…⟫`.
**Verify (the honest-on-outcome checklist):**
- Every numeric/outcome claim is either (a) in `free-stages.proof.txt`, (b) in a cited predecessor
  artifact, or (c) a `⟪…⟫` slot. **No fourth category.**
- No `⟪…⟫` is filled with a guess; the live ranking/clear/budget rows stay `⟪…⟫`.
- The re-run block reproduces a comparable drive (free stages + metered casts + jq/grep checks).
- It mirrors the hackathon file's shape (so it converges to the filled form on the authorized drive).

### Step 3 — Confirm the template tree is otherwise unchanged
`git status --short examples/templates/kitchen-seed/` shows **only** the new `EXPECTED-OUTCOME.md`
added (the stub `index.astro`, `SEED.md`, `charter.md`, `.emdash/seed.json` untouched).
**Verify:** no modification to any pre-existing template file; the addition is a sibling file.

### Step 4 — Final gate guard
`bun run check` (or, if the combined working tree is heavy, scope to the kitchen tests +
`tsc --noEmit`) — confirm no regression. A markdown-only addition must not move the count.
**Verify:** exit 0; count ≥ 1488 pass / 0 fail.

### Step 5 — Close the RDSPI trail
Write `progress.md` (execution log, deviations, honest AC status) and `review.md` (handoff: what
changed, the capture/pending split, the D2 placement call flagged for the human, open concerns).
**Verify:** both present; review states the metered half is `⟪…⟫` and names the downstream drive.

## Sequencing notes

- Step 1 gates Step 2 (the proof supplies Step 2's captured numbers).
- Steps 3–4 are independent guards after Step 2.
- Step 5 closes.
- **No step requires a login or spends tokens.** The whole card is free.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Pressure to "complete" the table with invented live numbers | Honest-on-outcome checklist (Step 2): metered rows stay `⟪…⟫`; the footer states no number was invented |
| Placement ambiguity ("epic work dir" vs seed template) | Chose the seed template (diffable by the clean-room drive — Design D2); flagged for the human in `review.md` |
| Drift between the gold-master and the component captures | The gold-master *cites* the predecessor artifacts/tests as the source of truth, not a re-statement that could drift; the tests are the guards |
| Touching the cook's slice (the stub) by accident | Step 3 explicitly verifies the template tree is unchanged but for the added file |
| Gate regression | Markdown-only addition; Step 4 re-runs the gate as a guard |

## Definition of done

- `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` committed, capturing the board (target),
  the rendered menu (fact), and the budget envelope (mechanism + `⟪…⟫`), diffable by a later drive.
- `free-stages.proof.txt` backs the captured numbers.
- The template tree is otherwise unchanged; the gate is green.
- The RDSPI trail is complete; `review.md` flags the placement call and the pending metered half.
