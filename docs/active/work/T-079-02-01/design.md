# Design — T-079-02-01

## Decision summary

Add one pure `computeSweep` boundary that consumes a canonical `WorkGraph` and a `SweepVerdict`.
It returns either an assembled `SweepFlipSet` or an actionable `SweepRefusal`.

The successful flip set is effect-ready data:

- one frontmatter-field flip per eligible epic;
- the exact repository-relative pathspec for those cards;
- one deterministic provenance commit message naming every cleared ticket.

Eligibility comes exclusively from `deriveEpicClearance`. A failed presweep short-circuits before
eligibility is exposed. The core describes changes but never reads, rewrites, stages, or commits a
file.

## Option 1 — re-derive eligibility locally

The sweep core could traverse `graph.epics`, flatten stories, and test each ticket phase.

Advantages:

- no runtime dependency on the settle slice;
- the algorithm would be short;
- sweep-specific filtering could happen in one traversal.

Rejected because T-079-01-01 exists specifically to provide one all-done derivation. Duplicating
the predicate would create two answers to “is this epic fully done,” and future changes such as the
non-vacuous empty-epic rule could drift. The ticket explicitly requires consuming settle-core.

## Option 2 — consume a complete `SettleVerdict`

The function could accept a previously computed `SettleVerdict` rather than a graph and presweep.

Advantages:

- the verdict already carries `epics`, `allDoneEpicIds`, and presweep;
- no second call to `deriveEpicClearance`;
- a shell could settle and sweep in one pipeline.

Rejected because sweep is a separate gesture and should be computable from current board and
presweep facts without requiring marker, gate, or review-concern inputs. A `SettleVerdict` also
couples sweep to unrelated delta state and could be stale by the time confirmation occurs.

## Option 3 — accept `WorkGraph` plus `SweepVerdict`

The function derives clearance from the graph using `deriveEpicClearance`, uses the graph's epic
status to avoid already-done no-op flips, and gates the result with the supplied presweep verdict.

Advantages:

- the all-done predicate stays single-sourced;
- the input contains only facts sweep actually needs;
- the later shell can obtain both facts from the same immediate invocation;
- pure fixture tests use the canonical graph builder;
- no marker, gate renderer, filesystem, or Git concern enters the core.

Chosen.

## Result union

Use a discriminated union rather than exceptions for expected operational outcomes:

```ts
type SweepResult = SweepFlipSet | SweepRefusal;
```

`SweepFlipSet.kind` is `"flip-set"`. `SweepRefusal.kind` is `"refusal"`.

This mirrors settle and presweep conventions: an andon is returned data that a CLI can render and
map to a non-zero exit without parsing an error string.

## Flip representation

Each `EpicFrontmatterFlip` contains:

- `epicId`;
- `path`;
- `field: "status"`;
- `from`, copied from the graph's current epic status;
- `to: "done"`;
- sorted `clearedTicketIds` from the shared clearance record.

This is a precise frontmatter instruction rather than an entire Markdown document. The graph does
not retain original source bytes, and reconstructing a card from the graph would risk losing YAML
formatting, comments, optional fields, or prose. T-079-02-02 can read the exact named file and apply
the one field transition.

The cleared IDs are retained on each flip as provenance source data even though the aggregate also
contains a rendered message. This keeps the result inspectable and lets the shell display a useful
preview without reverse-parsing the message.

## Eligibility rule

Call `deriveEpicClearance(graph)` once. Build a map of graph epic IDs to current statuses. Select
only clearance records where:

1. `allDone` is true according to settle-core; and
2. the epic's current status is not already `done`.

The second condition makes “flip” literal. A card already marked done should not be rewritten or
included in a new commit even if its tickets remain done.

Do not inspect ticket `status`. Do not infer completion from counts independently. Do not include
partial or empty epics.

The graph and clearance arrays are already ID-sorted, but the result sorts by epic ID explicitly so
determinism does not depend on incidental input order.

## Path construction and scope

Each path is:

```text
docs/active/epic/<epic-id>.md
```

Derive the `docs/active/` base from the exact board member in `SWEEP_PREFIXES`, then append
`epic/<id>.md`. If that shared contract ever stops containing the board prefix, throw a programmer
error rather than silently generating an unguarded staging scope.

The aggregate `pathspec` is exactly the sorted, deduplicated list of flip paths. It is not
`SWEEP_PREFIXES`, not `docs/active/`, and not a directory glob. This lets the effect shell use:

```text
git add -- <pathspec...>
git commit --only -- <pathspec...>
```

without admitting unrelated board or source changes.

Epic IDs originate in validated graph frontmatter, but path construction should still reject IDs
containing `/`, `\\`, `..`, or non-`E-` shape. A typed string can still be an unsafe path segment.
This is a programmer/data-boundary defect and throws `TypeError`; the canonical loader normally
prevents malformed board identity earlier.

## Provenance message

Use a stable subject plus one line per flipped epic:

```text
sweep: close E-100

E-100 cleared by T-100-01, T-100-02
```

For multiple epics, the subject lists sorted epic IDs separated by commas and the body has one
sorted epic line each. Every ticket appears under the epic whose clearance established the flip.

The message is deterministic, human-readable in Git history, and easy for the second ticket to
preview verbatim. It names cleared ticket IDs without inventing actor, timestamp, or archive claims.

The subject uses “close” rather than “archive,” preserving the story's honest boundary.

## Presweep refusal

Canonicalize offenders with sort and deduplication without mutating the caller's array. If
`presweep.ok` is false, return:

- `code: "presweep-offenders"`;
- the canonical offender list;
- a reason naming that committed-state proof failed;
- an exact next action to commit or restore the offenders and rerun `vend sweep`.

A failed verdict with no offender is internally inconsistent with the `SweepVerdict` contract and
throws `TypeError`. Likewise, an `ok: true` verdict carrying offenders is rejected as a programmer
error rather than allowing the boolean and evidence to disagree.

No flip, pathspec, or commit message is present on the refusal branch. This makes “never a flip” a
type-level property.

## No-candidate refusal

The parent story requires `vend sweep` to refuse when no epic is fully done. Return a second named
refusal, `code: "no-epics-ready"`, when clearance produces no status-changing candidates.

This includes:

- a board with only partial/empty epics;
- all all-done epics already having `status: done`.

The refusal advises completing remaining tickets or recognizing already-closed epics before retry.
Although the ticket acceptance fixture has one eligible epic, defining this branch here prevents
the CLI ticket from inventing policy in its effect shell.

## Input consistency

The successful presweep's `doneIds` should equal the canonical graph's `doneTicketIds`. Otherwise
the core would combine a cleanliness verdict from one board snapshot with eligibility from another.

Return a named `stale-presweep` refusal for mismatch rather than throwing: this can happen
operationally if board state changes between presweep classification and sweep computation. Include
the expected and observed sorted IDs and direct the caller to rerun presweep.

This additional gate preserves P3 and gives the later shell an actionable retry path. It does not
add completion judgment; it only verifies that two supplied facts describe the same snapshot.

## Mutation and determinism

All arrays in the result are newly allocated. Caller-provided presweep arrays are copied before
sorting. `deriveEpicClearance` already returns fresh arrays, but flip records also copy cleared IDs.

The function does not mutate the deeply frozen graph. Same graph plus same presweep yields byte-
identical objects and message text.

## Testing strategy

Create `src/sweep/sweep-core.test.ts` with a `buildGraph` fixture containing one two-ticket all-done
epic and one two-ticket partial epic.

The primary exact-equality assertion proves:

- exactly one flip;
- only the all-done epic is named;
- `status: open` to `done` is explicit;
- the flip contains both cleared ticket IDs;
- pathspec contains only `docs/active/epic/E-100.md`;
- the message names both ticket IDs;
- the partial epic contributes nothing.

Additional focused tests cover:

- failed presweep returns `presweep-offenders` with no flip shape;
- only partial epics return `no-epics-ready`;
- an already-done epic is not rewritten;
- stale presweep done IDs return `stale-presweep`;
- inconsistent presweep values throw programmer errors;
- input arrays are not mutated.

Focused verification is `bun test src/sweep`. Full verification is `bun run check`.

## Files and scope

Create only `src/sweep/sweep-core.ts` and `src/sweep/sweep-core.test.ts`, plus private attempt
artifacts. Do not modify the CLI, settle core, presweep core, graph model, package scripts, board,
or Git effect code.
