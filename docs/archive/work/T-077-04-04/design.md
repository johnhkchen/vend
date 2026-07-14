# Design — T-077-04-04

## Decision

Add an optional persisted decompose draft as an alternate source for `castPlay`. When present, the
cast validates the resume relationship, skips the complete cold-execution prefix, installs the
stored `parsedDraft` as the play output, and continues through the existing gates, effect, terminal
settlement, run-log, and return path.

The concrete decompose shell resolves the public epic argument, loads the latest active draft, and
hands it to the engine. The CLI recognizes `--resume` without `--budget`, and named dispatch skips
the cold funding counter for this zero-dispense path.

## Option A — cold dispense with the stored draft added to the prompt

The command could render a new prompt that asks the executor to reuse or repair the persisted plan.

Advantages:

- Minimal change to the cast engine.
- Could allow an executor to repair a stopped draft.

Rejected because:

- It spends tokens regenerating work, directly violating the ticket criterion.
- It is a repair/regeneration loop, explicitly outside the story.
- It makes recovery probabilistic again instead of reusing the paid typed output.
- It cannot prove that materialization came from the persisted bytes.

## Option B — a standalone concrete resume runner

`decompose-epic.ts` could load the record, call `play.gates`, call `play.effect`, settle the draft,
and manufacture a `RunSummary`.

Advantages:

- Very small change to the generic cast.
- Concrete typing is close to the play.
- Executor bypass is obvious.

Rejected because:

- It duplicates classification and terminal effect settlement.
- It would drift from diff capture, run logging, degradation reporting, and future cast gates.
- A manufactured summary without the shared ledger path weakens countability.
- The story says to re-enter the cast, not create a second runner beside it.

## Option C — factor the entire post-gate settlement into a new helper

The cast could be split into `dispenseAndParse` plus `settleParsedOutput`, and both cold and resume
could call the new helper.

Advantages:

- Strong architectural separation between source acquisition and settlement.
- Makes future alternate sources explicit.

Rejected for this ticket because:

- The current cast settlement is large and carries many established facts.
- Extracting it would create a broad, high-risk diff unrelated to the narrow acceptance criterion.
- The alternate source can join the current control flow without duplicating the tail.

## Option D — optional resume source inside `castPlay`

Extend `CastOptions` with one active `DecomposeDraftRecord`.

Cold mode remains unchanged. Resume mode:

1. checks the play is the stable resumable decompose play;
2. checks the record epic equals the cast subject;
3. rejects `skipGates`, because recovery must re-enter at gates;
4. skips MCP/tool resolution, executor selection/probe, render, transcript, dispense, meter, parse,
   and checkpoint append;
5. takes `record.parsedDraft` as output;
6. calls `play.gates(output, ctx)`;
7. uses the existing `classify` and effect/settlement tail;
8. settles the active draft only after final success.

Chosen. It makes the bypass small and keeps the largest, most policy-rich half of the cast shared.

## Why the engine may know the draft record

The generic engine already imports the decompose draft module to checkpoint and settle the stable
`decompose-epic` play. Adding the record type to `CastOptions` does not create a new dependency
direction or pull BAML/concrete play code into the engine.

The option is intentionally decompose-specific rather than a speculative generic cached-output
facility. The story asks for exactly one resumable play, and N3 rejects building a generalized
one-off prompt/cache runner without demonstrated need.

## Resume validation

The engine rejects programmer wiring errors before side effects:

- resume record with a non-decompose play;
- resume record whose `epic` differs from `opts.subject`;
- resume combined with `skipGates`.

The draft loader has already validated the versioned outer record and object-shaped output. The
play's gate boundary then validates the concrete plan shape/meaning before effect. No stored gate
verdict is trusted as current authorization; persisted findings remain evidence, while gates rerun
against current epic/charter inputs.

## Cold-path compatibility

The resume option is absent by default. All existing cold variables keep the same values and order:

- tool resolution and missing-capability refusal;
- executor selection and probe;
- render and max-turn resolution;
- transcript setup and streaming;
- dispense and timeout handling;
- token check, parse, gates, and checkpoint capture.

Only variable declarations must move outside the cold-only branch so the existing settlement tail
can consume either source.

## Resume accounting

Resume has no executor result:

- usage is `{}`;
- cost is `0`;
- turns are absent;
- execution seat is absent;
- transcript is not created;
- reduced-grounding is absent because no executor tools are provisioned.

The terminal run row still exists and carries rerun gate findings plus effect outcome. The concrete
dispatcher supplies the play's authored budget as the structural envelope required by the current
cast API, but does not present it as newly purchased funding. The authoritative actuals show zero
token burn.

## Cross-review consequence

Cross-review binds only when an authoring executor seat exists. Resume performs no executor work,
so no new author seat is invented. A materialized resume can still capture a diff, but complement
review remains inert without seat provenance. This is more honest than attributing the prior run's
executor to a later local effect without that fact in the draft record.

## Epic argument resolution

The doctor emits a bare stored subject, for example `E-077`. Resume maps a bare value to:

`<projectRoot>/docs/active/epic/<value>.md`

An argument ending in `.md` or containing a path separator is treated as an explicit epic path,
preserving the existing direct-run style. Input assembly then derives the canonical subject from
frontmatter and uses that subject for draft lookup.

## Draft lookup

`assembleAndCast` uses the existing public APIs:

- `loadDecomposeDrafts({ path: <root>/.vend/decompose-drafts.jsonl })`;
- `latestDecomposeDraft(records, subject)`.

No raw JSONL inspection is introduced. This preserves settlement reconciliation and malformed-tail
tolerance. If no active draft exists, a typed `ResumeDraftNotFoundError` identifies the subject.

## Dispatch behavior

`runPlay` continues to resolve names through the registry. On a resume:

- an unknown play remains `no-play`;
- the cold funding counter is skipped;
- the play's authored budget is passed to the cast shell;
- `ResumeDraftNotFoundError` becomes a `no-draft` data result.

The CLI renders `no-draft` as a concise andon and exits nonzero. This handles stale doctor hints
without a stack trace.

## CLI syntax

The pure parser accepts:

`vend run decompose-epic E-077 --resume`

The parsed run command gains optional `resume: true` and optional `budget`. A non-resume run still
requires and always contains a valid budget. A resume may omit budget and the CLI prints no funding
line. The help text lists the recovery gesture in the free section and keeps the cold gesture in
the metered section.

## Flag interactions

The recovery contract requires gates, so `--resume --no-gates` is rejected at the engine boundary.
The exact public gesture supplies no `--after`, `--agent`, or intervention flag. The v1 checkpoint
does not preserve those original optional inputs, so this ticket does not pretend to reconstruct
them. Parser compatibility can remain permissive, but the documented path is the fixed base gesture.

## Acceptance test

Add a BAML-free engine fixture named `decompose-epic`:

- append one active draft with a unique stored payload;
- provide a play whose render and parse throw if called;
- provide an executor whose probe and dispense record forbidden calls;
- call `castPlay` with `resumeDraft`;
- have gates record the stored payload and return CLEAR;
- have effect materialize a file from the stored payload;
- assert call order is gates then effect only;
- assert probe/dispense/render/parse were never called;
- assert `actuals.usage` is empty;
- assert the output file contains the stored payload;
- assert `loadDecomposeDrafts` returns zero active records;
- assert raw ledger history contains the original draft and a resume settlement.

## Parser tests

- exact doctor command parses with `resume: true` and no budget;
- cold run without budget remains a usage error;
- cold run shapes remain unchanged;
- help includes the exact resume gesture in the free section.

## Decision summary

Use the existing cast as one settlement engine with two input sources: cold executor output or one
active persisted decompose draft. Keep source acquisition concrete, missing state explicit, and
all gate/effect/cleanup behavior shared.

