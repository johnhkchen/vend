# T-008-02 — Progress

*Implementation log: what was done, what was verified, deviations.*

---

## Status: implementation complete, smoke-verified, committed.

## Steps executed (per plan.md)

- **Step 1 — baseline.** `bun run check:committed` → exit 0 ("ok"); working tree
  dirty only with ticket + work-doc files (no source). Confirmed.
- **Step 2 — rewrote `.lisa/hooks/on-stop.sh`.** Signal-write block byte-identical
  and first; added tty-guarded stdin read, `stop_hook_active` guard, fail-open
  toolchain guards (`command -v bun`, `git rev-parse`), gate invocation capturing
  stderr, and the exit-code translation `case`. Mode preserved `-rwxr-xr-x`.
  shellcheck not installed on this machine → manual read instead (noted).
- **Step 3 — clean tree → allow.** `echo '{}' | on-stop.sh` (with dummy
  `LISA_PANE_ID`) → **exit 0**, no andon, `.stopped` signal written then cleaned.
- **Step 4 — dirty source → andon (AC#3 demo).** Created throwaway
  `src/ci/_demo_dirty.ts`:
  - `bun run check:committed` → **exit 1**, offending path on stderr. ✅
  - hook, fresh stop (`{}`) → andon framing + relayed path + **exit 2 (block)**. ✅
  - hook, `{"stop_hook_active":true}` → same andon text + **exit 0 (warn, guarded)**. ✅
  - deleted demo file → `check:committed` back to exit 0. ✅
- **Step 5 — fail-open sanity.** Verified by reading the final script: missing
  `bun`, no git root, and any non-(0|1) gate code all lead to `exit 0`. A true
  no-git environment was not constructed (would require an unsafe throwaway env);
  the branches are straight-line `exit 0` — recorded as a Review gap, mirroring
  T-008-01's untested exit-2 branch.
- **Step 6 — regression + dogfood.** `tsc --noEmit` clean; `bun test` **282 pass /
  0 fail**; `bun run check:committed` on the final tree → **exit 0**.
- **Step 7 — committed.** `.lisa/hooks/on-stop.sh` + `docs/active/work/T-008-02/`
  staged and committed atomically; tree left with no source paths dirty.

## Deviations from plan

- **None substantive.** shellcheck unavailable (skipped, manual review instead).
  The relayed andon includes `bun run`'s own wrapper noise (the `$ bun run …`
  echo and `error: script … exited with code 1`) above the offending path — see
  Review (cosmetic; the path is clearly present and is what matters).

## Deferred (flagged, not done — by nature, not omission)

- **Live hook-fires verification.** Editing `.lisa/hooks/on-stop.sh` only changes
  *future* stops; the real "Claude Code invokes the hook at session stop, gets
  exit 2, and continues" path is next-loop and unobservable in this session. The
  translation logic + dirty-tree demo stand in for it here; the live trigger is
  confirmed at the next real session-stop.
- **exit-2 (env error) live branch** not executed end-to-end (see Step 5).
