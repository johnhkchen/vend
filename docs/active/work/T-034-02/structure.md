# T-034-02 — Structure: `check-history` sweep

The impure verb that turns T-034-01's pure core (`classifyHistory` + `boundRange`) into a runnable
backward audit. Mirrors the E-010 split exactly: `head-build-core.ts` (pure) ↔ `check-head.ts`
(impure verb); here `history-core.ts` (pure, done) ↔ `check-history.ts` (this slice).

## Files

### Modified — `src/ci/check-head.ts` (generalize the worktree builder)

`buildCommittedHead` today hardcodes two HEAD-isms: the `worktree add … HEAD` literal (line 69) and
nothing else commit-specific. Generalize to an arbitrary **commit-ish**, default `"HEAD"`, so
`check:head` is byte-for-byte unchanged in behaviour and the sweep can build any sha.

- `HeadBuildOptions` gains one optional field:
  ```ts
  /** The commit-ish to materialize in the worktree. Default "HEAD" — keeps check:head unchanged. */
  commitish?: string;
  ```
- In `buildCommittedHead`: `const commitish = opts.commitish ?? "HEAD";` and pass it to
  `git … worktree add --detach <worktree> <commitish>` in place of the `"HEAD"` literal.
- The temp prefix `vend-head-` stays as-is. It is not HEAD-specific in any load-bearing way (only the
  existing tests reference it, and only to assert *absence* after cleanup), and renaming it would be
  churn with no caller benefit. Documented in the function comment so the next reader isn't surprised.
- **Back-compat contract:** `commitish` defaults to `"HEAD"`, so every existing call
  (`buildCommittedHead({ root })`, the `import.meta.main` smoke block, and all five
  `head-build-core.test.ts` integration cases) is unchanged. AC#2 ("check:head unchanged, its tests
  stay green") is satisfied by construction.

Caller audit (confirmed before widening — the codebase-memory `CALLS buildCommittedHead` query intent):
`buildCommittedHead` is called from exactly (1) `check-head.ts` `import.meta.main`, (2)
`head-build-core.test.ts` (×6), and after this slice (3) `check-history.ts`. No other call sites.
Widening a signature with a defaulted optional breaks none of them.

### Created — `src/ci/check-history.ts` (the thin impure verb)

Header comment in the `check-committed.ts` / `check-head.ts` register: states the CENTRAL RULE (logic
is in `history-core.ts`; this is the trigger), the E-034 place in the commit-discipline frame
(backward audit complement to E-033's forward gate), the EXIT VOCABULARY, and why it runs on the host
(needs the real `.git` object store for worktrees). Three exported/private parts plus an
`import.meta.main` block:

1. `resolveRange(root, rangeArg?)` → `{ shas: string[] } | { error: string }` — IMPURE. Runs
   `git -C <root> rev-list <range>` where `<range>` is the caller's arg or the default token.
   Returns the ordered sha list (newest-first, as `rev-list` emits) or an environment error.
2. `sweepCommits(opts)` → `Promise<CommitResult[]>` — the **integration seam** (the role
   `buildCommittedHead` plays for `check-head`). For each sha, in order: resolve its subject via
   `git log -1 --format=%s <sha>`, build+test it via the generalized `buildCommittedHead`, then flatten
   the `BuildOutcome` through `classifyBuildOutcome` into a `history-core` `CommitResult`
   (`green = verdict.ok`, `summary = verdict.ok ? undefined : verdict.message`). Sequential — the
   ticket's stated non-goal is parallelism. Accepts `install`/`check` overrides so the test can pass
   `install: null` and stay offline/sub-second.
3. `import.meta.main` — wire it: `resolveRange` → `boundRange` (loud note) → `sweepCommits` →
   `classifyHistory` → print the bound note + report → `process.exit`.

Public surface (importable by the test): `resolveRange`, `sweepCommits`, plus a `HistorySweepOptions`
interface. The `import.meta.main` block is smoke-only (like its siblings), proven by the live AC#3 run.

### Modified — `package.json`

Add one script alongside the other `check:*` entries:
```json
"check:history": "bun run src/ci/check-history.ts",
```
Invoked as `bun run check:history [<range>]`; the trailing arg flows through `bun run` to
`process.argv`.

### Created — `src/ci/check-history.test.ts`

The integration proof, in `head-build-core.test.ts`'s shape: a synthetic multi-commit repo
(`git init`, several commits, one deliberately red), driven through `sweepCommits` with `install: null`
and a pure-Bun `check`, asserting the resulting `CommitResult[]` (and `classifyHistory` over it) flags
the red commit and names its failure, and that a green range reports clean. No network, sub-second.
The pure verdict/bound logic is already covered by `history-core.test.ts` — this file owns only the
git-and-worktree integration that the pure tests deliberately don't touch.

## Data flow (the wired `import.meta.main`)

```
argv range? ──► resolveRange ──► allShas ──► boundRange(allShas,{max,widenHint})
                   │ err→exit 2                     │
                   ▼                                 ▼ {covered, note}
            (git rev-list)                    print note (always)
                                                     │
                                          sweepCommits(covered) ──► CommitResult[]
                                                     │  (per sha: buildCommittedHead → classifyBuildOutcome)
                                                     ▼
                                          classifyHistory ──► {anyRed, report}
                                                     │
                                          print report; exit anyRed ? 1 : 0
```

## Exit vocabulary (sibling-consistent)

- `0` — clean: every covered commit test-green, OR honest-empty range ("no commits in range").
- `1` — ANDON: at least one covered commit is red (`anyRed`). The audit's reason to exist.
- `2` — environment error: `git rev-list` failed / not a repo (couldn't run the audit). Kept distinct
  from a red commit, same as `check:committed` / `check:head`.

## Default range

No-arg default token: **`HEAD`**. `git rev-list HEAD` yields all reachable commits newest-first;
`boundRange` then caps to `DEFAULT_HISTORY_MAX` (100) most-recent and states the cap loudly when it
bites. This is the "sensible bound / last-N" the ticket calls for — `main..HEAD` would be empty on
`main` itself, so last-N is the right default. The `widenHint` surfaced in the note echoes the
caller-facing knob (`check:history <older-range>`).

## Ordering of changes

1. Generalize `buildCommittedHead` (+ its doc) — isolated, `check:head` tests still green.
2. Write `check-history.ts` (`resolveRange`, `sweepCommits`, `import.meta.main`).
3. Add the `check:history` script.
4. Write `check-history.test.ts`; `bun test` green.
5. Live AC#3 proof over a range containing `3dfb95f`; `bun run check:*` green.

## Non-goals (ticket-stated)

Parallelism (sequential is fine), incremental caching of built worktrees, and any change to
`check:head`'s observable behaviour. Cost is acknowledged: each commit ≈ worktree + install + build;
this is a periodic/CI audit, not the hot path.
