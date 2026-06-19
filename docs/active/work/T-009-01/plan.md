# T-009-01 — Plan: ordered, verifiable steps

Each step is small, independently verifiable, and committable. Verification commands are
`bun run baml:gen`, `bun run check:typecheck`, `bun run check:test` (or `bun run check`,
which chains all three).

## Step 1 — Author `baml_src/propose.baml`
Write the header comment, the three enums (`CardColor`, `CardType`, `CardRarity`) with
uppercase-first members + lowercase `@alias`, the `class EpicCard` (frontmatter +
stat-block + body, every field `@description`'d), and `function ProposeEpic(signal,
charter, project) -> EpicCard` with `client ClaudeStub` and the PE-1…PE-7 prompt framing
ending in `{{ ctx.output_format }}`.
- **Verify:** file written; visually matches the `note.baml` shape (header → types →
  function).

## Step 2 — Regenerate the client
`bun run baml:gen`.
- **Verify:** exits 0; `baml_client/types.ts` now contains `export interface EpicCard`
  and `export enum CardColor/CardType/CardRarity`. (Confirms the `.baml` parses and the
  version pin is satisfied.)

## Step 3 — Author `src/baml/propose-bridge.ts`
Mirror `note-bridge.ts`: `ProposeBridgeOp`/`ProposeBridgeResult` types, `runOp` (parse →
`b.parse.ProposeEpic`, render → `extractPromptText(b.request.ProposeEpic(...))`), the
`import.meta.main` stdin→stdout protocol. Import `extractPromptText` from
`decompose-bridge.ts`; import `EpicCard` type-only from the client.
- **Verify:** `bun run check:typecheck` green (the bridge resolves `EpicCard` and the
  imported helper).

## Step 4 — Author `src/baml/propose.test.ts`
Type-only imports; `runBridge` spawner; `CANNED` card JSON (alias tokens); sentinels;
module-level batched `RESULTS`; the parse pin, the garbage-reject pin, and the render pin.
- **Verify:** `bun run check:test` green; the three ProposeEpic tests pass alongside the
  existing decompose/note suites.

## Step 5 — Full gate sweep
`bun run check` (gen + typecheck + test) green end to end.
- **Verify:** exit 0, all suites pass. This is AC #3.

## Step 6 — Commit
Stage **only** `baml_src/propose.baml`, `src/baml/propose-bridge.ts`,
`src/baml/propose.test.ts`, and `docs/active/work/T-009-01/*`. Do **not** stage
`baml_client/` (gitignored) or the ticket file's frontmatter. Commit on the current
branch.
- **Verify:** `git status` shows a clean tree apart from Lisa-owned ticket frontmatter;
  `check:committed` is satisfied for source.

## Testing strategy
- **Unit (offline, no network):** the three pins in `propose.test.ts` are the whole test
  surface for this ticket — they directly satisfy AC #2 (parse pin: canned → typed
  EpicCard; render pin: inputs rendered into the prompt).
- **No integration/live test.** Authoring-only; a live cast is T-009-03's concern. The
  garbage-reject pin is the bonus correctness check that EpicCard is a required-scalar
  class (rejects, not degrades) — the property the PE structural gate (T-009-02) will rely
  on.
- **Determinism:** all assertions are over canned/sentinel data through the subprocess
  bridge; no clock, no randomness, no model.

## Mapping to Acceptance Criteria
1. *`propose.baml` defines `ProposeEpic(signal,charter,project) -> EpicCard` with
   frontmatter + stat-block + body; `baml:gen` regenerates the client.* → Steps 1–2.
2. *A unit test feeds a canned reply through `b.parse.ProposeEpic` → typed EpicCard; a
   second asserts `b.request.ProposeEpic(...)` renders the inputs. (No live call.)* →
   Step 4 (parse + render pins via the bridge).
3. *`bun run check:test` / `check:typecheck` green.* → Steps 3–5.

## Rollback / deviation policy
If `baml:gen` refuses (version drift) or a generated field name collides, stop and record
the deviation in `progress.md` before adjusting `propose.baml`. No silent shape changes.
Any departure from the note-bridge mirror (e.g. needing a present-but-empty pin) is
documented in `progress.md` with rationale.
