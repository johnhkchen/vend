# T-026-04 — Research: rendering the go/reroute verdict

> Descriptive. What exists, where, and how it connects — the inputs this verdict consumes
> and the records it must update. No solution proposed here (that is Design).

## The ticket's job, restated from the artifacts

Convert T-026-03's **measured forward walk-away rate** into a verdict that **confirms or
revises** the *provisional* go E-014 already took. The go is real and shipped (the macro-wallet,
E-024/E-025); this ticket hardens or corrects that call on forward, variance-bearing fact.
Remediation (re-parking / rebuilding the wallet) is explicitly a **downstream epic, out of scope**
(`T-026-04.md:18`, `E-026.md:55`).

This is a **verdict/decision ticket**, not a code ticket. The deliverable is one page of
reasoning plus a one-line update to E-014's recorded verdict. No `src/` change is in scope.

## The input number (the dependency, T-026-03)

`work/T-026-03/findings.md` + `audit-output.txt` are the consumed inputs (this ticket
`depends_on: [T-026-03]`):

- **Forward walk-away rate: 93% (14/15 ran untouched)**, read by `vend audit` over
  `.vend/runs.jsonl` (25 records; 15 carry the `intervened` self-report bit).
- **Trend: 100% → 88%** (earlier → recent half of the 15 carriers; target → 100%).
- **One genuine intervention** — a single `decompose-epic` budget-exhausted run with
  `intervened=true`. The other 14 carriers are clean walk-aways.
- **Andon rate: 40%** vs 10% (standard) / 5% (keystone) budget — over at every tier, read by
  the instrument's own framing as "gates working, not defects" (7 censored + 3 gate-failed,
  none a defect in delivered work).
- **Sample: 15 carriers ≥ the ≥10 bar.** Genuine product use across propose/decompose/expand/
  survey/steer, real envelopes (token ×0.65 median over 9 successful runs), **not** padded
  1-token andons.

**Reproducibility (checked this session, 2026-06-19 22:59 PDT):** re-running `bun run
src/cli.ts audit` re-reads **93% (14/15) · trend 100% → 88%** verbatim — the frozen
`audit-output.txt` still matches the live ledger. The number is stable, not a one-shot capture.

## The thing being confirmed — the *provisional* go and its caveat

The go was rendered earlier this session in `work/measurement-sprint/findings.md`:

- Verdict: **go — un-gate the macro-wallet** (`measurement-sprint/findings.md:17,71`). Both
  E1 and E2 cleared; neither reroute branch fired.
- **E1 as collected: 100% (13/13)** — but the caveat is load-bearing and stated three ways
  (`measurement-sprint/findings.md:47-51`): the signal is **uniform** (13 falses, zero
  `--intervened`), **post-hoc** (attested via `src/ledger/attest-intervention.ts`, not live),
  and **single-attestor**. "100%-with-no-variance can't yet distinguish high trust from no
  discriminating case arose." It is *didn't-break*, not *stress-tested*.
- The recommendation explicitly named the fix: "the wallet's own first runs become the
  **forward, variance-bearing E1** the back-fill couldn't be" (`:75`, `:136`). That forward E1
  is exactly what T-026-03 measured. **This ticket closes that loop.**

So the provisional go = "go (provisional, back-fill)" the AC names: a go taken on uniform
post-hoc evidence, with the forward read deferred. E-026 reframes the whole sprint as
*hardening* that go (`E-026.md:9-12,33-38`).

## Where E-014's verdict note lives (the update target)

The AC requires updating "E-014's verdict note from 'go (provisional, back-fill)' to its
forward-evidenced state." The recorded verdict state is spread across:

1. **`docs/active/epic/E-014.md:4`** — frontmatter status comment, currently reads
   `verdict HOLD (measure to unblock)`. This is **stale**: it predates even the provisional go
   (the measurement sprint moved HOLD → go, but the comment was never updated). The canonical
   home for E-014's one-line verdict note.
2. **`docs/active/demand.md`** — the roadmap board. The E-014 row (`:70`) still says findings
   "returns **HOLD**"; the measurement-sprint section (`:116-117`) and macro-wallet section
   (`:132-137`) record the provisional go (E1 100%/13, "back-fill couldn't be"). These are the
   board-level reflection of the verdict.

The "verdict note" the AC means is the canonical one-liner — `E-014.md:4` — with `demand.md`
as the board echo. Both should land in the forward-evidenced state.

## Constraints and boundaries surfaced

- **No remediation.** The verdict may *recommend* a downstream epic, but begins no re-parking /
  rebuild work (`T-026-04.md:28`, `E-026.md:55`). A confirm-go in particular implies the wallet
  stays as shipped — zero remediation, the clean case.
- **No new instrument / no ledger writes.** Like T-026-03, this reads the existing `vend audit`
  output; it must not synthesize or pad ledger entries (`E-026.md:55` — N2, "measure, don't
  surveil"; the anti-padding gate T-026-01/02 set).
- **Cite the rate against the back-fill's 100%/13 caveat** — the AC's explicit requirement: the
  verdict must put 93%/15-forward *next to* 100%/13-back-fill and read the difference honestly.
- **The trend is thin** (T-026-03's carried-forward caveat): one intervention against fourteen
  walk-aways; a "→ 100%" trajectory can be neither claimed nor refuted yet. The verdict must
  carry this caveat, not bury it.

## Open questions for Design

- Confirm-go or reroute? (The number is favorable, but the AC demands the reasoning, not a
  foregone conclusion — Design must test the reroute branch honestly against the 93% and the
  trend.)
- How much of E-014's verdict note to rewrite vs. append — minimal one-line update vs. a fuller
  forward-evidenced note. Scope discipline says minimal + a pointer to this verdict page.
