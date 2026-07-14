# T-013-02 — Research

*Descriptive map of the codebase the recalibrate core plugs into. What exists, where,
how it connects. No solutions proposed here.*

## The ticket in one line

A **pure** `recalibrate(play, records, tier)` proposes a play's envelope (tokens +
wall-clock) at the **value-tier percentile** over its **successful** runs, returns the
envelope **plus confidence** (N successes, censored count), and falls back to a hand
prior on cold start. Then a surface displays it, honestly labelled.

---

## What T-013-01 already landed (the foundation we read from)

`src/log/run-log.ts` is now a two-faced module — a write face and a **read face** (the
mirror added by T-013-01, committed `d7593d3`). Everything this ticket needs to *read*
the ledger already exists and is tested:

- **`RunRecord`** (lines 113–129): the frozen record. Carries `play`, `outcome`,
  `usage: NormalizedUsage`, `costUsd`, `gateResults`, `startedAt`/`endedAt`, and — new
  in T-013-01 — an optional **`envelope?: Envelope`** (`{ timeMs, tokens }`), the
  *allocated* ceiling the cast ran under. Absence is meaningful (pre-T-013-01 records
  and envelope-less casts omit it), never zeroed.
- **`readRuns(jsonl): { records, skipped }`** (line 317): PURE parse of the JSONL text
  into records; malformed/torn lines are skipped + counted, never thrown.
- **`forPlay(records, play, { outcome? })`** (line 346): PURE filter to one play,
  optionally one outcome. The comment at 339–345 *names this ticket*: `forPlay(recs, p,
  { outcome: "success" })` is "the uncensored sample to bound the tail from"; the
  censored set is the same call with a `budget-exhausted` / `timed-out` outcome. **The
  percentile math is explicitly deferred to T-013-02** (this ticket).
- **`wallClockMs(r): number | null`** (line 359): PURE derived `endedAt − startedAt`;
  `null` when either ISO stamp is unparseable.
- **`totalTokens(r): number`** (line 371): PURE sum of the four usage sub-counts — the
  same definition as budget's `countTokens` (the single notion of "spent").
- **`loadRunLog(opts): Promise<ReadResult>`** (line 399): the one IMPURE fs verb; a
  missing ledger is `{ records: [], skipped: 0 }` (cold project), other fs errors throw.

**`RUN_OUTCOMES`** (line 41): `success | gate-failed | timed-out | budget-exhausted |
id-collision`. For censoring (IA-13) the **andon'd-at-envelope** outcomes are
`budget-exhausted` (token wall) and `timed-out` (wall-clock wall). `gate-failed` /
`id-collision` are neither a finishing-cost observation nor an envelope censoring.

The write side already records the envelope on every live cast: `src/engine/cast.ts`
line 163 passes `envelope: budget` into `appendRunLog`. So real `.vend/runs.jsonl`
records produced from now on carry the allocation — the cost-vs-budget signal exists.

---

## The `Budget` this returns

`src/budget/budget.ts`:

- **`Budget`** (line 17): `{ readonly timeMs: number; readonly tokens: number }` — the
  exact shape `recalibrate` must emit as its `envelope`.
- **`assertPositiveInt`** (line 66): every budget dimension must be a **positive,
  finite integer** when the run starts (`timeoutMsFor` / `check` enforce it). A measured
  envelope this core emits will eventually be handed to a real run, so it must satisfy
  that contract: positive integers, never `0`/`NaN`.
- `budget.ts` is PURE and imports **nothing** — the house "pure core" archetype the new
  module should mirror.

`Budget` and run-log's local `Envelope` are structurally identical but **declared
separately** (the zero-coupling invariant: `src/log/` imports nothing from
`src/budget/`, and vice versa). A new consumer that needs *both* is the natural place
they meet.

---

## The value tier → percentile mapping

`src/shelf/menu.ts` line 23: **`ValueTier = "keystone" | "high" | "standard" |
"leaf"`** — four tiers (the ticket's prose names three: Keystone→~p95, Standard→~p90,
Leaf→~p75; `high` sits between keystone and standard).

`src/shelf/gather.ts`:

- **`TIER_BUDGET`** (line 49): the *hand prior* per tier — `keystone 2h/80k`, `high
  2h/50k`, `standard 1h/25k`, `leaf 15m/8k`. The comment (45–47) literally says
  "Calibration-pending — set from the run log's measured fat tails once enough runs
  exist." **That is this epic.** This is the cold-start fallback prior.
- **`budgetForTier(tier): Budget`** (line 135): PURE/TOTAL accessor for the prior.

The tier sets the **andon budget** (IA-12): Keystone tolerates ~5% stops → p95; Leaf
~25% → p75. Value picks the percentile; data provides the value at it.

---

## The surface (where the default is shown)

- `src/cli.ts`: the v1 surface. `parseArgs` (line 66) is a PURE arg parser returning a
  discriminated `ParsedCommand`; the `import.meta.main` block (line 187) is the thin
  impure dispatch (lazy-imports the heavy deps, maps outcome→exit code). Adding a new
  read-only command means: a new `ParsedCommand` arm + a pure parse helper + a thin
  dispatch arm. Precedent everywhere (`run`, `chain`, `browse`, `select`).
- `src/shelf/press.ts` + `press-core.ts`: the press resolves a selection and dispatches
  each pick under `override ?? action.budget` (press-core line 93). The `action.budget`
  is today the **tier prior** (TIER_BUDGET), *not* measured. `press-core.ts` is PURE and
  does **not** read the run log; `press.ts` is the impure shell that could.
- **Confirm screen does not exist yet** — it is a later TUI epic (IA-6). So "the Confirm
  default" is, today, a CLI readout, not a screen.

---

## Constraints & assumptions surfaced (not yet decided)

1. **Purity / house pattern.** The math must be a PURE, fixtured core (mirrors
   `budget.ts`, `cast-core.ts`, `press-core.ts`). Only types may be imported (erased).
   The one fs touch (load the ledger) is a thin untested shell.
2. **Zero-coupling tension.** `run-log.ts` ⊥ `budget.ts`. A module that imports
   `RunRecord` *and* `Budget` is a new node that depends *up* onto both leaf modules —
   it must not create a cycle (neither leaf imports it). A new directory (`src/ledger/`)
   keeps that edge clean and matches the IA's "Ledger" vocabulary.
3. **Informative censoring (IA-13).** Andon'd runs are right-censored at the envelope —
   excluded from the percentile sample but **counted** (they are `≥ envelope` lower
   bounds, and the count is the andon-rate signal). This slice *reads* the rate into
   confidence; it does **not** actuate on it (IA-14 — auto-widen/slow-tighten — is a
   later rung).
4. **Independent dimensions.** Tokens and wall-clock are bounded **separately** (AC):
   each gets its own sorted sample and its own percentile. `wallClockMs` can be `null`
   (unparseable stamps) → that record drops from the *time* sample only.
5. **Cold start (IA-13 / IA-16).** Below "a handful" of successes, the percentile is
   noise — fall back to the hand prior, labelled honestly ("estimate (no data)").
6. **Valid-budget output.** The emitted envelope must satisfy `assertPositiveInt`
   (positive integer dimensions) so it can be handed to a real run downstream.
7. **Estimator = exact percentile, NOT t-digest** (ticket). The log is small; ship the
   smaller real thing. "Exact" = computed precisely from the actual sample, not a
   streaming sketch. The method (nearest-rank vs interpolation) is a Design choice.
8. **Windowing.** IA-13 says weight recent runs more. The minimal honest form is a
   *recency window* (last W records) — exponential weighting is later (IA-14).

---

## Test-style precedent

`src/log/run-log.test.ts`: a `baseInput(over)` fixture factory + per-branch `test()`s,
all on fabricated values, no fs/clock/spawn. `budget.test.ts` / `press-core.test.ts`
follow the same shape. The new test file mirrors this: a `recordOf(...)` fixture helper
producing `RunRecord[]` with known tokens/wall-clock, asserting percentile-per-tier,
censored-excluded-but-counted, cold-start fallback, independent dimensions.
