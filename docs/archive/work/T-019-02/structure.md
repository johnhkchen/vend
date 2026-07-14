# T-019-02 — Structure: file-level blueprint

The shape of the changes (not the code). Two code edits, two fixtures, one findings note, plus the
RDSPI artifacts.

## Files

### MODIFIED — `src/probe/run-consistency-probe.ts` (the only source edit)

The extension is additive and local to the target table + dispatch. Edits, in order:

1. **Value-imports** (so the plays self-register and their assemble verbs resolve):
   ```ts
   import { expandFragmentPlay, assembleExpandFragmentInputs } from "../play/expand-fragment.ts";
   import { steerProjectPlay, assembleSteerInputs } from "../play/steer.ts";
   ```
   (alongside the existing `surveyPlay` / `decomposeEpicPlay` imports).

2. **`expandTarget(fragment: string): ProbeTarget`** — closes over the fixed fragment string:
   - `play: expandFragmentPlay`
   - `seed`: `seedCharter(root)` + copy the live board (`stories`/`tickets`) so expand's
     `listIdsIn` dedup has the real id space (mirrors `surveyTarget`'s board copy).
   - `assemble: (root) => assembleExpandFragmentInputs({ projectRoot: root, fragment, budget: expandFragmentPlay.budget })`
   - `subject: () => "expand of grounded fragment"`
   - `outputDirs: ["docs/active/pm/staged"]`
   - `isAbstention: emptyOutput` — the **default** (expand STOPs ⇒ honest-empty arrives as a
     non-`success` `gate-failed`, never reaching the abstention test; documented inline that
     expand's honest-empty is read from the raw tally, not this predicate).

3. **`steerTarget(): ProbeTarget`** — mirrors `surveyTarget` (steer reads the whole project):
   - `play: steerProjectPlay`
   - `seed`: `seedCharter(root)` + copy `stories`/`tickets` (the grounded board).
   - `assemble: (root) => assembleSteerInputs({ projectRoot: root, budget: steerProjectPlay.budget })`
   - `subject: (root) => "steer of " + basename(root)`
   - `outputDirs: ["docs/active/pm/staged"]`
   - `isAbstention: (o) => o === null || o.includes("# Steer — nothing to stage") || o.includes("honest empty steer")`
     — keys on steer's exact marker (the partial "_No forks_" note under a real board is NOT a full
     abstention, so match the full-abstention heading/body, not the fork-side line).

4. **`resolveTarget`** — add two cases:
   ```ts
   case "expand": case "expand-fragment":
     if (!srcInputPath) return null;          // the fragment file is required
     return expandTarget(await readFragment(srcInputPath));
   case "steer":
     return steerTarget();
   ```
   `expand` takes the fragment from the CLI `input.md` positional (read its file contents as the
   fragment string — a small `readFragment` helper, or inline `readFile`). `resolveTarget` becomes
   `async` (it already returns a Promise-friendly path via the caller's `await`).

5. **`SUPPORTED`** → `["decompose-epic", "survey", "expand", "steer"]`.

6. **Survey's marker test** — tighten `surveyTarget.isAbstention` to also accept the exact heading
   `"# Survey — no demand staged"` (currently `"no demand staged"`, which is a substring of the
   heading — already correct; leave unless the live marker differs). No behavioral change intended.

**Boundary:** no change to `castN`, `collectOutput`, `classifyRun`, the temp-ledger helpers, or
the pure core. The two invariants (no pollution / no collision) are inherited unchanged.

### NEW — `docs/active/work/T-019-02/fixtures/grounded-fragment.txt`

The fixed, known-grounded fragment expand is cast on (D2). One short paragraph describing a real,
board-backed need (so the charter-correct outcome is a clean priced signal, and any honest-empty is
a false negative). Lives under the work dir so the sweep is turnkey and the input is auditable
(no silent input — IA-8). Referenced by the `How to produce the numbers` block.

### NEW — `docs/active/work/T-019-02/findings.md` (the AC deliverable)

The E-014-shaped note (design D7). Sections: framing blockquote → `## TL;DR — the verdict` →
`## The numbers` (per-play `formatConsistencyReport` line + raw `RunOutcome` tally, fenced
verbatim) → `## The decision` (verdict + 3-branch rule table + named next pull / demand.md bridge)
→ `## Honest about the sample` → `## How to produce the numbers` → `## Citations`.

### NEW — RDSPI artifacts (this directory)

`research.md`, `design.md`, `structure.md`, `plan.md` (written), `progress.md` (implement),
`review.md` (review). The findings note is the work product; these are the workflow trail.

## Public API / interface impact

- **None outward.** `run-consistency-probe.ts` is a sweep instrument, not part of the `vend` CLI
  surface (no `src/cli.ts` change). The only signature change is internal: `resolveTarget` becomes
  `async` (the `main` caller already `await`s the target path).
- **Registry:** the value-imports cause `expand-fragment` and `steer` to register at harness load;
  they already register in the normal `vend` path, so no double-registration (each module registers
  once at first import — Node/Bun module cache).

## Ordering of changes (where it matters)

1. Edit the harness (imports → targets → resolveTarget → SUPPORTED) — must compile before any run.
2. `bun run check` green (AC#4) — typecheck + the existing 586 tests + the new code path
   typechecks; no new unit tests (impure harness, house rule).
3. Author `fixtures/grounded-fragment.txt`.
4. CLI-guard smokes (no-args / unsupported / expand-without-fragment → usage + exit 2) — cheap,
   no model spawn, proves the dispatch wiring.
5. Launch the live sweep (background, expand-first) — the long pole.
6. Write `findings.md` folding real numbers as arms land; defer unfinished arms honestly.

## What is deliberately NOT changed

- `src/probe/consistency.ts`, `consistency.test.ts`, `variance.ts`, `run-probe.ts` — untouched
  (T-019-01's AC#3 carries forward; the generalization is exercised, not modified).
- The engine (`cast.ts`, `RunSummary`) — the stop-reason-on-RunSummary improvement is named as a
  kaizen signal in the findings, not built here (D4).
