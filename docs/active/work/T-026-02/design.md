# T-026-02 — Design: how to produce genuine forward E1 evidence

Grounded in Research. The question: how do we get the ledger to **≥10 real, non-synthetic, mixed-bit sessions read from genuine behaviour** — without padding (AC) and without board pollution (T-026-01 #2)?

## The decision in one line

**Thread the `intervened` self-report through `vend work` (the genuine fund-and-walk-away production gesture), so the user's normal autonomous sweeps accumulate genuine forward E1 records — then accumulate to ≥10 over a bounded multi-sitting sweep, flagged per the AC, rather than pad with degenerate andons.** T-026-02 lands the wiring; the count accrues from real product use.

## Options considered

### Option 1 — Pad with board-safe `vend run` andons (×8 more)
Repeat T-026-01's proven 1-token mode 8 more times, alternating bits, to reach ≥10 carriers.
- ✅ Real casts, non-synthetic, mixed bits, board-safe, cheap-ish, satisfies the AC *literally*.
- ❌ Every record is a **1-token budget-exhausted andon** — a run the author never had a chance to walk away from. The walk-away rate over them measures the *wire*, not trust. T-026-01 #2 explicitly warns against this; the AC's own clause says **"rather than the sample padded."** Producing 8 degenerate runs to hit a count **is** padding.
- **Rejected** — it games the number and would mislead E-014's verdict, the exact failure the sprint exists to avoid.

### Option 2 — Genuine `vend run` successes against throwaway epics (×10), then curate
Mint ~10 throwaway `probe-*` epics, cast each under a real budget → genuine `success` walk-aways → delete the materialised stories/tickets afterward.
- ✅ Genuine success outcomes (real walk-away behaviour), mixed bits, non-synthetic.
- ❌ ~$5–7 + 20–40 min + heavy board churn (write-then-delete ~10 epics + ~30 tickets); id-collision risk between the 10 decompositions; the casts decompose *fake* epics, so "genuine behaviour" is hollow — the author isn't trusting real work, just instrument fodder. Curation is error-prone and itself board-mutating.
- **Rejected** — expensive theatre; the "behaviour" measured is casting throwaways, not the product's real walk-away workload.

### Option 3 — Wire `intervened` through `vend work`, accumulate over real sweeps *(chosen)*
`vend work` is the charter's literal "fund a macro-wallet once, walk away, let it run" gesture — it already casts genuine propose→decompose successes against the **live wallet** and produces legitimate board output (it minted E-026 today). It is precisely the "genuine behaviour against the live wallet" the AC's Context describes. The only thing missing is that its casts don't record whether the author intervened.
- Add `intervened?: boolean` to `WorkOptions` → `ChainProposeDecomposeOptions` → both chain steps' `castPlay` opts → ledger (the proven pass-through pattern). Add `--intervened`/`--no-intervened` to `parseWorkArgs` + the work dispatch arm.
- ✅ Turns **every future `vend work` sweep** into genuine forward E1 evidence — no padding, no throwaways, no synthetic data. The ≥10 sessions accrue from the user's real daily sweeps (the sprint accumulation the AC anticipates flagging).
- ✅ Low-risk: identical to the already-tested `intervened`-on-`run` and `model`/`project` pass-throughs; logged regardless of outcome (T-026-01 proved this on `castPlay`).
- ✅ Board-safe by construction at the *wiring* level (no cast is forced); legitimate sweep output is the product working (human-reviewed per IA-5).
- ⚠️ Reaching ≥10 genuine **success** records requires real sweeps over time — intrinsically multi-sitting; flagged, not padded.
- **Chosen.**

### Option 4 — Add a non-materialising `--dry`/probe success mode to `vend run`
A bigger feature (a success outcome that skips the effect) so probes can be genuine-success yet board-safe.
- ❌ Out of scope (a new run mode = its own ticket), and a "success that doesn't materialise" muddies the success semantics the gates contract depends on.
- **Rejected / deferred** as a possible follow-up if `vend work` accumulation proves too slow.

## Why Option 3 is the right altitude

The ticket's Context says "≥10 REAL `vend run` casts … **against the live wallet** … genuine behaviour — not a synthetic or thin sample." The live wallet **is** `vend work`. The honest reading is: the forward evidence should come from the real autonomous gesture, not from instrument-only `vend run` probes. The blocker is that the gesture can't record the bit. Removing that blocker is the smallest change that makes the AC's *intent* achievable, and it leaves a durable instrument (every future sweep self-measures) rather than a one-off pile of probe records.

This also corrects the real gap T-026-01's readiness gate missed: it proved `vend run` carries the bit but never checked the *production* path (`vend work`), which is the one that actually generates walk-away successes. Option 3 is the "named blocking flaw in the real-session path" T-026-01 was meant to surface — now fixed.

## Semantics decided

- **Self-report is session-level.** `vend work --intervened|--no-intervened` is the author's report for the whole walk-away session; **every chain cast in that session inherits the bit** (propose + decompose records both carry it). Absent ⇒ field omitted ⇒ unknown (back-compat shape unchanged). This matches the gesture: you fund once and either walk away (`--no-intervened`) or you stepped in (`--intervened`).
- **Each chain cast is a session data point.** One `vend work` invocation produces multiple carriers (2 per cleared signal). `auditWalkAway` counts all carriers; this is honest (each is a genuine "did the author intervene" observation), and is documented so "≥10 sessions" is read as ≥10 genuine carrier records, not 10 separate invocations.
- **Default remains walk-away in spirit but unknown in data.** We do NOT default `vend work` to `intervened:false` — an unreported sweep stays `undefined` (unknown), so the rate is never fabricated. The author must opt in to the self-report, exactly as `vend run` requires the flag.

## Scope decided

- **In scope (Implement):** the `intervened` wiring through `vend work` + chain + CLI parser/dispatch, with parser unit tests; full `bun run check` green; committed atomically.
- **In scope (evidence):** document the accumulation protocol (how the user reaches ≥10 via real `--no-intervened`/`--intervened` sweeps) and record the genuine seed already present (T-026-01's 2 records). Flag the remaining accrual as a bounded multi-sitting background sweep (AC's explicit allowance).
- **Out of scope:** force-running 10 live sweeps in this autonomous sitting (board-mutating + ~$5–7 + stale-board friction, imprudent without human assent — IA-5); a `vend run --dry` mode (Option 4, a follow-up if needed).

## Verification strategy

1. **Parser tests** (pure): `vend work --intervened` / `--no-intervened` / neither set `intervened:true`/`false`/absent; composes with `--budget`/`--board`/`--stale-ok`. Mirrors the existing `run --intervened` tests.
2. **Threading by inspection + types:** the bit is pure pass-through into `castPlay` opts, identical to the `model`/`project` paths the suite already exercises; `tsc` proves the field flows through `WorkOptions → ChainProposeDecomposeOptions → PlayStep.opts`.
3. **Live end-to-end:** deferred to the natural sprint sweep (a real `vend work --no-intervened` writes bit-carrying chain records). The `castPlay`-logs-the-bit-regardless-of-outcome fact is already proven live by T-026-01; the chain reuses the same `castPlay`.
