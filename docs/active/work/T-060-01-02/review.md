# Review — T-060-01-02: thread-reduced-grounding-marker-onto-run-record

## What changed

Threaded the `reducedGrounding` signal (born in `resolveTools`, T-060-01-01) onto the
`runs.jsonl` run record as a **one-way marker** (`true | undefined`, never `false`), so a
decompose clear that ran without `codebase-memory-mcp` is countable in the ledger instead of
invisible. Added a one-line honest cast-time stdout note as its visible pair.

### Files modified (2 source + 2 test)

| File | Change |
|------|--------|
| `src/log/run-log.ts` | Added `reducedGrounding?: boolean` to `RunRecordInput` and `reducedGrounding?: true` to `RunRecord` (both documented as one-way, mirroring `intervenedAttested`); added `normalizeReducedGrounding`; derive + one-way spread in both `buildRunRecord` and `reviveRecord`. Zero new imports — the zero-coupling invariant holds. |
| `src/engine/cast.ts` | In `castPlay` (after the `!resolved.ok` andon early-return): read the flag via the union-narrowing `"reducedGrounding" in resolved && resolved.reducedGrounding`; emit a one-line honest stdout note on degrade; spread `...(reducedGrounding ? { reducedGrounding: true } : {})` into the end-of-cast `appendRunLog` alongside `intervened`/`turnsUsed`. The andon record is untouched. |
| `src/log/run-log.test.ts` | New `describe` block (5 tests): round-trip, absence/back-compat, one-way (`false` never written), malformed-on-revive, legacy line. |
| `src/engine/cast.test.ts` | `groundedEchoPlay` fixture (declares `optionalMcp: ["codebase-memory-mcp"]`); `reviveRecord`/`writeFile` imports; 2 integration tests — degraded cast records the marker (+ survives revive), grounded cast does not. |

No files created or deleted (besides work artifacts). No schema-version bump (an additive
optional field needs none — the same back-compat story as `turnsUsed`/`intervened`).

## Acceptance criteria — met

> A test asserts a decompose run executed without codebase-memory-mcp writes a reduced-grounding
> marker field into its runs.jsonl record (and a fully-grounded run does not); the marker
> survives the run-log revive/normalize read boundary.

✅ **Degraded run writes the marker** — `cast.test.ts` "a cast WITHOUT codebase-memory-mcp …":
casts `groundedEchoPlay` (declares the optional MCP) under a tmp root with no `.mcp.json` ⇒
`readProjectMcpServers → available:[]` ⇒ `resolveTools → reducedGrounding:true` ⇒ the
`runs.jsonl` line carries `reducedGrounding === true`. Proven through the real
`resolveTools → castPlay → appendRunLog` chain (the stub executor seam, no `claude` spawn).

✅ **Fully-grounded run does not** — the sibling test writes a `.mcp.json` declaring
`codebase-memory-mcp` ⇒ the same play casts fully grounded ⇒ the line has no marker
(`"reducedGrounding" in rec === false`).

✅ **Survives the revive/normalize read boundary** — both the integration close
(`reviveRecord(rec).reducedGrounding === true`) and the dedicated pure run-log tests
(round-trip through build → serialize → revive; malformed value dropped; legacy line parses with
the field absent).

## Test coverage

- **Integration (AC core)**: 2 new `cast.test.ts` tests exercising the actual wiring end-to-end
  — the gap a pure test alone would leave (proves the marker is connected, not just shaped).
- **Pure read-boundary**: 5 new `run-log.test.ts` tests modeled on the `turnsUsed` /
  `intervenedAttested` blocks — round-trip, absence (back-compat), one-way, malformed, legacy.
- **One-way discipline pinned**: `reducedGrounding: false` ⇒ field omitted (build + serialize),
  so a fully-grounded record stays byte-identical to a pre-T-060-01-02 one.
- **Regression**: existing `cast.test.ts` tests (no-`optionalMcp` play) stay green — their
  records are unchanged, confirming the only behavioral delta is the marker on the degrade path.
- **Gate**: `bun run check` (baml:gen + `tsc --noEmit` + full `bun test`) → **1348 pass / 0
  fail** across 81 files. `run-log.test.ts` 77 pass; `cast.test.ts` 4 pass.

### Coverage gaps (acknowledged, intentional)

- `castPlay` remains the single UNTESTED impure verb by house rule — but it is exercised
  end-to-end here via the injected stub executor (`cast.test.ts`), so the marker wiring through
  the impure shell IS covered behaviorally even though `castPlay` has no direct unit test.
- The honest stdout note is asserted only by observation in the run output (it fires on the
  degraded cast), not by a captured-stdout assertion — consistent with the codebase, which does
  not unit-test cosmetic `process.stdout.write` lines (the durable, countable surface — the
  record — is what the AC and tests assert).

## Open concerns / handoff notes

1. **Scope judgment — the stdout note.** I included a one-line honest reduced-grounding stdout
   note in `castPlay`, beyond the strict letter of the AC (which is the run-record field). It was
   explicitly deferred here by T-060-01-01's review (note #2) and serves the epic's "log an honest
   reduced-grounding note." It is one line in the already-impure shell with no new pure surface or
   test burden. If a reviewer prefers the AC's narrow scope, deleting the single
   `process.stdout.write` line removes it with zero impact on the AC, tests, or the record. Flagged
   for an explicit yes/no rather than buried.
2. **One-way vs three-state** was a deliberate design choice (design.md Q1): the AC's "a
   fully-grounded run does not write the marker" rules out the three-state `false`-is-written
   shape. The marker is therefore a counting predicate — `grep reducedGrounding runs.jsonl | wc -l`
   is the exact degraded-clear count, which is what "countable, not invisible" asks for.
3. **Downstream consumers.** Nothing reads `reducedGrounding` off the record yet — this ticket
   only makes the signal durable and countable. A later card (Ledger/IA surfacing of the
   degraded-clear rate) can consume it; no consumer is in scope here, and none is required by the
   epic for this slice.
4. **Not committed in this session.** The working tree carries pre-existing unrelated changes
   (`justfile`, `src/ledger/recalibrate.{ts,test.ts}`) not part of this ticket, so I left commits
   to the human/Lisa rather than entangle them or partial-stage. The four atomic commit boundaries
   (one per plan step) are recorded in plan.md and progress.md.

## Critical issues

None. The change is additive (one optional one-way field + one conditional spread + one stdout
line), behind the existing `intervenedAttested` precedent, with full back-compat (grounded and
legacy records byte-identical) proven by test and the full gate green.
