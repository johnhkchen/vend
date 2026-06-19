# T-008-02 — Design: wire-the-lisa-stop-hook

*Options, tradeoffs, decision with rationale — grounded in Research. The one real
decision is block vs warn (R11); the rest is making the hook minimal, robust, and
faithful to the Central Rule.*

---

## The decision space

Research established the hard facts: `on-stop.sh` is a Claude Code `Stop` hook;
exit **2** blocks and feeds stderr to Claude, exit **1**/other warns,
exit **0** allows. The existing signal write is load-bearing and must survive.
`check:committed` already exists and returns 0/1/2. So the design is small — but
two choices carry all the weight: **(A) does a failing gate block or warn?** and
**(B) how do we stay robust enough never to wedge the loop?**

---

## Decision 1 — Block vs warn (R11)

### Options

**Opt-1: Warn-only.** Run the check, relay the andon to stderr, exit non-zero-but-
not-2 (or exit 0) — the stop always proceeds. Pro: zero wedge risk; trivially
minimal; matches the ticket's hedged "if it only warns…" framing. Con: it does
**not** prevent D-005 — it relies on a human reading the transcript. In an
autonomous lisa loop (`auto_advance`, possibly unattended panes) there may be no
reader, so the failure mode the epic exists to kill survives.

**Opt-2: Block always (exit 2 on dirty).** Pro: actually prevents D-005 — Claude
receives the andon and must commit before it can stop. Con: with **no guard** a
genuinely un-committable tree blocks forever → wedged loop. The docs confirm
there is no built-in safeguard. Unacceptable as-is.

**Opt-3: Block once, guarded, fail-open (chosen).** Block (exit 2) on dirty
source — *unless* this stop is already a continuation of a prior blocking stop
(`stop_hook_active` true on stdin), in which case warn-only and allow the stop.
Any tooling/environment failure (bun missing, `check:committed` exit 2, unreadable
state) → **fail open** (exit 0, allow). The lisa signal is always written first.

### Choice: **Opt-3 — block once, guarded, fail-open.**

**Why not warn-only (Opt-1):** the epic is titled "done means committed." Its
value is *prevention*, not *notification*. Warn-only ships something that, in the
autonomous case, changes nothing about whether a broken HEAD ships — it would be
under-building the slice, not a smaller honest version of it. Blocking is the
minimal thing that actually achieves the ticket's purpose, so it is the right
first slice — not over-building (which would be elaborating *beyond* the slice's
need; this is the need).

**Why guarded + fail-open and not Opt-2:** the ticket's meta-risk is explicit —
"a malformed hook must not wedge the loop." Opt-3 keeps blocking's prevention
while bounding it: at most one block per stop-sequence, and never a block when the
checker itself can't run. The happy path is clean: stop → dirty → block + andon →
Claude commits → stop again → clean → exit 0. The pathological path (tree stays
dirty) blocks exactly once, then warns and lets the loop proceed rather than
wedging — degrading to Opt-1's safety, never worse.

**First-slice behavior, recorded (AC#2):** *blocking, guarded by
`stop_hook_active`, fail-open on tooling error.* The hard-block-forever variant is
explicitly **rejected** as the follow-up trap, not deferred work — there is no
"stronger" follow-up to flag; Opt-3 is the intended steady state. If real-world
observation shows the `stop_hook_active` guard is unavailable or the block proves
disruptive, the documented fallback is to downgrade this one hook to Opt-1
(warn-only) by changing a single exit code — see Structure.

---

## Decision 2 — Translating `check:committed` exit codes

The script and the hook both use code 2 for different meanings (Research). The
hook must translate, mapping the script's three outcomes onto Stop-hook behavior:

| `check:committed` exit | Meaning | Hook action | Hook exit |
|---|---|---|---|
| 0 | clean — all source committed | allow stop | 0 |
| 1 | **andon** — uncommitted source | block (or warn if `stop_hook_active`) | **2** / 0 |
| 2 | environment error (no git / status failed) | **fail open**, print a notice | 0 |
| (anything else / spawn failed) | unknown | **fail open**, print a notice | 0 |

Rationale: only outcome 1 is an actual D-005 hit. Outcome 2 means "couldn't
check," which must never be conflated with "found a problem" — failing open here
is what keeps a broken environment from wedging the loop.

---

## Decision 3 — Robustness mechanics

- **Signal-first, always.** Reproduce the existing `mkdir -p signals` +
  `pane-$LISA_PANE_ID.stopped` write **before** invoking the check, and gate
  nothing on the check's result. The hook's lisa-orchestration duty is sacred;
  the gate is additive.
- **Read stdin without hanging.** Only consume stdin when it is *not* a tty
  (`[ -t 0 ]`), so manual invocation for the dirty-tree demo never blocks waiting
  for input. Detect the guard with a tolerant grep
  (`"stop_hook_active"\s*:\s*true`) rather than a JSON parser — minimal, and
  absence simply means "not a continuation → may block once," the safe default.
- **No hard dependency on `timeout`.** macOS ships no `timeout`(1) by default;
  adding one would make the hook *less* portable. `check:committed` is fast
  (git status + bun startup, sub-second). Accept the small theoretical hang risk
  (e.g. a held `.git/index.lock`) and record it as a known limitation rather than
  bolt on a fragile dependency. Keeping the hook minimal is itself the robustness
  the ticket asks for.
- **Locate `check:committed` deterministically.** Run it from the repo root
  (`git rev-parse --show-toplevel`, same resolution the script itself uses) so the
  hook works regardless of the pane's cwd; if even that fails, fail open.
- **`bun` may be absent** in some environments → guard with
  `command -v bun` and fail open with a notice if missing. Never let a missing
  toolchain block a stop.

---

## Decision 4 — Where the andon text comes from

`check:committed` already writes the offending paths to its **stderr** in a clear
labelled block. The hook captures that stderr and re-emits it (to the hook's own
stderr) so that on a block it is fed straight back to Claude, and on a warn it
lands in the transcript. The hook does **not** re-derive or re-format the path
list — that would duplicate logic that belongs to the pure core (Central Rule).
The hook adds only a one-line framing prefix identifying itself as the stop gate.

---

## What is explicitly out of scope

- **Editing the other three hooks** (`on-heartbeat`/`on-idle`/`on-clear`). Only
  the stop event is the "done" boundary.
- **A `/ci` sub-class.** Architecturally impossible (host tree invisible in a
  container) — Research §"why a hook."
- **Widening `SOURCE_PREFIXES`** or touching the classifier. The hook consumes
  the T-008-01 contract unchanged.
- **Hard end-to-end (hook-actually-fires) verification.** Effect is next-loop;
  this session can only test `check:committed` standalone + the translation logic
  via a dirty-tree demo. The live trigger is verified at the next session-stop —
  flagged, not faked.

---

## Acceptance-criteria trace

- **AC#1** (hook runs `check:committed` at stop; on failure a clear andon naming
  the uncommitted source paths) → Decisions 1–4: signal-first, run the check,
  relay its stderr path-list, block on andon.
- **AC#2** (block-vs-warn determined & documented; first-slice recorded, follow-up
  flagged) → Decision 1: Opt-3 chosen and recorded; warn-only documented as the
  one-line fallback.
- **AC#3** (dirty-tree demo shows the andon fires; hook minimal/robust;
  effect-next-loop noted; `check:*` stay green) → Decision 3 robustness + Plan's
  demo step + the deferred-verification note.
