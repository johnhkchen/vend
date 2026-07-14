# T-060-03-01 — Review

**Ticket:** live-redrive-flips-gold-master-to-positive (S-060-03 · E-060)
**Type:** task — a LIVE measurement-and-capture ticket (no `src/` change).
**Drive:** 2026-06-29, throwaway sandbox, executor `claude`/`claude-opus-4-8`, total spend **$1.08**.

## What changed

| Path | Action |
| --- | --- |
| `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` | **MODIFIED** — flipped from the E-058 negative (honest-empty steer) to the positive gold master (board renders AND a slice clears). The one product-surface change. |
| `docs/active/work/T-060-03-01/research.md` … `review.md` | **CREATED** — the RDSPI trail. |
| `docs/active/work/T-060-03-01/runs.jsonl` | **CREATED** — the sandbox `.vend/runs.jsonl` captured verbatim (durable evidence: the forward-E1 + reduced-grounding records). |

**No `src/` change.** This ticket exercises the shipped artifact; it does not modify it. The fixes it
demonstrates landed in the dependency tickets (E-059, T-060-01-01/02, T-060-02-01/02).

## Acceptance criteria — met

> A runs.jsonl record from a sandboxed-seed-copy live drive shows ≥1 slice cleared with the
> reduced-grounding marker set and no instant budget-exhausted, a cleared forward-E1 record is
> accrued, and examples/templates/hackathon-seed/EXPECTED-OUTCOME.md is committed in its positive form
> (board renders AND a slice clears) replacing the E-058 empty-steer negative.

- **≥1 slice cleared, live, sandboxed-seed copy.** ✅ `vend work` cast the propose→decompose chain:
  propose-epic minted **E-001**, decompose-epic cleared it into **2 stories + 4 tickets** (`lisa
  validate ✓`). `runs.jsonl` records 2 and 3 both `outcome: success`. Cast 1, **cleared 1**.
- **Reduced-grounding marker set.** ✅ The fresh sandbox has no `.mcp.json`; decompose declared
  `codebase-memory-mcp` *optional*, degraded (printed `· reduced grounding …`), and its run record
  carries **`reducedGrounding: true`** (survives the ledger read boundary — T-060-01-02).
- **No instant budget-exhausted.** ✅ Omitting `--budget` funded the first clear at the calibrated
  cold-start quote; the first pull authorized and ran. The wallet exhausted only *after* the clear
  (cold-start overshoot, by design — the per-cast funding floor funds the clear; T-060-02-02).
- **Cleared forward-E1 record accrued.** ✅ Two: propose-epic and decompose-epic both carry live
  **`intervened: false`** (recorded at run time via `--no-intervened`, not back-filled).
- **EXPECTED-OUTCOME.md in its positive form, replacing the negative.** ✅ Rewritten: shipped steer
  renders a coherent 4-signal board + 2 forks (A3 closed, no diagnostic hack), `vend work` clears a
  slice, the three E-058 findings are marked closed, and one residual imperfection is recorded.

## Test coverage / evidence

- **No new unit tests** (no code changed). The drive itself is the behavioral test; the captured
  `runs.jsonl` is the durable evidence; `bun run check` (**1354 pass / 0 fail**, typecheck clean) is
  the regression proof that the capture-and-flip changed no behavior.
- The fixes demonstrated here are unit-covered in their own tickets: the marker in
  `run-log.test.ts`/`cast.test.ts` (T-060-01-02, working tree); the budget default in
  `work-core.test.ts` (T-060-02-02, committed `856f3c0`).
- **Cross-check of the three E-058 findings → all three reproduced as CLOSED live:** input wiring
  (board rendered on the shipped path), budget shape (no instant exhaustion), MCP capability
  (decompose degraded-and-cleared instead of andoning).

## Open concerns / known limitations

1. **Populated `vend svg` andons — the one honest shortfall.** `GraphIntegrityError: story 'S-002'
   has no epic 'E-002'`. decompose minted the two stories flat-sequentially (`S-001`/`S-002`) rather
   than nesting both under E-001 (e.g. `S-001`/`S-001-01`); vend's graph id-convention
   (`src/graph/model.ts:148`, `epicIdForStory` — `S-NNN[-MM]` → `E-NNN`, no `epic:` field) then can't
   resolve S-002's parent. **Newly surfaced** — decompose only now *runs* on the seed (it andoned in
   T-058-05). **Does not block this AC** (the populated SVG is the designer's downstream view, not an
   AC clause; the slice cleared and the records accrued). **Recommend a follow-up ticket:** make
   decompose number multi-story decompositions under the parent epic's id (`S-{epic}-{NN}`), or
   reconcile lisa's validator with vend's graph id-convention (they currently disagree — lisa passed,
   vend's graph build throws). *Flagged for human attention as the natural next card after E-060.*

2. **Cold-start wallet overshoot (known, by design).** The omit-`--budget` default funds at the summed
   standard prior (`◇ 50k`) while the real chain burned ~204k; the slice clears under the per-cast
   funding floor and the wallet reconciles once the ledger warms. Inherited from `recalibrate`'s prior
   (T-060-02-01/02 reviews), not new here. The displayed quote stays the p90 price (IA-8).

3. **Forward-E1 records live in the throwaway sandbox.** They are captured durably into
   `work/T-060-03-01/runs.jsonl`, but they do **not** accrue into the main repo's `.vend/runs.jsonl`
   (the drive ran in an isolated sandbox by design, to avoid polluting the real graph/ledger). The
   "cleared forward-E1 count" gauge (OKR Set-A, ~4 today) is advanced *as evidence captured*, not as
   live records in the project ledger — consistent with how T-058-05 captured its records.

4. **Single live sample; nondeterministic wording.** One drive. The board/forks/slice wording will
   differ run-to-run; the gold master is a *comparable* bar (gated validity, IA), not a wording match.

## Commit

One commit, **own files only**: `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md` +
`docs/active/work/T-060-03-01/`. The concurrent working-tree edits to `src/engine/cast.ts`,
`src/log/run-log.ts`, their `*.test.ts`, and `justfile` (T-060-01-02 / unrelated) were left
**unstaged** — they are active for the drive (the working tree runs them) but belong to their own
ticket's commit. Ticket frontmatter untouched (Lisa advances the phase from these artifacts).

## Verdict

The closing card of E-060 lands: the fresh-seed two-gesture round-trip is **whole** — board renders
AND a slice clears, with an honest reduced-grounding marker and two cleared forward-E1 records. The
gold master is flipped to positive and stays honest about the one remaining edge (the populated SVG
render), which is the recommended next follow-up.
