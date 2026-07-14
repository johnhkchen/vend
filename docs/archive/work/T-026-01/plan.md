# T-026-01 — Plan: ordered, verifiable steps

Spike. Each step is independently checkable; the Implement phase records results in `progress.md` and raw evidence in `smoke-output.txt`.

## Step 0 — Preconditions (no cost)
- Confirm repo root is the cwd and `.vend/runs.jsonl` exists (it does: 23 records).
- Confirm `git status` is clean except the planning artifacts, so any post-cast board write is attributable.
- Note whether `.vend/` is gitignored (decides whether the ledger append is committed or local-only; the evidence file is committed either way).
- **Verify:** `git status` shows only `docs/active/work/T-026-01/*`.

## Step 1 — Write the subject epic
- Create `docs/active/work/T-026-01/verify-epic.md` per structure.md (frontmatter `id: verify-e1-instrument-readiness`).
- **Verify:** file exists, frontmatter `id` line present.

## Step 2 — Baseline the audit (before casts)
- Record `wc -l .vend/runs.jsonl` and the intervention counts over the full ledger (run `vend audit` and/or compute `reported`/`intervened`).
- **Verify:** baseline numbers captured to `smoke-output.txt` (this is the denominator for the +2/+1 delta).

## Step 3 — Smoke cast #1 (`--intervened`)
```
bun run src/cli.ts run decompose-epic docs/active/work/T-026-01/verify-epic.md --budget 600000,1 --intervened
```
- **Verify:** the cast completes (does not hang/crash); stdout shows a `budget-exhausted` andon and `run <id>: budget-exhausted (materialized: false)`. A new last line in the ledger with `intervened: true`, `outcome: "budget-exhausted"`, `epic: "verify-e1-instrument-readiness"`, and **no** `intervenedAttestation`.

## Step 4 — Smoke cast #2 (`--no-intervened`)
```
bun run src/cli.ts run decompose-epic docs/active/work/T-026-01/verify-epic.md --budget 600000,1 --no-intervened
```
- **Verify:** same as Step 3 but the new last line has `intervened: false`. The `false` value (not absence) is the critical proof that the writer distinguishes clean walk-away from unknown.

## Step 5 — Write check
- `tail -2 .vend/runs.jsonl | jq -c '{epic,outcome,intervened,attested:(has("intervenedAttestation"))}'`
- **Verify (pass criteria):** two objects:
  - `{"epic":"verify-e1-instrument-readiness","outcome":"budget-exhausted","intervened":true,"attested":false}`
  - `{"epic":"verify-e1-instrument-readiness","outcome":"budget-exhausted","intervened":false,"attested":false}`

## Step 6 — Read check (`vend audit`)
- Run `vend audit` again; compute the intervention `reported`/`intervened` delta vs the Step 2 baseline.
- **Verify (pass criteria):** `reported` increased by exactly `+2`, `intervened` by exactly `+1`. (Equivalently, the standalone `auditWalkAway` over the full ledger reflects the two new carriers.) This proves both records are read back and `true`/`false` are counted correctly.

## Step 7 — No-pollution check
- `git status --porcelain docs/active/stories docs/active/tickets docs/active/epic`
- **Verify (pass criteria):** empty output — Option A's `budget-exhausted` skipped the materialize effect; nothing reached the board.

## Step 8 — Record the verdict
- `progress.md`: commands, captured output, any deviation from this plan.
- `review.md`: the readiness verdict — **READY** if Steps 5–7 all pass; otherwise a **named blocking flaw** in the real-session path (which step failed, with the captured evidence).

## Testing strategy
- This spike adds no unit tests (it verifies the live wiring of already-tested pure cores). The threading's pure pieces are already covered: `run-log.test.ts` (normalize/revive of `intervened`, incl. the `false`-kept / absence-omitted cases), `walk-away.test.ts` (intervention stat over carriers), `cli.test.ts` (`parseRunArgs` flag parsing). The gap those tests cannot close — that the *wired CLI→ledger live path* carries the bit through a real SDK cast — is exactly what Steps 3–6 close empirically.
- Pass/fail is binary and evidence-backed: the ledger lines and audit delta are captured verbatim.

## Rollback / cleanup
- Nothing to roll back on the board (no writes). The two ledger records are intentional instrument output and are **kept** (clearly `verify-*`/non-attested, excludable from real E1 data by the established convention). The throwaway `verify-epic.md` stays as a work artifact documenting what was cast.

## Out of scope (named, not done here)
- Collecting the ≥10 real walk-away sessions (T-026-02+).
- Any source change. If a flaw is found, it is reported as a blocking prerequisite, not patched in this spike.
