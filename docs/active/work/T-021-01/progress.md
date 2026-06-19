# T-021-01 — Progress: read-only-graph-model-loader

_Implementation tracking against `plan.md`. All six plan steps complete._

## Done

| Step | What | Result |
|---|---|---|
| 1 | `model.ts` types + error classes | `RawNode`, `Ticket/Story/EpicNode`, `AnyNode`, `WorkGraph`; `GraphParseError`, `GraphIntegrityError`. tsc clean. |
| 2 | `parseFrontmatter` + `epicIdForStory` + coercers | Fence regex + `Bun.YAML.parse`; convention fn; `str`/`text`/`optStr`/`strArray`. |
| 3 | `buildGraph` + `deepFreeze` | Full D5 ordering: coerce → dup guard → derive `blocks` → link (objects) → collect-all-violations → throw → sort/index/freeze. |
| 4 | `load.ts` impure verb | `loadWorkGraph(opts?)`; per-dir `readdir`/`readFile`, ENOENT→[], skips `TEMPLATE.md` + id-less files. No write imports. |
| 5 | `model.test.ts` (pure) | parsing, convention, happy linkage, derived `blocks`, 6 integrity cases, 2 coercion cases, **frozen/read-only AC**. |
| 6 | `load.test.ts` (impure) + full check | temp-dir round-trip (TEMPLATE + id-less skipped, missing-dir tolerated) + live-board smoke. |

## Verification

- `bun run check` green: **610 pass / 0 fail** (1474 expect calls), up from ~586 — my two
  files add 24 tests. tsc `--noEmit` clean. `baml:gen` clean.
- Live-board smoke loads the real `docs/active/**` (21 epics / 26 stories / 61 tickets) without
  throwing; `T-021-01`→`S-021-01`→`E-021` chain resolves; every authored edge resolves into
  `byId`.

## Files created

- `src/graph/model.ts` — pure core (types, parse, build, freeze, errors).
- `src/graph/load.ts` — impure loader verb (the only fs-touching file; read-only imports).
- `src/graph/model.test.ts`, `src/graph/load.test.ts`.

No existing files modified or deleted.

## Deviations from plan

None of substance. Two clarifications worth recording:

1. **`Bun.YAML` is fully typed** under `@types/bun` 1.3.9 — no cast was needed (the plan
   flagged this as a low risk; it did not materialize).
2. **`text()` coercer added** for the epic `serves:` field (not enumerated as a named helper in
   the plan): `serves` is descriptive prose, tolerated-absent → `""`, distinct from the
   structural `str()` fields that must be present. A small, in-spirit addition.

## Not committed

Per the task instruction ("simply stop — Lisa handles the rest") the working tree is left
staged-but-uncommitted for Lisa's commit/transition handling. The four new `src/graph/*` files
plus the work artifacts are the deliverable.
