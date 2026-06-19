# T-014-03 — Structure

The blueprint for the deliverable. No source code changes (Design Option C: synthesis +
decision, not a feature). Two files touched: the findings note (created) and demand.md (a
one-line bridge). The RDSPI work artifacts live alongside in `docs/active/work/T-014-03/`.

## Files

### Created — `docs/active/work/T-014-03/findings.md` (the deliverable)
The one-page findings note. ~Sections, in order:

1. **Header / TL;DR** — one bold line: the verdict (**HOLD — do not green-light the
   macro-wallet; the gate is not yet satisfied**) and the one-line why (instruments built &
   green; neither number collected yet). A reader gets the decision in the first two lines.

2. **The two numbers** — one subsection each, a paragraph apiece (AC1):
   - **E1 — walk-away trust.** Current state: *unrecorded*. The verbatim `vend audit`
     fragment in a fenced block. Paragraph: 0/10 records carry `intervened`; KR1 (≥10
     reports) unmet; the andon rate (40–50% vs 10%) is observable but contaminated by
     deliberate failure-test epics (E-900/E-901), so it is **not** a trust read.
   - **E2 — gate-driven variance reduction.** Current state: *not yet measured*. What
     `run-probe.ts` will report (one Jaccard-distance reduction number + dispersions), and
     the standing caveat (censoring can inflate it — read the number *with* its ⚠, per
     T-014-02 concern #1).

3. **The decision** (AC2) — the explicit recommendation and the rule:
   - **Verdict now: HOLD / not-go.** Unmeasured ≠ weak; "not go" is the safe default the
     macro-wallet is already gated behind.
   - **The rule, once the numbers land** — a 3-row table or list:
     | Signal state | Verdict | Concrete next pull |
     | E1+E2 green | **go** | un-gate the macro-wallet (demand.md) — trust capitalized |
     | E1 weak | reroute | promote andon-UX / design-language above the wallet |
     | E2 weak | reroute | promote the core consistency-promise fix above all autonomy |
   - **The next pull *now* (unmeasured):** the **measurement sprint** — cast ≥10 runs with
     `--intervened`/`--no-intervened`, run `bun run src/probe/run-probe.ts <epic.md>`, then
     re-read this rule. The human sweep gesture, not a build.

4. **Sample limits** (AC3) — one short paragraph: one self-reporting user, ≤5 casts/arm,
   one epic, contaminated andon sample. A directional steer, not a proof.

5. **How to produce the numbers** — the exact commands (the human step, per AC4), so the
   note is self-contained for whoever runs the sprint:
   - `vend run <play> --intervened` / `--no-intervened` × ≥10 → then `vend audit`.
   - `bun run src/probe/run-probe.ts docs/active/epic/E-0XX.md` → the E2 number.

6. **Citations** — T-014-01 (E1), T-014-02 (E2), PRD §8, discovery-foundation Step 6,
   demand.md (the gated signal).

Target ~80–110 lines — it is a *one-page* note by AC, deliberately tighter than the ~200
line RDSPI artifacts.

### Modified — `docs/active/demand.md` (the bridge)
The macro-wallet entry under "Not yet pulled" already carries
**"⚠ Gated by E-014: … pull only on E-014's go verdict."** Append one line:
> **Status (T-014-03):** HOLD — instruments built (T-014-01/02) but unmeasured; the next
> pull is the measurement sprint, not the wallet. See `work/T-014-03/findings.md`.

Single line. No re-ranking of other signals (none are promoted *yet* — that happens when
the numbers come back weak). Honors demand.md's "don't overproduce inventory" discipline.

### Not touched
- All of `src/` — no code change. The instruments are complete and committed.
- The ledger `.vend/runs.jsonl` — read-only; populating it is the human sweep step.
- The ticket frontmatter — Lisa advances phase/status on artifact detection.

## Ordering
1. `findings.md` (the deliverable) — Implement phase.
2. `demand.md` one-line bridge — Implement phase, after findings exists (so the link resolves).
3. Re-run `bun run check:*` as the AC4 regression guard (no change expected → stays green).

## Interfaces / data read (no new ones defined)
- `auditWalkAway` / `formatWalkAwayFindings` — already exercised via `vend audit`; the note
  quotes their output, defines nothing.
- `varianceReduction` / `formatVarianceReport` — described, run only at the human sweep.
- No new exports, types, or modules. This ticket adds zero surface area — by design.
