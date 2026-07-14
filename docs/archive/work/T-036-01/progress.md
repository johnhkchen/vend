# T-036-01 — Progress

Status: **complete.** All plan steps executed, full gate green (988 pass / 0 fail), two atomic commits.

## Steps

| step | what | state | verify |
|---|---|---|---|
| 1 | Declare `OpenModelStub` in `clients.baml` | ✅ | `baml:gen` "Wrote 14 files"; diff addition-only (+18) |
| 2 | `RequestShape` + pure `requestShape()` in bridge | ✅ | `check:typecheck` green |
| 3 | Thread `client` through render op; entry-point env defaults | ✅ | `check:typecheck` green |
| 4 | Openai-format render assertions in `decompose.test.ts` | ✅ | `bun test decompose.test.ts` → 6 pass |
| 5 | Full gate + commits | ✅ | `bun run check` → 988 pass / 0 fail; 2 commits, precommit ok |

## Commits

- `415cce3` feat(baml): OpenModelStub render-only client (openai-generic) — T-036-01
- `1bf570c` test(baml): render targets OpenModelStub, proves openai-generic shape — T-036-01

## Confirmed external contract (the one the ticket flagged)

Runtime client selection is the generated **`BamlCallOptions.client?: string`** option:
`b.request.DecomposeEpic(epic, charter, project, { client: "OpenModelStub" })`. Read from the
generated `baml_client/sync_request.ts:29-56` — BAML resolves the string by building a
`ClientRegistry` and calling `setPrimary(name)` internally. The string form needs no
`@boundaryml/baml` value import (which would load the native addon) and reuses the single client
declaration in `clients.baml`. Exercised end-to-end in the bridge; recorded in `design.md` D2.

## Observed format fingerprint (real built requests, via the bridge)

| field | default (ClaudeStub / anthropic) | `{ client:"OpenModelStub" }` (openai-generic) |
|---|---|---|
| `url` | `…/v1/messages` | `…/chat/completions` |
| `hasMaxTokens` | true (32000) | false |
| `firstRole` | `user` | `system` |
| `contentIsString` | false (blocks[]) | true |
| `prompt` text | — identical across both clients — | (proves the proof is on SHAPE, not text) |

## Deviations from the plan

1. **Pure `requestShape` unit test (plan Step 4 / structure §3c) — dropped, covered by the bridge
   instead.** Reason: a value import of `requestShape` from `decompose-bridge.ts` into the test file
   would transitively run the module's top-level `import { b } from sync_client`, loading the BAML
   native addon **into the `bun test` process** — the exact once-driven flakiness the suite's header
   forbids (and which forces all its BAML imports to be type-only). Rather than add a new pure module
   to dodge the import (structure.md committed to "no new files"), `requestShape` is exercised on
   **real** built requests through the bridge child (ops [2] and [3]). This is *stronger* coverage
   than fabricated inputs — it proves the extractor against actual BAML output for both providers.
   No loss of assurance; net simpler. (No new files; the helper stays in `decompose-bridge.ts`.)

   Everything else followed the plan exactly.

## Scope guards honored

- Render-only — no live dispatch, no `fetch`, no network; every env var a render-only dummy (`??=`).
- `ClaudeStub` + all six function defaults unchanged; `clients.baml` diff is addition-only.
- SAP-parse logic untouched (T-036-02 proves it provider-agnostic).
- No render-follows-`VEND_EXECUTOR` wiring, no `stack.md` note (both T-036-02).
- Only the decompose bridge touched — the single proof vehicle; the other five bridges untouched.
- `baml_client/` regenerated but not committed (gitignored build product).
