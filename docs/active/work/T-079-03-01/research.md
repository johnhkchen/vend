# Research — T-079-03-01

## Ticket position

- Ticket: `T-079-03-01`, `loop-settled-seam-contract`.
- Parent story: `S-079-03`, `andon-carries-the-loop-home`.
- Epic: `E-079`, `the-loop-closes-itself`.
- The ticket starts in `phase: research`.
- Its dependency `T-078-02-03` is complete on the current branch.
- Its dependent ticket is `T-079-03-02`, `settle-rides-the-cord`.
- A sibling story is building the deterministic `vend settle` surface.
- The parent story explicitly keeps this ticket's seam surface disjoint from `src/settle/`.

## Contract carried by the story

- The story covers the vend/lisa seam and later settle consumption.
- This ticket owns the agreement artifact and vend-side marker validation.
- The later ticket owns provenance presentation, consume-on-settle, and event-triggered settle.
- The marker must come from an existing lisa emission.
- The story names two candidates:
  - lisa's `on-notify complete` event;
  - lisa's existing `.lisa/completion-journal.jsonl`.
- New lisa events or journal-format changes are explicitly out of scope.
- Runtime state on Vend's side must live only in vend-owned paths.
- The story's end state removes the human “lisa loop done” relay.
- The story does not auto-pull signals after settlement.
- It does not add a daemon or a babysitting dashboard.
- It does not change the ntfy notification content.
- A live end-to-end lisa loop is an observation boundary, not a test obligation in this story.

## Existing lisa completion event

`lisa hooks-guide` documents `on-notify` as a user-owned hook.

Lisa invokes it as:

```text
on-notify <event> [detail]
```

- `$1` mirrors `LISA_EVENT`.
- `LISA_EVENT` is `complete` or `attention`.
- `LISA_PROJECT` is the absolute project root on every event.
- A complete event carries `LISA_TICKETS_DONE`.
- A complete event carries `LISA_DURATION_SECS` when duration is tracked.
- The complete event fires when the whole loop finishes.
- The Zellij plugin invokes the hook through its existing `run_command` path.
- A missing or non-executable hook is a silent no-op.
- The hook is transport-independent from lisa's point of view.
- The guide explicitly calls the hook project-owned.
- No change to lisa's scheduler, plugin, signal files, or event vocabulary is needed to observe it.

The existing repository hook is `.lisa/hooks/on-notify`.

- It is tracked and executable.
- It was introduced as a project-specific ntfy integration.
- It derives a short project name with `basename "$LISA_PROJECT"`.
- Its `attention` arm renders question, permission, and idle notifications.
- Its `complete` arm renders the loop ticket count and duration.
- Network failures are suppressed so notification transport cannot block lisa.
- The current hook resolves the ntfy topic before dispatch.
- With no topic it exits before examining the event.
- Therefore the existing complete facts currently reach ntfy only when a topic exists.
- The marker crossing does not yet exist.

## Existing completion journal

`.lisa/completion-journal.jsonl` is runtime state and is gitignored by `.lisa/.gitignore`.

Observed rows are ticket-completion reconciliation records, not whole-loop summaries.

- `requested` rows carry a ticket completion id, attempt, generation, and prior phase/status.
- `command-in-flight` rows add correlation and reconciliation deadline data.
- `confirmed` rows add the resulting commit id.
- Rows use `schema_version: 1`.
- One ticket normally produces several journal states.
- The journal does not contain the project name.
- The journal does not contain a whole-loop tickets-done count.
- The journal does not contain loop wall-clock duration.
- A confirmed row says a ticket completion transaction settled.
- It does not say the whole lisa loop has finished.
- Reconstructing a loop completion would require scheduling and aggregation knowledge absent from the file.

## Vend-owned runtime state

The repository's established local runtime namespace is `.vend/`.

- `.gitignore` ignores `.vend/*` except two explicitly durable ledgers.
- `src/init/init-core.ts` describes `.vend/*` as vend-owned.
- The init scaffold creates `.vend/.gitignore` rather than modifying lisa-owned ignore files.
- `src/log/run-log.ts` defaults to `.vend/runs.jsonl`.
- `src/engine/decompose-draft.ts` defaults to `.vend/decompose-drafts.jsonl`.
- Cast transcripts and captured diffs also live below `.vend/`.
- `.lisa/` is lisa's runtime namespace.
- Existing one-way-authority comments permit Vend to read lisa markers but prohibit Vend effects from mutating lisa-owned state.
- A pending loop marker under `.vend/` matches the existing ownership partition.

## Existing schema-boundary patterns

`src/engine/decompose-draft.ts` is the closest compact marker precedent.

- It defines a numeric schema version constant.
- Its serialized records carry a short `v` field.
- It distinguishes strict construction from tolerant revival.
- Strict construction rejects malformed programmer inputs with `TypeError`.
- Revival takes `unknown` and returns a typed frozen value or `null`.
- Serialization uses deterministic object construction and `JSON.stringify`.
- The filesystem wrapper is thin and lives beside the pure transformations.
- Filesystem defaults are exported constants.
- The effect creates only the parent directory it owns.

`src/log/run-log.ts` uses the same broad shape at larger scale.

- Unknown JSON is narrowed at the read boundary.
- Required malformed data invalidates a row.
- Optional malformed metadata is omitted where backward compatibility requires it.
- Tests pin valid round trips and malformed refusals.

The loop marker differs from optional run-log metadata:

- every marker field is provenance needed by settle;
- accepting a partial marker would produce a misleading verdict;
- malformed input therefore cannot be treated as a valid pending loop.

## Existing pure-core / impure-shell rule

The repository requires pure logic over plain values and thin effect wrappers.

- `*-core.ts` modules hold validation, normalization, and decisions.
- Filesystem, clock, network, and process environment access belong in shell modules.
- Bun tests import the pure functions directly.
- Effect tests use temporary directories and clean them in `finally` blocks.
- Expected external invalidity is normally returned as typed data.
- Unexpected filesystem faults propagate.

No `src/seam/` directory currently exists.

- No `src/settle/` implementation exists at this research snapshot.
- No loop-settled marker type exists.
- No loop-settled marker fixture exists.
- No Vend reader currently consumes a lisa completion event.
- No CLI arm currently records or consumes a loop marker.

## Test and build environment

- TypeScript is strict.
- `noUncheckedIndexedAccess` is enabled.
- Tests use Bun's built-in `bun:test`.
- `bun run check` performs BAML generation, TypeScript checking, and the full test suite.
- Source imports use explicit `.ts` extensions.
- The pinned project runtime is Bun; package metadata requires Bun `>=1.3.13`.
- The ticket requires the complete repository gate before commit.

## Worktree and ownership constraints

The initial worktree is already dirty from lisa-managed activity:

- `.lisa/provenance.jsonl` is modified.
- `docs/active/tickets/T-079-01-01.md` is modified.
- `docs/active/tickets/T-079-03-01.md` is modified.

These paths are not ticket-owned source changes.

- They must not be reverted, staged, or included in ticket commits.
- Phase artifacts belong only in `.lisa/attempts/T-079-03-01/1/work/`.
- Lisa publishes admitted artifacts later.
- Ticket phase and status frontmatter must not be changed by this worker.
- Ticket source commits must use `lisa commit-ticket` with exact includes.
- Ordinary `git add` and `git commit` are prohibited for this assignment.

## Research conclusions

- Lisa already emits the whole-loop facts at `on-notify complete`.
- The completion journal records a different lifecycle and lacks required loop provenance.
- The executable repository hook is the existing project-owned crossing point.
- Vend's established runtime authority is `.vend/`.
- A marker must preserve project, tickets-done, and duration as required provenance.
- Validation belongs in a pure Vend-side schema boundary.
- Filesystem materialization belongs in a thin seam shell.
- The current ticket can remain disjoint from `src/settle/` and the public CLI.
- The later ticket can consume the typed marker without re-deciding the lisa contract.
