# Research — T-078-02-01

## Assignment and workflow constraints

- The ticket starts in `research` and the assignment requires one continuous pass through
  Research, Design, Structure, Plan, Implement, and Review.
- Attempt artifacts belong only under `.lisa/attempts/T-078-02-01/1/work/`.
- Lisa publishes admitted artifacts later; this worker must not write phase artifacts to
  `docs/active/work/T-078-02-01/`.
- Ticket phase and status frontmatter are Lisa-owned and must not be edited.
- Ticket-owned source must be committed with `lisa commit-ticket`, using exact repeated
  repository-relative `--include` paths.
- Ordinary Git staging and ordinary `git commit` are forbidden for ticket work.
- The repository currently has unrelated working-tree changes in ticket and epic documents.
  They are not owned by this ticket and must remain untouched.
- `bun run check` is the repository gate: BAML generation, TypeScript checking, and the complete
  Bun test suite.

## Product and story contract

- Vend is a local-first clearing house for repeatable agent work.
- Its gates turn probabilistic work into a dependable contract.
- This ticket advances P3: gates are the contract.
- The parent story is `S-078-02`, “charter-convention-teaches-itself.”
- The story covers three newcomer-facing surfaces for the P-label convention.
- This ticket owns the first surface: gate refusals and the shared label detector seam.
- Sibling ticket `T-078-02-02` will use the detector in a doctor preflight probe.
- Sibling ticket `T-078-02-03` will use the detector to verify the init charter stub.
- This ticket runs alone because it settles the shared seam before those two tickets fan out.
- The story explicitly excludes gate verdict changes, epic schema changes, charter schema
  changes, auto-labeling, migration, and changes to overlay charters.
- The intended change is legibility: a newcomer should learn why the refusal happened and what
  to do next.

## Acceptance contract

- `src/gate/gates.test.ts` must pin behavior for a charter containing zero P-labeled invariants.
- In that context, an empty-`advances` refusal must name the missing-label cause.
- In that context, a dangling P-reference refusal must name the same cause.
- Both refusals must show the convention in human-readable form, beginning with an example like
  `P1 — Author once, run forever...`.
- Both refusals must state the fix: label the charter invariants or cite none.
- With a labeled charter, existing refusal text must remain byte-identical.
- With a labeled charter, every existing pass/refuse verdict must remain unchanged.
- The current module-private label matcher must become an exported seam.

## Relevant source module

- `src/gate/gates.ts` is a pure module.
- It imports BAML plan types with a type-only import, so loading the module does not load the BAML
  native addon.
- `clear(plan, ctx)` is its public entry point.
- `ClearContext` contains the exact `epic` and `charter` strings supplied to decomposition.
- `assertPlan` throws for malformed caller wiring.
- `assertContext` requires both context fields to be strings.
- Expected plan defects are returned as `GateStop`, never thrown.
- Gate ordering is fixed by `GATE_NAMES` and `GATES`:
  value, story-completeness, allocation, bounds, structural.
- `clear` returns the first offense only.
- This first-offense behavior is a product property: the highest-value defect is reported first.

## Existing charter detector

- `matchIds(text, prefix)` lives in `src/gate/gates.ts` near the other pure helpers.
- It is currently module-private.
- Its prefix type is the closed union `"P" | "N"`.
- It builds a global regular expression with a word boundary, prefix, and one or more digits.
- It returns a `Set<string>`, naturally deduplicating repeated labels.
- It detects references anywhere in text; it does not parse Markdown structure or definitions.
- This behavior is already what the bounds gate treats as the live charter ID set.
- `boundsGate` calls `matchIds(ctx.charter, "P")` for invariants.
- `boundsGate` calls `matchIds(ctx.charter, "N")` for non-goals.
- The detector has been present since the original clearing-gate implementation.
- Exporting it preserves its existing name, inputs, output, and semantics.
- A zero-label charter is observably `matchIds(charter, "P").size === 0`.

## Existing value behavior

- `valueGate` currently receives only the plan, not the clear context.
- A zero-ticket plan stops with unit `<plan>` and reason:
  `plan has no tickets — it advances nothing (malformed/empty)`.
- A ticket with an absent, empty, or blank-containing `advances` array stops with unit equal to the
  ticket ID and reason:
  `` `advances` is empty — must name what it advances (never empty) ``.
- The empty-advances branch runs after purpose validation and before done-signal validation.
- Because `valueGate` has no context, it cannot currently distinguish a labeled charter from an
  unlabeled one.
- The `GATES` table wraps value as `(p) => valueGate(p)` even though every gate runner accepts
  `(plan, ctx)`.
- Passing context to `valueGate` can fit the existing gate-runner interface without changing gate
  order or the public `clear` signature.

## Existing bounds behavior

- `boundsGate` already receives `ClearContext`.
- It recomputes invariant and non-goal sets from the current charter on every call.
- An `N\d+` claim stops as incoherent even if the charter does not define the cited non-goal.
- A `P\d+` claim absent from the invariant set stops as a dangling reference.
- The current exact dangling reason is:
  `advances \`P9\` — no such invariant in the charter (dangling ref)`.
- Free-text advances values are outside rule-checkable label semantics and pass bounds.
- A charter with no P-labels makes every shaped P-reference dangling.
- Today that refusal identifies the immediate dangling reference but does not identify that the
  charter itself contains no convention-compatible labels.

## Normal decomposition path

- `src/play/decompose-epic-core.ts` normalizes editorial charter cites before gates run.
- `stripNonGoalAdvancesWithDispositions` uses the separate charter snapshot/classification seam.
- A dangling-only cite can therefore normalize to `advances: []` before `clear`.
- That normalized plan stops at the value gate, not bounds.
- Direct callers can still pass an unnormalized `P9` claim to `clear`, reaching the bounds gate.
- The ticket correctly requires both refusal sites: they cover the normal normalized path and the
  direct defense-in-depth path.
- This ticket does not own normalization or snapshot parsing.

## Test module and fixture patterns

- `src/gate/gates.test.ts` is a pure Bun test file.
- BAML imports are type-only, avoiding native-addon behavior.
- `CHARTER` supplies P1 through P7 and N1 through N4.
- `CTX` is the ordinary labeled context.
- `DEFINITION_CHARTER` supplies Markdown-formatted definitions for P1 and P3.
- `ticket`, `story`, and `plan` build complete typed fixtures with focused overrides.
- `VALID` is a two-ticket happy-path plan.
- Existing tests cover each gate, gate ordering, narrowing, and programmer-error guards.
- Existing empty-advances tests pin the gate and unit but only check that the reason contains
  `advances`.
- Existing dangling-reference tests pin gate and unit but only check that the reason contains the
  cited code.
- The current suite therefore does not protect the exact legacy text requested by this ticket.
- A new unlabeled context can be made by retaining the epic and replacing only the charter with
  prose containing no `P\d+` token.
- Detector tests can import `matchIds` from the same module and prove P/N selection and the
  zero-label case without filesystem effects.

## Repository and commit context

- Relevant source history is small and concentrated in the two gate files.
- The most recent relevant production change degraded dangling `advances` cites before gating.
- That history explains why empty `advances` is now the common cold-start refusal.
- `lisa commit-ticket --help` confirms the required syntax:
  `--ticket-id`, `--message`, and one or more `--include` paths.
- The meaningful source unit is likely the gate implementation and its colocated tests together,
  because the behavior and its byte-level compatibility pins are one coherent contract.
- Phase artifacts are attempt-private and are not part of the ticket source commit.

## Constraints and risks surfaced by the map

- The diagnostic must be conditional only on zero detected P-labels.
- Testing the truthiness of the `Set` would be wrong; even an empty `Set` is truthy.
- Searching the epic instead of the charter would be wrong; `ClearContext.epic` itself commonly
  cites P-labels and could mask an unlabeled charter.
- Changing the base legacy message would violate byte-identical labeled-charter acceptance.
- Adding a new gate or changing the ordered gate list would alter pass verdicts and logs.
- Treating free-text advances as invalid would change bounds semantics and exceed scope.
- Making unlabeled charters clear would change verdict logic and violate the story boundary.
- Parsing only Markdown list definitions would change the detector contract; sibling surfaces are
  explicitly intended to reuse the existing matcher semantics.
- A shared diagnostic helper can remain private; only the existing detector is required as a
  public seam.
- The zero-ticket refusal is not explicitly named by ticket acceptance as one of the two messages;
  the relevant “empty-advances” case is the ticket-level branch after normalization.
- Full verification must account for generated BAML output, type checking, and the entire test
  suite, even though this change is confined to a pure module.

## Research conclusion

- The current architecture already contains the required detector and context at the clearing
  boundary.
- The implementation surface is limited to `src/gate/gates.ts` and
  `src/gate/gates.test.ts`.
- No schema, effect, filesystem, executor, or CLI change is needed.
- The key compatibility requirement is to append an unlabeled-charter explanation only when the
  live charter has zero matched P-labels, while preserving the old reason string otherwise.
