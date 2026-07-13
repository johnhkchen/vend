# Reply to the first-cast field report (2026-07-12)

Plaintext to pass to the user who hit the sandboxed `vend steer` failure. Send after
v0.4.0-rc.4 is confirmed on the tap.

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
