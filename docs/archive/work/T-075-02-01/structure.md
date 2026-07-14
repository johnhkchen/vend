# Structure — T-075-02-01 plain operator trust lines

## Change shape

The implementation remains inside the existing pure presentation boundary. Four tracked files are
modified; no files are created or deleted in the repository source tree. The six RDSPI artifacts
remain private to this Lisa attempt until Lisa publishes them.

## File inventory

| File | Action | Responsibility in this ticket |
|---|---|---|
| `src/ledger/walk-away.ts` | modify | Plain full `vend audit` wording. |
| `src/ledger/walk-away.test.ts` | modify | Full-readout copy and forbidden-token coverage. |
| `src/shelf/home.ts` | modify | Plain compact Home ledger wording. |
| `src/shelf/home.test.ts` | modify | Home copy, empty branches, and shared rounding proof. |

No CLI, shell, type, report-core, budget, or sibling surface file changes are planned.

## `src/ledger/walk-away.ts`

### Preserved module boundary

- Continue exporting `auditWalkAway` as the pure report builder.
- Continue exporting `formatWalkAwayFindings` as the pure multi-line formatter.
- Continue exporting `pct` as the single whole-percent formatter shared with Home.
- Keep `ratio`, `subWalk`, and `cost_has` private.
- Add no imports and no exports.

### Preserved report construction

The entire body of `auditWalkAway` remains byte-unchanged. In particular:

- Filter/window order remains unchanged.
- Outcome count seeding and aggregation remain unchanged.
- `censored` remains the internal name for budget-exhausted plus timed-out counts.
- Non-success rate and tier threshold remain unchanged.
- Cost ratio sample rules and median calculation remain unchanged.
- Reported intervention filtering remains unchanged.
- Earlier/recent split remains unchanged.
- Forward/attested partitioning remains unchanged.

### Formatter literal edits

Inside `formatWalkAwayFindings`, preserve this local structure:

1. Resolve `scope`, `m`, and `iv`.
2. Create `lines`.
3. Push the heading.
4. Branch on `iv.reported === 0`.
5. For populated data, calculate `walkAway` and `trendWalk` exactly as now.
6. Select `budgetMark` from `report.withinBudget` exactly as now.
7. Push the stop-rate line.
8. Push the four result counts.
9. Branch through `cost_has(report)`.
10. Join with newline.

Only the static text around existing interpolations changes.

### Full formatter line templates

Heading:

```text
run trust · ${scope} · ${report.total} run[s] [${report.tier}]
```

Unknown trust branch:

```text
finished without help: not recorded yet (${report.total} runs did not say whether anyone stepped in)
```

Populated trust branch:

```text
finished without help: ${pct(walkAway)} (${untouched}/${reported} ran untouched) · trend ...
```

Provenance continuation:

```text
recorded at the time: ${subWalk(iv.forward)} · filled in later: ${subWalk(iv.attested)}
```

Stop allowance:

```text
runs stopped before finishing: ${pct(rate)} vs ${pct(allowance)} allowed — ${budgetMark} (checks working as intended)
```

Result counts:

```text
how runs ended: N finished · N hit budget or time limit · N stopped by a check · N duplicate run ID blocked
```

Cost populated/empty headings:

```text
cost compared with plan: ... (middle result across N finished run[s])
cost compared with plan: no planned cost data
```

### Documentation alignment

Update the formatter-adjacent comments that explicitly describe old rendered copy or show an old
operator-facing example. Keep precise internal terminology where it documents calculations or data
types. This avoids falsely implying the domain model was renamed.

## `src/ledger/walk-away.test.ts`

### Preserved fixtures and math tests

- Keep `rec` and all audit-core fixture construction unchanged.
- Keep outcome, rate, cost, intervention, filter, window, and provenance math assertions unchanged.
- Do not rename internal `andonRate` or `censored` test assertions; those verify the domain model,
  not operator wording.

### Formatter suite changes

- Rename formatter-suite/test prose away from experiment shorthand where it describes the surface.
- Replace old label expectations with the new phrases.
- Preserve expectations for `budget`/threshold numbers only through their new `allowed` context.
- Preserve representative cost and provenance numeric assertions.
- Change provenance label assertions to `recorded at the time` and `filled in later`.
- Keep `none yet` coverage.
- Add a small test helper or direct regex assertion that the rendered output omits:
  - `E1 walk-away` (and the headed `E1 — walk-away` variant).
  - `andon rate`.
  - `censored`.
  - `intervention bit unrecorded`.
- Exercise both populated and no-recorded-answer reports so all conditional copy is observed.

## `src/shelf/home.ts`

### Preserved module boundary

- Keep imports from `shelf-row.ts` and `walk-away.ts` unchanged.
- Keep `HomeRegions` unchanged.
- Keep `subPct` private and its expression unchanged.
- Keep `homeLedgerLine` and `renderHome` exports unchanged.
- Keep `renderHome` byte behavior unchanged apart from receiving newly worded ledger input.

### Home branch templates

Zero total:

```text
ledger   finished without help — no runs yet
```

No recorded answers:

```text
ledger   finished without help — not recorded yet (${total} run[s] did not say whether anyone stepped in)
```

Populated:

```text
ledger   finished without help ${pct(walkAway)} (${untouched}/${reported})   └ recorded at the time ${subPct(forward)} · filled in later ${subPct(attested)}
```

The `report.total === 0` and `iv.reported === 0` predicates stay in their current order. The
`walkAway` expression and both `subPct` calls stay unchanged.

### Documentation alignment

Update the top-of-module and function comments where they quote the old Home line or tell readers
that old labels mirror the audit. Retain internal E-028/DL references where they describe lineage;
those comments are not operator output.

## `src/shelf/home.test.ts`

### Import structure

- Add `pct` to the existing `walk-away.ts` import so expected percentages can be named from the
  shared production formatter.
- Keep all other fixture and composer imports unchanged.

### Home formatter assertions

- Pin the populated line's new leading and provenance labels.
- Retain `63% (5/8)`, `50%`, and `75%` sample facts.
- Pin exact zero-run and no-answer lines with new wording.
- Retain singular `1 run` behavior.
- Retain empty provenance `none yet` and no fabricated `0%`.
- Add forbidden-token checks across populated and empty Home outputs.

### Rounding assertion

In the existing no-drift test:

- Compute expected strings with `pct(5 / 8)`, `pct(1 / 2)`, and `pct(3 / 4)`.
- Assert each expected string appears under the matching new label in Home.
- Assert each appears under the matching new label in `formatWalkAwayFindings`.
- This verifies the sample's half-up whole-percent result (`62.5%` to `63%`) at both surfaces and
  names the shared seam in executable code.

### Composer assertion updates

- Replace `E1 walk-away` index/split anchors with `finished without help` or the stable `ledger`
  prefix.
- Keep board/shelf/ledger ordering unchanged.
- Keep board byte-stability, empty board, empty shelf, and no-card-chrome tests unchanged except for
  the necessary ledger anchor.

## Public interfaces

No interface changes:

```ts
export function pct(r: number | null): string;
export function formatWalkAwayFindings(report: WalkAwayReport): string;
export function homeLedgerLine(report: WalkAwayReport): string;
export function renderHome(regions: HomeRegions): string;
```

No caller changes are required because argument and return types remain identical.

## Dependency direction

The existing direction remains:

```text
run records
  -> auditWalkAway
  -> WalkAwayReport
       -> formatWalkAwayFindings -> vend audit stdout
       -> homeLedgerLine         -> renderHome -> bare vend stdout

walk-away.ts pct
  -> formatWalkAwayFindings
  -> home.ts subPct/homeLedgerLine
```

No reverse import or cycle is introduced.

## Commit unit

The four files form one meaningful, independently green unit: changing source copy alone would
invalidate current tests, and changing tests alone would fail current output. Commit them together
with one `lisa commit-ticket` invocation and four exact `--include` paths after targeted and full
verification pass.

## Excluded structure

- No shared copy constants file.
- No snapshot file.
- No CLI integration fixture or live audit artifact.
- No changes under `docs/active/work/`.
- No changes to ticket frontmatter.
- No changes to `src/shelf/shelf-row.ts`, `src/shelf/menu.ts`, SVG/presentation code, or BAML.
