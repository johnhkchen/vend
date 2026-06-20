# T-036-01 — Plan: ordered implementation steps

Each step is independently verifiable; two atomic commits at the natural boundaries (declare, prove).

## Testing strategy

- **Unit (no native addon):** `requestShape` is PURE — tested directly on fabricated request
  objects in `decompose.test.ts`. No bridge spawn, no BAML load. Fast and deterministic.
- **Bridge / integration (one native call per process):** the render-shape proof spawns the
  decompose bridge once (batched ops) and asserts on the returned `RequestShape`. This is the
  existing subprocess pattern — already deterministic, already offline (render-only).
- **`baml:gen` green** is the gate for the client declaration (Step 1).
- **Full gate:** `bun run check` = `baml:gen` + `tsc --noEmit` + `bun test`. Green before each commit.
- **No live model anywhere** — every env var is a render-only dummy; no `fetch`, no network.

## Verification criteria (map to Acceptance Criteria)

- AC-1 (client declared, `baml:gen` green, `ClaudeStub`/defaults unchanged) ⇐ Steps 1, 5; `git diff`
  shows only an *addition* to `clients.baml`.
- AC-2 (render targets selectable client, builds openai format, asserted on shape, API confirmed in
  artifact) ⇐ Steps 2-4; the design.md D2 note records the confirmed `{ client }` contract.
- AC-3 (deterministic, no live model, `bun run check:*` green) ⇐ Step 5.

---

## Step 1 — Declare `OpenModelStub`, confirm `baml:gen` green

**Edit:** `baml_src/clients.baml` — append the `OpenModelStub` block + render-only comment
(`structure.md` §1). Leave `ClaudeStub` untouched.

**Verify:**
- `bun run baml:gen` → "Wrote 14 files" (green).
- `git diff baml_src/clients.baml` shows only an addition below the existing block.

**Commit:** `feat(baml): OpenModelStub render-only client (openai-generic) — T-036-01`

Rationale for committing here: the declaration is a self-contained, independently-green unit; the
bridge proof builds on it.

## Step 2 — Add `RequestShape` + `requestShape()` to the bridge

**Edit:** `src/baml/decompose-bridge.ts` — add the `RequestShape` type and the PURE `requestShape`
extractor (`structure.md` §2b). Reads `req.url` + `req.body.json()`; computes the four fingerprint
fields. Narrowly typed reach-in.

**Verify:** `bun run check:typecheck` green (helper is unused until Step 3 — that's fine, it's
exported and the test will consume it).

## Step 3 — Thread `client` through the render op

**Edit:** `src/baml/decompose-bridge.ts`:
- `BridgeOp` render variant: add `client?: string` (§2a).
- `BridgeResult` render variant: add `shape: RequestShape` (§2c).
- `runOp`: pass `{ client: op.client }` to `b.request.DecomposeEpic` when set; widen the cast to
  include `url`; return `{ prompt, shape }` (§2d).
- Entry point: add the three openai render-only `??=` env defaults (§2e).

**Verify:** `bun run check:typecheck` green.

## Step 4 — Prove openai-generic format in the test

**Edit:** `src/baml/decompose.test.ts`:
- Add the `client: "OpenModelStub"` render op to the batched `runBridge([...])` (§3a) as op `[3]`.
- New `describe`: assert `[3].shape` is openai format and `[2].shape` stays anthropic (§3b), with
  the url-endpoint assertion and the text-identical / shape-different pin.
- Add the pure `requestShape` unit test on two fabricated requests (§3c).

**Verify:** `bun test src/baml/decompose.test.ts` green; the new assertions pass.

## Step 5 — Full gate + second commit

**Verify:**
- `bun run check` green (baml:gen + typecheck + full test suite — no regressions in the other five
  bridges or anywhere else).
- `git diff --stat` touches exactly `baml_src/clients.baml`, `src/baml/decompose-bridge.ts`,
  `src/baml/decompose.test.ts` (baml_client/ is gitignored).

**Commit:** `test(baml): render targets OpenModelStub, proves openai-generic shape — T-036-01`

---

## Risk / mitigation

- **R1 — openai-generic render fails without `base_url`.** Mitigated by Step 3's entry-point env
  defaults (`??=`). De-risked already in the research spike (render succeeded with dummy env).
- **R2 — the `{ client }` option signature differs from what's documented.** De-risked: read from
  the generated `sync_request.ts:29-56` and exercised in the spike; the string option is the
  funnel BAML's own code uses. Recorded in design.md D2.
- **R3 — `extractPromptText` chokes on openai scalar content.** It already handles scalar content
  (`Array.isArray(c) ? c : [{type:"text",text:c}]`) — confirmed in research. The render text op
  returns for both clients.
- **R4 — native-addon double-call flakiness if a value BAML import sneaks into the test.** Mitigated
  by keeping all test-file BAML imports type-only (existing discipline) and routing every native
  call through the one child spawn.
- **R5 — accidental change to `ClaudeStub` / a default.** Mitigated by `git diff` review at Steps 1
  and 5 (addition-only).

## Deviations

None anticipated. Any divergence from this plan gets recorded in `progress.md` with rationale
before proceeding.
