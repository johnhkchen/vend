# Research — T-004-02 refuse-materialize-on-collision

Descriptive map of the code this ticket touches. What exists, where, how it
connects. No solutions here — those are Design's job.

## The ticket in one line

Wire the pure detector (T-004-01) into the write path so a cross-board id
collision **stops the line before any file is written** — an andon, not a
clobber. Today `materialize` writes blindly.

## The hazard (why this ticket exists)

`src/play/materialize.ts` `materialize()` (lines 155–176) is the single impure
write verb. It does, unconditionally:

```
mkdir -p storiesDir ; mkdir -p ticketsDir
for s of plan.stories: writeFile(join(storiesDir, `${s.id}.md`), …)
for t of plan.tickets: writeFile(join(ticketsDir, `${t.id}.md`), …)
```

There is **no existence check** (observation 20349). `writeFile` truncates, so a
plan that re-mints an id already on the board (`S-001`, `T-001-01`, …) silently
overwrites a hand-authored file. The E-001 live proof (`work/T-002-04`, kaizen
#4) only escaped this because it materialized into a sandbox. The four clearing
gates (`gates.ts`) guarantee uniqueness *within* a plan (allocation gate,
`idSetOf`), but nothing checks uniqueness *against the existing board*.

## The pieces already in place

### `src/play/id-guard.ts` — the pure detector (T-004-01, committed `0a4f53f`)

```ts
detectCollisions(generated: readonly string[], existing: readonly string[]): string[]
```

Returns the ids in `generated` that already exist in `existing`, **deduped and
ordered by first appearance in `generated`**. PURE and TOTAL — never throws, no
fs/clock/addon, not even a type-only BAML import. `[]` ⇒ clear. This is the heart
of the guard; T-004-02 only has to *gather the two id lists and act on a
non-empty result*. Its review explicitly hands off the call shape:
`detectCollisions([...plan.stories.map(s=>s.id), ...plan.tickets.map(t=>t.id)],
existingIds)`.

### `src/play/project-context.ts` — the existing-id listing

`listIds(root, dir)` (lines 87–94, **private**) does
`readdir(join(root, dir))`, filters `*.md`, strips the extension → the ids living
directly under a docs dir. Tolerates a missing dir (`catch → []`). It is already
called by `assembleInputs` for the *prompt snapshot* (stories + tickets, lines
110–116) — but that snapshot is gathered at run START and is not threaded forward
to `materialize`. The ticket says to **reuse this listing**. It currently takes
`(root, dir)`; `materialize` knows full target dirs, so the signature needs a
single-dir entry point.

### `src/play/decompose-epic.ts` — the runner (impure orchestrator)

`runDecomposeEpic` (lines 106–188) is the wiring. The relevant tail:

- line 157: `const verdict = classify({ timedOut, budgetOutcome, gateResult })`
  — the pure outcome decision (`decompose-epic-core.ts`).
- lines 159–172: `if (verdict.materialize && plan) { await materialize(plan,
  {storiesDir, ticketsDir}); lisaValidate; } else if (outcome !== "success")
  { andon stdout }`.
- lines 174–185: one `appendRunLog({ … outcome: verdict.outcome … })`.
- line 187: `return { runId, outcome: verdict.outcome, materialized }`.

The targets are `join(root, "docs","active","stories")` /
`…,"tickets")` (lines 162–163). **The guard's insertion point is between
`classify` and the write** (observation 20351) — i.e. the collision must be
caught at or just before the `materialize` call so the run still produces exactly
one run-log record and zero files.

### `src/play/decompose-epic-core.ts` — the pure decision core

`classify(ClassifyInput): Verdict` (lines 56–66). `ClassifyInput =
{ timedOut, budgetOutcome, gateResult }`; `Verdict = { outcome: RunOutcome,
materialize: boolean, gateLog }`. First-match priority: timeout > budget >
gate-stop > success. It only returns `materialize: true` on `success`. It has
**no knowledge of the board** — collisions are an fs fact unavailable to a pure
function, and they are discovered *after* a plan has already cleared the gates.

### `src/log/run-log.ts` — the countable ledger

`RUN_OUTCOMES = ["success", "gate-failed", "timed-out", "budget-exhausted"]`
(line 39); `RunOutcome` is that tuple's union (line 45). `assertOutcome` (lines
128–132) throws `RangeError` if the runner passes an outcome not in the tuple —
so a new outcome label **must be added to the tuple** or `appendRunLog` will
throw. `buildRunRecord` is pure and unit-tested. Adding a member is the entire
log-side change; a failed/refused run already "writes a record carrying its
failure outcome" structurally (it's just a field).

### `src/cli.ts` — exit mapping

Line 85: `process.exit(summary.outcome === "success" ? 0 : 1)`. **Any** non-
success outcome already exits non-zero — so an `id-collision` outcome needs no
CLI change; it falls out of the existing mapping.

## House patterns / constraints that bind this work

- **Pure core + single impure verb** (obs 20402): judgment is pure & tested; the
  one fs verb is untested, "proven live". `detectCollisions` is the pure
  judgment; `materialize` is the impure verb. A guard inside `materialize` keeps
  this shape — impure gather + pure detect + throw.
- **BAML native addon must not load in `bun test`** (obs 20213/20275). `gates`,
  `materialize`, `decompose-epic-core`, `id-guard` all import BAML **type-only**
  so their tests are addon-free. `materialize.test.ts` already builds plain-object
  drafts cast to the erased enum types and tests `materialize`'s render pair
  without the addon. **fs is fine in tests** — only the addon is forbidden — so a
  temp-dir fixture test against `materialize` is addon-safe.
- **House throw rule** (gates/budget/materialize): a *programmer/wiring* error
  THROWS; an *expected andon* is data. A collision is an expected andon. But the
  gates' STOP vocabulary lives in a pure judge that runs pre-write; the write verb
  signals refusal the only way an fs verb can mid-call — by throwing a **typed**
  error the runner catches and maps to data. `materialize` already throws
  `RangeError` on alias/enum drift, so a typed throw is in-idiom for this module.
- **`materialize` owns its targets.** It receives `storiesDir`/`ticketsDir`, so it
  can gather the board ids from exactly the dirs it is about to write — a true
  poka-yoke at the write boundary, fresher than the run-start snapshot.

## Assumptions surfaced

- The colliding-id namespace is whatever `listIds` emits (`*.md` basenames) and
  whatever `plan.*.id` mints — both lisa ids (`S-…`, `T-…`). detectCollisions
  treats them as opaque strings; no id-shape parsing is needed (T-004-01 D5).
- Stories and tickets share one flat id namespace for collision purposes — the
  guard pools both target dirs' ids and both `plan.stories`+`plan.tickets` ids,
  matching the handoff call shape. A story id and a ticket id never coincide by
  construction (`S-` vs `T-`), so pooling is safe and simplest.
- A collision is discovered **only on an otherwise-successful run** (gates
  cleared, in budget). On a STOP/timeout/exhausted run, `materialize` is never
  called, so the guard never runs — correct, nothing would be written anyway.

## Open questions for Design

1. Does the guard live **inside `materialize`** (AC1's literal reading: "`materialize`
   collects … and runs `detectCollisions`") or in the runner before the call?
2. How is the refusal surfaced to the runner so it logs `id-collision` —
   typed error vs. a returned discriminated result?
3. Where does the `id-collision` outcome label get decided — pure core or runner?
4. How is AC5's "zero files written, verified on disk" made true *structurally*
   (throw before any write) and *testable* without the BAML addon?
