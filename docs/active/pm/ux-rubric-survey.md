# UX rubric + survey — 2026-07-12

A hands-on grade of vend's operator experience at HEAD (post E-071, v0.4.0-rc.2 era).
Method: every free gesture exercised live (`bare vend`, `--help`, unknown command, missing
arg, `doctor`, `user-guide`, `audit`, `envelope`, `svg`), live-cast output read from the
E-069/070/071 chain transcripts, plus source reads where a surface looked off. Metered
gestures were NOT re-cast for this; their UX is graded from this week's real runs.

## The rubric

Nine dimensions, each graded 1–5. Grounded in the charter (P2 two-gesture transaction,
P4 autonomy, P7 budget contract, honest-on-outcome) and the house brand voice (parlor not
portfolio; kitchen-table English; names as wayfinding; labels orient by what you'd do).

| # | Dimension | What 5/5 looks like |
|---|---|---|
| 1 | **First-contact orientation** | A newcomer lands, runs one obvious thing, and knows where they are within a minute. |
| 2 | **Discoverability & self-teaching** | The tool teaches its own surface: `--help` works, usage is complete, each output points to the natural next gesture. |
| 3 | **Gesture economy** | Two gestures: pick + budget. Defaults carry the common case; flags are rare and memorable. |
| 4 | **Live feedback & walk-away legibility** | During a cast you can tell it's alive and how far along; after, one line tells you what happened and what it cost. Walking away is safe and *feels* safe. |
| 5 | **Error quality & recovery** | Errors are targeted (name the one wrong thing), plain, and say what to do next — not a usage wall. Refusals are honest and cheap. |
| 6 | **Honesty of surfaces** | No label overstates or understates reality — the anti-laundering rule applied to copy. |
| 7 | **Kitchen-table language** | Every string a visitor reads passes the brand test; jargon quarantined to source code. |
| 8 | **Humane units & formats** | Inputs and outputs use units a person can say aloud (`40m`, `350k`), not machine units (`2400000` ms). |
| 9 | **Visual surface (SVG)** | The board picture orients a non-dev in seconds: grab-able names, non-color status signals, stable layout. |

## The grades

### 1. First-contact orientation — **4/5**
Bare `vend` renders the shelf — the right first screen, on-metaphor, with worth + priced
envelope per playbook. `vend doctor` is exemplary (5 green ticks, plain words). `user-guide`
is genuinely good plain writing. Held back by: the cryptic `(no actions)` header line on the
shelf (menu internals leaking), and nothing on the shelf pointing a newcomer at
`vend user-guide` as the next step.

### 2. Discoverability & self-teaching — **2/5** ⚠ weakest dimension
- **`vend --help` and `vend help` fail** with `unknown command` — the single most-typed
  gesture in any CLI is a dead end.
- The usage block omits **five real commands**: `doctor`, `user-guide`, `envelope`, `audit`,
  `--version`. An operator can't discover the trust/audit surface exists.
- No output cross-links: `steer` doesn't mention `chain` pulls a row; `audit` doesn't say
  where the intervention bit would come from.

### 3. Gesture economy — **4/5**
Post-E-068 the promise is real: `vend chain "<signal>"` with zero flags cleared three
keystone epics this week. `--after` and `--agent` are memorable and orthogonal. Held back
by: `vend run` still requiring a mandatory `--budget` while `chain` doesn't (inconsistent),
and the envelope gesture being invisible (see #2).

### 4. Live feedback & walk-away legibility — **2/5** ⚠
The closing lines are excellent (`effect ✓ staged …` · `turns: 13 / 15 cap` ·
`run …: success (materialized: true)`). But **the minutes before them are noise**: a live
cast streams dozens of bare event names (`· system (thinking_tokens)` ×90, `· assistant`,
`· user`) — no elapsed time, no spend-against-budget, no turn counter until the end. For a
product whose promise is *fund it and walk away*, the live surface gives no reason to trust
walking away; this is the UX face of the dogfood's "not hands-off" verdict. A long
foreground `chain` also dies silently under shell timeouts (we background as a workaround —
an operator won't know to).

### 5. Error quality & recovery — **3/5**
Structured refusals are the good half: gates fail with named outcomes (`graph-invalid`,
`gate-failed`), degradations carry markers (`seat-defaulted`, `seat-inferred`), N-codes
auto-strip. The bad half: **every CLI arg error prints the same 9-line usage wall** whether
you typo'd a command, forgot `<signal>`, or malformed `--budget` — the one wrong thing is
never named with a targeted fix (`did you mean steer?`).

### 6. Honesty of surfaces — **3/5**
The culture is right (audit says `intervention bit unrecorded` rather than inventing a rate;
shelf distinguishes measured vs default envelopes). But two live falsehoods:
- **Shelf says `(default — no runs yet)` for steer, which has 2 successful runs on the
  ledger** — `COLD_START_MIN_SUCCESSES = 3` collapses "not enough runs yet" into "none",
  on the flagship first screen (`src/shelf/shelf-row.ts` label; `src/ledger/recalibrate.ts:48`).
- `svg` reports `1 groups, 198 cards` — grammar aside, one group for 198 cards suggests
  grouping degenerates on a mostly-done board (worth a look before more SVG polish).

### 7. Kitchen-table language — **3/5**
The nouns are the brand at its best: shelf, playbook, pull, chain, sweep, doctor. The
operator/trust surfaces break it: `E1 walk-away — no self-reports yet`, `censored`,
`andon rate`, `intervention bit` (audit/ledger lines), and the SVG card faces still carry
`Baml…`/`Ci module`/`Claude p…` tokens (confirmed at HEAD — the staged jargon-strip signal
is real).

### 8. Humane units & formats — **2/5** ⚠
`--budget <ms>,<tokens>` means a 40-minute budget is typed `2400000,350000`. Milliseconds
are a machine unit; nobody says them aloud. Outputs are better (shelf shows `356s/345k`,
`~40m/400k`) — proof the tool already knows how to speak humanely; it just doesn't listen
that way. Accept `40m,350k` / `2h,1.5m` and echo the parse back.

### 9. Visual surface — **2/5**
Known and staged: card-face jargon (#7), color-only status, no layout stability check. Plus
the possible one-group degeneracy (#6). The render-and-watch probe (fork B) should follow
the jargon strip, per the steer board's own recommendation.

## Ranked: what would make it stronger

1. **Make the CLI teach itself** (dims 2+5, ~1 block): `--help`/`help` work; usage lists all
   commands grouped free-vs-metered; arg errors name the one wrong thing + suggest.
   Cheapest, broadest win — every operator, every session, first minute.
2. **Live cast progress line** (dim 4, ~1–2 blocks): replace event-name noise with one
   updating line — `elapsed 4m12s · spent 210k/500k weighted · turn 7/15` — the walk-away
   trust promise made visible while it runs. Pairs with the detached/notify staged signal.
3. **Humane budget units** (dim 8, small): parse `40m,350k`; keep raw forms working.
4. **Shelf honesty fix** (dim 6, tiny): `(default — 2 runs, measured at 3)` instead of
   `no runs yet`; fix `1 groups` grammar and check the grouping degeneracy while there.
5. **Jargon pass on audit/ledger/SVG faces** (dims 7+9, ~1 block): one vocabulary sweep,
   already half-staged as the SVG signal; extend it to `audit` and the ledger foot line.
6. **Point the shelf at the guide** (dim 1, tiny): one foot line — `new here? vend user-guide`.

Items 1–3 are a coherent epic-sized pull ("the CLI meets you where you are"); 4–6 ride along
with the already-staged SVG/vocabulary work.

## What's already strong (don't touch)

`doctor`'s five green ticks; the shelf metaphor and its priced rows; the honest named
degradation markers; `chain`'s zero-flag default path; `user-guide`'s prose; the closing
run-summary lines. The bones are right — the gaps are almost all in the connective copy
and the live middle of a cast.

---

## Disposition (2026-07-13, one day later — post-v0.4.0)

The ranked list was pulled nearly whole: **#1** self-teaching CLI → E-072+E-078 (help, grouped
usage, did-you-mean, always-free). **#2** live progress line → E-072 (+E-077 detect-after label,
E-081 true-spend units). **#3** humane budget units → E-072. **#4** shelf honesty → E-075.
**#5** jargon pass → E-075. **#6** shelf→guide pointer → E-072 (help foot). Dimensions 2/4/8
(the three 2-of-5 grades) would all re-grade at 4+ today. Still open from this survey: the SVG
accessibility items (dimension 9, staged) and the render-and-watch designer probe.
