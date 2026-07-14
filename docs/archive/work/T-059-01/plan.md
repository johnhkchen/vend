# T-059-01 — Plan

Ordered, independently-verifiable steps. The work is small and additive; the plan front-
loads the pure core (everything else depends on it) and pins it before wiring the callers.

## Testing strategy (what proves each AC)

| AC | Verified by |
| --- | --- |
| section emitted when intent present; byte-identical when absent; both pinned | unit tests in `project-context.test.ts` (Step 2) |
| `assembleSteerInputs`/`assembleSurveyInputs` read SEED tolerantly, never throw | code review + the `.catch(() => undefined)` idiom (house-untested impure verb; logic = pure formatter + thin read) |
| fresh seed's steer input contains the one-line idea; no-SEED snapshot byte-identical | transitively by the formatter pin (present ⇒ section) + the absent pin; end-to-end by T-059-03 live drive |
| `bun run check:*` green | Step 5 (`bun run check`) |

Unit tests are the lever: the pure formatter owns the behavior (section emit + blank-as-
absent + byte-identical), so pinning it covers the substantive logic. The impure verbs are
a tolerant read + a pass-through, untested per the house purity rule (Research).

## Step 1 — Pure core: constant + field + formatter

**File:** `src/play/project-context.ts`

1. Add `export const SEED_PATH = "SEED.md";` beside `CHARTER_PATH`.
2. Add `readonly intent?: string;` to `SnapshotParts` with the doc comment.
3. In `buildProjectSnapshot`, compute `const intent = parts.intent?.trim();` and spread
   `...(intent ? ["## Stated intent (SEED.md)", "", intent, ""] : [])` after the title line,
   before `## Source modules`.
4. Add the one-sentence note to the function's house comment (deliberate exception to
   "names, not contents").

**Verify:** `bun run check:typecheck` compiles (the 4 non-wiring callers still satisfy
`SnapshotParts` since `intent` is optional). No behavior change yet for any live caller.

**Commit:** `feat(snapshot): buildProjectSnapshot gains optional intent section (T-059-01)`

## Step 2 — Pin the formatter (present / absent / blank)

**File:** `src/play/project-context.test.ts`

Add three tests to the `buildProjectSnapshot` describe block:

- intent present ⇒ `## Stated intent (SEED.md)` + verbatim content, positioned before
  `## Source modules` (assert index ordering).
- intent absent ⇒ no `Stated intent` substring; `buildProjectSnapshot(parts)` `===`
  `buildProjectSnapshot({ ...parts, intent: undefined })` (byte-identical for the absent
  case). The pre-existing 3-`(none)` test must still pass unchanged.
- blank intent (`"  \n "`) ⇒ no section (blank-as-absent).

**Verify:** `bun test src/play/project-context.test.ts` green (old + new tests). This step
is the AC-1 evidence and can be committed with Step 1 or separately.

**Commit:** `test(snapshot): pin intent-present/absent/blank cases (T-059-01)` (or fold
into Step 1's commit).

## Step 3 — Wire `assembleSteerInputs`

**File:** `src/play/steer.ts`

1. Add `SEED_PATH` to the `project-context.ts` import (line 31).
2. Add `readFile(join(root, SEED_PATH), "utf8").catch(() => undefined)` as the second
   element of the existing `Promise.all`, destructured as `intent`.
3. Pass `intent` into `buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent })`.
4. Update the doc comment (now also reads root SEED intent tolerantly).

**Verify:** `bun run check:typecheck`. `SteerInputs` shape is unchanged (`{ project,
charter }`), so no downstream type churn.

## Step 4 — Wire `assembleSurveyInputs`

**File:** `src/play/survey.ts`

Identical change to Step 3 (the bodies are byte-for-byte the same). Same import add, same
tolerant read, same `intent` pass-through, same doc-comment sentence.

**Verify:** `bun run check:typecheck`.

**Commit (Steps 3+4):** `feat(steer,survey): read root SEED.md intent into the snapshot (T-059-01)`

## Step 5 — Full gate

Run the real gate:

```bash
bun run check        # baml:gen (no-op) + tsc --noEmit + bun test
```

Confirm:
- `check:typecheck` clean.
- `check:test` green — the new formatter pins pass and **no existing test regressed**
  (especially the steer/survey effect + bridge tests and the existing project-context
  pins; the byte-identical invariant means nothing downstream sees a changed snapshot for
  no-SEED projects like vend itself).
- `baml:gen` produces no diff (no BAML change).

If any existing snapshot-shape test fails, that is a real signal the absent-case is not
byte-identical — fix the spread guard, do not edit the test.

## Step 6 — Manual spot-check (optional, free)

Confirm the wiring end-to-end without a metered cast by constructing the snapshot directly
(the live metered proof is T-059-03, out of scope here):

```bash
# a throwaway check that a SEED file flows into the snapshot string
bun -e 'import {buildProjectSnapshot} from "./src/play/project-context.ts";
  console.log(buildProjectSnapshot({root:"/x",srcFiles:[],stories:[],tickets:[],
  intent:"A team-finder for solo hackathon-goers"}))'
```

Expect the `## Stated intent (SEED.md)` section at the top. (Diagnostic only; not committed.)

## Rollback / risk

- The change is additive and gated on an optional field. The single risk is the byte-
  identical-absence invariant; Step 2's absent-case pin + the unchanged existing tests guard
  it directly. If those go red, the spread guard is wrong — a one-line fix.
- No data migration, no schema change, no BAML regen, no CLI surface change. Nothing to roll
  back beyond reverting the diff.

## Commit sequence (summary)

1. `feat(snapshot): buildProjectSnapshot gains optional intent section (T-059-01)` (+ tests)
2. `feat(steer,survey): read root SEED.md intent into the snapshot (T-059-01)`

Each commit independently typechecks and tests green.
