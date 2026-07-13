# Review — T-080-01-01 marker tolerates untracked duration

## Disposition

Pass.

The ticket acceptance criterion is met. A complete Lisa event with no `LISA_DURATION_SECS` now
produces a valid, claimable four-field marker; a present malformed duration still refuses; both
tracked and untracked closed v1 shapes round-trip; settle renders the loop line without inventing a
seconds figure; the real hook fixture proves the unset environment path through one-shot
consumption; all ticket-owned source is committed; and the post-commit full repository gate is
green.

## Outcome

The completion cord no longer depends on an optional measurement.

Tracked completion remains:

```text
loop: vend — 1 ticket done in 41s
```

Untracked completion is now:

```text
loop: vend — 1 ticket done
```

The second form does not contain `0s`, `?s`, `undefineds`, or an inferred duration. It carries only
the project and completed-ticket facts Lisa actually supplied.

## What changed

### `src/seam/lisa-loop-settled-core.ts`

- `LisaLoopSettledMarkerInput.durationSecs` is now optional.
- `LisaLoopSettledMarker.durationSecs` is now optional.
- The schema has four required keys:
  - `v`;
  - `kind`;
  - `project`;
  - `ticketsDone`.
- `durationSecs` is the only optional key.
- Exact-key validation admits exactly four or five keys.
- Unknown keys remain refused.
- A present duration must remain a non-negative safe integer.
- The builder validates duration only when supplied.
- The builder conditionally adds the property, so absence is structural rather than an own
  `undefined` value.
- Revival applies the same closed four/five-key rule to external `unknown` values.
- Classification now separates an absent input from a failed numeric parse.
- `durationSecs: undefined` reaches `kind: "complete"`.
- Present partial/unsafe duration strings remain `kind: "refused"`.
- Serialization still rebuilds through the strict builder, preserves deterministic key order, and
  appends one final newline.

### `src/seam/fixtures/lisa-loop-settled.valid.json`

The canonical fixture now exercises the new untracked shape:

```json
{"v":1,"kind":"lisa-loop-settled","project":"vend","ticketsDone":2}
```

Tracked five-field bytes remain valid and are exercised inline by the core tests.

### `src/settle/settle.ts`

- `renderSettleResult` creates the shared project/ticket line first.
- It appends `in <durationSecs>s` only when duration is not `undefined`.
- The branch uses explicit undefined comparison, so measured zero remains `in 0s`.
- No marker lifecycle, gate, presweep, review concern, exception, or delta behavior changed.

### `docs/knowledge/lisa-loop-settled-contract.md`

- Records that Lisa supplies duration when tracked.
- Names four required v1 fields plus one optional measurement.
- Shows the canonical untracked fixture.
- States that absent duration is admitted by omitting the property.
- States that malformed present duration remains inadmissible.
- States that settle prints duration only when present.
- Retains the existing marker home, atomic publication, consume-on-verdict, malformed retention,
  one-way authority, and explicit exclusions.

### Test changes

`src/seam/lisa-loop-settled-core.test.ts` now proves:

- untracked fixture parsing and byte-identical serialization;
- absence of the duration own property;
- frozen untracked marker output;
- tracked five-field parsing and byte-identical serialization;
- frozen tracked marker output;
- builder admission of missing duration;
- builder preservation of measured zero;
- continued rejection of invalid present numeric values;
- continued closed-schema rejection of null/invalid duration and extra keys;
- complete-event admission with `durationSecs: undefined`;
- exact refusal for present `"41s"` duration.

`src/seam/lisa-loop-settled.test.ts` now proves:

- the recorder publishes a valid four-field marker at the fixed Vend path;
- the parsed marker has no duration own property;
- Vend-only `.vend/` authority remains intact;
- tracked marker replacement still works;
- the actual project-owned hook path runs with `LISA_DURATION_SECS` explicitly unset;
- the hook prints the untracked loop line exactly once;
- no numeric or undefined seconds claim is printed;
- the marker is consumed;
- an immediate second settle reports no pending loop.

`src/settle/settle-core.test.ts` now proves:

- the pure aggregate admits and carries untracked loop provenance;
- the resulting marker has no duration own property;
- tracked provenance remains valid;
- malformed closed-schema refusal still works using a genuine extra-key violation rather than the
  newly valid four-field shape.

`src/settle/settle.test.ts` now proves:

- the existing tracked `in 41s` line remains unchanged;
- the untracked line contains only project/count provenance;
- untracked output has no `undefineds` or numeric duration suffix;
- measured zero remains distinct and renders `in 0s`;
- the existing tracked run-settle lifecycle remains green.

## Acceptance evaluation

### “classifyLisaCompleteEvent with durationSecs undefined yields kind 'complete'”

Pass.

The focused core test asserts the complete discriminant, project root, exact four-field marker, and
absence of a duration own property.

### “a marker whose duration is honestly absent”

Pass.

The builder uses conditional object construction. Core, recorder, and settle tests all use
`Object.hasOwn(..., "durationSecs") === false`; this is not merely a JSON stringify side effect.

### “present-but-garbage LISA_DURATION_SECS still refuses”

Pass.

The core test supplies `"41s"` and asserts the exact result:

```text
kind: refused
reason: LISA_DURATION_SECS must be a non-negative safe integer
```

Unsafe present duration remains in the refusal matrix as well.

### “closed-schema revive/parse round-trips both marker shapes”

Pass.

- Four-field canonical fixture parses and reserializes byte-for-byte.
- Five-field tracked bytes parse and reserialize byte-for-byte.
- Both returned markers are frozen.
- Invalid present duration and extra keys remain schema mismatch.

### “fixture updated”

Pass.

The committed canonical fixture is the untracked four-field shape, compact and newline-terminated.

### “renderSettleResult prints the loop line for an untracked-duration marker”

Pass.

The direct renderer test asserts the exact line. The real hook fixture independently asserts the
dynamic project-name version through recorder, settle, and CLI output.

### “without fabricating an Ns figure”

Pass.

Tests exclude any numeric `in Ns` loop suffix and `undefineds`. The explicit zero test ensures the
implementation did not use truthiness to collapse a real measurement.

### “bun run check green”

Pass.

The full gate passed before each source commit and after the final commit.

## Verification results

### Baseline focused suite

```text
62 pass
0 fail
183 expectations
4 files
```

### Final focused acceptance suite

Command:

```text
bun test src/seam/lisa-loop-settled-core.test.ts \
  src/seam/lisa-loop-settled.test.ts \
  src/settle/settle-core.test.ts \
  src/settle/settle.test.ts
```

Result:

```text
69 pass
0 fail
203 expectations
4 files
```

### Final full gate

Command:

```text
bun run check
```

Result:

- BAML code generation passed.
- TypeScript `tsc --noEmit` passed.
- 1,924 tests passed.
- 1 intentional test skipped because real `dist/` artifacts are absent.
- 0 tests failed.
- 6,293 expectations ran across 126 files.

`git diff --check` also passed on every ticket-owned path.

## Architecture review

The pure-core / impure-shell boundary remains intact.

- Shape policy, event classification, revival, and serialization remain in the pure seam core.
- The filesystem recorder algorithm did not change.
- No clock was added to infer duration.
- Settle core continues to reuse the canonical seam parser.
- Terminal conditionality remains in the pure renderer.
- Hook source was not modified.
- Atomic marker publication, claim, restoration, and consumption remain unchanged.

The closed schema remains genuinely closed. Optionality is limited to one named measurement; it does
not admit partial common fields or future unknown keys.

## Regression assessment

- Existing tracked five-field markers remain readable.
- Existing tracked renderer wording remains exact.
- Zero-duration markers remain tracked rather than treated as absent.
- Missing ticket count remains refused.
- Relative project roots remain refused.
- Malformed present duration remains refused.
- Non-complete events remain ignored.
- Latest-pending atomic replacement remains covered.
- Malformed marker retention remains covered.
- Second settle still reports `loop: none pending`.
- No CLI syntax, budget, executor, notification content, or TUI behavior changed.

## Commit and ownership review

Two meaningful units were committed through the required transaction.

### `ab5ff95e850736f047c48bc74405a8a247cc80a1`

`feat(seam): admit untracked loop duration`

Exactly six included paths:

- `docs/knowledge/lisa-loop-settled-contract.md`;
- `src/seam/lisa-loop-settled-core.ts`;
- `src/seam/lisa-loop-settled-core.test.ts`;
- `src/seam/lisa-loop-settled.test.ts`;
- `src/seam/fixtures/lisa-loop-settled.valid.json`;
- `src/settle/settle-core.test.ts`.

### `5a2bb150251059943b76993b6810ca2e351a57fa`

`fix(settle): render loops without tracked duration`

Exactly three included paths:

- `src/seam/lisa-loop-settled.test.ts`;
- `src/settle/settle.ts`;
- `src/settle/settle.test.ts`.

No ordinary `git add` or `git commit` command was used. All ticket-owned tracked paths are clean.
Lisa-owned phase changes and Lisa-published work directories remain outside these commits.

Concurrent T-080-02-01 sweep changes appeared during the first gate and were independently committed
by that worker. Exact include paths prevented any overlap or accidental ownership transfer.

## Open concerns and honest boundary

No acceptance-blocking concern remains.

This review claims fixture/unit proof through the real project-owned hook script in a temporary Git
repository. It does not claim a live multi-ticket Lisa loop observation; the parent story explicitly
defers the bare end-to-end rerun to epic closeout.

The marker version remains v1 while admitting its documented optional measurement. That is the
ticket's explicit compatibility contract: both four-field and five-field shapes round-trip. No
other schema relaxation is implied.

The hook's swallow-errors containment remains unchanged. A recorder process that never starts can
still leave no marker; later tickets in S-080-01 own refusal tracing and cord-failure display. This
ticket establishes the optional marker shape those tickets consume and does not preempt their scope.

No TODO, migration, manual repair step, or follow-up is required for this ticket.
