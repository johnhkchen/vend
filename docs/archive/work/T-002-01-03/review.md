# T-002-01-03 — Review: verify-no-drift

*Self-assessment and handoff. What was proven, coverage, open concerns. Enough to
understand the work without re-running every command.*

## Summary

This **spike** proved the T-002-01-02 `test` gate is **real and drift-free**, on
the machine, with the Docker daemon up. The same `bun run check:test` runs green
both standalone (**229 pass / 0 fail**) and in-container via
`dagger -m ci call test run` (**exit 0**), and goes **red identically** (both
**229 pass / 1 fail**, exit 1) when a deliberately-broken test is introduced — then
reverted. `/ci` is confirmed a separate program (imports nothing from the app).
The three-way no-drift contract — standalone · play-andon · CI — holds: two legs
were exercised directly; the play-andon leg is the *same `bun run check:test`
string*, so its agreement is by construction. **No production code changed.**

## What changed (files)

| File | Change | Notes |
|------|--------|-------|
| `docs/active/work/T-002-01-03/{research,design,structure,plan,progress,review}.md` | **new** | RDSPI artifacts (this set) |
| `zz-drift-can-fail.test.ts` | created **then deleted** | the deliberate break; **never committed** |

**Zero** changes to `ci/src/*`, `ci/*` config, `package.json`, `baml_src/*`, or any
real `*.test.ts`. The gate was *exercised*, not edited. `git status` at close:
only the RDSPI work dir is added; the ticket `.md` files carry Lisa's bookkeeping.

## Acceptance criteria

| AC | Status | Evidence |
|----|--------|----------|
| `dagger call test run` (Docker up) runs the suite in-container and **agrees** with standalone `bun run check:test` (both green) | ✅ | Standalone exit 0 / 229 pass; `dagger -m ci call test run` exit 0. Verdict-equality, identical tally. |
| A deliberately-broken test makes the gate **fail**, then revert | ✅ | Scratch test → standalone exit 1 (229/1) **and** container exit 1 (229/1); `rm` → back to 229/0; tree clean. |
| A short note records cold-start / run time and confirms `/ci` imports nothing from the app | ✅ | Timing: connect 0.2s (warm; ~18.4s cold per `ci-strategy.md`), 12.6s first run → 5.9s cached. Boundary greps empty; `@dagger.io/dagger` not a dep; `ci/sdk` gitignored. |
| **Out of slice:** `lint`, `typecheck`, `consistency`, keep-warm — not bundled | ✅ | None added. Timing *motivates* keep-warm; it is recorded as out-of-slice, not built. |

All four ACs met and verified on the machine.

## Test coverage

- **No unit tests added — correct, not a gap.** A spike's coverage *is* the live
  proofs P1/P2/P3 in `progress.md`. The one test that existed (the scratch break)
  was an instrument designed to fail, then deleted.
- **The can-fail proof is the strongest coverage here:** it demonstrates the gate
  is a real detector, in-container, with a verdict identical to standalone — not a
  pass-through. This is precisely the property `lint`/`typecheck`/`consistency`
  gates will inherit mechanically (playbook step 2: "a gate that cannot fail is
  not a gate").
- **Agreement coverage** is verdict + tally equality on both a green and a broken
  tree (229/0 both sides; 229/1 both sides). Stronger than a single green run.

## Open concerns / flags for a human reviewer

1. **Gate `.stdout()` returns only the `bun test` banner, not the tally.** `bun
   test` prints its pass/fail summary to **stderr**; `Test.run()` returns
   `.stdout()`, so the returned string is just `bun test v1.3.9 …`. **This is not
   drift** — the *check string* and the *exit-code verdict* (which enforces the
   gate) are identical both sides. But if a future caller (the play's andon, a CI
   dashboard) wants the machine-readable tally from the return value, the gate
   should capture stderr too. A *reporting* enhancement, not a correctness bug;
   out of this slice. Must not alter the `check:test` definition when done.
2. **Invocation is `dagger -m ci call test run`, not bare `dagger call test`.** The
   module lives in `ci/`; the bare form (and the T-003 AC shorthand) errors with
   `unknown command "test"`. Whoever wires the play's andon or a CI trigger must
   use `-m ci` (or run from inside `ci/`) and chain the `run` leaf. (Documented in
   `progress.md` Finding 1.)
3. **Three T-002-01-02 surfaced assumptions are now CONFIRMED**, removing risk for
   the next gate: `defaultPath: "/"` → git repo root (no `--source=.` needed);
   `bun install --frozen-lockfile` works in-container; the linux `baml` binary
   generates `baml_client/` cleanly in `oven/bun:1.3.9-slim`. No prep tuning was
   needed.
4. **Keep-warm is now empirically justified but deliberately unbuilt.** Measured
   cost: ~12.6s first run, ~18.4s cold-start, dropping to ~5.9s warm+cached. Across
   a fast-committing fleet this is the per-increment tax keep-warm later removes.
   Flagged for the keep-warm slice, not actioned here (ticket AC4).

## Andon events

- **`dagger develop` was NOT run.** The CLI again advertised v0.21.4 → v0.21.7;
  **declined**. Engine stayed pinned at v0.21.4. No regen, no bump.
- **No `check:test` edit** to make any proof pass — the Central Rule the spike
  defends was held throughout.
- Docker-up precondition was satisfied; nothing was faked or simulated.

## Bottom line

The first structural gate is **honest**: it agrees with standalone, it can fail,
and it lives in a clean, separate `/ci` module. The shape `ci-strategy.md` and the
`ci-structural-gate` playbook prescribe is now proven end-to-end on one gate —
exactly the foundation gate #2..N (lint, typecheck, consistency) generalize from.
Two reporting/invocation notes (stderr tally, `-m ci`) are surfaced for whoever
wires the next gate or the play's andon. Nothing blocks. Ready for handoff.
