# Research — T-075-03-02 plain-empty-board-line

## Assignment and phase context

- Ticket: `T-075-03-02`.
- Parent story: `S-075-03` (`shelf-honesty-labels`).
- Starting phase in ticket frontmatter: `research`.
- The assignment requires all remaining RDSPI phases in one continuous pass.
- Attempt artifacts belong only under
  `.lisa/attempts/T-075-03-02/1/work/`.
- Lisa, rather than this worker, publishes admitted artifacts to
  `docs/active/work/T-075-03-02/`.
- The ticket frontmatter is Lisa-owned during the attempt and must not be edited.
- Ticket source commits must use `lisa commit-ticket` with exact repository-relative
  include paths.

## Story contract

- `S-075-03` covers two honesty labels on the board/shelf surface.
- This ticket owns only the empty-board label.
- The sibling `T-075-03-01` owns cold-start confidence counts in
  `src/shelf/shelf-row.ts` and `src/shelf/shelf-row.test.ts`.
- The story states that the two tickets use disjoint source files and can run in
  parallel.
- This ticket therefore does not own the shelf-confidence discriminated union,
  `confidenceLabel`, `shelfRows`, or recalibration logic.
- The story acceptance condition for this slice is that an empty bare-`vend` board
  shows a plain line rather than `"(no actions)"`.
- The ticket acceptance condition names two proof sites:
  `src/shelf/menu.test.ts` and `src/shelf/home.test.ts`.
- Both tests must cover the new line and exclude the legacy phrase.
- The story's honest boundary classifies this as a pure, typed, fixture-proven edit.
- There is no live model call, ledger calculation, or filesystem-state mutation in
  the behavior under test.

## Product grounding

- `docs/knowledge/vision.md` defines Vend as a local-first clearing surface for
  named, reusable, gated playbooks.
- The bare `vend` screen is the local-first Home surface: demand leads, available
  supply follows, and trust evidence sits at the foot.
- The ticket cites P3, “Gates are the contract.”
- Here the gate is an exact fixture assertion that prevents jargon from returning
  to a user-facing empty state.
- The ticket also cites P5, “Local-first.”
- The changed output is rendered locally from local board state.
- `E-075` describes this epic as a vocabulary-and-honesty pass over read surfaces.
- Its intent explicitly identifies `"(no actions)"` as a token a kitchen-table
  reader should not need to interpret.
- Its done condition says the bare-`vend` shelf has no legacy header leak.
- The epic requires honest content to remain intact while wording becomes legible.
- For this branch, honesty means distinguishing a truly empty action input from a
  non-empty input whose rows are merely hidden.

## Relevant module: `src/shelf/menu.ts`

- `menu.ts` is the pure menu model.
- It imports only the `Budget` type from `src/budget/budget.ts`.
- It performs no filesystem, clock, process, network, model, or native-addon work.
- `Action` is the board-row value object.
- Every action has an id, title, leverage tier, readiness, and budget.
- `rankActions` sorts a copy by tier and readiness.
- `visibleActions` is the shared visibility filter.
- With `all = false`, it removes blocked and leaf-tier actions.
- With `all = true`, it returns a fresh copy containing every input action.
- `renderMenu(actions, opts?)` calls `visibleActions` and returns a string.
- Populated output consists of numbered rows.
- The rendered numbering is aligned with the visible actions persisted in the menu
  cache by the impure caller.
- When some actions are hidden, a footer reports the hidden count and points to
  `vend --all`.

## The two zero-visible branches

- At `src/shelf/menu.ts:155-157`, `renderMenu` handles `shown.length === 0`.
- The function then distinguishes the original input length.
- `actions.length === 0` currently returns `"(no actions)"`.
- A non-empty input with no visible actions returns
  `"(no salient actions — vend --all)"`.
- Those states carry different information.
- The empty-input state means the caller supplied no board actions at all.
- The all-hidden state means actions exist but default visibility suppressed them.
- The ticket names only `renderMenu([])` and the empty bare-`vend` path.
- It does not name or relax the all-hidden guidance branch.
- `opts.all` does not change the empty-input result because the input remains empty.
- The empty-input branch is a single literal replacement point in production code.
- No type, cache schema, ranking, filtering, numbering, or budget formatting changes
  are implicated by the ticket.

## Relevant pure test: `src/shelf/menu.test.ts`

- The suite imports `renderMenu` directly from `./menu.ts`.
- It uses plain `Action` fixtures and Bun's `describe`, `test`, and `expect`.
- Rendering behavior is pinned with exact golden strings.
- The populated fixture pins numbering, value tier, budget, and readiness.
- Separate tests pin hidden-row behavior and `opts.all` behavior.
- At `src/shelf/menu.test.ts:174-176`, the empty-input test currently has the name
  `empty input → (no actions)`.
- Its only assertion is exact equality with the legacy string.
- At `src/shelf/menu.test.ts:178-181`, the all-hidden test separately pins
  `"(no salient actions — vend --all)"`.
- The tests therefore already expose the distinction between no actions and hidden
  actions.
- The acceptance contract adds a negative legacy-copy assertion to the direct
  empty-input proof.
- No helper or fixture expansion is needed to reach `renderMenu([])`.

## Home composition path

- `src/shelf/home-shell.ts` is the impure bare-`vend` orchestration shell.
- `homeText` calls `browseShelf` for the board region.
- It reads the run log once for shelf confidence and ledger trust data.
- It builds the ledger line and shelf rows from that shared record list.
- It calls `renderHome({ boardMenu, shelfRows, ledger })`.
- `src/shelf/gather.ts:browseShelf` gathers, ranks, renders, persists the cache, and
  returns the rendered `menu` string.
- Its return statement uses `renderMenu(ranked, { all })`.
- Therefore an empty gathered action list reaches Home as the exact output of
  `renderMenu([])`.
- `browseShelf` still writes a valid empty `MenuCache.actions` array.
- The menu copy is not part of the cache schema or selection data.
- Changing the copy cannot alter `vend <sel>` resolution because the press path
  reads the cached structured actions rather than parsing display text.

## Relevant pure composer: `src/shelf/home.ts`

- `renderHome` accepts an already-rendered `boardMenu` string.
- It does not call `renderMenu` or inspect board actions.
- It appends a rendered shelf region and ledger line with blank-line separators.
- The board string is placed first and byte-for-byte unchanged.
- Its doc comment explicitly describes empty-board guidance as pass-through.
- This makes Home behavior downstream of `renderMenu` without duplicating the
  literal in production logic.
- No change to `renderHome` is required for a `renderMenu` copy change to appear at
  the top of Home.

## Relevant Home test: `src/shelf/home.test.ts`

- `home.test.ts` stays on a pure test path.
- It imports `renderMenu` and passes its output into `renderHome`.
- It does not import the BAML-bearing `home-shell.ts`.
- The populated composition tests assert board, shelf, and ledger ordering.
- A cache-stability proxy asserts that Home starts with the exact `boardMenu`
  string and includes it unchanged before the first blank separator.
- At `src/shelf/home.test.ts:147-150`, the empty-board test builds
  `renderHome({ boardMenu: renderMenu([]), ... })`.
- It currently asserts only that the full Home output contains `"(no actions)"`.
- That test is the named empty-board Home-path fixture in the ticket.
- The fixture also contains non-empty shelf rows and a non-empty ledger line.
- Therefore it proves the empty board label in the composed screen without
  conflating empty shelf or empty ledger behavior.
- Separate tests continue to cover empty shelf and empty ledger states.
- The acceptance contract adds an explicit negative check for the old phrase in
  the composed Home output.

## Comments and descriptive text in source

- `src/shelf/home-shell.ts:21` names the current legacy phrase in its graceful-
  degradation module comment.
- `src/shelf/home.ts:93-95` describes the branch generically as the `renderMenu`
  guidance line and does not hard-code the phrase.
- `src/shelf/menu.ts` describes the branch generically as a single guidance line.
- The shell comment is not executable, but it would become stale when the output
  changes.
- Historic artifacts under `docs/active/work/` record prior behavior and are not
  runtime or ticket-owned source.
- The current ticket and story necessarily quote the legacy string to define the
  defect.
- Repository-wide literal absence is therefore not a viable interpretation across
  immutable history and the ticket specification itself.
- The executable/test surface can remove the old phrase from current source and
  assert it is absent from both relevant render outputs.

## Baseline verification

- Command run:
  `bun test src/shelf/menu.test.ts src/shelf/home.test.ts`.
- Result: 35 passed, 0 failed, 62 assertions.
- The baseline confirms the current legacy expectations are internally green.
- The direct menu empty-input test passes with `"(no actions)"`.
- The Home empty-board pass-through test also passes with the same phrase.
- This is a copy defect against the new ticket contract, not a pre-existing broken
  test suite.
- Bun reports version 1.3.13, matching the project pin and avoiding the documented
  1.3.14 BAML-addon issue.

## History and ownership

- `git blame` attributes the `renderMenu` empty branch and its documentation to the
  original pure-menu commit `a204459` from `T-003-01`.
- The Home pass-through fixture originated with the Home composite work and has
  continued to pin the original menu output.
- There are no later compatibility layers around the empty string.
- `git status --short` shows unrelated Lisa-owned concurrent changes:
  `.lisa/provenance.jsonl`, both active T-075 ticket files, and the sibling's work
  artifact directory.
- The three relevant source/test files were clean at research time.
- Those unrelated files must remain outside every ticket commit include list.

## Constraints and open specification detail

- The exact replacement sentence is not specified by the ticket, story, or epic.
- They constrain it to be plain, honest, and free of the legacy phrase.
- The line must describe an empty board, not the broader claim that the project has
  no possible work.
- The line must not erase the distinct all-hidden guidance behavior.
- It must remain a single string because `renderMenu` and `renderHome` expose plain
  text and current tests pin exact output.
- The production decision belongs in Design; Research records only the constraint
  and the existing seams.

## Research conclusion

- The behavior flows through one pure literal in `src/shelf/menu.ts`.
- `src/shelf/menu.test.ts` is the direct contract test.
- `src/shelf/home.test.ts` is the downstream Home composition contract test.
- `src/shelf/home-shell.ts` contains a descriptive comment that mirrors the old
  output but no independent rendering behavior.
- The all-hidden state, Home layout, cache shape, persistence, selection semantics,
  shelf confidence, and ledger math are outside this ticket's behavior change.
- The existing pure-core/impure-shell boundary already supports the requested
  change without architectural movement.
