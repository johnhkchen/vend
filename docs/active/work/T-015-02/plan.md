# T-015-02 Plan — ordered, verifiable steps

Four commits, each independently typechecked + tested. Test-first where the change is pure.
Verification command throughout: `bun run check` (baml:gen → typecheck → test). Per-step
fast loop: `bun test <file>`.

## Step 1 — run-log `turnsUsed` field (write + read), test-first

**Edits** (structure.md §5): `RunRecordInput.turnsUsed?`, `RunRecord.turnsUsed?`,
`normalizeTurnsUsed`, `buildRunRecord` spread, `reviveRecord` revive.

**Tests** (run-log.test.ts §9): add a `describe("turnsUsed (T-015-02)")` block mirroring the
envelope block — carries-through + round-trip, absent ⇒ omitted (no key in the line),
non-finite/negative/non-integer ⇒ omitted, revive keeps valid / drops malformed / pre-field
line unchanged.

**Verify:** `bun test src/log/run-log.test.ts` green; the "absent ⇒ no `turnsUsed` key"
assertion proves byte-for-byte back-compat. Atomic commit.

## Step 2 — seam type + pure resolvers, test-first

**Edits:** `ResultMessage.num_turns?` (claude.ts §1); `resolveMaxTurns` + `resolveTurnsUsed`
(cast-core.ts §3).

**Tests** (cast-core.test.ts §8): import both resolvers; a `describe` for each —
`resolveMaxTurns` (override wins / default applies / neither ⇒ undefined / `0` returned
as-is) and `resolveTurnsUsed` (int passes; undefined/NaN/-1/"3"/2.5 ⇒ undefined).

**Verify:** `bun test src/engine/cast-core.test.ts` green; `tsc --noEmit` clean (the
`num_turns` field is read in step 4). Atomic commit.

## Step 3 — the contract field, the justified constant, the wire

**Edits:** `Play.maxTurns?` (play.ts §2); `DECOMPOSE_MAX_TURNS = 15` with the justification
doc-comment (decompose-epic-core.ts §6); wire `maxTurns: DECOMPOSE_MAX_TURNS` onto
`decomposeEpicPlay` (decompose-epic.ts §7).

**Decision (structure.md §7):** prefer importing the constant from the core (single source
of truth, testable without the addon). If the import introduces any awkwardness, fall back
to declaring the constant inline on the play with the identical doc-comment — but default to
the core import; confirm with `tsc --noEmit`.

**Tests** (decompose-epic.test.ts §10): assert `DECOMPOSE_MAX_TURNS === 15` and that it is a
positive integer — pins the judgment. (This test imports the addon-free core only, per the
test discipline.)

**Verify:** `bun test src/play/decompose-epic.test.ts` + `tsc --noEmit` green. Atomic
commit.

## Step 4 — thread it through `castPlay`

**Edits** (cast.ts §4): add `resolveMaxTurns, resolveTurnsUsed` to the cast-core import;
`const maxTurns = resolveMaxTurns(opts.maxTurns, play.maxTurns)` and pass `maxTurns` to
`dispense`; `const turnsUsed = resolveTurnsUsed(result?.num_turns)`; spread `turnsUsed` into
the `appendRunLog` input; `· turns: N` stdout line.

**Tests:** none new — `castPlay` is the impure shell (its logic is the pure resolvers tested
in steps 1–2, exactly as `intervened`/`skipGates` carry no `castPlay` unit test). Document
this in review as the house pattern, not a gap.

**Verify:** `bun run check` — full typecheck + the entire suite green (the regression gate:
no existing cast/chain/log test breaks). Atomic commit.

## Step 5 — the live bound-check sweep (AC3), documented

`dispense` spawns a real metered `claude -p`; it is the seam's one un-unit-tested verb, so
AC3 cannot be an automated assertion (design.md D5). The bound is now wired; the check is
**run**, not asserted, following the E-014 measurement-sprint posture.

**Documented sweep command** (recorded in progress.md + review.md):

```bash
# Cap is now the play's warranted default (15); no flag needed to exercise it.
# Use a generous token budget so the TURN cap — not the token andon — is what bounds the run.
vend run decompose-epic docs/active/epic/E-013.md --budget 7200000,180000
# then read the turns + token spend the run logged:
tail -1 .vend/runs.jsonl | jq '{outcome, turnsUsed, tokens: (.usage|add)}'
```

**Pass criterion (AC3):** the cast caps at ≤ 15 turns and lands total token spend **below
the prior ~85–95k tail**; `turnsUsed` is present on the record. **AC4 cross-check:** the run
clears (no false andon — outcome `success`, not a turn-cap-induced stop on a legitimate
decomposition).

If the sweep shows 15 is too tight (a legitimate run cut off) or too loose (tail not
shrunk), the now-logged `turnsUsed` distribution gives the exact next number — the
refinement loop the design intends. Either way the wiring + green check is this ticket's
deliverable; the live number is the human sweep step.

## Testing strategy summary

- **Unit (pure, addon-free):** `resolveMaxTurns`, `resolveTurnsUsed` (cast-core.test.ts);
  `turnsUsed` normalize/build/revive (run-log.test.ts); `DECOMPOSE_MAX_TURNS` value
  (decompose-epic.test.ts). These cover AC1 (precedence) + AC2 (turns captured + logged).
- **Type:** `tsc --noEmit` proves the field threads cast → log and `num_turns` reads off the
  result without a cast.
- **Regression:** full `bun run check` — every existing test green (AC4's "existing casts
  unaffected"; the default only adds a flag a legitimate run never hits).
- **Live (manual sweep):** the documented `vend run` command (AC3 + AC4 live cross-check) —
  forward-looking human step, honestly flagged in review.

## Risk / rollback

- Each step is additive and independently revertable. The riskiest is the *number* (15) —
  but it is a one-line constant with a documented rationale and a data-driven refinement
  path; wrong-but-generous fails safe (a tail through, never a false andon), which the
  ticket explicitly prefers.
- No schema bump, no new outcome, no import-edge change ⇒ no migration, no coupling risk.
