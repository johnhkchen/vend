# T-026-01 — Structure: the shape of the verification

This is a **spike**: no source code is created, modified, or deleted. The "structure" is the set of work artifacts and the exact shape of the two live casts + the verification. Everything lands under `docs/active/work/T-026-01/`.

## Files

### Created (this ticket)
- `docs/active/work/T-026-01/research.md` — threading map (done).
- `docs/active/work/T-026-01/design.md` — smoke design + decisions (done).
- `docs/active/work/T-026-01/structure.md` — this file.
- `docs/active/work/T-026-01/plan.md` — ordered steps + verification criteria.
- `docs/active/work/T-026-01/verify-epic.md` — the throwaway `verify-*` subject epic (see shape below). **Inside the work dir on purpose** — never a board epic.
- `docs/active/work/T-026-01/progress.md` — Implement-phase log: commands run, captured output, deviations.
- `docs/active/work/T-026-01/smoke-output.txt` — raw captured stdout/stderr + the two ledger lines + the audit before/after, kept as evidence.
- `docs/active/work/T-026-01/review.md` — readiness verdict (handoff).

### Modified
- `.vend/runs.jsonl` — **appended** two records (the intended instrument output). Append-only; existing lines untouched.

### Explicitly NOT touched
- No file under `src/`.
- No file under `docs/active/{stories,tickets,epic}/` (Option A guarantees the materialize effect never runs).

## Shape of `verify-epic.md`

Minimal but well-formed so `assembleInputs` reads it and `render` can prompt on it. Frontmatter `id` is the lever that stamps the record's `epic` field as a `verify-*` probe:

```markdown
---
id: verify-e1-instrument-readiness
title: verify-e1-instrument-readiness
status: probe
---

## Context
Throwaway subject epic for T-026-01's instrument-readiness smoke. NOT a board epic.
Exists only to give `vend run` a real epic to render a decompose prompt from. The cast
is run under a 1-token ceiling so it deterministically budget-exhausts before any
materialize effect — nothing here ever reaches the board.

## Intent
Prove the live `vend run --intervened|--no-intervened` path writes the `intervened`
bit to the run ledger and that `vend audit` reads it back.
```

## Shape of the two casts

Both run from repo root (`/Volumes/ext1/swe/repos/vend`), against the work-dir epic, under the 1-token ceiling:

```
bun run src/cli.ts run decompose-epic docs/active/work/T-026-01/verify-epic.md \
  --budget 600000,1 --intervened
bun run src/cli.ts run decompose-epic docs/active/work/T-026-01/verify-epic.md \
  --budget 600000,1 --no-intervened
```

- Expected per-cast stdout tail: `· andon: budget-exhausted …` then `run <id>: budget-exhausted (materialized: false)`; exit code 1 (a non-success outcome maps to exit 1 — this is the *expected* andon, not a failure of the smoke).
- Expected ledger delta: exactly two new lines, `epic: "verify-e1-instrument-readiness"`, `outcome: "budget-exhausted"`, `intervened: true` then `intervened: false`. No `intervenedAttestation` marker (these are **live** captures, not back-fill — proving the forward path).

## Shape of the verification

Three assertions, scripted in the Implement phase and captured to `smoke-output.txt`:

1. **Bit written, correct values** — `tail -2 .vend/runs.jsonl | jq '{epic,outcome,intervened}'` shows the two expected objects (`true`, then `false`).
2. **Live, not back-filled** — the two new lines have **no** `intervenedAttestation` key (`jq 'has("intervenedAttestation")'` ⇒ `false`).
3. **Audit reads them back** — capture `vend audit`'s intervention `reported`/`intervened` (parsed from `formatWalkAwayFindings`, or computed directly via the same `auditWalkAway` over the full ledger) **before** and **after** the two casts; assert `reported` increased by `+2` and `intervened` by `+1`. (Audit filters by play, not epic; the full-ledger delta is the robust check — see design D3.)

## Ordering that matters

1. Write the four planning artifacts (R/D/S/P) first — they are the high-leverage review surface.
2. Snapshot the audit baseline **before** any cast (so the +2/+1 delta is measurable).
3. Cast `--intervened`, then `--no-intervened` (order fixes which record is `true`).
4. Verify write + read; capture evidence.
5. `git status` proves no board pollution.
6. Write `progress.md`, then `review.md`.

## Commit boundaries

- Commit 1: R/D/S/P artifacts + `verify-epic.md` (the plan, before execution).
- Commit 2: `progress.md` + `smoke-output.txt` (the executed evidence). `.vend/runs.jsonl` is gitignored (ledger is local state) — its delta is captured into `smoke-output.txt` as the durable evidence.
- Commit 3: `review.md` (the verdict).

(If `.vend/` is *not* gitignored, the ledger append is left uncommitted local state and noted; the evidence file is the committed artifact either way.)
