# T-020-03 — Structure: recalibrate-survey-honest-empty

> The blueprint — file-level changes and exact shape of the edits, not the code. Implements the
> Option C decision from `design.md`: a prompt-only recalibration of `baml_src/survey.baml`.

## Files touched

| File | Change | Why |
|---|---|---|
| `baml_src/survey.baml` | **Modify** — rewrite the `## Honest-empty (IA-4)` prompt section; tighten the `Board.signals` `@description` | The model's abstention decision lives here (design Option C) |
| `baml_client/**` | **Regenerated** (not hand-edited, gitignored) | `bun run baml:gen` output; carries the new descriptions into the typed client |
| `docs/active/work/T-020-03/sweep-logs/{survey,survey-thin}.log` | **Create** | Live-probe AC evidence (Implement phase) |

**Explicitly NOT touched:** `src/play/survey-core.ts` (+ its test), `src/play/survey.ts`,
`src/probe/run-consistency-probe.ts`, `baml_src/expand.baml` (its `Signal.what`/`.why` descriptions
were already tightened by T-020-02 and survey reuses them). No field names, no types, no enum — only
`@description` text and prompt prose change, so the generated `Board` / `Signal` / `SignalTier` shape
is **byte-stable** and all existing tests pass unchanged.

## Edit 1 — the `## Honest-empty (IA-4)` prompt section (survey.baml lines 53–57)

Replace the current "abstain rather than manufacture" branch. Shape of the replacement (≈3 short
blocks, mirroring the merged expand.baml structure so the two read as siblings):

1. **Reframe heading + lead** — "the RARE abstention, not a default." State that abstention is the
   exception; a project with ANY open work — an open ticket/story, a TODO, a gap between the charter's
   vision and what exists — is NOT empty; survey exists to READ that latent demand gradient, so a
   large or partly-captured board is never a reason to abstain.
2. **The concrete test (project scale)** — "Can you read even ONE real demand off the project — an open
   ticket/story, a TODO, a run-log fact, a gap between vision and what exists? If YES → you have a
   board: stage it, and name each signal's source in `grounding`. ABSTAIN — return an EMPTY board (no
   signals) — ONLY when the honest answer is 'this project grounds no demand: everything it points at
   is already done.'" Bind abstention to the same evidence `read-never-invent` requires.
3. **The calibrated example pair (BOARD scale)** — a **complete/frozen tiny project** (a thin charter +
   an all-`done` board, nothing open) → ABSTAIN, empty board (this is the `survey-thin` /
   `THIN_BOARD_DIR` negative control); a **project with open tickets, TODOs, or visible
   vision-distance** → STAGE the ranked board. Close with: do NOT abstain because the board is large,
   already partly-captured, or saturated — when in doubt and you can read ONE real demand, STAGE; keep
   "a board padded with manufactured busywork is the worst waste (overproduction)" so the
   no-fabrication intent survives.

**Boundaries preserved:** the `{{ charter }}` / `{{ project }}` interpolations and the
`{{ ctx.output_format }}` tail are untouched. The `## Read, never invent` section (lines 46–51) and
`## Otherwise, author the board…` section (59–72) are unchanged — only the middle section is rewritten
so it now *collaborates* with read-never-invent instead of competing with it.

## Edit 2 — the `Board.signals` `@description` (survey.baml line 33)

Tighten the honest-empty clause so the type-level instruction the model sees via
`{{ ctx.output_format }}` matches the new prose. Shape:

- Keep the leverage-ordering description ("the ranked demand board — highest-leverage first … REUSES
  the demand.md Signal shape").
- Change the empty clause to: "EMPTY ONLY when the project is complete/frozen and grounds NO demand —
  everything it points at is already done; a project with ANY open work or vision-distance stages a
  ranked board, never an empty one. Abstain honestly on a frozen project; NEVER manufacture a list to
  look productive (honest-empty, IA-4)."

No change to the field **name** (`signals`), **type** (`Signal[]`), or the `Board` class structure —
the generated shape is identical, so `survey-core.test.ts` (which pins `Board`/`Signal` fields and
gate behavior) stays green.

## Why no Edit 3 (the Signal field descriptions)

Unlike T-020-02, survey does **not** edit `Signal.what`/`.why` — those live in `baml_src/expand.baml`
and were already recalibrated by the merged T-020-02 (research §"REUSES expand's Signal"). Survey
reuses the type, so it inherits the tightened per-signal blank instruction for free. Touching
`expand.baml` here would be out of scope and risk a cross-ticket conflict.

## Ordering of changes

1. Edit `baml_src/survey.baml` (both edits — one file).
2. `bun run baml:gen` — regenerate `baml_client/` so the new descriptions propagate to the typed
   client (the prompt text is embedded in generated request-builders).
3. `bun run check` — `baml:gen` (idempotent re-run) → typecheck → `bun test`. Must be green.
4. Commit (`baml_src/survey.baml` only — `baml_client/` is gitignored) — the deterministic-gate-green
   commit.
5. Live probe `survey` + `survey-thin`, capture logs → `sweep-logs/`. (The AC's directional evidence;
   committed separately as probe artifacts, the T-020-01 / T-020-02 precedent.)

## Module boundaries / invariants held

- **Prompt is the only authored surface.** `baml_client/` is generated, never hand-edited — the diff
  there is whatever `baml:gen` emits from the new prompt.
- **Pure core untouched.** `survey-core.ts`'s `honestEmptyGate` still means "a blank/filler signal
  among real ones ⇒ STOP; an empty board ⇒ clear (honest abstention)." The recalibration changes
  *when the model returns an empty board*, never what empty means.
- **Harness untouched** (T-019 / T-020-01 lineage): `run-consistency-probe.ts` already carries the
  `survey`/`survey-thin` targets — no edit.
- **No shape drift:** the `Board` field set and the reused `Signal`/`SignalTier` are identical
  before/after, guaranteed by editing only descriptions + prose.

## Verification surface

- **Deterministic gate:** `bun run check` (green = no shape/type regression).
- **AC (directional):** two probe sweeps. Survey's honest-empty is a `success` outcome (no D4 fold),
  so the rate is read **directly off the headline mix** — grounded `survey` → ~0, thin `survey-thin`
  → ≥1 marker persists. Logs are the artifact.
