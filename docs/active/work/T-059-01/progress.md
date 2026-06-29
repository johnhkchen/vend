# T-059-01 — Progress

Implementation of the plan. All steps complete; the full gate is green.

## Status: COMPLETE — gate green

`bun run check` → `baml:gen` (no diff) + `tsc --noEmit` (clean) + `bun test` →
**1316 pass / 0 fail** (3742 assertions, 81 files).

## Steps executed

### Step 1 — pure core (project-context.ts) ✓
- Added `export const SEED_PATH = "SEED.md"` beside `CHARTER_PATH`.
- Added `readonly intent?: string` to `SnapshotParts` with the "deliberate exception"
  doc comment.
- `buildProjectSnapshot`: `const intent = parts.intent?.trim();` then spread
  `...(intent ? ["## Stated intent (SEED.md)", "", intent, ""] : [])` after the title,
  before `## Source modules`. Updated the function's house comment to note the exception.
- **Deviation from plan:** none.

### Step 2 — formatter pins (project-context.test.ts) ✓
Added three tests to the `buildProjectSnapshot` describe block:
- intent present ⇒ section + verbatim content, positioned before `## Source modules`.
- intent absent ⇒ no `Stated intent`; `buildProjectSnapshot(parts) ===
  buildProjectSnapshot({ ...parts, intent: undefined })` (byte-identical absent case).
- blank/whitespace intent ⇒ no section; identical to the no-intent snapshot.
The pre-existing pins (sections / sort / 3×`(none)`) pass unchanged — that unchanged pass
is itself the byte-identical guarantee in force.

### Step 3 — assembleSteerInputs (steer.ts) ✓
- Added `SEED_PATH` to the `project-context.ts` import.
- Added `readFile(join(root, SEED_PATH), "utf8").catch(() => undefined)` to the existing
  `Promise.all` (one concurrent batch, no added latency), destructured as `intent`.
- Passed `intent` into `buildProjectSnapshot({ root, srcFiles: [], stories, tickets, intent })`.
- Updated the doc comment (now also reads root SEED intent tolerantly — the E-059 wire).

### Step 4 — assembleSurveyInputs (survey.ts) ✓
Identical change to Step 3 (the two bodies remain byte-for-byte the same). Same import add,
tolerant read, `intent` pass-through, doc-comment sentence.

### Step 5 — full gate ✓
`bun run check` green (numbers above). `baml:gen` regenerated `baml_client/` with **zero
diff** (`git diff --stat baml_client/` empty) — confirms no BAML change, an AC.

## Acceptance-criteria check

- [x] `buildProjectSnapshot` emits `## Stated intent (SEED.md)` (verbatim) when `intent`
      present; **byte-identical** when absent — both unit-test-pinned (Step 2).
- [x] `assembleSteerInputs` / `assembleSurveyInputs` read root `SEED.md` tolerantly
      (`.catch(() => undefined)`, absent ⇒ no section, never throws) and thread it as `intent`.
- [x] A fresh hackathon seed's steer input now contains the seed's one-line idea (formatter
      emits the section when intent present); a project with no `SEED.md` (vend itself)
      produces a byte-identical snapshot (honest-empty preserved). No BAML change.
- [x] `bun run check:*` green.

## Notes for the reviewer / Lisa

- **Working-tree only — not committed.** Per the session's "Lisa handles the rest"
  instruction and the commit-only-when-asked rule, the code + artifacts are left in the
  working tree for Lisa to commit and advance. (Plan's suggested commit messages are in
  `plan.md` if Lisa commits on my behalf.)
- **Unrelated working-tree changes are Lisa's, not mine:** `docs/active/pm/staged/steer.md`
  and `docs/active/tickets/T-059-01.md` show as modified from concurrent Lisa activity
  (artifact detection / a staged steer). My change set is exactly: `src/play/project-context.ts`,
  `src/play/steer.ts`, `src/play/survey.ts`, `src/play/project-context.test.ts`, and
  `docs/active/work/T-059-01/`.
- **Out of scope (correctly untouched):** `src/init/init-core.ts` (T-059-02), the live
  re-drive + `EXPECTED-OUTCOME.md` (T-059-03), `baml_src/steer.baml` (no regen needed).
