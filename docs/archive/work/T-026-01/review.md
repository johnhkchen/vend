# T-026-01 — Review: E1 instrument readiness

**Verdict: READY.** The live `vend run … --intervened|--no-intervened` → run-ledger → `vend audit` path records and reads back the `intervened` bit, proven by two real casts. No blocking flaw in the real-session path. The E-026 measurement sprint may proceed to cast its ≥10 real sessions against this instrument.

## What this spike did

A spike, not a build — **no source code created, modified, or deleted.** It (1) traced the `intervened` threading path through the code, (2) confirmed the instrument is structurally outcome-independent, and (3) empirically verified the **live** path with two real `vend run` casts plus a `vend audit` read-back.

## Acceptance criterion — met

> One smoke `vend run … --intervened` and one `--no-intervened` each complete and append a genuine record carrying the `intervened` bit to the run ledger, and `vend audit` reads them back; readiness (or a named blocking flaw) is recorded in `docs/active/work/T-026-01/`.

- ✅ **Both casts completed** — `budget-exhausted` (a clean terminal outcome), `materialized: false`, real generations of 86455 / 85143 tokens (the full SDK path ran).
- ✅ **Genuine records carrying the bit** — `intervened:true` (cast #1) and `intervened:false` (cast #2) appended to `.vend/runs.jsonl`; `false` written as a value, not omitted; **no** `intervenedAttestation` marker → live forward captures, not back-fill.
- ✅ **`vend audit` reads them back** — carriers 13→15 (+2), `true` 0→1 (+1); audit reports `14/15 ran untouched (93%)`, `trend 100% → 88%`.
- ✅ **Readiness recorded** — this file + `progress.md` + `smoke-output.txt`.

## Files

### Created (all under `docs/active/work/T-026-01/`)
- `research.md` — full `intervened` threading map (parse → dispatch → assemble → cast → log) and read path (`auditWalkAway`).
- `design.md` — decisions D1 (1-token ceiling ⇒ deterministic `budget-exhausted`, no materialize), D2 (`verify-*` off-board subject epic), D3 (write+read verification).
- `structure.md` — artifact shapes, cast commands, verification shape, no-pollution invariant.
- `plan.md` — 9 ordered, independently verifiable steps + pass criteria.
- `verify-epic.md` — throwaway subject epic (`id: verify-e1-instrument-readiness`); kept as documentation of what was cast.
- `progress.md` — executed steps, verbatim results, deviations.
- `smoke-output.txt` — raw captured stdout, ledger lines, audit before/after.
- `review.md` — this verdict.

### Modified
- `.vend/runs.jsonl` — appended 2 records (intended instrument output; gitignored, so local state — the durable evidence is `smoke-output.txt`).

### Not touched
- No `src/` file. No `docs/active/{stories,tickets,epic}/` file (verified: zero new board files).

## Test coverage

No new unit tests (correct for a spike that verifies live wiring of already-tested pure cores). Existing coverage backs each link in the chain:
- `cli.test.ts` — `parseRunArgs` maps `--intervened`/`--no-intervened`/neither to `true`/`false`/absent.
- `run-log.test.ts` — `normalizeIntervened`/`reviveRecord` keep `false`, omit absence.
- `walk-away.test.ts` — `auditWalkAway` counts the intervention stat over carriers only.

The gap unit tests **cannot** close — that the *wired CLI→SDK→ledger live path* carries the bit through a real cast — is what the two smokes closed empirically. That is the whole point of this readiness gate.

## Open concerns / notes for the sprint (T-026-02+)

1. **Probe records live in the real ledger.** The two `verify-e1-instrument-readiness` records now sit in `.vend/runs.jsonl`. They are clearly `verify-*` and non-attested, so excludable by the convention the attestation basis already uses — but the sprint's audit, when run **unfiltered**, will include them (it did: 25 runs). The sprint should either window past them or scope its read so its headline walk-away number is over **real** sessions, not these two andon'd probes. `vend audit` filters by **play**, not epic, so it cannot exclude them by id today — a known limitation, not a blocker.
2. **`budget-exhausted` ≠ walk-away.** These probes are andons, not walk-away successes. They prove the wire, not the rate. The sprint must cast under **real** budgets so its records are genuine `success` walk-aways (the measurement E-014's verdict hinges on).
3. **Materialize on real sprint casts.** When the sprint casts succeed (real budgets), `decomposeEffect` **will** write to the board. The sprint needs an epic subject that decomposes cleanly without id-collision, or it should accept/curate the materialized output. (Not a concern for *this* spike — Option A avoided it.)
4. **Single-environment proof.** Verified in this repo/session where the SDK is authenticated and reachable (consistent with the autonomous casts earlier today). A different environment (headless/cron without auth) would need its own readiness check before trusting the live path there.

## Critical issues needing human attention

None. The instrument is ready; the four notes above are sprint-scoping guidance, not defects.
