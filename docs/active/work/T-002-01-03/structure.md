# T-002-01-03 — Structure: verify-no-drift

*The blueprint. For a spike the "structure" is the set of files touched (almost
none, durably) and the structure of the **evidence** produced. No production code
shape changes — the gate already exists.*

## Files created / modified / deleted

| Path | Disposition | Lifetime | Notes |
|------|-------------|----------|-------|
| `docs/active/work/T-002-01-03/research.md` | created | durable | RDSPI |
| `docs/active/work/T-002-01-03/design.md` | created | durable | RDSPI |
| `docs/active/work/T-002-01-03/structure.md` | created | durable | this file |
| `docs/active/work/T-002-01-03/plan.md` | created | durable | RDSPI |
| `docs/active/work/T-002-01-03/progress.md` | created | durable | RDSPI — holds the run evidence |
| `docs/active/work/T-002-01-03/review.md` | created | durable | RDSPI — handoff |
| `<repo-root>/<scratch>.test.ts` | created **then deleted** | **ephemeral** | the deliberate break (P2); never committed |

**No changes** to: `ci/src/test.ts`, `ci/src/index.ts`, `ci/dagger.json`,
`ci/package.json`, `ci/tsconfig.json`, `package.json`, any `baml_src/*`, any real
`*.test.ts`. The gate is exercised, not edited. The only non-doc filesystem event
is the scratch test's create→delete, fully inside Implement.

## The scratch break — exact shape

A new file at the **repo root** (where `bun test` discovers it), named to be
unmistakable in `git status` and to sort away from real suites:

```
# path: zz-drift-can-fail.test.ts   (root; matches bun's *.test.ts glob)
import { test, expect } from "bun:test"

// T-002-01-03 P2 scratch — proves the gate CAN fail. Deleted within the spike.
test("DELIBERATE FAILURE — verify-no-drift can-fail proof", () => {
  expect(true).toBe(false)
})
```

Rationale recap (Design D3): a standalone new failing test is unambiguous, cannot
corrupt a real test's intent, fails as a **test** (red suite) rather than a build
error, and reverts with a single `rm`. The `zz-` prefix and the `.test.ts` suffix
ensure `bun test` picks it up while a human sees instantly it is scratch.

> The container mount `ignore` list is `["**/node_modules", "baml_client",
> ".git"]` — it does **not** exclude `*.test.ts` at the root, so the scratch file
> *is* mounted into the container and the gate *will* see it. (If it were ignored,
> P2 in-container would be a false negative — checked here deliberately.)

## Evidence structure (what `progress.md` will hold)

The durable output of a spike is the evidence table. `progress.md` is structured as:

1. **Environment snapshot** — `docker info` up, `dagger version` == pin, HEAD SHA,
   engine warm/cold state at start.
2. **P1 — agreement (green tree):**
   - standalone: `bun run check:test` → exit code, pass/fail tally, wall-time.
   - container: `dagger call test run` (record exact invocation incl. any
     `--source=.` fallback) → exit code, tally as seen in stdout, wall-time,
     cold-start `connect` time if observable.
   - verdict-equality statement (Design D2).
3. **P2 — can-fail (broken tree):** introduce scratch test → standalone red →
   container red → `rm` scratch → `git status` clean → standalone green again.
4. **P3 — separateness + timing:** boundary greps (empty), `@dagger.io/dagger`
   absent from `package.json`s, `ci/sdk` gitignored; cold-start + run-time numbers
   collected into one short paragraph.
5. **Deviations** — anything that differed from Plan (e.g. needed `--source=.`,
   prep tuning), with rationale.

## Ordering that matters

1. **Green-tree proofs (P1) before the break (P2).** Establish agreement on a
   known-good tree first; only then introduce failure. Reversing the order risks
   conflating "the gate is broken" with "the tree is broken."
2. **Revert the break before the timing/boundary writeup (P3)** and before any
   commit — clean tree is an exit condition; do it as early as the proof allows.
3. **Boundary greps can run anytime** (they are static), but record them after the
   dynamic proofs so the evidence reads green-tree → can-fail → separateness.
4. **Commit (if any) last** — RDSPI artifacts only; the working tree must show no
   scratch file and no `ci/` or app-source change.

## Interfaces / contracts touched

None changed. The contract under test is the **command surface** `bun run
check:test` and the **CLI leaf** `dagger call test run`. The spike reads these
contracts; it does not alter them. The `Test.run(source)` signature, the router
`Ci.test()`, the engine pin — all unchanged and re-verified, not redefined.
