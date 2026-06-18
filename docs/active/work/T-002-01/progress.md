# T-002-01 — Progress

## Status: COMPLETE — `bun run check` green (exit 0), deterministic over 5 runs (68 pass, 0 fail)

## Completed (mapped to plan steps)

- **Step 1 — `baml_src/generators.baml`** ✓ TS generator, `output_dir "../"`, `version "0.222.0"`.
- **Step 2 — `baml_src/clients.baml`** ✓ render-only `ClaudeStub` (header states never-called),
  field-for-field with the mc reference (provider/model/api_key/max_tokens).
- **Step 3 — `baml_src/decompose.baml`** ✓ four enums, `TicketDraft`/`StoryDraft`/`WorkPlan`,
  `DecomposeEpic(epic, charter, project) -> WorkPlan` with the charter/gates-steering prompt
  ending in `{{ ctx.output_format }}`. Header pins the transport boundary + SAP empty-degradation.
- **Step 4 — `package.json`** ✓ added `"baml:gen": "baml-cli generate --from baml_src"`; `check`
  now `bun run baml:gen && check:typecheck && check:test`.
- **Step 5 — generate** ✓ `bun run baml:gen` → 14 files in `baml_client/` (gitignored). Exports
  `b`, `WorkPlan`, `StoryDraft`, `TicketDraft`, `DraftType/Status/Priority/Phase`.
- **Step 6 — `src/baml/decompose.test.ts`** ✓ parse pin + empty-degradation pin + render pin.
- **Step 7 — full gate** ✓ `bun run check` green; `tsc` clean (generated client in graph, no errors).
- **Step 8 — leave for lisa** ✓ no `git commit` (project convention; lisa owns commits).

## Deviations from plan (documented per RDSPI)

### Deviation 1 — enum members are uppercase + `@alias` (Plan Step 3 / risk register, as predicted)

`baml-cli generate` rejected lowercase enum members ("Invalid name for `enum value`: Must
start with an uppercase letter"). **Resolution:** members are `Task`/`Open`/`Ready`/…; each
carries `@alias("task")` etc. — the alias is the lisa-frontmatter token, what
`{{ ctx.output_format }}` shows the model and what the SAP parser accepts. `b.parse` returns
the MEMBER name (`"Task"`, `"InProgress"`). **Hand-off:** the materializer (T-002-03) must map
member → alias to write lisa-valid frontmatter (`InProgress` → `in-progress`). Documented in
`decompose.baml`'s enum comment.

### Deviation 2 — tests run BAML in a child process via `src/baml/decompose-bridge.ts` (NEW, unplanned file)

**Discovered constraint:** the BAML native addon allows exactly **one** successful native
call per `bun test` process — the addon's async runtime reactor is driven by bun's loop only
once, so a second `b.parse`/`b.request` hangs until the 5 s per-test timeout. Reproduced down
to a single-call minimal test; verified the same code runs many calls fine under plain `bun`
(probe: parse + parse + render all green). The two required calls (parse **and** request)
therefore cannot both run in the test process.

**Resolution (mirrors mc-design-eval's subprocess bridge):** added `src/baml/decompose-bridge.ts`
— a standalone runnable that reads `{ ops }` from stdin, runs render/parse, writes `{ results }`
to stdout. The test batches all three ops into **one** `Bun.spawn(["bun","run",bridge])`, then
asserts on the JSON. Two further fixes made it deterministic:
- the test's BAML imports are **type-only** (erased) so the native addon never loads into the
  `bun test` process — only the child touches it; a value import of the client reintroduced the
  flakiness;
- enum fields are compared against string literals cast to the (erased) enum types
  (`"Task" as DraftType`), since `b.parse` returns the member-name string.

This is a small, named addition to T-002-01's own `src/baml/` territory (disjoint from
S-001 and from T-002-02/03). Confirmed stable: 5× isolated (24–60 ms) and 5× full `check`
(~110 ms), 68 pass / 0 fail each.

### Deviation 3 — `extractPromptText` lives in the bridge, not inline in the test

Plan put the render-extraction helper inline. It now lives in `decompose-bridge.ts` (exported,
typed) because the render happens in the child. Mirrors mc's `bridge.mts` `.body.json().messages`
extraction exactly.

## Not committed

No `git commit` performed — files left for lisa (project convention, per T-001-02/03). Working
tree also shows unrelated changes from concurrent lisa threads (other tickets, `demand.md`,
`E-003.md`, `playbooks/`); none are T-002-01's and none were touched here.

## Files created/modified by T-002-01

- create `baml_src/generators.baml`, `baml_src/clients.baml`, `baml_src/decompose.baml`
- create `src/baml/decompose-bridge.ts`, `src/baml/decompose.test.ts`
- modify `package.json` (add `baml:gen`; wire into `check`)
- generated (gitignored): `baml_client/**`
