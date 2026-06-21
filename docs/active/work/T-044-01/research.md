# T-044-01 — Research: concrete-demand-ranker-recalibration

Descriptive map of the code the ticket touches. What exists, where, how it connects. No solutions.

## The defect, grounded

Two live sweeps (E-037, E-039) had `vend steer` rank a **self-referential meta-task** #1
(*"Run and settle the E-037 live macro sweep…"*). The operator re-pointed at concrete demand by
hand. An unattended sweep (P4) cannot re-point — it 0-clears or mints a degenerate meta-epic. The
defect is **semantic** (a meta-task is well-formed but is not product demand), so the structural
gates cannot catch it; the fix belongs in the **ranker prompt**.

## The two rankers (the change surface)

Both files are BAML prompt modules under `baml_src/`. They share the demand-board shape (E-016's
`Signal`) and the same authoring discipline (render-only `ClaudeStub`; `b.request` renders, the
`claude -p` seam dispenses, `b.parse` SAP-parses).

### `baml_src/steer.baml` (lines 1–112)
- `function SteerProject(project, charter) -> Steer` (53–112). Output `Steer` = `signals Signal[]`
  + `forks Fork[]` (all-array SAP-degrade class).
- The prompt body (55–111) is organized as `##` sections:
  - `## Read, never invent` (64–69) — demand is READ, every signal names its `grounding`.
  - `## Honest-empty, BOTH sides (IA-4)` (71–76).
  - **`## The board — author it by these rules (the *what*)` (78–90)** — the per-signal rule list:
    `ONE signal per real demand` → NAME THE VALUE / RANK BY LEVERAGE / PRICE IT / STATE READINESS /
    GROUND IT, then `ORDER THE BOARD highest-leverage first`. **This is the ticket's insertion site
    (~78–90).**
  - `## The forks` (92–102), `## The charter` (104–105), `## The project's current state` (107–108).

### `baml_src/survey.baml` (lines 1–97)
- `function Survey(project, charter) -> Board` (36–97). Output `Board` = `signals Signal[]` (single
  array field — diverges from Steer on SAP, irrelevant here).
- Prompt sections: `## Read, never invent` (46–51), `## Honest-empty (IA-4)` (53–73, with a
  Calibration sub-block), **`## Otherwise, author the board by these rules` (75–87)** — the SAME
  per-signal rule list as steer (NAME THE VALUE / RANK BY LEVERAGE / PRICE IT / STATE READINESS /
  GROUND IT + ORDER THE BOARD). **This is the parallel insertion site.**

The two board-authoring rule lists are textually near-identical; keeping them consistent (ticket
step 2) means adding the same rule to both, phrased the same way.

## The structural gates (must stay UNCHANGED)

`src/play/steer-core.ts` — three pure gates over a `Steer`, value-ordered:
- `readNeverInventGate` (93) — every signal's `grounding` non-blank, else STOP. A poka-yoke for
  citation, *not* a semantic oracle.
- `forkGenuinenessGate` (120) — fork shape checks (option count, blank fields).
- `leverageRankGate` (161) — adjacent tiers non-increasing.
- `clear(steer)` (198) runs them in order; STOP is returned data, not a throw.

The self-referential signal **passes all three**: it is grounded (cites the run log), it is ranked
keystone (well-ordered), and it carries a real `grounding`. The header comment (lines 1–33) is
explicit that BAML owns SHAPE and the gates own MEANING but **"cannot judge semantic consequence."**
The ticket forbids adding a keyword/pattern gate here — distinguishing *"run `vend work`"* (meta)
from *"improve `vend work`'s budget handling"* (real demand) is a semantic judgment a brittle pattern
gets wrong. So `steer-core.ts` is read-only context, not a change target. There is no `survey-core`
honest-empty/leverage code that needs touching for this ticket either.

## The precedent: E-020 (prompt-only recalibration)

`docs/active/epic/E-020.md` — `tighten-honest-empty-abstention`. E-019's sweep showed honest-empty
over-fired on grounded input; E-020 fixed it by **recalibrating the prompt threshold**, not by adding
code logic. Shipped in commits `6fed23e` (survey) / `2a66121` (expand), verified `536847d`. This is
the exact shape of T-044-01: a semantic mis-calibration fixed in the ranker prompt, phrased as
steering, with a deterministic proof plus a deferred live confirmation. The honest-empty steering in
both prompts today (`## Honest-empty` sections) is the *style* to imitate — a `##` block / bullet
rule written as an instruction to the model, never a new schema field.

## The test pattern (the deterministic proof surface)

- `bun run baml:gen` (`baml-cli generate --from baml_src`) regenerates `baml_client/` from the
  prompts; must stay green. `bun run check` = `baml:gen && check:typecheck && check:test`.
- `src/baml/steer.test.ts` and `src/baml/survey.test.ts` are the offline authoring pins. Each:
  - imports BAML **type-only** (a value import loads the native addon and makes `bun test` flaky);
  - spawns a child `bun` running `*-bridge.ts` (one native call per process limit) via `runBridge`;
  - the bridge's `{ mode: "render" }` op calls `b.request.SteerProject(...)` and returns the fully
    rendered `prompt` string (`steer-bridge.ts:36–39`, `extractPromptText`).
  - existing render tests already assert substrings of the rendered prompt:
    `expect(prompt).toContain("project STEERER")` / `toContain("demand-surveyor")`.
- **This is the contract-assertion hook**: the render op returns the real rendered prompt, so an
  added `expect(prompt).toContain(<concrete-demand steering>)` is a deterministic, no-live-model
  assertion that the prompt now carries the steering. No new harness needed — extend the existing
  render `describe` block in each file.

## Constraints / assumptions surfaced

- `ClaudeStub` and every other BAML function must be unchanged (ticket AC#2). The edit is confined to
  prompt **text** inside the two `prompt #" … "#` blocks; no `class`/`function`/`client` changes, so
  `baml:gen` output shape is unaffected and the parse/SAP-degrade pins keep passing.
- The new steering must be **phrased as steering** (an instruction rule), not a new `@description` /
  output field — mirrors RANK/GROUND and the honest-empty blocks.
- Keep the two prompts **consistent** — same rule, same wording, both files.
- Live confirmation is **deferred** (named, not claimed) to the next `vend steer`/sweep — the
  E-038→E-039 shape; document it, do not run a live model.
- The contract assertion should key on a stable, distinctive phrase present in BOTH prompts (e.g.
  "concrete product demand" and "self-referential") so the two render tests can share the contract.
