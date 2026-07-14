# T-026-04 — Plan: ordered steps to render and record the verdict

> The execution sequence. Each step is small, independently checkable, and the doc edits commit
> as one atomic verdict change. Verification is by consistency-of-cited-number + grep, since
> there is no code to test.

## Testing strategy (a verdict ticket)

There is no `src/` change, so no unit/integration tests are added. Verification is:

- **Reproducibility check (done in Research):** `bun run src/cli.ts audit` re-reads
  `93% (14/15) · trend 100% → 88%` — matches T-026-03's frozen `audit-output.txt`. The cited
  number is live-stable, not a one-shot artifact.
- **Number-consistency check:** every figure in `verdict.md` traces to `work/T-026-03/
  findings.md` or `audit-output.txt` (no invented number).
- **Grep checks:** after the E-014 / demand edits, no file asserts `HOLD` as E-014's *current*
  verdict; `T-026-04` is cited at each updated note.
- **Gate check:** `bun run build` (typecheck) + `bun test` stay green — the doc-only change
  must not perturb the suite (sanity, since no code changed).

## Steps

### Step 1 — Write `verdict.md` (the deliverable)

Render the confirm-go verdict per `structure.md`'s 7-section shape. Pull every number from
T-026-03. Lead with **confirm-go**; carry the trend-thinness caveat; state "no remediation."
- Verify: numbers match `findings.md`; one page (~90–120 lines); reroute branch explicitly
  tested and rejected.

### Step 2 — Update E-014's canonical verdict note (`E-014.md`)

- Frontmatter line 4: `verdict HOLD (measure to unblock)` →
  `verdict go — forward-confirmed (E1 93%/15 fwd, T-026-04/E-026)`.
- Add `## Verdict (forward-confirmed 2026-06-19)` body note (3–5 lines) pointing at
  `work/T-026-04/verdict.md`.
- Verify: `grep -n "verdict" docs/active/epic/E-014.md` shows the new line; the body note cites
  the page and the rate; the thin-trend caveat is present.

### Step 3 — Echo the forward-confirmed state in `demand.md`

- E-014 row: append the forward-E1-collected / go-forward-confirmed clause.
- Measurement-sprint + macro-wallet sections: one sentence each linking the verdict page.
- Verify: the board no longer presents HOLD as E-014's current state; T-026-04 cited.

### Step 4 — Write `progress.md`, then commit

- Record steps 1–3, any deviations, and the reproducibility result.
- Run `bun run build` + `bun test` as a doc-change sanity gate (expect green, unchanged).
- Commit all `work/T-026-04/` artifacts + the `E-014.md` / `demand.md` edits as one atomic
  verdict commit (`docs(T-026-04): forward-confirm E-014 go — E1 93%/15`).

### Step 5 — Write `review.md` (handoff)

Summarize the change set, the verdict and its basis, test/verification coverage, and open
concerns (the thin trend; the single-attestor limit; the downstream-epic pointer). Stop.

## Anti-padding / honesty gates (carried from T-026-01/02/03)

- **No new ledger entries.** Read-only audit only. The verdict cites the existing 15 carriers;
  it does not manufacture a richer sample to strengthen the trend.
- **No invented number.** Only T-026-03's measured figures are rendered into a decision.
- **The caveat is not optional.** "Rate clears / trend thin" travels with every citation; the
  confirm is never inflated to "trajectory proven."
- **No remediation work.** confirm-go leaves the wallet as shipped; the plan begins no
  re-park / rebuild step. If the verdict had been reroute, the remediation would still be a
  *downstream epic to propose*, not work to start here.

## Deviation policy

If the reroute branch had survived the Design test, Step 1 would render **reroute** instead and
Steps 2–3 would record a revised verdict + a downstream remediation-epic pointer. It did not
(93%/15 forward, trust holding under the first real intervention) — so the plan executes the
confirm-go path. Any change to the cited number on re-audit would halt and re-open Design.
