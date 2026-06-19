# T-020-01 — Design: thin-input negative control

> Options, tradeoffs, the decision and its rationale — grounded in `research.md`. One source edit
> (the harness), two fixtures, the RDSPI artifacts.

## The decision in one line

Add **two thin fixtures** + a **`survey-thin` probe target** (parameterizing the charter/board source
root) and an **`expand-thin` target** (the existing expand seeding with a fixed vacuous fragment).
The two new `SUPPORTED` names give the negative control a **single-word, reproducible command** per
play, symmetric with the grounded sweep.

## D1 — How does survey point at a thin board? (the only real design question)

`surveyTarget` hard-wires charter + board to `process.cwd()`. Options:

- **(A) New target that seeds from a fixed fixtures dir.** Add `survey-thin`; factor the charter/board
  seeding to take a source root (default `process.cwd()`); the thin target passes the fixtures dir.
- **(B) Make `survey` read a fixtures path from the CLI `input`.** Survey today ignores the input
  positional; repurposing it couples the arg parser (survey's first numeric positional is N) to a
  rarely-used path and changes the meaning of an existing target.
- **(C) Seed an empty/contentless board with the real charter.** No new fixture dir. But the real
  charter is demand-rich, so the model finds cold-start demand → a *signal*, not honest-empty. Fails
  the polarity the control needs.

**Chosen: (A).** It mirrors the established pattern exactly (a `ProbeTarget` builder + a `resolveTarget`
case + `SUPPORTED` entry — the T-019-01/02 seam), keeps `survey` unchanged, and isolates the variable:
the *only* difference between `survey` and `survey-thin` is the **input root**. (B) overloads the arg
parser; (C) can't produce the abstention. The factoring is a one-line default param on `seedCharter`
/ `seedBoardSnapshot` (`srcRoot = process.cwd()`), the same shape `collectOutput` already took when it
was generalized from a constant.

## D2 — Does expand need a new target, or just a new fixture?

The existing `expand` target works with *any* fragment file, so `… expand <thin-fragment> N` already
exercises the thin case (research: the asymmetry). Options:

- **(A) Fixture only.** Reproduce with `expand docs/active/work/T-020-01/fixtures/thin-fragment.txt N`.
- **(B) Fixture + a named `expand-thin` target** that hard-wires the fixed thin-fragment path.

**Chosen: (B).** Reasons: (1) **symmetry** — survey *must* be a named target (D1), so `expand-thin`
makes the negative control "two named controls," not "one named, one path-you-must-remember"; (2)
**discoverability** — the negative control is a *permanent instrument* (it re-runs after every E-020
recalibration), so pinning the canonical thin fragment in the harness beats a path passed by hand;
(3) **near-zero cost** — `expand-thin` is `expandTarget(<thin fragment read from the fixed path>)`,
reusing the existing builder verbatim. The grounded `expand <path>` form stays available unchanged.

## D3 — What is the thin **expand** fragment?

A fragment that **grounds no demand** — the model should return a blank signal (honest-empty STOP).
Candidates: a vacuous imperative (`"make the project better somehow"`), pure noise (`"asdf"`), or a
contentless TODO. **Chosen:** a vacuous-but-grammatical imperative in the spirit of
`T-002-04/fixtures/underspecified.md` ("make the project better"). Rationale: noise (`asdf`) tests
the *parser*, not the *gate*; a grammatical-but-empty fragment is the realistic over-eagerness trap —
it reads like a real ask but cites nothing and closes no vision-distance, so the honest move is to
abstain. It is the crispest negative control for "the fragment grounds no demand (IA-4)."

## D4 — What is the thin **survey** board?

The reliable abstention input (research): a **complete / saturated tiny project**, not a blank one.
Components of the fixture dir:

- `docs/knowledge/charter.md` — a **thin charter** for a trivially small, **frozen, finished** tool:
  one stated purpose, scope explicitly **complete and frozen**, no open problems, no ambition beyond
  what is done. Thin enough to ground no demand gradient; valid enough that `assembleSurveyInputs`
  reads a real charter file.
- `docs/active/stories/` + `docs/active/tickets/` — a board that already **fully captures** that tiny
  product: a `done` story + `done` tickets. The honest read is "everything is captured and done —
  nothing new to stage" ⇒ empty board ⇒ the survey marker.

**Rejected:** an *empty* board + real charter (C above — produces a signal). **Rejected:** a board of
open work (that is demand → a signal). The negative control needs the input where staging nothing is
*correct*, and "frozen, finished, fully-captured" is the unambiguous such input.

## D5 — Classification: how the run records "honest-empty" per play

Unchanged from T-019-02 (the polarity is intrinsic to each play):

| Play | Abstains by | Probe records it as | Read from |
|---|---|---|---|
| **survey-thin** | empty board ⇒ marker note (`success`) | **`honest-empty`** (headline mix) | `isAbstention` matches `"no demand staged"` |
| **expand-thin** | blank signal ⇒ STOP (`gate-failed`) | `budget-exhausted` bucket *(folded)* | **raw tally** `gate-failed` + the per-cast andon line |

This is the **same D4 instrument blind spot** T-019-02 documented: expand's honest-empty arrives as a
`gate-failed` non-`success`, so `classifyRun` folds it into `budget-exhausted` and the **true**
honest-empty is read off the raw `RunOutcome` tally + the printed andon (`gate 'honest-empty'`), not
the headline mix. The negative control's expand arm is therefore verified the same way the grounded
sweep verified expand's over-eagerness — symmetry that makes the before/after comparison apples-to-
apples. (The instrument-level fix — threading the structured stop reason onto the run record — is the
separately-staged kaizen signal from T-019-02; **out of scope here**.)

## D6 — "Distinct from the grounded fixtures' outcome" (AC#1)

The AC wants the thin run's outcome to be **distinct** from the grounded fixture's outcome per play:

- **expand**: grounded fragment → `signal` (it grounds real demand); thin fragment → `honest-empty`
  (raw `gate-failed`). Distinct.
- **survey**: grounded board → stages a real demand board (`signal`); thin board → `honest-empty`
  (marker). Distinct.

Distinctness is the **whole proof**: the gate discriminates grounded from thin. A gate that abstained
on *both* would be over-eager (the T-019-02 finding); a gate that abstained on *neither* would be
disabled (the E-020 over-correction risk). The negative control makes "abstains on thin, not on
grounded" a measurable, re-runnable assertion.

## D7 — N and budget for the verifying run

Small N (directional, not proof — E-014 discipline), as T-019-02. Per-cast budget defaults to each
play's recalibrated envelope (survey 300k, expand 250k) — budgets were **vindicated** in T-019-02 (0/9
exhausted), so no override needed. The run is evidence the fixtures *work*; the artifact deliverable is
the **fixtures + targets**, which `bun run check` proves type-correct and regression-free regardless of
live-cast availability. If live casts are unavailable in the run environment, the exact reproduction
commands are recorded (the T-019-02 "how to produce the numbers" pattern) and `bun run check` is the
hard gate.

## What is explicitly NOT changed

- `src/probe/consistency.ts` (pure core) — same three buckets, no new logic.
- `src/probe/run-probe.ts` — byte-for-byte unchanged (inherited AC).
- The `survey` / `expand` / `steer` / `decompose-epic` targets — additive only.
- No new unit tests for the harness (house rule: the instrument is proven live; its judgment is the
  already-tested pure core).
