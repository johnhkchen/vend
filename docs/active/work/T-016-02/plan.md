# T-016-02 — Plan

Ordered, independently-verifiable steps with commit boundaries. Each step ends green
(`bun run check`). Testing strategy follows the offline, addon-free discipline.

## Step 1 — The addon-free effect (`expand-effect.ts`) + its test

**Do.** Create `src/play/expand-effect.ts`: `STAGING_DIR`, `ExpandFragmentInputs`, pure
`slugify` + `renderStagedSignal`, and `expandFragmentEffect` (mkdir + writeFile under
`docs/active/pm/staged/<slug>.md`, returns `{ok, detail, artifacts:[path], produced:path}`).
Imports BAML **type-only**; value-imports only `renderSignalRow` (pure) + `node:fs`/`node:path`.

Create `src/play/expand-effect.test.ts` with the **effect** block + the **slugify** block
(the `clear → classify` block lands in Step 3 once the gate wiring is exercised — or include now,
since `clear` already exists from T-016-01). Include all three blocks now: `clear`, `classify`,
`renderSignalRow`, `STAGING_DIR`, `expandFragmentEffect` all already-or-now exist.

**Verify.** `bun test src/play/expand-effect.test.ts` green; the effect writes only under
`pm/staged/`, `produced == artifacts[0]`, the file carries the row + pull string; honest-empty and
ungrounded signals classify `gate-failed` with the right gate name; slug pins hold.
`bun run check:typecheck` green.

**Commit.** `feat(expand): staging effect — pm-desk write + demand-row render (T-016-02)`.

## Step 2 — The shell (`expand-fragment.ts`): Play + register + cast

**Do.** Create `src/play/expand-fragment.ts`: `PLAY`, `RunSummary` re-export, `EMPTY_SIGNAL`,
`parseExpandFragment` (try/catch → empty), `expandFragmentPlay` (six members + `card`),
`registry.register(expandFragmentPlay)`, `ExpandFragmentOptions`, `assembleExpandFragmentInputs`,
`castExpandFragment`. Value-imports `b` — so **no** test imports this module.

**Verify.** `bun run baml:gen` (ensure `b.request.ExpandFragment` / `b.parse.ExpandFragment` /
`Signal` resolve), then `bun run check:typecheck` green — the play satisfies `Play<ExpandFragmentInputs,
Signal>`, `card satisfies Card`, the `gates` closure matches `ExpandClearContext`. A registration
smoke (optional, manual): `bun -e 'import("./src/play/expand-fragment.ts").then(() => …)'` —
deferred to Step 4's live check; typecheck + the no-dup registry is the structural proof here.

**Commit.** `feat(expand): register expandFragmentPlay — shell + cast verb (T-016-02)`.

## Step 3 — The gesture (`cli.ts`) + parse tests

**Do.** Extend `src/cli.ts`: `USAGE` line, `ParsedCommand` `expand` arm, `parseExpandArgs`,
`parseArgs` dispatch, and the `import.meta.main` `expand` arm (lazy-import the shell, default budget
to `expandFragmentPlay.budget`, print the run summary, map outcome → exit code). Append `expand`
parse tests to `src/cli.test.ts` mirroring the `chain` block.

**Verify.** `bun test src/cli.test.ts` green (the new `expand` pins + every prior parser unchanged);
`bun run check:typecheck` green. `vend expand` with no args prints usage + exits 2 (pure-parser
assertion, no dispatch).

**Commit.** `feat(expand): vend expand gesture — one-gesture fragment → staged signal (T-016-02)`.

## Step 4 — Full gate + progress/review

**Do.** `bun run check` (baml:gen → typecheck → test) over the whole suite; confirm no regression
and the new tests counted. Record the delta in `progress.md`; write `review.md`. The **live cast**
(`vend expand "<a real rough fragment>"` → a real staged file under `docs/active/pm/staged/`) is the
human verification at sweep (AC#4) — note it as the handoff, do not run a billed model in CI.

**Verify.** `bun run check` → all green, test count up by the new pins, 0 failures. `git status`
shows only the four intended source files + the work artifacts (and the lisa-touched ticket).

**Commit.** Folded into Step 3's commit if small, else `chore(expand): T-016-02 progress + review`.

## Testing strategy (what proves what)

| AC | Proof | Where |
|---|---|---|
| `expandFragmentPlay` registered; `castExpandFragment` casts it | typecheck (`Play<…>` + `satisfies Card`) + self-register at load; live cast at sweep | Step 2 / Step 4 |
| `vend expand "<fragment>"` casts; success stages a structured signal; refusal halts with an andon | `cli.test.ts` parse pins + the `clear → classify` honest-empty/ungrounded STOP block | Step 3 / Step 1 |
| a fixture proves fragment → staged signal end to end; effect writes to staging, not the board | `expand-effect.test.ts` temp-dir effect (asserts `pm/staged/` path; no `demand.md`/board write) | Step 1 |
| `bun run check:*` green | full-suite run | Step 4 |

## Risks / mitigations

- **`b.parse.ExpandFragment` rejects an empty-but-valid abstention reply.** Mitigated by D6 — the
  parse closure catches the throw → `EMPTY_SIGNAL`; honest-empty STOPs cleanly. Pinned offline in
  the existing `expand.test.ts` (garbage → reject) + the new clear→classify block.
- **Slug collision overwrites a draft.** Intended (D3, idempotent staging); documented in the
  effect header so it is not mistaken for a bug.
- **Addon leak into a bun-test process.** Mitigated by the standing discipline: every BAML import in
  tests is type-only; the shell is never test-imported. Verified by the suite staying non-flaky.
- **CLI budget default needs the play value on the impure path.** Mitigated by lazy-importing
  `expandFragmentPlay` alongside `castExpandFragment` in the dispatch arm (addon stays off the
  pure-parse path).
