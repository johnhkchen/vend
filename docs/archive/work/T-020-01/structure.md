# T-020-01 — Structure: file-level blueprint

The shape of the changes (not the code). **One source edit**, **one fixture file**, **one fixture
directory tree**, plus the RDSPI artifacts. Everything additive and local to the target table +
dispatch.

## Files

### NEW — `docs/active/work/T-020-01/fixtures/thin-fragment.txt`

The vacuous expand fragment (design D3). One short, grammatical-but-empty imperative that grounds no
demand and cites nothing — the negative-control sibling of `T-019-02/fixtures/grounded-fragment.txt`.
Plain text, single line (matches the grounded fixture's `.txt` shape; the harness `.trim()`s it).

### NEW — `docs/active/work/T-020-01/fixtures/thin-board/` (the saturated tiny project, design D4)

A self-contained mini-repo the survey-thin target copies in as the seeded project:

```
fixtures/thin-board/
  docs/knowledge/charter.md            # thin charter: a frozen, finished, single-purpose tool
  docs/active/stories/S-900-01.md      # one DONE story (everything captured)
  docs/active/tickets/T-900-01.md      # one DONE ticket under it
```

- **charter.md** — the value function survey reads its demand gradient against. Deliberately thin:
  one purpose line, scope marked **complete & frozen**, no open problems, no further ambition. Valid
  frontmatter-free prose is fine (survey reads it as a raw string). It must NOT carry `P#`/`N#`
  invariant ids that read as unmet demand.
- **stories/tickets** — minimal, `status: done`, so `listIdsIn` reports a board that already fully
  captures the tiny product. The ids use a `9xx` block (`S-900-01`, `T-900-01`) to avoid colliding
  with the live board's id space (the `E-900`/`E-901` convention from `T-002-04/fixtures`).

The honest read of "frozen, finished, fully-captured" is an **empty board** ⇒ the survey marker.

### MODIFIED — `src/probe/run-consistency-probe.ts` (the only source edit)

Additive, local to the seeding helpers + target table + dispatch. Edits, in order:

1. **Fixture path constants** (near `RUNS_DEFAULT`):
   ```ts
   const THIN_BOARD_DIR = "docs/active/work/T-020-01/fixtures/thin-board";
   const THIN_FRAGMENT_PATH = "docs/active/work/T-020-01/fixtures/thin-fragment.txt";
   ```
   Relative to `process.cwd()` (the live repo root), exactly as the grounded sweep references its
   fixture by repo-relative path.

2. **Parameterize the two seed helpers** with a source root (default = `process.cwd()`), so the thin
   target can seed from the fixtures dir instead of the live repo. Backward-compatible — existing
   callers pass nothing:
   ```ts
   async function seedCharter(root: string, srcRoot = process.cwd()): Promise<void>   // cp <srcRoot>/CHARTER_PATH
   async function seedBoardSnapshot(root: string, srcRoot = process.cwd()): Promise<void>  // cp <srcRoot>/docs/active/{stories,tickets}
   ```
   `surveyTarget`'s inline board copy is refactored to call `seedBoardSnapshot` (it currently inlines
   the same loop) so the thin target and the grounded target share one seeding path — the existing
   `seedBoardSnapshot` helper already exists for exactly this (it was factored in T-019-02 for the new
   targets); survey just predates it.

3. **`surveyThinTarget(): ProbeTarget`** — identical to `surveyTarget()` except `seed` sources the
   charter + board from `THIN_BOARD_DIR`:
   - `play: surveyPlay`
   - `seed: async (root) => { await seedCharter(root, THIN_BOARD_DIR); await seedBoardSnapshot(root, THIN_BOARD_DIR); }`
   - `assemble`, `outputDirs`, `isAbstention` — **identical** to `surveyTarget` (same play, same
     marker; the only variable is the input root). `subject: (root) => "survey-thin of " + basename(root)`.

4. **`expandThinTarget(): Promise<ProbeTarget>`** — the existing `expandTarget` builder applied to the
   fixed thin fragment (design D2/D3). Reads the thin fragment from `THIN_FRAGMENT_PATH` and returns
   `expandTarget(fragment)` with a `subject` override of `"expand of thin fragment"` (so the run log
   distinguishes it from the grounded arm). Seeds the **real** charter + live board (unchanged from
   `expandTarget`), isolating the fragment as the only variable.
   - Simplest form: `resolveTarget`'s `expand-thin` case does
     `expandTarget((await readFile(join(process.cwd(), THIN_FRAGMENT_PATH), "utf8")).trim())` — reusing
     the existing builder with no new builder function, mirroring how the `expand` case builds from a
     CLI path. The subject is cosmetic; the existing `"expand of grounded fragment"` is acceptable, or
     a tiny tweak to label it. Keep it minimal: reuse `expandTarget` directly.

5. **`resolveTarget`** — two new cases (input-less, like `survey`/`steer`):
   ```ts
   case "survey-thin":  return surveyThinTarget();
   case "expand-thin":  return expandTarget((await readFile(join(process.cwd(), THIN_FRAGMENT_PATH), "utf8")).trim());
   ```
   Both ignore `srcInputPath` (the fixture path is fixed) — so the CLI's "first numeric positional is
   N" branch (the existing `inputIsNumeric` logic) already handles them with no parser change.

6. **`SUPPORTED`** — append the two names:
   ```ts
   const SUPPORTED = ["decompose-epic", "survey", "expand", "steer", "survey-thin", "expand-thin"] as const;
   ```

### NEW — RDSPI artifacts under `docs/active/work/T-020-01/`

`research.md`, `design.md`, `structure.md`, `plan.md`, `progress.md`, `review.md`.

## Module boundaries / interfaces (unchanged)

- `ProbeTarget` interface — unchanged. The new targets are ordinary members; `survey-thin` reuses
  `surveyTarget`'s `isAbstention` (the `"no demand staged"` marker), `expand-thin` reuses
  `expandTarget`'s `emptyOutput` default (honest-empty read off the raw tally — design D5).
- `consistency.ts` pure core — **untouched**. Same `ProbeOutcome` buckets, same `consistencyReport`.
- `run-probe.ts` — **untouched** (inherited AC).
- No new exports leave the harness; no other module imports it.

## Ordering of changes (where it matters)

1. Fixtures first (`thin-fragment.txt`, `thin-board/` tree) — the harness constants point at them; the
   probe run needs them present.
2. Harness edit (constants → seed-helper params → `surveyThinTarget` → `resolveTarget` → `SUPPORTED`).
3. `bun run check` green (typecheck sees the new target; tests unaffected).
4. The verifying probe run (live casts) — last, since it depends on 1–3.

## Risk / failure modes (carried into the plan)

- **Model stages a signal on thin survey input** (cold-start eagerness) → not honest-empty. Mitigation:
  fixture is *frozen/complete/saturated*, not blank (D4). If it still signals, that is itself a finding
  the negative control is designed to surface — record it honestly (IA-8), do not force the fixture.
- **`lisa init` overwrites the seeded charter.** `initLisaProject` runs *before* `target.seed`
  (`main`: `seedTempRoot()` then `target.seed`), and the existing grounded `surveyTarget` already seeds
  its charter post-init successfully — so the order is safe. Verify the thin charter actually lands
  (not clobbered) during the run.
- **Id collision** between the thin board's `9xx` ids and the live board — avoided by the `9xx` block;
  the temp root is disposable regardless.
