# T-002-04 — Review: live-dispense-proof

Handoff for a human reviewer. This is the **spike that converges E-001**: it ran the
already-wired `decompose-epic` play **live** through `claude -p` and proved the whole
loop — gated `WorkPlan`, lisa-valid materialized files, countable log, budget honored
both ways, and a broken input that stops the line. The headline: **all four scenarios
matched expectations on the first pass**, and the machine reproduced the human's E-001
decomposition almost exactly. Full evidence + numbers in `proof.md`.

## What changed (files)

| Action | File | Role |
|---|---|---|
| create | `docs/active/work/T-002-04/live-proof.ts` | driver — 4 sandboxed live scenarios over the real `runDecomposeEpic` |
| create | `…/fixtures/tiny.md` | small groundable epic (A2 token / A4 time scenarios) |
| create | `…/fixtures/underspecified.md` | contentless epic (A3 gate-trip) |
| create | `…/results/summary.json` | generated machine evidence (outcome/usage/cost/wall) |
| create | `…/results/e001-machine-plan.md` | generated — A1's materialized plan (AC4 diff source) |
| create | `…/proof.md` | the AC4 deliverable: results, by-hand-vs-machine diff, kaizen |
| create | `…/{research,design,structure,plan,progress,review}.md` | RDSPI artifacts |

**No `src/` file was created, modified, or deleted.** This spike runs the convergence
that T-002-03 built (`608e648`); it adds proof, not product. `bun run check` is
**114 pass / 0 fail / 0 TS errors**, unchanged before and after.

## AC status

- **AC1 — live run → lisa-valid stories/tickets + run record.** ✅ A1 on the real
  E-001: `success`, 2 stories + 8 tickets materialized, `lisa validate` green (re-run
  independently), and `.vend/runs.jsonl` holds 4 countable records.
- **AC2 — tiny budget → andon, no partial materialization.** ✅ Proven on **both** P7
  dimensions: tokens (A2 → `budget-exhausted`, 0 files) and wall-clock (A4 →
  `timed-out` in 3 ms, 0 files).
- **AC3 — under-specified epic → named gate stop, no garbage.** ✅ A3 →
  `gate-failed` at the `value` gate ("plan has no tickets — … malformed/empty"), 0
  files; the log record names the gate.
- **AC4 — tokens/cost/wall-clock + by-hand gap recorded.** ✅ `proof.md`: ≈233k tokens
  / ≈$1.05 total; the machine matched the hand decomposition on stories, ticket ids,
  DAG shape, and critical path (5), diverging only in (defensible) `advances`
  granularity and priority calls.

## Test coverage

**No new unit tests, by design** (house rule). Every pure unit on the live path is
already covered by the 114-test suite; the driver is impure apparatus composed of
tested verbs (same status as the CLI `import.meta.main` dispatch). The spike's "test"
is the **live run itself** plus the on-disk AC verifications (ledger line count,
independent `lisa validate`, `find` for materialized files, `jq` over the log). The
driver is **re-runnable** for manual re-proof:
`bun docs/active/work/T-002-04/live-proof.ts`.

Gap flagged: live outcomes are recorded, not asserted in CI (they're
non-deterministic). That is appropriate for a spike; if regression coverage of the
live loop is ever wanted, it belongs in a separate, budget-gated smoke job, not the
unit suite.

## What a reviewer should scrutinize

1. **Isolation strategy.** Every scenario runs in its own `lisa init`-ed sandbox under
   `.vend/live-proof/<id>` with the **real charter** copied in (so the bounds gate
   stays honest). This is what makes a live success safe — confirm no path lets the
   runner write to the repo's own `docs/active` board. (Verified: live board untouched.)
2. **The model reused E-001's ids** (S-001, T-001-01…). Harmless here (sandbox), but it
   confirms the **cross-board id-collision gap** (T-002-03 review #2). See concerns.
3. **A2 spent 119k tokens against a 1-token ceiling.** This is correct behavior — the
   token check is post-completion — but it means the token budget is an
   *accountability* andon, not a preventive cap. Decide whether that's the intended
   P7 semantics or whether a hard mid-flight token cap is wanted later.

## Open concerns / follow-up signals (for the demand board)

1. **Cross-board id collision is unguarded** *(highest value)*. The play picks ids
   blind to the existing board; pointing it at the live board would clobber. Needs a
   cross-board uniqueness check or an id-namespacing strategy before the play
   materializes anywhere populated.
2. **`claude -p` cost is agentic, not epic-sized.** The seam runs the full Claude Code
   agent (tools/hooks/multi-turn); a tiny epic cost *more* than the full E-001. Budget
   envelopes (demand.md) should be calibrated from this — and a `--max-turns`/system
   constraint on the seam may be worth a ticket to bound exploration.
3. **Logged model is a sentinel** (`claude-cli-default`); the true id
   (`claude-opus-4-8[1m]`) lives only in the transcript. Cheap to thread through the
   runner if the consistency layer needs it.
4. **No `--project-root` on the CLI** forced this spike to use a driver. Adding it (E-003
   shelf scope) would let runs target arbitrary roots without bespoke apparatus.

## Critical issues

**None.** The keystone works: intent in → gated, budgeted, lisa-valid work out, with a
clean named andon when input is unworthy or budget is exceeded. E-001 is converged —
the play now does by machine what was done by hand to produce E-001. The open concerns
are forward-looking signals, not defects in this slice.
