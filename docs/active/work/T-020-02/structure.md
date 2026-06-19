# T-020-02 — Structure: recalibrate-expand-honest-empty

> The blueprint — file-level changes and exact shape of the edits, not the code. Implements the
> Option C decision from `design.md`: a prompt-only recalibration of `baml_src/expand.baml`.

## Files touched

| File | Change | Why |
|---|---|---|
| `baml_src/expand.baml` | **Modify** — rewrite the `## Honest-empty` prompt section; tighten the `what`/`why` field `@description`s | The model's abstention decision lives here (design Option C) |
| `baml_client/**` | **Regenerated** (not hand-edited) | `bun run baml:gen` output; carries the new descriptions into the typed client |
| `docs/active/work/T-020-02/sweep-logs/{expand,expand-thin}.log` | **Create** | Live-probe AC evidence (Implement phase) |

**Explicitly NOT touched:** `src/play/expand-core.ts` (+ its test), `src/play/expand-fragment.ts`,
`src/probe/run-consistency-probe.ts`, `baml_src/survey.baml` (that is T-020-03). No field names, no
types, no enum — only `@description` text and prompt prose change, so the generated `Signal` /
`SignalTier` shape is **byte-stable** and all existing tests pass unchanged.

## Edit 1 — the `## Honest-empty` prompt section (expand.baml lines 68–72)

Replace the current four-line section. Shape of the replacement (≈3 short blocks):

1. **Reframe heading + lead** — "the RARE abstention, not a default." State that abstention is the
   exception; most fragments are NOT empty; the play exists to clear rough/terse/under-specified
   input, so roughness is never a reason to abstain.
2. **The concrete test** — "Can you cite even ONE real thing the fragment points at — a phrase in it,
   a file/doc/TODO it names, a run-log fact it implies? If YES → you have a signal: extract it (that
   citation is the `grounding`). Abstain ONLY when the honest answer is 'there is nothing here to
   read' — then return a Signal with `what` AND `why` BLANK." Bind abstention to the same evidence
   read-never-invent requires.
3. **The calibrated example pair** — the thin fixture ("water the office plants …") → ABSTAIN
   (off-topic, grounds nothing); a one-clause paraphrase of the grounded fixture ("the run log records
   the outcome bucket but not WHICH gate stopped it") → EXTRACT (a real gap, traceable to the run
   record). Close with: do NOT abstain because a fragment is rough/terse/under-specified — when in
   doubt and you can cite a real source, EXTRACT; keep "manufactured busywork is the worst waste
   (overproduction)" so the no-fabrication intent survives.

**Boundaries preserved:** the `{{ fragment }}` / `{{ charter }}` / `{{ project }}` interpolations and
the `{{ ctx.output_format }}` tail are untouched. The `## Read, never invent` section (lines 62–66)
and `## Otherwise, author …` section (74–82) are unchanged — only the middle section is rewritten so
it now *collaborates* with read-never-invent instead of competing with it.

## Edit 2 — the `what` / `why` field `@description`s (expand.baml lines 43–44)

Tighten the abstention clause so the type-level instruction the model sees via
`{{ ctx.output_format }}` matches the new prose. Shape:

- `what`: keep "ONE line: the move to make." Change the blank clause to: "Leave BLANK (together with
  `why`) ONLY when the fragment grounds NOTHING at all — off-topic noise or empty input, a rare
  honest-empty abstention; a rough-but-grounded fragment is a SIGNAL, not an abstention. Never
  manufacture a move to fill the field."
- `why`: keep the leverage description. Change the blank clause to: "Blank together with `what` ⇒
  honest-empty — reserved for a fragment that reads off nothing, not merely a terse one."

No change to field **names**, **types**, ordering, or the `SignalTier` enum — the generated shape is
identical, so `expand-core.test.ts` (which pins `Signal` fields and gate behavior) stays green.

## Ordering of changes

1. Edit `baml_src/expand.baml` (both edits — one file).
2. `bun run baml:gen` — regenerate `baml_client/` so the new descriptions propagate to the typed
   client (the prompt text is embedded in generated request-builders).
3. `bun run check` — `baml:gen` (idempotent re-run) → `tsc --noEmit` → `bun test`. Must be green.
4. Commit (prompt + regenerated client) — atomic, the deterministic-gate-green commit.
5. Live probe `expand` + `expand-thin`, capture logs → `sweep-logs/`. (The AC's directional
   evidence; committed separately as probe artifacts, the T-020-01 precedent.)

## Module boundaries / invariants held

- **Prompt is the only authored surface.** `baml_client/` is generated, never hand-edited — the
  diff there is whatever `baml:gen` emits from the new prompt.
- **Pure core untouched.** `expand-core.ts`'s `honestEmptyGate` still means "`what` AND `why` blank ⇒
  STOP." The recalibration changes *when the model emits blank*, never what blank means.
- **Harness untouched** (T-019 AC#3 lineage): `run-probe.ts` byte-for-byte stable;
  `run-consistency-probe.ts` already carries the `expand`/`expand-thin` targets — no edit.
- **No shape drift:** the `Signal` class field set is identical before/after, guaranteed by editing
  only descriptions + prose.

## Verification surface

- **Deterministic gate:** `bun run check` (green = no shape/type regression).
- **AC (directional):** two probe sweeps, raw `gate-failed` tally read per the D4 asymmetry
  (research §"probe harness") — grounded → ~0, thin → ≥1 persists. Logs are the artifact.
