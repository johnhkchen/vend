# T-058-05 — Plan: the drive, step by ordered step

Each step is independently verifiable; the free steps (1–5) gate the metered steps (6–8). "Verify"
is the concrete assertion that decides pass/continue vs stop-and-record.

## Step 0 — Build the `vend` invocation

Vend has no installed binary; it runs from source. The drive invokes it from the **repo** against the
**sandbox cwd**:

```
( cd "$SANDBOX" && bun run /Volumes/ext1/swe/repos/vend/src/cli.ts <args> )
```

All vend gestures resolve `process.cwd()` as the project root (init/steer/work/svg), so running with
the sandbox as cwd is correct. **Verify:** `bun run …/src/cli.ts doctor` prints the doctor report
(proves the entry resolves before we depend on it).

## Step 1 — Create the sandbox

```
SANDBOX=$(mktemp -d "$TMPDIR/vend-seed-drive-XXXX")
cp -R examples/templates/hackathon-seed/. "$SANDBOX/"
rm -rf "$SANDBOX/node_modules" "$SANDBOX/.astro" "$SANDBOX/.vend"
mkdir -p "$SANDBOX/drive-logs"
```

**Verify:** `$SANDBOX/SEED.md` contains "team-finder"; no `docs/` dir yet; committed template
unchanged (`git status --porcelain examples/` empty).

## Step 2 — Make it a lisa project

Try `lisa init` non-interactively; if it needs a TTY, fall back to creating the markers directly
(`.lisa.toml` + a minimal `CLAUDE.md`) — `isLisaProject` accepts **either** marker (init-core.ts:47).
**Verify:** `isLisaProject` precondition holds ⇒ Step 3's init will not refuse `not-lisa`.

## Step 3 — `vend init --template hackathon`  (free)

```
( cd "$SANDBOX" && bun run …/src/cli.ts init --template hackathon )
```

**Verify:** exit 0; stdout `vend init: scaffolded --template hackathon — N created, M skipped`;
`SEED.md` is in **skipped** (no-clobber held — the rich seed survived); `docs/active/demand.md`,
`docs/active/pm/staged/`, `docs/knowledge/charter.md` were **created**. Also assert
`docs/active/demand.md` has **zero** demand rows (honest-empty: `countDemandRows == 0`).

## Step 4 — `vend doctor`  (free, the spend gate)

```
( cd "$SANDBOX" && bun run …/src/cli.ts doctor ); echo "exit=$?"
```

**Verify:** exit 0 and every check `✓` (lisa, claude, BAML, executor:claude). **If red ⇒ STOP:**
record the unfit-env finding in EXPECTED-OUTCOME, skip all metered steps, jump to Step 9 with the
honest "drive could not run here" outcome. No tokens spent.

## Step 5 — `vend svg` on the empty board  (free)

```
( cd "$SANDBOX" && bun run …/src/cli.ts svg )
```

**Verify:** exit 0; stdout `wrote .../.vend/work-graph.svg — …`; the file exists and is valid SVG
(`<svg` present). This is the designer's view existing **pre-drive** (the honest-empty board renders)
— the AC3 end-to-end confirmation that the visual path works, independent of the metered cast.

## Step 6 — `vend steer` (METERED) — background + poll

```
( cd "$SANDBOX" && bun run …/src/cli.ts steer --budget 600000,150000 ) \
   >"$SANDBOX/drive-logs/steer.log" 2>&1   # run_in_background
```

Poll the log / process until the cast settles or its 10-min budget timeout fires. **Verify on
success:** stdout `run …: success (materialized: true)`; `docs/active/pm/staged/steer.md` exists with
a ranked board + ≥1 fork; `.vend/runs.jsonl` has a steer record. **Capture:** board-item count, fork
count + one verbatim fork, the cast's token/ms cost.

**Honest branches:**
- *gate-failed andon* (read-never-invent / fork-genuineness / weak board) → record the **A3
  weak-board finding** (the seed/charter need tuning); still capture the staged output verbatim.
- *executor error* (auth/spawn/rate) → record **executor-unavailable**; proceed to Step 9 with the
  free evidence (Steps 1–5) as the captured result.

## Step 7 — `vend svg` on the populated board  (free, only if Step 6 staged a board)

Re-run `vend svg`. **Verify:** the work-graph now reflects the staged board (more cards/links than
the empty render). This is the designer's *populated* view — AC3 confirmed end-to-end against real
data.

## Step 8 — `vend work` (METERED) — background + poll  (only if Step 6 staged a board)

```
( cd "$SANDBOX" && bun run …/src/cli.ts work --budget 900000,250000 --no-intervened ) \
   >"$SANDBOX/drive-logs/work.log" 2>&1   # run_in_background
```

Poll until settled. **Verify on success:** the receipt prints (cleared ≥ 1 / per-cast cost /
remaining / stop reason); `.vend/runs.jsonl` gained propose-epic + decompose-epic records carrying
`intervened:false` (the **forward-E1** record). **Capture:** slices cleared, real budget spent
(summed from the receipt), forward-E1 = yes.

**Honest branches:** `no-board`/`empty-board`/`stale-board` (a clean refusal) or `cleared: 0` (budget
too tight / weak board) → record the exact outcome; ≥1 cleared is the AC, 0-cleared with a real
record is still an honest captured result (note why).

## Step 9 — Capture the gold master

Edit `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md`:
- reframe the banner (CAPTURED on 2026-06-21, host/executor, sandbox path, exact commands);
- fill the table "Actual (live)" column from Steps 6/8;
- replace the notes placeholder with the verbatim fork sample, the staged-board summary, the cleared
  slice (or the honest finding), and the SVG note;
- append the **Verdict** (A3 call + charter-path observation + the re-run command block).

**Verify:** no `FILLED BY T-058-05` placeholder remains; the file reads as a captured, re-runnable
master; `git status` shows only `EXPECTED-OUTCOME.md` (+ the work dir) changed under the repo.

## Step 10 — Guard vend's own gate

```
bun run check        # or check:test + check:typecheck
```

**Verify:** green and unchanged from pre-drive (this ticket adds only markdown; `tsconfig`
`include:["src"]` makes the suite inert to it — the T-058-03/04 precedent).

## Testing strategy

- **No unit tests** — there is no code to test; the deliverable is a captured artifact. The correct
  gates are: the per-step `Verify` assertions above (real CLI exit codes + output), the honest-empty
  check at Step 3, and vend's unchanged suite at Step 10.
- **Re-runnability** is the consistency test the master itself encodes: the exact command block in
  EXPECTED-OUTCOME lets a future run reproduce a *comparable* board/slice. That is the product-level
  verification this ticket exists to seed.

## Commit

One commit at the end (after Review): the captured `EXPECTED-OUTCOME.md` + the work-dir RDSPI trail.
Message: `feat(examples): gold-master live drive captured into hackathon-seed EXPECTED-OUTCOME
(T-058-05)`. Do not edit ticket frontmatter — Lisa advances phases from these artifacts.
