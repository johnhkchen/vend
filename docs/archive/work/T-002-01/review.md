# T-002-01 — Review: `DecomposeEpic` BAML function + `WorkPlan` types

Handoff document. What changed, how it's tested, what a reviewer should scrutinize, and the
open concerns for downstream tickets.

## Gate status

`bun run check` → **exit 0**, deterministic over 5 consecutive runs: **68 pass / 0 fail**,
`tsc --noEmit` clean (the generated client is in the typecheck graph), ~110 ms. `bun run
baml:gen` regenerates `baml_client/` cleanly (14 files).

## What changed

| Action | File | Notes |
|---|---|---|
| create | `baml_src/generators.baml` | TS generator → `baml_client/` at repo root; `version "0.222.0"` |
| create | `baml_src/clients.baml` | render-only `ClaudeStub` (header: never called); mirrors mc reference |
| create | `baml_src/decompose.baml` | 4 enums + `TicketDraft`/`StoryDraft`/`WorkPlan` + `DecomposeEpic` fn + prompt |
| create | `src/baml/decompose-bridge.ts` | standalone render/parse runnable (see Concern 1) |
| create | `src/baml/decompose.test.ts` | parse pin + empty-degradation pin + render pin (spawns the bridge) |
| modify | `package.json` | `+ "baml:gen"`; `check` now runs `baml:gen` first |
| generated | `baml_client/**` | gitignored build product (`bun run baml:gen`) |

No edits to `src/executor`, `src/budget`, `src/gate`, `src/log`, `src/play` — disjoint from
S-001 and the other S-002 tickets. The one shared touch is `package.json` (scripts only).

## Acceptance criteria — all met

- **AC1** ✓ `clients.baml` defines a render-only `ClaudeStub` (never called; header states it).
- **AC2** ✓ `decompose.baml` defines `DecomposeEpic(epic, charter, project) -> WorkPlan`.
  `TicketDraft` carries all eight lisa frontmatter fields (`id`, `story`, `title`, `type`,
  `status`, `priority`, `phase`, `depends_on`) **plus** `purpose`, `advances`, `doneSignal`.
  `StoryDraft` carries the story-side frontmatter (`id`, `title`, `type`, `status`,
  `priority`, `tickets`) — lisa stories use `tickets:`, not `phase:`/`depends_on:`. `WorkPlan`
  holds ordered `stories[]` + `tickets[]` (array position = order).
- **AC3** ✓ `generators.baml` emits the TS client; `bun run baml:gen` regenerates `baml_client/`.
- **AC4** ✓ a unit test feeds a canned reply through `b.parse.DecomposeEpic` and asserts a typed
  `WorkPlan`; a second asserts `b.request.DecomposeEpic(...)` renders the three inputs into the
  prompt. (A third pins the SAP empty-degradation behavior — see Concern 2.)

## Design decisions worth a reviewer's eye

- **Poka-yoke via enums (D2).** The four closed lisa sets (`type`/`status`/`priority`/`phase`)
  are BAML enums, so an out-of-set value is unrepresentable in the parsed type. BAML owns
  **shape**; the gates (T-002-02) own **semantics** (DAG, grounding, bounds). This boundary is
  deliberate — verify you agree the split is clean.
- **Enum spelling.** BAML enum members must be uppercase, so members are `Task`/`InProgress`/…
  with `@alias("task")`/`@alias("in-progress")`. `b.parse` returns the **member name**; the
  alias is the model-facing + lisa-frontmatter token. The member→alias mapping is the
  materializer's job (T-002-03) — flagged below.
- **Prompt steers by the charter (D5).** The prompt encodes the five value criteria and the
  four clearing gates as authoring guidance (P1: judgment paid once at authoring), interpolates
  `{{ epic }}`/`{{ charter }}`/`{{ project }}`, and ends with `{{ ctx.output_format }}`. It does
  not re-specify at run time.

## Test coverage

- **Parse pin** — canned reply (1 story, 2 ordered tickets, `depends_on` edge, full value
  triplet) → typed `WorkPlan`; asserts lengths, positional order, enum member values, and the
  value triplet round-trips.
- **Empty-degradation pin** — junk reply → empty plan (documents, not just assumes, the SAP
  leniency downstream must handle).
- **Render pin** — three sentinel inputs appear in the rendered prompt, plus the clearing
  framing. Render-only key guard set inside the bridge child.
- **Gap (acceptable):** no live `claude -p` round-trip — out of scope (T-002-04). No assertion
  on the *full* prompt wording (only sentinels + one framing phrase), so prompt edits won't
  break the test — intentional, but means prompt-quality regressions aren't caught here.

## Open concerns / handoff

1. **CRITICAL for the test architecture — the BAML-on-`bun test` limitation.** The BAML native
   addon completes only **one** native call per `bun test` process; a second hangs to the 5 s
   timeout. T-002-01 works around it with a subprocess bridge + **type-only** client imports in
   the test (a value import reloads the addon into the test process and reintroduces flakiness).
   **Any future ticket that wants to call BAML from a `bun test` file must do the same** — call
   it in a child process, keep client imports type-only. This is the single most important thing
   to carry forward. (The runner T-002-03 runs as a normal `bun` process, not `bun test`, so it
   can call `b` directly — the limit is specific to the test runner.)
2. **SAP degrades malformed replies to an EMPTY `WorkPlan` (never throws).** `WorkPlan` is an
   all-array class, so `b.parse` cannot reject. **T-002-02's value gate / T-002-03's runner must
   classify an empty plan as MALFORMED** (it advances nothing). Pinned by a test and by the
   `decompose.baml` header.
3. **Enum member ↔ lisa token mapping is unbuilt.** T-002-03's materializer must convert
   `DraftStatus.InProgress` → `in-progress` etc. (the `@alias` values) when writing frontmatter.
   The aliases in `decompose.baml` are the source of truth for that map.
4. **`package.json` is a shared file.** T-002-01 added `baml:gen` and wired `check`. lisa
   serializes commits; if a concurrent S-001 thread also edited `package.json`, re-apply the
   additive two-line scripts change — it is order-independent from `src/` edits.
5. **`baml_client/` is gitignored and regenerated by `check`.** A fresh clone must run
   `bun run baml:gen` (or `bun run check`, which does) before `tsc`/`bun test` resolve the
   client import. The CI backstop (E-002) must invoke a script that regenerates first — `check`
   already does.

## Not done by design

No gates (T-002-02), no runner/materializer/CLI (T-002-03), no live dispense (T-002-04). No
`git commit` — files left for lisa per project convention.
