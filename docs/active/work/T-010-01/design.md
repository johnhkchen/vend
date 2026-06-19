# T-010-01 — Design: check-head-isolated-build

*Options, tradeoffs, the decision and its rationale — grounded in Research.*

## What must be decided

1. **Isolation mechanism** — how to get the committed HEAD into a clean tree.
2. **Pure/impure split** — what the unit-tested core classifies vs what the thin
   verb does.
3. **Integration-test fixture** — how to reproduce E-007's defect class *cheaply*
   (no real `bun install` / BAML addon / minutes-long run).
4. **Exit-code contract** — mapping build outcome → process exit.

---

## 1. Isolation mechanism

**Settled by E-010 boundary: git worktree, NOT Docker.** No re-litigation. The
only sub-choice is *how* to place and clean the worktree.

- **Chosen:** `mkdtemp` a parent under `tmpdir()`, then
  `git worktree add --detach <parent>/head HEAD`. git creates the `head`
  subdir (it must not pre-exist). Cleanup: `git worktree remove --force
  <parent>/head` then `rm -rf <parent>`, in a `finally`.
- *Rejected:* `git stash` + in-place build — pollutes the user's working tree,
  violates "isolation from the working tree," and is not crash-safe.
- *Rejected:* `git archive | tar -x` into a temp dir — loses the `.git` link, so
  `baml:gen`/tooling that may consult git breaks, and it re-materializes the tree
  with no object sharing. Worktree is purpose-built for exactly this.

`--detach` is essential: we check out HEAD's *commit*, not a branch, so the
worktree never collides with the branch already checked out in the main tree.

## 2. Pure / impure split (the E-008 doctrine, applied)

Mirror `committed-core.ts` (pure) + `check-committed.ts` (impure verb). The
question is *what genuine judgment* the pure core holds — it must be more than
`exitCode === 0`, or the split is theater.

The real logic is the **three-way classification** E-008 established: a run can
*pass*, *find a problem* (broken HEAD — the andon), or *fail to even check*
(env error — git missing, worktree add failed). That maps to exit `0/1/2`, and
the message text is part of the contract. That mapping is pure, total, and worth
testing in isolation.

**Decision:**

- **`head-build-core.ts` — PURE.** Input: a structured `BuildOutcome` describing
  *which step failed* (or none) + a detail string. Output: a `HeadVerdict`
  = `{ exitCode: 0|1|2, ok, message }`. Pure/total; no spawning. Unit-tested.
- **`check-head.ts` — IMPURE verb.** `if (import.meta.main)` entry + an exported
  `buildCommittedHead(opts)` that performs the worktree lifecycle + runs the
  build, returning a raw `BuildOutcome`. The entry feeds that to
  `classifyBuildOutcome`, writes the message, and `process.exit`s. Smoke-only
  for the entry; but `buildCommittedHead` IS exercised by the integration test
  (it is the unit under test there), so it takes injectable parameters.

Why split the *outcome* (data) from the *verdict* (decision): the impure verb
decides nothing — it reports "the build step exited non-zero." The pure core
decides "non-zero build step ⇒ exit 1, broken-HEAD message." A future caller
(T-010-02 hook) can reuse the same verdict mapping without re-deriving it.

*Rejected:* fold classification into the verb (one file, no core). Loses the
unit-testable seam and breaks the house pattern every sibling gate follows.

## 3. Integration-test fixture — reproducing E-007 cheaply

This is the design crux. AC#3 demands a **synthetic broken HEAD** where
`check:head` *fails*, and a clean HEAD where it *passes*, reproducing E-007's
class. The real repo is the wrong fixture: a real run = `bun install` + BAML
addon + `tsc` + `bun test`, far too slow/heavy for `bun test`, and would make
the test recurse into the whole suite.

**Decision: build a throwaway git repo on a real temp fs** (the
`propose-effect.test.ts` precedent), with a *cheap, self-contained* `check` that
faithfully reproduces E-007's defect class — **a committed file importing a
module that was not committed alongside it.**

Fixture shape:

```
<tmp-repo>/
  package.json   →  { "scripts": { "check": "bun run app.ts" } }
  app.ts         →  import "./dep.ts";  console.log("ok")
  dep.ts         →  (the dependency)
```

- **Broken HEAD:** commit `package.json` + `app.ts` but **NOT** `dep.ts` (the
  E-007 move: `cast.ts` committed without `play.ts`). `dep.ts` exists only in the
  working tree, uncommitted. An *in-place* `bun run check` passes (working tree
  has `dep.ts`); the *isolated worktree* build fails — `bun run app.ts` cannot
  resolve `./dep.ts`. → exit 1. The test asserts the in-place/isolated contrast,
  which IS the bug E-010 exists to close.
- **Clean HEAD:** commit all three files. Isolated build resolves the import →
  exit 0.

Crucially the synthetic `check` is `bun run app.ts` — **no `bun install`, no
deps, no BAML addon**. So `buildCommittedHead` must let the test (a) skip the
install step and (b) keep `bun run check` as the build command. The default real
entry runs `bun install` then `bun run check`; the test passes `install: null`.

*Rejected:* a synthetic `check` that just `exit 1` on a marker file — passes the
letter of AC#3 but does NOT reproduce "committed file importing a missing
module," so it would not prove the gate catches *E-007's* class. The
import-resolution fixture is faithful and still sub-second.

*Rejected:* run the gate against the real repo HEAD in CI only — out of scope
(that is verification after the loop, and T-010-02's trigger), and untestable in
`bun test`.

## 4. Exit-code contract (copied from E-008, extended)

| code | step that failed        | meaning |
|------|-------------------------|---------|
| `0`  | none                    | committed HEAD builds — gate passes |
| `1`  | `build` (install/check) | ANDON — HEAD does not build (E-007 class) |
| `2`  | `preflight` / `worktree`| environment error — couldn't check (git missing, not a repo, worktree add failed) |

`1` vs `2` preserves E-008's "found a problem" vs "couldn't check" so T-010-02's
hook can fail-open on `2` and block on `1`. The pure core owns this mapping and
the human-readable message for each.

## Decision summary

- Two new source files (`head-build-core.ts` pure, `check-head.ts` verb+entry),
  one new test (`head-build-core.test.ts`) covering the pure mapping **and** the
  integration scenario against a synthetic broken/clean HEAD.
- One `package.json` line: `"check:head": "bun run src/ci/check-head.ts"`.
- `buildCommittedHead` is parameterized (`root`, `install`, `check`) so the
  integration test drives it offline against a synthetic repo; the real entry
  uses defaults (`bun install` + `bun run check` at repo root).
- Worktree removed in a `finally` — every path, no leak.
