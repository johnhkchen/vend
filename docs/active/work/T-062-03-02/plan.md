# T-062-03-02 — Plan

Ordered, independently-verifiable steps. The deliverable is a **green confirm** (one new test file) +
a **pending-capture record**; **no production code** is anticipated. Gate throughout: `bun run check`
(`baml:gen → tsc --noEmit → bun test`). Each step commits atomically.

## Testing strategy

- **Unit/integration (the whole confirm):** one new addon-free test file
  `src/kitchen/kitchen-degrade.test.ts`, three layers:
  1. **scaffold-reality** (integration, guarded-live): the materialized kitchen seed ships no
     `.mcp.json` ⇒ `readProjectMcpServers` reports codebase-memory-mcp absent.
  2. **resolve/flags** (pure): the real `DECOMPOSE_TOOLS` degrades against that empty registry —
     strict, read-only, `reducedGrounding:true`, no andon; argv carries no `--mcp-config`.
  3. **cast** (integration, stub executor): casting `DECOMPOSE_TOOLS` on the scaffolded root clears
     `success`, writes `reducedGrounding:true` (survives revive), writes no `missing-capability` row.
- **No live test:** the metered steer→work drive is T-062-03-03 (non-deterministic, spends tokens).
  Its expected result is recorded as a pending gold-master, not asserted here.
- **Verification criteria:** `bun run check` green; the three blocks fail loudly if (a) the overlay
  ever ships a registry declaring the server, (b) `DECOMPOSE_TOOLS` is re-required, or (c) the cast
  stops writing the marker / starts andoning.

## Steps

### Step 1 — Block 1: scaffold-reality pin
- Write `src/kitchen/kitchen-degrade.test.ts` with the file-local fixtures (`tmps`/`afterEach`/`tmp`,
  `CMM`) and the first `describe`/`test`: `runInit(root,"kitchen")` →
  `readProjectMcpServers(root)` → `expect(available).toEqual([])` and `.not.toContain(CMM)`.
- **Verify:** `bun test src/kitchen/kitchen-degrade.test.ts` — Block 1 green.
- **Why first:** it confirms the premise (empty registry on the real seed) the other blocks rely on.

### Step 2 — Block 2: real-constant resolve + flags
- Add the second `describe`/`test`: import `DECOMPOSE_TOOLS`, `AUTONOMOUS_DENY`, `resolveTools`,
  `toolFlags`. Scaffold (or reuse via a `scaffoldKitchen()` helper), read `{available, path}`, assert
  the full degraded `resolved` shape and the read-only `toolFlags` (no `mcpConfig`, deny =
  `AUTONOMOUS_DENY`).
- **Verify:** Block 2 green; deliberately temp-break by passing `["codebase-memory-mcp"]` to confirm
  the assertion flips to `reducedGrounding:false` (then revert) — proves the pin bites.

### Step 3 — Block 3: cast through the stub on the scaffolded root
- Add `SAMPLE_STREAM` + `stubExecutor` + `degradeProbePlay` (echo play with `tools: DECOMPOSE_TOOLS`),
  copied thin from `cast.test.ts`. Add the third `describe`/`test`: `castPlay(...)` against the
  scaffolded root with `runLogPath` under it; assert `outcome:"success"`, `materialized:true`, the
  `runs.jsonl` `reducedGrounding:true` marker, and `reviveRecord` agreement.
- **Verify:** `bun test src/kitchen/kitchen-degrade.test.ts` — all three blocks green.

### Step 4 — Full gate
- `bun run check` — typecheck + the whole suite green (no regression in cast/init/run-log tests).
- **Verify:** exit 0.

### Step 5 — The record artifact
- Write `docs/active/work/T-062-03-02/EXPECTED-OUTCOME.degrade.md`: the pending banner, the
  deterministic half transcribed from Block 2's proven shape, the `What | Target | Actual (live)` table
  with `⟪…⟫` slots, the re-run gestures for T-062-03-03, the honest-on-outcome footer.
- **Verify:** the artifact's "deterministic half" matches the test's asserted shape verbatim (no drift
  between the proof block and the assertion).

### Step 6 — Commit
- One commit: `test(kitchen): confirm graceful degrade without codebase-memory-mcp on the kitchen seed
  (E-062 S-062-03)` — the test + the record. (Two commits if Step 5 reads cleaner separately.)

## Risks / mitigations

- **`Play` fixture type friction** — the echo play must satisfy `Play<I,O>`; copy the exact shape from
  `cast.test.ts:30-44` (which compiles) and only add `tools: DECOMPOSE_TOOLS`. Mitigation: reuse, don't
  invent.
- **Executor import surface** — `DispenseOptions`/`ResultMessage`/`StreamMessage` are re-exported from
  `executor.ts` (verified). Use the `cast.test.ts:9` import line as-is.
- **Unexpected gap** — if a block fails, the seam does NOT already hold; document the deviation in
  `progress.md`, and the ticket becomes a fix (scope the minimal `src` change). Not anticipated.
- **`runInit` cost** — three scaffolds (one per block) are cheap (tmpfs); a `scaffoldKitchen()` helper
  keeps it DRY but is optional. Always `rm` in `afterEach`/`finally`.

## Done = 
`bun run check` green; `kitchen-degrade.test.ts` proves scaffold→empty-registry→`DECOMPOSE_TOOLS`
degrade→`reducedGrounding:true`→no andon on the real seed; `EXPECTED-OUTCOME.degrade.md` records the
free half + pends the metered half for T-062-03-03; `review.md` written.
