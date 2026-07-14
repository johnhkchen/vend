# T-067-01-03 — bare-code-write-guard — Research

Descriptive map of what exists. No solutions proposed here.

## The ticket in one line

Turn "cut artifacts carry no bare codes" into a **write-side contract**: a cast whose
charter cannot resolve a cited code is refused with a named andon BEFORE any `writeFile`
(zero partial output, `IdCollisionError`-style typed refusal), plus a cast-level fixture
proof through the stub executor whose written bodies grep clean of bare unexplained P/N
codes.

## Where the guard slots — materialize.ts today

`materialize(plan, targets, charter)` (src/play/materialize.ts:298) is the single impure
verb. Its current order, with the exact slot already marked by T-067-01-02's doc comment
("T-067-01-03's resolvability check slots between that build and the first write"):

1. Gather board ids (`listIdsIn` × 2) → `detectCollisions` → throw `IdCollisionError`
   before any mkdir/write (materialize.ts:304-309).
2. `mkdir -p` both target dirs (materialize.ts:311-312).
3. One clock read (`cutDate`) + ONE charter resolution:
   `snapshot = snapshotCharterCodes(charter)` (materialize.ts:317-318).
4. Loop stories → `renderStoryFile(s, storyTickets, cutDate, snapshot)` → `writeFile`.
5. Loop tickets → `renderTicketFile(t, snapshot)` → `writeFile`.

Note the ordering wrinkle: the snapshot is built AFTER the two `mkdir` calls, and the
render/write loops are interleaved (render one file, write it, render the next). "Before
any writeFile" is the contract the collision guard already meets; `mkdir` of the target
dirs is not treated as partial output by the existing collision test only because the
throw precedes it there (the test at materialize.test.ts:408 pins "stories dir never
created").

## What the renderers already do with codes (T-067-01-02, settled)

- `PROSE_CODE = /\b([A-Z]{1,3}\d+)\b(?! —)/g` (materialize.ts:142) — private const. The
  `(?! —)` lookahead makes the rewrite idempotent and skips already-glossed codes.
- `resolveCodesInProse(text, snapshot)` — rewrites a code to `code — carried text` IFF
  the snapshot resolves it; anything else (`forward-E1`'s `E1`, `A3`) passes through
  verbatim. Applied to ticket `purpose`/`doneSignal` and all five story sections
  (waveRationale inside the DAG chunk).
- `advancesLine(advances, snapshot)` (materialize.ts:159) — a snapshot miss degrades to
  the BARE code, documented as "turning that absence into a named refusal is the write
  guard (T-067-01-03), not the renderer's". Renderers stay total; nothing here refuses.
- The empty-snapshot golden (materialize.test.ts:315) pins the degrade path: `_Advances:
  P1_` bare — the exact counterexample shape this ticket's guard must make unreachable on
  the cast path (per the -02 handoff).

## The typed-refusal precedent — IdCollisionError

`IdCollisionError` (materialize.ts:104) is the named pattern the AC cites: `extends
Error`, sets `name`, carries structured payload (`collisions: readonly string[]`), thrown
before any write. `decomposeEffect` (decompose-epic.ts:204-208) catches it by
`instanceof` and RELABELS to a returned `EffectResult` with `outcome: "id-collision"` —
"returned data, not exception" at the orchestration boundary; any other throw propagates
(a genuine fs failure is not a clean andon).

## Run-log outcome plumbing

- `RUN_OUTCOMES` (src/log/run-log.ts:52) is the closed outcome vocabulary: `success |
  gate-failed | timed-out | budget-exhausted | id-collision | missing-capability |
  graph-invalid | errored`. `assertOutcome` throws on anything else, and `readRunLog`
  drops records with unknown outcomes — so a NEW named outcome must be added to this
  tuple or an existing one reused.
- Downstream consumers derive from the tuple rather than enumerating by hand:
  walk-away's `OutcomeMix` is `Record<RunOutcome, number>` seeded from `RUN_OUTCOMES`;
  run-log.test.ts does `test.each([...RUN_OUTCOMES])`; graph-core pins `errored`
  membership. recalibrate/walk-away hardcode only `CENSORED_OUTCOMES =
  ["budget-exhausted", "timed-out"]`. No exhaustive switch exists that a new member
  would break silently.
- `EffectResult.outcome?: RunOutcome` (engine/play.ts:101) is the relabel channel;
  `castPlay` (engine/cast.ts:261) applies it and prints `· andon: <outcome>` on any
  non-success. Chain halting (engine/chain-core.ts:50) is generic on non-success.

## What upstream already refuses (and what it cannot see)

- **Bounds gate** (src/gate/gates.ts:283): checks `advances` ARRAYS only. A `P\d+` entry
  must grep-resolve in the charter (`matchIds` — ANY occurrence of `\bP\d+\b`, not just
  bold definitions); an `N\d+` entry is "cannot advance a non-goal". So a dangling
  P-code in `advances` is already a `gate-failed` STOP before the effect ever runs —
  ON THE GATED PATH.
- **`stripNonGoalAdvances`** (decompose-epic-core.ts:197) runs in `parse`, so N-codes
  never reach `advances` on the decompose path.
- Two holes the -02 review names explicitly:
  1. **Prose is invisible to gates** (concern #4): a prose citation of a code the charter
     doesn't define stays bare forever; the bounds gate never looks at `purpose`/
     `doneSignal`/story sections.
  2. **`matchIds` vs the snapshot disagree on what "defined" means**: the bounds gate
     accepts a P-code that appears ANYWHERE in the charter text; the snapshot only maps
     codes with a bold `**P4 — title.**` definition. A charter mentioning `P9` in prose
     but never defining it clears bounds yet misses the snapshot → renders bare. Also
     `--skipGates` (`vend run --no-gates`) bypasses the bounds gate entirely; and a
     blank-titled definition (`**P8 — .**`) mints no snapshot entry by design
     (charter-snapshot.ts:30 "whether that refuses a cut is the write guard's judgment").

## The cast-level fixture precedent — story-gate-cast.test.ts

The exact pattern the AC's second clause needs, already in the tree: a stub `Executor`
whose `dispense` returns a canned JSON `WorkPlan` (story-gate-cast.test.ts:95), a
decompose-SHAPED fixture play wiring the REAL `clear` and the REAL `materialize` into
tmp dirs, cast through the REAL `castPlay` with `runLogPath` — asserting outcome,
`materialized`, on-disk state, and the run-log record. Zero BAML addon (all baml_client
imports type-only; decompose-epic.ts never value-imported in bun tests). Its `CHARTER`
fixture (line 40) is PROSE-shaped (`"P1 — Author once…"` without bold) — it resolves for
`matchIds` but yields an EMPTY snapshot; materialize.test.ts's `CHARTER` (line 66) is the
bold-shaped one that resolves for both.

## Test-side conventions that constrain this ticket

- materialize.test.ts is a pure-function test file plus a REAL-FS guard section
  (mkdtemp/afterEach rm); the collision tests exercise `materialize` directly and verify
  refusal ON DISK (sentinel untouched, dirs never created).
- Every baml import type-only; enum members are string literals cast to erased types.
- House rule: caller/wiring error THROWS; an expected andon is DATA at the effect
  boundary (typed throw inside materialize, caught + relabeled in the effect).

## Call sites of materialize (all three)

1. `decomposeEffect` (decompose-epic.ts:190) — production; catches `IdCollisionError`.
2. `chain-propose-decompose.test.ts:137` — chain fixture, charter fixture already threaded.
3. `story-gate-cast.test.ts:124` — fixture effect, real materialize, prose-shaped charter.

Call sites 2 and 3 pass charters whose snapshot coverage differs from their plans' cited
codes today (site 3's charter is prose-shaped → empty snapshot, plan advances `["P1"]`);
a guard that refuses unresolved codes would change those tests' behavior unless their
fixtures are updated — a fact for Design, noted descriptively here.

## Constraints and assumptions surfaced

- Story scope fences: gates.ts and decompose.baml untouched; only the write side changes.
- The grep-clean bar per the -02 handoff: bodies contain no `\b[PN]\d+\b` not followed by
  ` — ` — scoped to P/N prefixes, NOT the full `[A-Z]{1,3}\d+` shape (so `E1`/`A3`/`K1`
  prose passthrough stays legal against the vend charter).
- "Zero partial output" precedent treats the throw-before-mkdir ordering as the bar
  (collision test pins ENOENT on the stories dir).
- `PROSE_CODE` is private to materialize.ts; the handoff explicitly leaves "export it or
  re-derive" as this ticket's design call.
- Provenance: honey-kitchen complaint #1 (auto-strip N-codes) is the field driver; the
  P3 framing is refusal-at-source, not read-side cleanup (story Out-of-slice fences
  read-time stripping).
