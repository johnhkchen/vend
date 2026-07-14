# Research — T-079-02-01

## Assignment and phase boundary

This attempt starts at `phase: research` and must complete all six RDSPI phases continuously.
Phase artifacts belong only in `.lisa/attempts/T-079-02-01/1/work/`; Lisa publishes admitted
artifacts later. Ticket frontmatter is Lisa-owned and must not be edited by this worker.

Implementation commits must use `lisa commit-ticket` with exact repository-relative include paths.
Ordinary `git add` and `git commit` are prohibited for ticket work. The final repository gate is
`bun run check`.

## Product and story contract

Vend is a local-first clearing house for reusable, gated agent work. This ticket advances P3
(gates are the contract) and P4 (autonomy by default) by replacing a hand-assembled sweep decision
with deterministic computation.

Parent story `S-079-02` introduces a new `src/sweep/` slice. This first ticket owns only the pure
flip computation. The second ticket owns the `vend sweep` verb, confirmation keystroke, filesystem
writes, Git staging, and commit.

The story explicitly excludes archiving, automatic confirmation, and changing tickets or stories
that are not already phase-done. A sweep flips epic cards only; it adds no new completion judgment.

## Acceptance surface

The ticket requires a fixture with one all-done epic and one partial epic. The result must contain
exactly one flip set for the all-done epic and none for the partial epic.

That flip set has three observable products:

- the epic card frontmatter status transition;
- a Git pathspec restricted to the flipped board files;
- a provenance commit message naming the cleared ticket IDs.

A failed presweep with named offenders must return a named refusal and must never return flips.

The focused acceptance command is `bun test` (the ticket text does not narrow it to a directory),
while repository policy additionally requires `bun run check` before completion.

## Existing completion source

`src/settle/settle-core.ts` is the dependency landed by T-079-01-01. It is a pure module over a
`WorkGraph` and plain facts. It exports `deriveEpicClearance(graph)`.

`deriveEpicClearance` returns:

- an ordered `epics` array;
- each epic's ID and title;
- `cleared`, `total`, and sorted `clearedTicketIds`;
- an `allDone` boolean;
- the globally sorted phase-done ticket frontier;
- sorted `allDoneEpicIds`.

Completion is based only on `ticket.phase === "done"`. Ticket `status` is deliberately not an
authority. An empty epic is not all-done, because the helper requires `total > 0`.

The helper derives containment from the canonical graph and deduplicates tickets within an epic by
ID before counting. It is therefore the required single source for sweep eligibility.

The T-079-01-01 handoff explicitly directs sweep to reuse `deriveEpicClearance` and its
`allDoneEpicIds`, rather than independently examining status or ticket arrays.

## Work graph boundary

`src/graph/model.ts` defines the read-only `WorkGraph`. Epic nodes expose ID, title, status,
advances, serves, kind label, stories, and body. Ticket nodes expose phase and containment.

The graph is deeply frozen and has no write path. `src/graph/load.ts` is the thin filesystem reader.
The model intentionally does not retain the complete original Markdown bytes or source filepath on
linked nodes.

Epic containment paths are conventional and stable: real epic cards live at
`docs/active/epic/<epic-id>.md`. The loader defaults to `docs/active/epic`, skips `TEMPLATE.md`, and
loads every real Markdown card.

Because original file bytes are not available to the pure graph, this ticket cannot safely render
an entire rewritten epic document from `WorkGraph`. The later effect shell can read a named card and
apply a narrowly specified frontmatter transition.

## Epic card frontmatter

Live epic cards and `src/play/propose-core.ts` use a fenced YAML frontmatter mapping. New cards are
rendered with a line `status: open`. The template documents the lifecycle vocabulary as open,
clearing, active, and done.

The graph preserves current epic status as a plain string. A sweep candidate can therefore carry
the current status alongside the desired `done` status without reparsing or reconstructing prose.

The pure result should describe the frontmatter field transition, while the effect ticket owns the
actual byte rewrite and write ordering.

## Presweep source and scope

`src/ci/presweep-core.ts` exports both `SweepVerdict` and `SWEEP_PREFIXES`.

`SweepVerdict` contains:

- `ok`;
- phase-done ticket IDs;
- offender paths.

An `ok: false` verdict is expected andon data, not an exception. Its offenders name uncommitted
paths that contradict the done board state.

`SWEEP_PREFIXES` is the source contract plus `docs/active/`. It currently includes `src/`,
`baml_src/`, `ci/`, `.lisa/hooks/`, and `docs/active/`.

The core classifier returns sorted/deduplicated offenders because it consumes
`classifyPorcelain`. A direct caller can still construct a `SweepVerdict`, so a sweep result should
copy and canonicalize offender data instead of leaking mutable caller arrays.

The output pathspec has a stricter purpose than presweep scope: it is the exact list of board cards
that the sweep shell may write and stage. It must not be the broad `docs/active/` prefix and must
not include source paths merely because `SWEEP_PREFIXES` recognizes them.

## Pure-core conventions

The house pattern separates plain-data judgment from effects. Expected operational refusal states
are returned as discriminated data; impossible typed/programmer states may throw `TypeError`.

Existing core modules return fresh deterministic values, sort set-like arrays, and avoid mutating
caller inputs. Tests pin pure functions with small fixtures.

`settle-core.ts` imports `SweepVerdict` as a type and copies presweep arrays. The new sweep core can
import the runtime `SWEEP_PREFIXES` constant because the ticket/story explicitly require reuse and
the imported presweep module is itself addon-free and pure.

## Test fixture convention

`src/settle/settle-core.test.ts` already has a canonical `buildGraph` fixture with one all-done
epic, one partial epic, and one empty epic. It deliberately includes phase/status disagreement to
pin phase as authoritative.

The sweep test can use the same public `buildGraph` boundary and a smaller two-epic fixture. This
avoids inventing a sweep-local graph facsimile and proves the imported completion derivation works.

Bun tests use `describe`, `test`, and `expect` from `bun:test`. Tests commonly assert exact object
equality for discriminated contracts and exact messages where downstream display/commands depend
on the bytes.

## Current worktree

The worktree is shared with concurrent Lisa work. Existing unrelated changes include Lisa
provenance, Lisa-managed ticket frontmatter, and another ticket's work artifacts. They must be
preserved and excluded from this ticket's commit.

No `src/sweep/` directory currently exists. The likely ticket-owned source unit is therefore two
new files:

- `src/sweep/sweep-core.ts`;
- `src/sweep/sweep-core.test.ts`.

No CLI, graph, settle, presweep, package, or board file needs modification for this ticket.

## Constraints carried into Design

- Eligibility must call `deriveEpicClearance`; it must not re-derive all-done state.
- Failed presweep must short-circuit to a named refusal before any flip set is returned.
- Successful output must be deterministic and immutable by convention.
- A flip must identify the precise epic path and frontmatter status transition.
- Pathspec must equal the exact flipped board-file list, not the broad sweep prefix scope.
- Provenance must name the cleared tickets associated with the flipped epic.
- The core must do no filesystem, Git, process, clock, network, executor, or CLI work.
- Actual Markdown rewriting, one-keystroke confirmation, staging, and committing belong to
  T-079-02-02.
- Archiving and non-epic flips remain outside the story.
