# T-056-02 — Progress: blocked-flag-on-projection-link

## Status: implementation complete, all gates green

## Steps executed (per plan.md)

### Step 1 — IR type + producer (src/present/project.ts) — DONE
- Added `readonly blocked: boolean` to `ProjectionLink` (with doc comment tying it to
  E-056 edges-as-payload and the no-new-authority discipline).
- In `buildLinks`, hoisted `const blocked = stateKey(t) !== "done";` above the inner
  `dep` loop and attached `blocked` to each pushed link. `stateKey` was already imported.
- Extended the `buildLinks` doc comment to explain the derivation (`from` is the loop
  ticket `t`; the flag is a per-source property, hence the hoist).

### Step 2 — existing assertion update (project.test.ts:117) — DONE
- The single cross-story link's `from` is T-002-01 (`open`) → updated the expected
  literal to include `blocked: true`, with an explanatory comment.

### Step 3 — focused AC describe block — DONE
- Added `describe("projectGraph — blocked flag (edges-as-payload; T-056-02)")` with a
  local `blockedGraph()` (A done→B done = blocked:false; C open→B = blocked:true), kept
  separate from `miniGraph()` so existing assertions stay byte-unchanged. Four tests:
  blocked:true polarity, blocked:false polarity, authority guard (graph.tickets ref
  unchanged + frozen), determinism (links toEqual on repeat).

### Step 4 — gates — DONE
- `bun test src/present/project.test.ts`: 17 pass / 0 fail (was 13; +4 new).
- `bun run build` (tsc --noEmit): clean, no type errors. The required new field broke no
  downstream consumer (confirmed: only `as-unknown` casts and structural `.links` reads).
- `bun test` (full suite): **1278 pass / 0 fail** across 81 files — includes the
  authority-guard and one-way-authority suites, all green.

## Deviations from plan

- **No `lint` step.** package.json has no `lint` script; the canonical gate is
  `bun run check` (= `check:typecheck` + `check:test`), both run and green. No deviation
  in substance — the format/lint intent is covered by the typecheck gate.
- Otherwise implemented exactly as planned. The local-graph approach (vs. mutating
  `miniGraph`) was the pre-chosen option in structure.md/plan.md and held.

## Commit

`feat(present): blocked flag on ProjectionLink — status-derived edge decision weight (T-056-02)`
(committed after all gates green).
