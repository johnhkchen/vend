# T-018-01 — Design: steer-pure-core

Decisions, grounded in research, for the `Fork` type, the `Steer` output, the `SteerProject`
BAML function, the `steer-bridge`, and the three pure gates. The north star: **mirror
survey-core exactly, add the forks** — minimum new surface, maximum reuse of proven contracts.

## D1 — Where the new code lives (file boundaries)

Mirror the survey split one-for-one:

| Concern | survey (E-017) | steer (E-018, this ticket) |
|---|---|---|
| BAML types + function | `baml_src/survey.baml` | **`baml_src/steer.baml`** |
| Pure gates + renderer | `src/play/survey-core.ts` | **`src/play/steer-core.ts`** |
| Pure unit test | `src/play/survey-core.test.ts` | **`src/play/steer-core.test.ts`** |
| Offline BAML bridge | `src/baml/survey-bridge.ts` | **`src/baml/steer-bridge.ts`** |
| Offline BAML test | `src/baml/survey.test.ts` | **`src/baml/steer.test.ts`** |

**Rejected:** adding `Fork`/`Steer` to `survey.baml`. They are a distinct play's output;
co-locating would couple two plays' SAP behavior and break the one-file-per-play convention.

## D2 — The `Fork` BAML type

```baml
class Fork {
  question        string   // the genuine decision the human must make — one line
  options         string[] // 2–4 mutually-exclusive paths; each distinct and real
  whyItMatters    string   // the stakes — why this fork is load-bearing
  recommendation  string   // Vend's recommended option + one-line rationale
}
```

Grounded in the ticket's "question · 2–4 options · why-it-matters · recommendation" and
project-steering move 3 ("recommendation first"). `options` is a `string[]` (the count rule —
2–4 — is SEMANTIC, enforced by the gate, not the shape; BAML cannot bound array length). All
scalars are required strings; like `Signal`, an abstaining model surfaces NO fork (empty
`Fork[]`), it does not emit a blank fork.

**Rejected:** an `options` enum or a richer per-option object (`{label, consequence}`). The
first slice wants the smallest fork that is a real decision; per-option consequences are a
refinement (and `whyItMatters` already carries the stakes). YAGNI per the resist-over-build move.

## D3 — The `Steer` BAML type (board + forks)

```baml
class Steer {
  signals  Signal[]   // the ranked demand board — REUSES E-016's Signal
  forks    Fork[]      // the real forks — EMPTY when the path is clear
}
```

An **all-array class with TWO array fields**, deliberately mirroring `WorkPlan` (not `Board`).
Research §3 predicts this DEGRADES a garbage reply to `{signals:[], forks:[]}` rather than
throwing on a bare string (Board's single field throws; WorkPlan's two degrade). **This is the
honest-empty handle for free:** a garbage reply lands an empty steer, which every gate clears
as a clean abstention — so (unlike survey) T-018-02's parse closure may not even need a catch.
**To be VERIFIED** by the bridge test (D8); whatever the real behavior, the test pins it and
the design note records it (read-never-invent: probe, never assume).

`Signal`/`SignalTier` are referenced from `expand.baml`, never redefined (BAML shares types).

**Rejected:** wrapping survey's `Board` (`steer.board.signals`). A nested class adds a degrade
layer and a render indirection for no gain; a flat two-array class is the proven WorkPlan shape.

## D4 — The `SteerProject` BAML function

`function SteerProject(project: string, charter: string) -> Steer`, `client ClaudeStub`
(render-only). Same two inputs as `Survey` (a steer reads the whole project against the
charter). The prompt productizes `project-steering.md`'s move set, but the headline addition
over Survey's prompt is the **fork instruction**: after proposing the ranked board, surface
ONLY the genuine forks — each with 2–4 real options, why it matters, and a recommendation —
and **abstain (empty forks) when the path is clear; never manufacture a decision**. The board
half reuses Survey's read-never-invent + leverage-ordering language verbatim in spirit.

## D5 — The gate set, names, and order

`STEER_GATE_NAMES = ["read-never-invent", "fork-genuineness", "leverage-rank"]` — the single
source of ordering, fixed by the ticket AC. Value priority: **is the board real? → are the
forks real? → is the board ordered?**

Note the deliberate divergence from survey's `["honest-empty", "read-never-invent",
"leverage-rank"]`: steer has **no separate board honest-empty gate**. The ticket enumerates
exactly three gates and `fork-genuineness` is named "the fork-side sibling of honest-empty," so
the honest-empty role moves to the FORKS. The board's emptiness is still honest by
construction — an empty `signals[]` passes all three gates (read-never-invent finds nothing
ungrounded, leverage-rank trivially ordered), exactly the survey abstention.

### Gate 1 — read-never-invent (board signals)
Reuse survey-core's pattern verbatim: the first `signal` whose `grounding` is blank → STOP
(speculation, PE-1). Empty board passes (no candidates).

### Gate 2 — fork-genuineness (the signature gate)
For each `fork`, refuse the FIRST that fails any genuineness check; an empty `forks[]` PASSES
(the honest clear-path abstention). A fork is refused when:
- **No real choice:** fewer than 2 *distinct, non-blank* options → not a trade-off (a
  one-option or duplicate-option "fork" is a fake decision). This is the core inconsequential
  case the AC names.
- **Over-framed:** more than 4 options → the spec's 2–4 bound; an un-narrowed menu is not a
  decision the human can assent to.
- **No stakes:** blank `question` or blank `whyItMatters` → an inconsequential fork (nothing
  named to decide / no reason it is load-bearing).
- **No recommendation:** blank `recommendation` → Vend must frame the call (move 3,
  "recommendation first"); surfacing a naked choice pushes the articulation back on the human.

The decidable proxy for "genuine" is structural (≥2 distinct options + named stakes +
recommendation) — a pure gate cannot judge semantic consequence, but it CAN refuse the shapes
that are provably not a real, framed decision. This is the fork analogue of read-never-invent's
"cite or be refused": a poka-yoke, not a semantic oracle.

### Gate 3 — leverage-rank (board order)
Identical to survey: first adjacent inversion `tierRank(hi) > tierRank(lo)` → STOP; empty /
single / ties pass. Reuse `TIER_RANK` (exported by survey-core, the single source of the
ordinal); copy the tiny `tierRank` wrapper (throws `RangeError` on drift).

**Rejected:** sorting the board instead of refusing. Mutation hides the model's mis-rank — the
no-mutation gate discipline; the visible andon is the value.

## D6 — Reuse vs copy (the no-shared-util idiom)

- **Reuse (genuine shared CONTRACT):** `renderSignalRow` from `expand-core.ts` (identical
  demand.md row — both plays write it) and `TIER_RANK` from `survey-core.ts` (the single
  leverage ordering). Both sources are pure (type-only BAML), so steer-core stays addon-free.
- **Copy (incidental helper):** `nonEmpty` (the per-module predicate idiom) and the `tierRank`
  wrapper (3 lines around the shared map).

This matches survey-core's own choices (it reused `renderSignalRow`, copied `nonEmpty`).

## D7 — The fork renderer (pure, in the core)

`renderFork(fork): string` + `renderForks(forks): string` — the new pure presentation piece
(forks have no existing renderer; the board half already has `renderSignalRow`/`renderBoard`).
A fork renders a small markdown block: the question as a heading, why-it-matters, an ordered
options list, and the Vend recommendation. T-018-02's staging effect composes these under a
`## Forks` section, exactly as survey-effect composed `renderBoard`. Pure, deterministic, no fs.

Placing it in the core (not the effect) mirrors survey: `renderBoard` lived in survey-CORE,
the staged-artifact composition (`renderStagedBoard`) lived in survey-EFFECT.

## D8 — Testing strategy

- **`steer-core.test.ts`** (pure, offline, type-only BAML): the three gates (clear case +
  each stop), the fork-genuineness arms (no-options / one-option / duplicate / over-4 /
  blank-stakes / no-recommendation all refused; empty forks pass), leverage-rank stop + drift
  `RangeError`, and the fork renderer. Mirrors survey-core.test.ts's structure.
- **`steer.test.ts`** (offline via `steer-bridge` child process): a canned reply parses into a
  typed `Steer` (board + forks round-trip); the SAP-degrade probes (object-shaped & bare
  string) pin the REAL degrade behavior (D3); the render pin asserts project/charter render
  into the prompt. One spawn covers all ops (the native-addon-per-process limit).

## D9 — `clear` signature

`clear(steer: Steer): GateVerdict` — takes no ctx (all three gates read only the steer; no
charter needed, the clean survey divergence). Composes as `(steer) => clear(steer)` into
`Play.gates` (AC#3). A STOP is returned data; only enum/map drift throws (`RangeError`).
