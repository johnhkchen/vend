# Structure — T-004-02 refuse-materialize-on-collision

The shape of the code: files touched, the interfaces, ordering. Not the code —
the blueprint Plan will sequence.

## Files changed

| File | Action | Why |
|------|--------|-----|
| `src/log/run-log.ts` | modify | Add `"id-collision"` to `RUN_OUTCOMES`. |
| `src/play/project-context.ts` | modify | Extract + export `listIdsIn(dir)`; `listIds` delegates. |
| `src/play/materialize.ts` | modify | Add `IdCollisionError`; gather+detect+throw guard atop `materialize`. |
| `src/play/decompose-epic.ts` | modify | Catch `IdCollisionError`; relabel outcome → `id-collision`; andon. |
| `src/play/materialize.test.ts` | modify | Add the cross-board collision guard `describe` (AC5 both paths). |

No files created or deleted. Five edits, four source + one test. `id-guard.ts` is
**unchanged** — it is consumed, not modified.

## 1. `src/log/run-log.ts` — the outcome label

Single-line tuple change (line 39):

```ts
export const RUN_OUTCOMES = [
  "success", "gate-failed", "timed-out", "budget-exhausted", "id-collision",
] as const;
```

Ripple: `RunOutcome` (the derived union) gains the member automatically;
`assertOutcome` now accepts it, so `appendRunLog({outcome:"id-collision"})` no
longer throws. Update the doc comment above `RUN_OUTCOMES` (lines 33–38) to name
the new state and its source (`id-collision` ← `materialize`'s cross-board guard,
T-004-02). No other run-log code changes — `buildRunRecord`/`serializeRunRecord`
are outcome-agnostic.

## 2. `src/play/project-context.ts` — a reusable single-dir listing

The private `listIds(root, dir)` (lines 87–94) becomes a thin wrapper over a new
**exported** single-dir entry point, so `materialize` (which holds full dirs) can
reuse the exact listing logic the snapshot uses (AC: "reuse … `listIds`").

```ts
/** List the `*.md` ids (basename without extension) directly under `dir`.
 *  Tolerates a missing dir (a fresh board) → `[]`, never throws. Exported so the
 *  materialize collision-guard reuses the same listing the snapshot uses. */
export async function listIdsIn(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((n) => n.endsWith(".md")).map((n) => n.slice(0, -3));
  } catch {
    return [];
  }
}

/** …existing doc… now delegates to {@link listIdsIn}. */
async function listIds(root: string, dir: string): Promise<string[]> {
  return listIdsIn(join(root, dir));
}
```

Behavior of `listIds` is byte-for-byte unchanged (same tolerant `*.md`-basename
listing), so `assembleInputs` and `buildProjectSnapshot` are untouched. Only a
new export is added.

## 3. `src/play/materialize.ts` — the guard + typed error

### New export: `IdCollisionError`

```ts
/** Thrown by {@link materialize} when the plan's ids collide with ids already on
 *  the board — the cross-board andon (T-004-02). Carries the colliding ids
 *  (deduped, plan-ordered, straight from `detectCollisions`) so the runner names
 *  them in its andon. An expected refusal, caught by the runner; a sibling of the
 *  `RangeError` thrown on enum/alias drift. */
export class IdCollisionError extends Error {
  readonly collisions: readonly string[];
  constructor(collisions: readonly string[]) {
    super(`materialize: refusing — ${collisions.length} board id(s) already exist: ${collisions.join(", ")}`);
    this.name = "IdCollisionError";
    this.collisions = collisions;
  }
}
```

### New imports

```ts
import { detectCollisions } from "./id-guard.ts";
import { listIdsIn } from "./project-context.ts";
```

Both are pure/addon-free at the type level: `id-guard` has no addon;
`project-context`'s `listIdsIn` is plain fs. Importing them adds no BAML addon to
`materialize`'s import graph (it stays type-only on BAML). Confirm no import
cycle: `project-context` does **not** import `materialize` (it imports only node
fs/path), so `materialize → project-context` is acyclic.

### The guard, atop `materialize` (before the first `mkdir`)

```ts
export async function materialize(plan, targets): Promise<MaterializeResult> {
  // Cross-board collision guard (T-004-02) — runs BEFORE any write so a reused
  // id stops the line with zero partial materialization (P7). Gather is impure;
  // the judgment is the pure detectCollisions; refusal is a typed throw.
  const existing = [
    ...(await listIdsIn(targets.storiesDir)),
    ...(await listIdsIn(targets.ticketsDir)),
  ];
  const generated = [...plan.stories.map((s) => s.id), ...plan.tickets.map((t) => t.id)];
  const collisions = detectCollisions(generated, existing);
  if (collisions.length > 0) throw new IdCollisionError(collisions);

  await mkdir(targets.storiesDir, { recursive: true });   // …unchanged below…
  …
}
```

The existing write loop (lines 156–175) is **unchanged**. The guard is a prefix.
Update the module header note that today calls `materialize` "the single IMPURE
verb (mkdir -p + writeFile)" — it now also reads the board first; still a single
impure verb, now read-then-write.

## 4. `src/play/decompose-epic.ts` — catch + relabel

### New import

```ts
import { materialize, IdCollisionError } from "./materialize.ts";
```

### The tail (lines 159–187), restructured

```ts
let materialized = false;
let outcome: RunOutcome = verdict.outcome;   // collision may relabel a success
if (verdict.materialize && plan) {
  try {
    await materialize(plan, {
      storiesDir: join(root, "docs", "active", "stories"),
      ticketsDir: join(root, "docs", "active", "tickets"),
    });
    const validated = await lisaValidate(root);
    materialized = validated.ok;
    process.stdout.write(validated.ok ? "· lisa validate ✓\n" : `· lisa validate ✗\n${validated.output}\n`);
  } catch (e) {
    if (e instanceof IdCollisionError) {
      outcome = "id-collision";
      process.stdout.write(`· andon: id-collision — reused board id(s): ${e.collisions.join(", ")}\n`);
    } else {
      throw e;   // a genuine fs failure is not a clean outcome (mirrors line 142)
    }
  }
} else if (verdict.outcome !== "success") {
  process.stdout.write(`· andon: ${verdict.outcome}${stopReason(gateResult, budgetOutcome)}\n`);
}

await appendRunLog({ …, outcome, … });        // was verdict.outcome
return { runId, outcome, materialized };       // was verdict.outcome
```

Three touch points: introduce `let outcome`; wrap materialize/validate in
try/catch with the `IdCollisionError` branch; swap the two `verdict.outcome`
references at the log + return to the mutable `outcome`. `verdict.gateLog` passed
to `appendRunLog` is **unchanged** (the gates did pass).

## 5. `src/play/materialize.test.ts` — the fixture test (AC5)

Add imports (`mkdtemp`, `rm`, `readdir`, `writeFile` from `node:fs/promises`,
`tmpdir` from `node:os`, `join`) and `materialize, IdCollisionError` from
`./materialize.ts`. New block:

```
describe("materialize — cross-board collision guard (T-004-02)")
  helper: make a temp { storiesDir, ticketsDir }; afterEach rm -rf.
  helper: workPlan({stories, tickets}) → plain object cast to WorkPlan
          (reuse the existing `ticket()`/`story()` draft fixtures for bodies).

  test "populated board → refuses (named ids) and writes nothing":
    pre-seed ticketsDir/T-001-01.md (a hand-authored sentinel body).
    plan mints T-001-01 (collision) + T-009-02 (fresh).
    await expect(materialize(plan, targets)).rejects.toBeInstanceOf(IdCollisionError)
    err.collisions deep-equals ["T-001-01"].
    read both dirs off disk → only the sentinel exists; T-009-02.md absent;
    sentinel body unchanged (not clobbered).

  test "fresh/disjoint board → materializes normally":
    empty dirs; plan mints S-009 + T-009-01 (disjoint).
    await materialize(...) resolves; read disk → S-009.md & T-009-01.md present.
```

Tests use real fs in a temp dir; no BAML addon (type-only imports, plain-object
plans). Self-contained — no live board touched.

## Ordering of changes (Plan will sequence)

1. `run-log.ts` outcome member — leaf, unblocks the runner's relabel typecheck.
2. `project-context.ts` `listIdsIn` export — leaf, unblocks materialize's import.
3. `materialize.ts` guard + `IdCollisionError` — depends on 2 + `id-guard`.
4. `materialize.test.ts` fixture — depends on 3.
5. `decompose-epic.ts` catch/relabel — depends on 1 + 3.

## Invariants preserved

- `id-guard.ts` untouched; `detectCollisions` consumed, not changed.
- `materialize`'s success return type (`MaterializeResult`) unchanged.
- `listIds` behavior unchanged (pure refactor behind a new export).
- One `appendRunLog` call per run; `cli.ts` exit mapping needs no change.
