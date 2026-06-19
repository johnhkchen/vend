# T-017-02 Design — register-survey-and-gesture

Decisions, with rationale, grounded in the Research map. The spine is fixed by the ExpandFragment
trio; the genuine design choices are where Survey *diverges* from expand (no subject, board-scale
effect, hybrid degrade, generous budget).

## D1 — Three files, mirroring the E-016 trio (not two, not one)

**Decision:** `survey-effect.ts` (Inputs + staging effect), `survey.ts` (BAML shell: parse, Play,
register, cast), and `survey-effect.test.ts` (offline AC#3 proof). The pure core + its test already
exist (T-017-01).

**Why:** the three-way split is the house testability contract, not ceremony. `survey.ts`
value-imports `b` (the addon) → no `bun test` may touch it. By keeping the effect addon-free in its
own module, `survey-effect.test.ts` can exercise the staging write + the clear→classify wiring on a
real temp dir without ever loading the addon — exactly the seam `expand-effect.test.ts` proves. A
two-file split (effect folded into the shell) would make the effect untestable in `bun test`.

**Rejected:** folding `Inputs` + effect into `survey.ts` (kills offline testability); a separate
`survey-render.ts` (expand keeps render inline in the shell — no reason to diverge).

## D2 — `gates` closure ignores ctx: `(board) => clear(board)`

**Decision:** `surveyPlay.gates = (board) => clear(board)`.

**Why:** `survey-core.clear` takes no context (Research confirmed — the board gates need no charter;
leverage-rank reads only tier order). This is the one clean divergence from expand, whose
`gates: (signal, ctx) => clear(signal, {charter: ctx.inputs.charter})` threads the charter for
value-link. Survey's `gates` matches the `Play.gates` signature `(out, ctx) => GateVerdict` and simply
drops `ctx`. No adapter, no `SurveyClearContext`.

## D3 — `parseSurvey`: try/catch → empty board (the HYBRID degrade fix)

**Decision:**
```ts
export function parseSurvey(text: string): Board {
  try { return b.parse.Survey(text); } catch { return EMPTY_BOARD; }  // EMPTY_BOARD = { signals: [] }
}
```

**Why:** the T-017-01 finding (obs 21370–21372, pinned in `survey.test.ts`): `b.parse.Survey`
degrades object-shaped garbage to `{signals: []}` but THROWS on a bare unstructured string. The catch
makes parse TOTAL, so BOTH garbage shapes reach the gates as an empty board → honest-empty CLEARS it
(the abstention) and the cast logs a clean success-with-empty-board, never an uncontracted throw
crashing `castPlay`. This is the same shape as `parseExpandFragment`, but the coercion target differs:
expand's `EMPTY_SIGNAL` STOPs (blank what/why), Survey's `EMPTY_BOARD` CLEARS (empty board is honest).
`survey.test.ts` already names this catch as the required T-017-02 fix.

**Rejected:** letting the throw propagate (crashes the cast on an unstructured reply — the exact
failure the test warns against); a pre-parse shape sniff (re-implements BAML's parser — fragile).

## D4 — Board-staging effect: one fixed-name board file, idempotent overwrite

**Decision:** `surveyBoardEffect` writes the whole ranked board to a single
`docs/active/pm/staged/survey-board.md` (a fixed stem under the shared `STAGING_DIR`), overwriting any
prior survey draft. Reuse `expand-effect.ts`'s `STAGING_DIR` constant (the contract is identical —
same machine inbox).

**Why:** a board is ONE artifact, not N per-signal files — staging it as one ranked document is what a
human reviews and pulls from. A Signal has no id and a board has no DAG identity, so re-surveying
should OVERWRITE the prior draft (a draft you iterate on), exactly the idempotent overwrite-by-slug
expand chose for its per-signal drafts (design D3 there). A fixed name is the board analogue of
expand's `slugify(what).md` — there is no per-board `what` to slug, so the stem is the constant
`survey-board`. No clock, no id-mint → PURE renderer + a deterministic path.

**Rejected:** one file per signal (loses the *ranking* — the board's order is the product; scatters
the human's pull surface); a timestamped filename (needs the clock → impure renderer, and accumulates
stale boards — staging is a draft, not a log); writing into `proposed-batch.md` (that is the PM
*agent's* hand-authored file — the README says the machine writer uses `staged/` so the two never
collide).

## D5 — Empty board renders an honest abstention note (still a success)

**Decision:** `renderStagedBoard(board)` branches: a non-empty board → heading + demand table header +
`renderBoard(board)` rows + a `## Pull these` block (one `vend chain "<what> — <why>"` per signal, top
-ranked first, the first marked the recommended next pull) + origin trailer. An EMPTY board → a short
"surveyed; no real demand gradient — abstained honestly (IA-4)" note + origin trailer (no table).

**Why:** an empty board CLEARS the gates (the honest abstention — survey-core's documented polarity),
so the effect DOES run on it. Writing a readable "I looked and there is nothing to stage" artifact is
the honest materialization of that abstention — more useful than an empty file, and it proves the
abstention happened. The non-empty body mirrors `renderStagedSignal` lifted to a set: the demand-row
table is the "Signal[] in the demand.md shape" the AC requires; the per-signal pull block gives the
human the exact gestures to promote each row.

**Rejected:** writing nothing for an empty board (then a success leaves no trace — a human can't tell
"surveyed, found nothing" from "never ran"); a single recommended pull only (the board's value is the
*ranked set* — list them all, mark the top one).

## D6 — `vend survey` parse: a flags-only gesture (no positional subject)

**Decision:** `parseSurveyArgs(argv)` accepts `survey [--budget <ms>,<tokens>]` and returns
`{cmd: "survey", budget?}`. No "missing <subject>" path — unlike `expand`/`chain`, survey has no
positional argument (it reads the whole project). Any unexpected positional token → usage error.

**Why:** the gesture IS "read the rough project" — there is no subject to type. This is the cleanest
divergence from `parseExpandArgs` (which requires ≥1 positional). The `--budget` handling (optional,
malformed → usage, dangling `--budget` → usage) is copied verbatim from `parseExpandArgs` so the
behavior is consistent across gestures.

**Rejected:** an optional `[<scope>]` positional to survey a subdir (out of scope — the ticket says
"reads the rough project"; YAGNI); reusing `parseExpandArgs` (its required-positional path is wrong
for survey).

## D7 — Generous pre-filled budget with a recalibration note

**Decision:**
```ts
// A PROJECT-SCALE read — heavier than expand, which under-shot (100k ceiling, 211k spent: obs 21333).
// Pre-filled generously as a measured FLOOR, not a cold-start guess. recalibrate from the log (E-013).
budget: { timeMs: 1_800_000, tokens: 300_000 },
```

**Why:** the ticket directive is explicit — heed E-016's finding (expand's 100k ceiling was spent 2×
over at 211k) and pre-fill generously from the start. Survey reads the whole project (charter +
snapshot of every story/ticket id + src listing), strictly heavier than one fragment. 300k tokens sits
comfortably above expand's observed 211k actual; 30 min wall-clock gives a project-scale agentic read
room without an unbounded latch. It is a default — the gesture passes an explicit `--budget` to
override, and the `// recalibrate from the log` note flags that the real envelope comes from measured
runs (E-013's ledger), not this floor.

**Rejected:** copying expand's `{1_200_000, 12_000}` (the ticket explicitly warns against this — it is
the cold-start under-shot that the finding indicts); a `maxTurns` cap (expand sets none; the budget +
wall-clock latch bound the run — adding a turn cap is an un-calibrated guess, worse than none).

## D8 — Subject = a synthesized "survey: <project>" label

**Decision:** `castSurvey` passes `subject: \`survey of ${basename(root)}\`` to `castPlay`.

**Why:** `CastOptions.subject` is required non-empty (stamped on the run-log `epic` field). Survey has
no positional subject, so a synthesized, human-legible label is correct — it names what the run was
(a survey of this project). `castPlay` separately stamps the `project` field, so this is purely the
record's human-facing subject. Mirrors how expand stamps the fragment as its subject.

## Card metadata

`{ color: ["blue", "green"], type: "permanent", rarity: "rare" }` — identical to expand
(Blue planning + Green ramp; a reusable articulation permanent). Survey is the same family one scale
up; no reason to diverge the card.
