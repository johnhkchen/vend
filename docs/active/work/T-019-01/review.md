# T-019-01 — Review: generalize the consistency probe

Handoff document. What changed, test coverage, open concerns. The thing a human reviews instead
of reading every diff.

## What changed

All changes are **additive, under `src/probe/`** — zero edits outside it, and `run-probe.ts` is
byte-for-byte unchanged (AC#3).

| File | Action | Lines | Purity | Tested |
|---|---|---|---|---|
| `src/probe/consistency.ts` | created | ~135 | PURE | yes |
| `src/probe/consistency.test.ts` | created | ~110 | test | — |
| `src/probe/run-consistency-probe.ts` | created | ~260 | IMPURE | no (house rule) |

Plus the six RDSPI artifacts under `docs/active/work/T-019-01/`.

### The pure core (`consistency.ts`)
Generalizes the decompose-only, **paired gated-vs-ungated** variance read into a **single-arm,
any-play** consistency read: one play cast N× on a fixed input → (a) the run-to-run dispersion of
the produced (signal) outputs (reusing `variance.ts`'s `dispersion` primitive verbatim) and (b)
the outcome mix (signal / honest-empty / budget-exhausted counts + rates). Classification is
deliberately **not** here — it is play-specific (see "design crux"), so the impure harness assigns
a `ProbeOutcome` per cast and this core only tallies + disperses. No fs/clock/addon.

### The impure harness (`run-consistency-probe.ts`)
`bun run src/probe/run-consistency-probe.ts <play-name> [input.md] [N] [tokenBudget]`. Resolves a
named play to a `ProbeTarget`, seeds a disposable temp project (`mkdtemp` → `lisa init` → per-play
fixed-input seed), casts N× into a **temp ledger** (`runLogPath` under the temp root — the real
`.vend/runs.jsonl` is never touched), classifies each cast, and prints the pure report plus a raw
`RunOutcome` tally. First-cut targets: **decompose-epic** and **survey** — the two ends of the
honest-empty polarity. Temp-ledger helpers are **copied** from run-probe (no import) so run-probe
stays untouched (AC#3) and the no-shared-util idiom holds.

## Acceptance criteria

- **AC#1 (pure core: variance + outcome mix, unit-tested):** ✅ `consistency.ts` +
  `consistency.test.ts`. The three named fixtures are explicit tests: all-same signals → 0
  variance; mixed outcomes counted; honest-empty rate computed. 10/10 pass.
- **AC#2 (any-play N-cast harness into a disposable ledger):** ✅ `run-consistency-probe.ts`
  resolves a named play, seeds a temp project, casts N× with the run log redirected into the temp
  root, collecting results. (Live N×sweep itself is T-019-02 — see open concerns.)
- **AC#3 (`check:*` green; decompose `run-probe.ts` unaffected):** ✅ `bun run check` → 586 pass,
  0 fail, typecheck clean; `git diff --stat -- src/probe/run-probe.ts` empty.

## Test coverage

- **Pure core: covered to the branch** (the AC's unit-test surface). `outcomeMix` (zeroing,
  counting, rates, divide-by-zero), `consistencyReport` (signal-only dispersion, noise-invariance,
  null-output-signal drop, all-censored ⇒ no NaN), `formatConsistencyReport` (headline + mix +
  rate + the `n < 2` caveat).
- **Impure harness: not unit-tested, by house rule** (the run-probe precedent — impure verbs are
  proven live, not in `bun test`). Verified instead by: `tsc --noEmit` clean; CLI guards
  (no-args / unsupported play / decompose-without-epic → usage + exit 2); a `lisa init` temp-root
  smoke proving the seeding half; and structural mirroring of the proven run-probe loop.

## Open concerns / known limitations

1. **Live N×sweep deferred to T-019-02.** The harness has not been run end-to-end against the real
   model in this pass (each cast spawns `claude` — tokens + minutes × N). This matches how
   `run-probe.ts` was proven (live at sweep). `lisa` and `claude` are both on PATH, so T-019-02 is
   unblocked. **Reviewer note:** the first real sweep is where seeding-bugs surface (run-probe's
   first sweep was confounded by a `lisa init` seeding gap and an under-set budget) — watch the raw
   `RunOutcome` tally for an all-`budget-exhausted` arm (raise `tokenBudget`) or all-`gate-failed`
   (a seeding/structure gap), exactly the run-probe failure modes.
2. **The honest-empty discriminator is per-play and prose-coupled for survey.** Survey's
   `isAbstention` keys on the substring `"no demand staged"` emitted by `surveyBoardEffect`'s empty
   branch. If that prose changes, survey's honest-empty would be misclassified as `signal`. The
   default predicate (null/blank output) is the safety net for the other plays. A sturdier
   long-term fix would surface the parsed output's emptiness from `castPlay` — deliberately **not**
   done here (would change the engine surface; classification stays harness-side per design D2).
3. **First cut covers 2 of 5 plays.** expand-fragment / propose-epic / steer are a **documented
   extension seam**: add one `ProbeTarget` entry (seed + assemble + outputDirs + isAbstention), no
   core change. The generalization is real — the pure core and harness loop are play-agnostic; only
   the target table enumerates.
4. **`budget-exhausted` bucket folds other andons.** `timed-out` / `gate-failed` / `id-collision`
   are mapped into `budget-exhausted` (the dominant fat-tail mode). This is surfaced honestly: the
   raw `RunOutcome` tally is printed beside the probe outcomes, so the fold is never silent (IA-8).

## Suggested follow-ups (not this ticket)

- **T-019-02**: run the sweep (decompose + survey), produce the findings note.
- Add expand/propose/steer `ProbeTarget` entries when their consistency is in question.
- If survey's abstention prose proves brittle, consider an effect-level honest-empty marker the
  probe can read structurally.
