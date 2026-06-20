# T-026-04 — Structure: files, edits, and ordering

> The blueprint. Which files are created/modified, what each contains, and the order that keeps
> every step independently verifiable. No prose reasoning here (that is Design); shapes only.

## Files created

### `docs/active/work/T-026-04/verdict.md` — the deliverable (one page)

The AC's "one-page verdict." Sections, in order:

1. **Verdict line** — `**confirm-go**` in the first line, with the one-sentence basis.
2. **The number, against the back-fill** — a small table putting the forward read next to the
   back-fill read:

   | | Back-fill (E-014 sprint) | Forward (T-026-03) | Read |
   |---|---|---|---|
   | walk-away rate | 100% (13/13) | 93% (14/15) | hardened, not regressed |
   | `--intervened` records | 0 (uniform) | 1 (variance present) | the missing case appeared |
   | provenance | post-hoc attested | live self-report | forward, not back-fill |
   | tier budget read | n/a | 40% andon vs 10%/5% | gates working, not defects |

3. **Why confirm, not reroute** — the reroute branch ("author keeps intervening") stated and
   rejected against 14/15.
4. **The caveat carried forward** — trend (100%→88%) thin, one bit; rate clears, trajectory
   unproven.
5. **E-014 verdict-note transition** — from `go (provisional, back-fill)` / stale `HOLD` → `go
   (forward-confirmed)`, with the exact one-liner now in `E-014.md`.
6. **No remediation** — confirm-go leaves the wallet as shipped (E-024/E-025); remediation is a
   downstream epic and **none is triggered**.
7. **Citations** — T-026-03 findings + audit-output, measurement-sprint findings, E-014, E-026.

Target ~90–120 lines (a *page*, deliberately tighter than the ~200-line RDSPI artifacts — the
AC says one page).

### `docs/active/work/T-026-04/{research,design,structure,plan,progress,review}.md`

The RDSPI artifacts (this set). Already partially written; `progress.md` and `review.md` follow.

## Files modified (the verdict-note update — Design Option A)

### `docs/active/epic/E-014.md` — the canonical verdict note

- **Line 4 frontmatter comment:** `... verdict HOLD (measure to unblock)` →
  `... verdict go — forward-confirmed (E1 93%/15 fwd, T-026-04/E-026)`.
- **Body:** add a short `## Verdict (forward-confirmed 2026-06-19)` note after the existing
  "Done looks like" / "Decomposition" material — 3–5 lines: provisional go → forward-confirmed,
  the rate, the thin-trend caveat, pointer to `work/T-026-04/verdict.md`. No other body change.

### `docs/active/demand.md` — the board echo

- **E-014 row (`:70`):** the row currently narrates "returns **HOLD**" then later "E1 still
  needs forward runs → HOLD holds." Append one clause: the forward E1 has since been collected
  (93%/15, T-026-03) and the go is **forward-confirmed** (T-026-04) — HOLD fully retired.
- **Measurement-sprint section (`:116-117`) / macro-wallet section (`:132-137`):** one sentence
  noting the "forward, variance-bearing E1 the back-fill couldn't be" was collected and
  **confirms** the go (link `work/T-026-04/verdict.md`). Minimal; do not rewrite the sections.

## Files explicitly NOT touched

- `src/**` — no code change. This is a verdict ticket.
- `.vend/runs.jsonl` — no ledger writes. Read-only re-audit only (reproducibility, already run).
- `src/ledger/attest-intervention.ts` and any instrument — untouched (no remediation, no new
  instrument).
- The wallet epics `E-024.md` / `E-025.md` — untouched (confirm-go = no remediation).

## Ordering (each step independently verifiable)

1. `verdict.md` written and self-consistent with T-026-03's numbers (verify: numbers match
   `findings.md` + live re-audit).
2. `E-014.md` verdict note updated (verify: `grep` shows no remaining "HOLD" as the *live*
   verdict; new line cites T-026-04).
3. `demand.md` echo updated (verify: E-014 row no longer asserts HOLD as current state).
4. `progress.md` records the above; commit.
5. `review.md` handoff.

Steps 1–3 are pure doc edits with no interdependency beyond consistency of the cited number;
they commit together as one atomic verdict change.

## Interfaces / invariants to preserve

- **The cited number is single-sourced** to T-026-03 (`findings.md` / `audit-output.txt`) +
  the live re-audit. The verdict must not introduce a *new* number — only render the existing
  one into a decision.
- **The caveat travels with the number** everywhere it is cited (rate clears / trend thin).
- **"go" is never asserted as "trends to 100% proven"** in any edited file.
