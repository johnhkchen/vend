# Research — T-069-01-02

## Ticket and story contract

- The ticket starts in `phase: research`.
- Its parent is `S-069-01`, which was read before this artifact.
- The story adds Lisa executor-routing metadata to the two board-writing gestures.
- This ticket owns only the materialization seam.
- It must stamp a supplied seat onto every generated ticket.
- The stamp is `agent: <seat>` immediately after `priority:`.
- A missing seat must preserve the pre-change rendered bytes.
- An unknown seat must throw `UnknownSeatError` before any file is created.
- The acceptance example uses `codex` as the valid seat and `gpt` as invalid.
- Later tickets own decompose-effect relabeling, run-log outcomes, chain plumbing, and CLI parsing.
- Story files, ticket body prose, gates, and Lisa dispatch are outside this ticket.
- The story's known routing vocabulary is exactly `claude | codex`.

## Governing project constraints

- `docs/knowledge/vision.md` defines Vend as a local-first clearing and orchestration tool.
- P2 keeps the run gesture small; the seat is optional metadata on an existing gesture.
- P6 requires routing metadata not to assume Claude is the only executor seat.
- P7 requires refusal to happen without partial output.
- N4 keeps Vend distinct from the executor; this field allocates work for Lisa.
- `AGENTS.md` requires pure core and impure shell.
- `AGENTS.md` requires `bun run check` green before completion.
- Done includes committed code, tests, and all RDSPI artifacts.
- Ticket phase and status frontmatter must not be edited by the worker.

## Upstream dependency state

- `T-069-01-01` is committed at `ef73d3a`.
- It created `src/play/agent-seat.ts`.
- `KNOWN_SEATS` is the single runtime tuple `['claude', 'codex']`.
- `AgentSeat` is derived from that tuple.
- `findUnknownSeat(seat: string)` returns `null` for a known seat.
- It returns the original input for an unknown seat.
- Matching is exact; it does not trim or normalize case.
- The module is pure, dependency-free, and addon-free.
- The upstream ticket deliberately left throwing policy to this ticket.
- `ContextSources` and `DecomposeInputs` now carry optional `agent?: string`.
- `assembleInputs` conditionally includes the field only when supplied.
- The input remains `string` so untrusted runtime values can reach a validation boundary.

## Materialization module

- `src/play/materialize.ts` owns conversion of a cleared `WorkPlan` into board files.
- It imports BAML declarations with `import type`, avoiding runtime addon loading in tests.
- It exports pure ticket and story rendering functions.
- It exports the impure `materialize` function.
- It imports `mkdir` and `writeFile` from `node:fs/promises`.
- It imports `listIdsIn` to gather existing board ids.
- It imports `detectCollisions` for the pure collision judgment.
- It resolves the charter into one snapshot per materialization.

## Ticket rendering surface

- `renderTicketFile(t, snapshot)` currently takes two parameters.
- It creates frontmatter as an ordered array of strings.
- The current order is delimiter, id, story, title, type, status, priority, phase,
  depends_on, delimiter.
- The full-file golden pins this exact order and all bytes.
- The line after `priority:` is currently `phase:`.
- Ticket body content is separately assembled from purpose, advances, and done signal.
- Charter citations in the body are resolved before return.
- The return value is `{ name, body }`.
- Story rendering is independent and has no ticket routing frontmatter.

## Existing compatibility proof

- `src/play/materialize.test.ts` contains an inline full-file ticket golden.
- That golden is an exact `toBe` comparison.
- It currently contains no `agent:` line.
- Preserving that assertion when no seat is passed directly proves byte compatibility.
- Existing focused assertions also pin aliases and identity fields.
- Story goldens must remain unchanged.
- No external fixture file needs updating.

## Impure materialization order

- `materialize(plan, targets, charter)` currently takes three arguments.
- It first reads existing ids from both target directories.
- It computes generated ids from stories and tickets.
- It throws `IdCollisionError` on collisions.
- It then reads the clock and snapshots the charter.
- It renders every story and ticket into memory.
- It scans all rendered files for unresolved bare charter codes.
- It throws `BareCodeError` when the scan finds any.
- Only after both guards clear does it call either `mkdir`.
- It then writes stories followed by tickets.
- It returns the paths written.

## Existing typed-error pattern

- `IdCollisionError` extends `Error`.
- It sets `this.name` explicitly.
- It carries a structured `collisions` payload.
- Its message begins `materialize: refusing to write`.
- `BareCodeError` follows the same shape.
- It sets `this.name` and carries structured per-file hits.
- Both errors represent expected write refusals rather than filesystem failures.
- `decompose-epic.ts` catches them by `instanceof` and relabels outcomes.
- The story assigns unknown-seat relabeling to a later ticket.

## Existing zero-write tests

- The bottom suite in `materialize.test.ts` uses real temporary directories.
- Each test creates its own root with `mkdtemp`.
- `afterEach` recursively removes all roots.
- Missing target directories are observed with `readdir(...).catch(() => 'ENOENT')`.
- The collision refusal proves no new file and no stories directory.
- The bare-code refusal proves neither target directory exists.
- The successful case proves normal files land.
- These tests exercise the impure function without loading the BAML addon.
- `WorkPlan` values are plain objects cast through the erased type.

## Call-site topology

- Production has one direct materialize call in `src/play/decompose-epic.ts`.
- That call currently supplies plan, targets, and charter.
- Existing tests and fixtures also call the three-argument form.
- Adding an optional trailing parameter can preserve every existing call.
- Later `T-069-01-04` is explicitly sequenced after this ticket to supply the input seat.
- Cast-level tests currently use the legacy call and must stay compatible.

## Test acceptance surface

- The ticket names `materialize.test.ts` golden cases specifically.
- Valid-seat coverage must observe rendered files on disk, not only a helper return.
- It must inspect every ticket in a multi-ticket plan.
- It must verify exact placement immediately following `priority:`.
- Missing-seat coverage can retain the existing pure golden unchanged.
- Invalid-seat coverage must catch an `UnknownSeatError`.
- It must prove both target directories remain absent or empty.
- The error should retain the unknown value for the later effect relabel.
- Existing known-seat tests already pin the shared vocabulary; this ticket needs composition proof.

## Scope and worktree constraints

- The relevant production file is `src/play/materialize.ts`.
- The relevant test file is `src/play/materialize.test.ts`.
- Work artifacts belong under `docs/active/work/T-069-01-02/`.
- No BAML schema, generated client, CLI, run-log, chain, or executor registry change is needed.
- The worktree contains Lisa-owned modifications in `.lisa/provenance.jsonl` and ticket files.
- The epic and parent story are untracked orchestration inputs.
- Those files must be preserved and excluded from this ticket's commits.
- Explicit staging is required.

## Research conclusions

- The pure renderer controls exact line placement and backward-compatible bytes.
- The impure materializer controls validation timing and zero-write behavior.
- The upstream pure oracle is ready to be composed at that boundary.
- Typed errors should follow the two existing materialize refusal classes.
- An optional trailing seat parameter is compatible with all current callers.
- Validation must occur before directory creation and file writes.
- Rendering all tickets with the same supplied value matches the story's per-gesture semantics.
- Later effect and CLI behavior must remain untouched.
