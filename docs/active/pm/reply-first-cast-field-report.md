# Reply to the first-cast field report (2026-07-12)

Plaintext to pass to the user who hit the sandboxed `vend steer` failure. Send after
v0.4.0-rc.4 is confirmed on the tap. (Superseded guidance: recommend **rc.5**, not rc.4 —
see the localhost:11434 reply below.)

---

# Reply to the localhost:11434 crash report (boilerplate-demo, 2026-07-13)

Your report was exactly right on every point, and it's fixed. **`brew update && brew upgrade
vend` → 0.4.0-rc.5**, then:

1. **Your orphan E-013**: re-run the decompose you had to kill —
   `vend run decompose-epic docs/active/epic/E-013.md --budget 40m,500k` (budgets take humane
   units now). It completes normally; we proved the fix on our own identically-orphaned epic.
   `vend doctor` goes fully green once it lands.

2. **What it was**: vend's new cross-vendor review gate shipped with a default registry that
   fabricated a reviewer on `localhost:11434` (a local-model default nobody configured), and its
   failure was uncaught. You never had a misconfig — `grep` finding nothing was the correct
   result. As of rc.5, cross-review is inert unless you explicitly provision a reviewer (the run
   record says `crossReviewSkipped` honestly), a configured-but-unreachable reviewer stops the
   cast with a named explanation instead of a stack trace, and doctor tells you up front what
   review will do.

3. **Your missing ledger line and stray `.vend/artifacts/run-….diff`**: both were our bug — the
   crash pre-empted the record write. That can't recur (the record now survives settlement
   failures), but the crashed cast's line is unrecoverable; your ledger simply has a gap at
   ~04:28 UTC. The stray artifact is safe to delete or keep.

4. Your version-skew observation (rc.3 → rc.4 mid-session) explained why your earlier chains
   cleared — rc.3 had no cross-review code. Good catch; it confirmed the failure was
   every-cast-on-rc.4, not conditional.

Your report — killed retry, preserved orphan, grep evidence, ledger timestamps — turned a
crash into a shipped fix in one working day. Genuinely appreciated; keep them coming.

---

Thanks for the report — it was precise enough to fix the same day. What you hit was real,
and it was two separate problems:

1. **The sandbox failure.** The claude executor needs the macOS Keychain to read its login
   credentials, and your sandbox blocked it. `vend doctor` said everything was green because
   it only checked that claude was *installed*, not that it could actually *run from where
   you were*. That was a hole in doctor, not in your setup.

2. **The 12.5k budget.** That ceiling came from vend's own tier pricing, which is denominated
   for clearing work — a whole-project `steer` read measures around 400k tokens, and vend let
   the cast be funded at ~3% of that without a word. Your bounded cast was always going to
   come up short or empty; that silence was our bug too.

Both are fixed in **v0.4.0-rc.4** (`brew update && brew upgrade vend`):

- `vend doctor` now runs an **executor dispensability** check — from inside your sandbox it
  will go red and name what's blocked (credential/config-store access) with the fix, before
  any tokens are spent.
- If the same failure ever happens mid-cast, it lands as a clean named stop with the cause,
  never a raw error.
- Funding a cast far below its measured envelope now gets a warning at the counter — you can
  still run a deliberately thin probe, but never an accidental one.

Practical path for your setup: run `vend doctor` first from wherever you'll actually cast;
if it's red on dispensability, cast from outside the sandbox (or grant Keychain access), and
run `vend steer` with **no `--budget`** — the default envelope is the measured one.

One more thing: your instinct to inspect what the cast actually wrote instead of trusting
the exit was exactly right — that's the discipline vend is built around. Keep the reports
coming; this one turned into a shipped epic in under a day.
