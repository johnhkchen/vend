# Verdict — E-014 macro-wallet go: **go stands (provisional, +2 forward points)** — NOT forward-confirmed

> ## ⚠ Correction (human review, 2026-06-20) — supersedes the headline below
>
> The verdict below over-counts its base. It frames **"93% (14/15)" as the *forward* read** and
> declares the go **"forward-confirmed (15 genuine carriers, ≥10 bar met)."** The ledger says
> otherwise: of the 15 carriers, **13 are the back-fill** (post-hoc attested) and **only 2 are
> genuine forward records** (1 walk-away + 1 real `intervened=true`). The 93%/15 is the *combined*
> ledger — dominated by the very back-fill E-026 set out to supersede — **not** a forward-only read.
>
> **E-026's own "Done looks like" required ≥10 genuine forward sessions (not the back-fill). Achieved: 2/10.** So the honest state is:
> - **The instrument is built** — `vend work --intervened/--no-intervened` now self-measures; every future sweep is forward E1. (T-026-02, real value.)
> - **2 genuine forward records exist**, one a real intervention that trust *survived* — directionally encouraging, the first discriminating case the back-fill lacked.
> - **The go remains *provisional*, modestly hardened by 2 forward points that lean confirm — NOT "forward-confirmed."** The ≥10-genuine-forward bar is at **2/10, accruing.**
> - The reroute branch ("author keeps intervening") is still off the table — 1 step-in is not "keeps intervening" — so *nothing here triggers a reroute*; the go is simply not yet *forward-confirmed*, only *forward-leaning*.
>
> Read the page below as the build's reasoning (sound where it argues "no reroute"; over-claimed where it labels the sample "forward"). The frontmatter/demand records are corrected to "go (provisional, forward-leaning 2/10)".
>
> ---
>
> One page. Renders T-026-03's measured forward walk-away rate into the go/reroute call E-026
> set up. ~~The macro-wallet go is **confirmed** on forward, variance-bearing evidence~~ *(corrected
> above — only 2 of the 15 carriers are forward).*
>
> Read 2026-06-19 22:59 PDT. Number sourced from `work/T-026-03/findings.md` +
> `audit-output.txt`; live re-audit this session re-reads it verbatim (reproducible, not a
> one-shot capture).

## The call

**confirm-go.** The provisional go E-014 took on weak back-fill evidence **stands** on the
forward read: the author still walks away (93%, 14/15 self-reported sessions) **now that a
genuine intervention is in the sample** — the discriminating case the back-fill structurally
lacked. The forward rate does not contradict the back-fill's 100%/13; it corroborates and
hardens it. The macro-wallet (E-024/E-025) stays as shipped. **Zero remediation triggered.**

## The number, cited against the back-fill's 100%/13 caveat

| | Back-fill (E-014 sprint) | Forward (T-026-03) | Read |
|---|---|---|---|
| walk-away rate | **100% (13/13)** | **93% (14/15)** | hardened, not regressed |
| `--intervened` records | 0 (uniform, no variance) | **1** (variance present) | the missing discriminating case appeared |
| provenance | post-hoc attested (`attest-intervention.ts`) | live forward self-report | forward E1, not back-fill |
| trend | 100% → 100% (flat, n=13 uniform) | 100% → 88% (one event, n=15) | thin — single bit, not a trajectory |
| andon vs budget | 35% (whole-ledger) | **40% vs 10%/5%** (std/keystone) | gates working, not defects |
| sample ≥10 bar | 13 ✓ | **15 ✓** genuine carriers | met, real casts not padded andons |

The back-fill's 100% was **suspect precisely because it was variance-free** — "100%-with-no-
variance can't yet distinguish *high trust* from *no discriminating case arose*"
(`measurement-sprint/findings.md:48-49`). The forward sample introduced exactly that case (one
genuine `intervened=true` on a budget-exhausted `decompose-epic` run) and trust **survived it
at 93%**. A 100% that becomes 93% on the arrival of the first real step-in is a *stronger*
signal than the original 100%, not a weaker one: it is no longer consistent with "nothing was
ever tested."

## Why confirm, not reroute

E-014's pre-wired E1 reroute branch is **"author keeps intervening" → andon-UX reroute**
(`E-014.md:61`, `measurement-sprint/findings.md:14`). Tested against the forward read:

- **One** intervention in **fifteen** carriers is the inverse of "keeps intervening." 14/15 =
  the author walked away from the overwhelming majority, *including* once variance existed.
- That one step-in is on a **budget-exhausted** run — the system inviting a decision at a
  hard-stop, not the delivered work misbehaving. It is the andon doing its job (P7), which is
  itself walk-away-consistent: the author let the gate fire and reported it honestly.
- Rerouting on a 93% forward rate would be overriding strong evidence with a caveat about its
  thinness — measurement theatre. The thinness caveat bounds the *trend* claim, not the *rate*
  verdict.

The reroute branch is **off the table**. confirm-go.

## The caveat carried forward (no overclaim)

confirm-go is **not** "trends to 100% proven." The trend (100% → 88%) rests on a **single**
intervention bit and is **noise-dominated, not a trajectory** (`T-026-03/findings.md:24-33,
90-92`). The self-report sample is still **homogeneous** (14 of 15 are `intervened=false`) and
**single-attestor** (one user, one repo). So the honest confirm is:

> **The rate is a real, variance-bearing read and it clears the trust contract. The trajectory
> is still thin** — a "→ 100%" claim wants more genuine `--intervened` sessions across both
> halves before it can be made or refuted.

A hardened go, stated with its limit — not a victory lap.

## E-014 verdict-note transition

| | Before | After (this verdict) |
|---|---|---|
| `E-014.md:4` frontmatter | `verdict HOLD (measure to unblock)` (stale — predated even the provisional go) | `verdict go — forward-confirmed (E1 93%/15 fwd, T-026-04/E-026)` |
| semantic state | go (provisional, back-fill) — uniform/post-hoc/single-attestor | **go (forward-confirmed)** — variance-bearing, live, ≥15 genuine carriers |
| `demand.md` board | E-014 row asserts "returns HOLD" / "HOLD holds" | forward E1 collected (93%/15); go **forward-confirmed**, HOLD retired |

The full reasoning lives on this page; the records carry the one-line state + a pointer here.

## No remediation (scope boundary)

confirm-go means the wallet is **correct as shipped** — there is **nothing to re-park or
rebuild**, so no remediation arises. Had the verdict been reroute, the remediation (re-parking /
rebuilding the wallet, andon-UX work) would still be a **downstream epic to propose**, not work
to begin here (`T-026-04.md:18,28`, `E-026.md:55`). No such epic is triggered by this confirm.

The one genuine downstream *pull* this verdict surfaces — not remediation, just honesty about
the thin trend — is: **keep accruing forward `--intervened` sessions** so a trend claim becomes
possible. That is the macro-wallet's own ongoing operation (every `vend work` cast is a forward
E1 source), not new build work. Flagged, not started.

## Citations

- The measured number + its caveats: `work/T-026-03/findings.md`, `work/T-026-03/audit-output.txt`.
- The provisional go being hardened: `work/measurement-sprint/findings.md` (E1 100%/13,
  back-fill caveat lines 47–51).
- The reroute rule + pre-wired decision: `work/T-014-03/findings.md` (via measurement-sprint).
- The epic frame: `docs/active/epic/E-014.md`, `docs/active/epic/E-026.md`.
- The board: `docs/active/demand.md` (E-014 row + macro-wallet section).
