# T-037-03 — Review (settle-the-evidence-and-verdict)

Handoff for a human reviewer. This ticket **settles** T-037-02's watched spend into an honest
verdict and crystallizes the board. It is the third leg of E-037 (preflight → live sweep → settle).
**No source code changed** — the work is evidence and judgement, held to the E-014/E-026 standard.

## What changed

| File | Action | Summary |
|---|---|---|
| `docs/active/work/T-037-03/verdict.md` | **created** (deliverable) | The honest verdict: **watched, not confirmed**. Forward-E1 1/2 → 3/4 (sample 2/10 → 4/10) on **censored** records; go stays **provisional + forward-leaning**; named cadence to ≥10; the `propose-epic` time-censor named as the gating blocker. |
| `docs/active/demand.md` | **modified** | Frontier 1 In-flight row + signal bullet crystallized honestly — keystone **watched** (P4/P7 live), evidence moved, what remains named. Not marked cleared. |
| `docs/active/work/T-037-03/{structure,plan,progress}.md` | created | RDSPI artifacts (started at `structure`, the T-037-02 pattern). |
| `src/**` | **untouched** | Pure read of `auditWalkAway` over the ledger. |

## The verdict in one paragraph

The keystone gesture is now **watched** — a real metered cast spent down to a clean twin P7
`andon: timed-out` stop, the wallet bounded and truthful, **auth==exec held** (E-025: ran under its
exact 72,785 ms envelope, 0 tokens debited). That graduates the feature from *coded-green-never-
demonstrated* to **demonstrated live**. But the watched run was an **honest 0-clear**: it minted
nothing, so the forward-E1 gate moved only on **censored** records (1/2 → 3/4, sample 4/10), and the
go stays **provisional + forward-leaning — explicitly not "forward-confirmed."**

## Test coverage / verification

- **Deterministic gate green:** `bun run check` → **998 pass, 0 fail**, `tsc --noEmit` clean,
  `baml:gen` clean. (No new code ⇒ no new tests; the existing `walk-away.test.ts` already covers
  `auditWalkAway`'s forward/attested split, E-028.)
- **Number reproducible:** `vend audit` re-reads an append-only ledger; forward 3/4 is stable. Ledger
  classification cross-checked directly (`tail .vend/runs.jsonl` ⇒ #27/#28 forward-censored).
- **Citation discipline audited:** `grep -nE "forward-confirmed|14/15|16/17|94%" verdict.md` — every
  hit is a **negation or the explicitly-quarantined exclusion** of the combined pool. No combined
  figure is used as a forward claim. This is the gate the ticket is really about.
- **Board still valid:** `lisa validate` → "All checks passed. 94 tickets, 1 ready, DAG valid."

## Open concerns / what needs human attention

1. **The real finding — `propose-epic` time-censors the top signal (the gating blocker).** The two
   timeouts are **not** a price problem (E-025 holds); `propose-epic` needs **more than its 72,785 ms
   p90 per-step envelope** on the board's heaviest signal and is censored before it can mint. **This
   blocks the ≥10 *cleared*-forward cadence.** Two routes proposed in `verdict.md` §3: widen the
   `recalibrate` envelope for heavy propose signals, or stage a lighter top signal. **Recommend
   filing as Frontier 1 remaining work** (rhymes with Frontier 6's recalibration levers). This is
   exactly the kind of evidence a watched run exists to surface.
2. **Clear-quality is undemonstrated, not passed.** Because nothing minted, the "is the cleared work
   sound vs junk" question has **no artifact to assess**. The verdict is honest about this — it does
   **not** claim the loop clears *good* work, only that it *refuses cleanly*. A future cleared sweep
   is needed to close it.
3. **Authoring-vs-reality pivot.** The ticket frontmatter optimistically presumed a clearance ("the
   autonomously-minted epic+tickets", a moving "cleared = one" delta). The artifacts settle the
   actual 0-clear instead. Reviewer should confirm they're comfortable that the **non-goal (no
   over-claim) was honored even though it cost the headline AC** — i.e. "≥1 cleared pull" is **not**
   met, and the verdict says so plainly rather than dressing the censored records as a clearance.

## Why this is the right call (not under-claiming either)

It would be equally dishonest to dismiss the run as a failure. **P4/P7 were genuinely demonstrated
live for the first time** — bounded spend, clean stop, truthful receipt, auth==exec, zero partial
state, reproduced twice. The machinery works. The verdict separates that earned "watched" claim from
the unearned "confirmed" claim and asserts only the first. That separation — and the refusal to let
2 censored records read as forward confirmation — is the whole point of the E-026/T-026-04 standard
this ticket holds.

## Suggested follow-ups (not in scope here)

- File the `propose-epic` recalibration finding (concern #1) as Frontier 1 / Frontier 6 work.
- Re-run a `--no-intervened` sweep once the envelope is widened, to accrue the first **cleared**
  forward record and continue 4/10 → ≥10.
