# Research — T-077-02-03 advances-cite-degrades

## Assignment and contract

- Ticket: `T-077-02-03`, `advances-cite-degrades`.
- Parent story: `S-077-02`, `degrade-not-discard-charter-cites`.
- Current ticket phase is `research`; Lisa owns phase/status transitions.
- Attempt artifacts belong only under `.lisa/attempts/T-077-02-03/1/work/`.
- Ticket-owned source commits must use `lisa commit-ticket` with exact include paths.
- The ticket advances P3 (gates remain the contract), P5 (the decision is local), and E-077.
- Acceptance names one editorial case and one structural backstop:
  - a well-shaped `advances` code absent from the charter must be removed or annotated during
    normalization so the board can materialize;
  - if removal leaves a ticket with no `advances`, the value gate must still refuse it.
- Verification is explicitly over the pure decompose core and gates.

## Story boundary

- Story `S-077-02` owns two charter-cite refusal surfaces.
- The inline-prose surface belongs to sibling `T-077-02-02`.
- The `advances`/bounds surface belongs to this ticket.
- The durable run-log and cast-summary marker belongs to successor `T-077-02-04`.
- The story requires editorial cite failures to degrade without weakening structural invalidity.
- Structural examples retained by the story include bad graphs, duplicate/missing ids, required
  field absence, and absent story contracts.
- The story explicitly excludes repair/regeneration loops and all structural-gate changes.
- The DAG puts `T-077-02-02` and this ticket in parallel after shared shape ticket
  `T-077-02-01`; their declared implementation files are disjoint.

## Existing shared classification contract

- `src/play/degrade-disposition.ts` landed in predecessor `T-077-02-01`.
- It is pure and addon-free.
- `CharterCite` carries `code`, `location`, and requested `action`.
- `DegradeDisposition` carries exactly `{code, location, action}`.
- Supported actions are `strip` and `annotate`.
- `classifyCharterCite` trims code and location before classifying.
- Its valid code grammar is prefix-generic: `[A-Z]{1,3}\d+`.
- A code found in the supplied `CharterSnapshot` is `resolvable` and carries its title.
- A well-shaped code absent from the snapshot is `degradable` and carries a disposition.
- A malformed code is `structural` with reason `invalid-code`.
- A blank location is `structural` with reason `missing-location`.
- `materializationDisposition` folds classifications into clean materialization, materialization
  with degrades, or structural refusal.
- The predecessor intentionally deferred invoking the classifier for `advances` to this ticket.

## Existing charter resolver

- `src/play/charter-snapshot.ts` exports `snapshotCharterCodes`.
- It is pure, total, import-free, and does not load BAML.
- It parses bold charter definitions such as `**P4 — Autonomy ...**`.
- The parser uses the same prefix-generic code family as the classifier.
- It returns a `ReadonlyMap<string, string>`.
- Unknown and retired codes are represented only by map absence.
- Empty or definition-free charter text yields an empty map.
- It accepts project-specific prefixes such as the kitchen charter's `K1` codes.
- It differs intentionally from the bounds gate's grep helper: snapshots require an actual
  definition and preserve its title, while the gate currently recognizes P/N mentions.

## Existing normalization

- `src/play/decompose-epic-core.ts` owns the pure normalization precedent.
- `isNonGoalAdvance` recognizes trimmed `N\d+` values.
- `stripNonGoalAdvances(plan)` maps ticket `advances` arrays.
- It removes every N-shaped entry before gates and effect see the plan.
- It returns a new plan and new ticket only when a ticket actually contains an N-code.
- It does not mutate input plans, tickets, or arrays.
- It leaves stories untouched because stories carry no `advances` field.
- A clean ticket object retains identity within the returned plan.
- A ticket containing only non-goal codes becomes `advances: []`.
- The normalizer deliberately does not fabricate a replacement value.
- Existing core tests cover mixed `[P4, N2]`, N-only, clean-plan identity, non-mutation, and
  multiple tickets.

## Existing production wiring

- `src/play/decompose-epic.ts` defines `decomposeEpicPlay`.
- Its current parse hook is:
  `stripNonGoalAdvances(b.parse.DecomposeEpic(text))`.
- The generic cast loop parses once and stores that one output.
- The same parsed output is passed to the play's gates and, on CLEAR, its effect.
- Therefore normalization in parse guarantees both the gate input and materialized board omit
  removed entries.
- The play's gates receive a `CastContext<DecomposeInputs>` containing `inputs.charter`.
- The play's effect receives the same context.
- The current parse hook does not receive that context or the typed inputs.

## Generic play/cast boundary

- `src/engine/play.ts` declares `Play<I, O>`.
- `render` receives typed inputs.
- `parse` currently has signature `(text: string) => O`.
- `gates` and `effect` both receive `(out, CastContext<I>)`.
- `src/engine/cast.ts` creates `CastContext<I>` after execution and before parsing/gating.
- It currently calls `play.parse(result.result ?? "")`.
- Existing concrete parse functions are one-argument functions.
- TypeScript permits a function with fewer parameters to implement a callback type that may be
  invoked with an additional argument, so an added parse context can be backward-compatible for
  existing play declarations.
- The cast already possesses both `inputs` and the resolved project root at the parse call site.
- No filesystem read is needed to make the charter available there.

## Existing gate behavior

- `src/gate/gates.ts` is pure and BAML-addon-free.
- Gate order is value → story-completeness → allocation → bounds → structural.
- The value gate rejects a ticket when `advances` is absent, empty, or contains blank entries.
- This ordering means normalization to `[]` is refused before bounds runs.
- The bounds gate derives live P and N sets from the supplied charter text.
- It rejects N-shaped/non-goal entries as incoherent.
- It rejects a P-shaped entry absent from the charter as a dangling reference.
- It permits free-text outcome phrases because they are human-judgment territory.
- The bounds comments describe the N-code branch as defense in depth for direct, unnormalized
  callers.
- Existing gate tests directly prove dangling P refs and non-goal refs STOP at bounds.
- Existing value tests directly prove empty `advances` STOP at value.

## Relevant constraints and assumptions

- The repository's pure-core/impure-shell rule applies: the normalizer must take plain values and
  return data without filesystem, clock, network, process, or hidden mutable state.
- Resolution cannot hardcode Vend's current P1–P7 set because the tool supports authored local
  charters and prefix-generic codes.
- Resolving against epic prose would be weaker than resolving against charter definitions and
  would drift from the predecessor's settled classifier contract.
- Removing the bounds check entirely would weaken defense in depth for direct callers and would
  contradict the ticket wording, which says normalization should prevent the STOP.
- Normalizing only inside `gates` without replacing the cast output would leave the effect to
  materialize the original dangling code.
- Mutating the plan during gating would violate the established pure normalizer behavior and make
  gate evaluation order observable through side effects.
- A clean plan's external bytes and existing gates should remain unchanged.
- Degrade disposition persistence is not part of this ticket; successor `T-077-02-04` owns the
  RunRecord and summary integration.
- The shared classifier nevertheless provides the canonical decision and disposition data this
  normalizer should use rather than duplicating code-shape logic.

## Worktree and concurrency observations

- The branch contains completed predecessor commits, including the shared disposition module.
- Lisa-managed `.lisa/provenance.jsonl` and ticket frontmatter are already modified.
- Those changes are not ticket-owned source work and must not be staged or overwritten.
- Sibling `T-077-02-02` is active in parallel and owns materialization files.
- This ticket must avoid `materialize.ts`, `decompose-effect.ts`, and their tests.
- No attempt phase artifacts existed before this research file.

## Research conclusion

- The defect is not in the value gate: empty post-normalization values already refuse correctly.
- The defect is not best fixed by weakening bounds: its STOP remains useful for unnormalized calls.
- The missing capability is charter-aware normalization before the single parsed output fans out
  to gates and effect.
- The existing classifier and snapshot parser provide the pure resolution mechanism.
- The current parse callback lacks the input/context needed to use that mechanism in production.
- The next phase must evaluate a small parse-context seam versus alternatives that preserve both
  custom-charter correctness and the production parse → gates/effect data flow.
