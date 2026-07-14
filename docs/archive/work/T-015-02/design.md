# T-015-02 Design — decisions & rationale

Two decisions to make, each grounded in Research: **where the default lives** (and what
number) and **how turns-used becomes observable**. Plus the testing posture for the live
sweep AC.

## D1 — Where the warranted default lives

**Options**

- **A. A constant in the seam** (`claude.ts`, e.g. `buildArgs` defaults `maxTurns ??= 15`).
  Rejected: the seam is a deliberate *dumb argv builder* — T-015-01 review §Design notes
  says policy/validation belongs upstream. A default IS policy. Putting it here also makes
  the default un-overridable cleanly and applies it to non-play dispenses.
- **B. A generic constant in `castPlay`** (cast.ts, `opts.maxTurns ?? CAST_DEFAULT_TURNS`).
  Workable but wrong altitude: it forces one number across *all* plays. The observed tail
  (~85–95k) is decompose-epic's; note/propose plays wander differently. A single engine-wide
  cap is either too tight for a heavy play or too loose for a light one.
- **C. A per-play field on the `Play` contract** (`play.ts` `maxTurns?: number`), resolved
  in `castPlay` as `opts.maxTurns ?? play.maxTurns`. **Chosen.**

**Why C.** The `Play` interface *already* houses exactly this kind of value: `budget:
Budget` is documented as "the warranted budget envelope (overridable at the counter)". A
warranted turn cap is the same concept on a different axis — a per-play default the counter
(per-cast `CastOptions.maxTurns`) overrides. It is grounded in Research: the tail is
per-play, and `decomposeEpicPlay` already states its `budget` inline, so it has the natural
home for a sibling `maxTurns`. Resolution `opts.maxTurns ?? play.maxTurns` makes the
override-wins contract (AC1) a one-liner, and `maxTurns?` optional means a play that
declares none is unbounded — back-compat for every other play, byte-for-byte.

**Precedence (AC1):** `CastOptions.maxTurns` (per-cast override, T-015-01) `??`
`play.maxTurns` (warranted default) `??` `undefined` (no flag ⇒ bounded only by wall-clock +
token budget). `0` never reaches a meaningful cap (the seam's truthy guard folds it to
absent — T-015-01 decision, unchanged).

## D2 — The number, and its in-code justification

**Chosen: `DECOMPOSE_MAX_TURNS = 15`.**

Grounded in Research's evidence band:

- Clean decompose runs land at **1–7 turns** (live `num_turns`: 1,2,2,3,4,7). 7 is the
  observed clean-run ceiling.
- The ~85–95k token tail is **agentic wandering** — extra exploratory turns, not bigger
  input. Turns are the lever that bounds it.
- **15 ≈ 2× the observed clean-run ceiling.** Generous enough that no legitimate run is cut
  off (AC4: no false andon — nothing seen within 8 turns of the cap), tight enough that an
  unbounded wander is stopped well before it runs away. The ticket's tie-breaker — "err
  generous; a false andon is worse than one tail through" — is honored by the 2× margin
  over the *ceiling*, not the median.

**Why not freeze it tighter (e.g. 8–10):** the sample is tiny (one self-reporting author,
~6 clean runs). A cap at the ceiling+1 risks false andons on a legitimate run that needed a
couple more turns for a meatier epic — the exact failure the ticket says is worse. **Why not
looser (e.g. 30):** that would barely bite the wandering tail the ticket exists to rein in.

**It is a judgment, not a frozen constant** — and the in-code comment says so. AC2 makes
turns-used observable precisely so the *next* iteration replaces 15 with a p95-of-clean
number read from the log. The constant is the seed; the data is the refinement loop. This
mirrors E-014's HOLD discipline: ship a defensible instrument, let measured data move it.

The constant lives in `decompose-epic-core.ts` (addon-free) with the justification
doc-comment, and `decompose-epic.ts` references it on `decomposeEpicPlay.maxTurns` — so the
value is unit-testable without loading BAML (Research §pure/impure).

## D3 — How turns-used becomes observable (AC2)

`num_turns` is on the terminal `result` message (Research confirmed it live). Two surfaces:

1. **The run-log record (primary, durable, tunable).** Add `turnsUsed?: number` following
   the *exact* `envelope`/`project`/`intervened` pattern: optional on input + record,
   normalized to `undefined` when absent/non-finite, spread only when present (omitted ⇒
   byte-identical to a pre-field record), revived the same way. This is the surface the cap
   is calibrated from — `wc`/`jq` over `runs.jsonl` gives the turns distribution.
2. **A stdout line (operator-facing).** `castPlay` emits `· turns: N` after the cast,
   matching the existing `· ` convention — cheap visibility while a run streams.

**Type the field.** Add `num_turns?: number` to `ResultMessage` in claude.ts so cast.ts
reads `result.num_turns` cleanly (today it's reachable only as `unknown` via the open
record). Purely additive to a type that already documents `usage`/`total_cost_usd`.

**Harvest purely.** A `resolveTurnsUsed(numTurns: unknown): number | undefined` in
`cast-core.ts` (keep only a finite non-negative integer; else `undefined`) — symmetric with
`resolveLoggedModel`, unit-testable without spawning. `castPlay` calls it on
`result?.num_turns` and threads the result to `appendRunLog`.

## D4 — Resolution helper (AC1, testable)

Add `resolveMaxTurns(override: number | undefined, dflt: number | undefined): number |
undefined` to `cast-core.ts` returning `override ?? dflt`. Trivial, but it pins the
override-wins precedence contract under test (the heart of AC1) and documents it in one
named place, exactly as `resolveLoggedModel` pins the model-id precedence.

## D5 — Live sweep posture (AC3)

AC3 ("a decompose-epic cast on a meaty epic caps turns and lands token spend below the
~85–95k tail") requires a **real metered `claude -p` cast** — `dispense` is the seam's one
deliberately un-unit-tested verb (it spawns). Per the project's established posture (E-014's
measurement sprint; T-014-03 treated the live sweep as a forward-looking human step), this
ticket **wires the bound so the check can be run**, documents the exact command and the
pass criterion, and lands `bun run check` green. The live number is produced by running the
documented sweep command — it is not, and cannot be, an automated unit assertion. Review
states this honestly rather than claiming a live number was captured.

## What is explicitly out of scope

- **A `--max-turns` CLI flag** for the per-cast override. The override already exists at
  `CastOptions.maxTurns`; precedence is what AC1 needs. A CLI knob is the same follow-up
  T-015-01 deferred — not required here, and adding it is scope creep.
- **A new run-log outcome for "hit the turn cap"** (T-015-01 review §Open concern #2). A
  capped run logs whatever its terminal result + gates yield. Distinguishing the stop
  reason needs the seam to surface it — a separate enhancement.
- **Auto-tuning the default from the log** (IA-14 auto-widen/slow-tighten). This ticket
  makes turns *observable*; actuating the number from data is a later rung.
