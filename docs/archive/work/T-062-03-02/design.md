# T-062-03-02 — Design

**Decision in one line:** this is a **confirm-and-record** ticket (the T-062-03-01 shape). Add a
focused, addon-free test that binds the **real materialized kitchen scaffold** → an **empty MCP
registry** → the **real `DECOMPOSE_TOOLS`** declaration → the **degrade outcome** (strict, read-only,
`reducedGrounding: true`, no andon), plus a **pending-capture degrade gold-master** the live drive
(T-062-03-03) diffs against. **No production code change is expected** — the seam already degrades and
the overlay already ships no `.mcp.json`; the work is to LOCK that on the real seed and RECORD it.

## What the AC actually requires us to prove

| AC clause | What proves it (deterministically, offline) |
|---|---|
| codebase-memory-mcp absent from the registry | `runInit(root,"kitchen")` then `readProjectMcpServers(root).available` does **not** contain `codebase-memory-mcp` (in fact `[]`; no `.mcp.json` shipped) |
| completes via reduced-grounding read-only tools | `toolFlags(resolveTools(DECOMPOSE_TOOLS, available), path)` ⇒ `allowedTools:["Read","Grep","Glob"]`, `strictMcp:true`, **no `mcpConfig`** |
| sets the reduced-grounding flag | `castPlay(<play with real DECOMPOSE_TOOLS>, …, {projectRoot: scaffoldRoot, executor: stub})` ⇒ run record `reducedGrounding: true` (survives revive) |
| throws no missing-capability andon | the same resolve is `ok:true`; the same cast's `summary.outcome !== "missing-capability"` (it succeeds) |

The "steer" leg of steer→work needs no proof of its own: `steerPlay` declares no `tools` ⇒ passthrough
⇒ it never requires (so never andons on) codebase-memory-mcp. The degrade lives entirely in the
**decompose leg inside `work`'s chain** — that is what we exercise. (Documented, not tested, since there
is nothing MCP-shaped on steer to assert.)

## Options considered

### A. Pure-resolve test only — `resolveTools(DECOMPOSE_TOOLS, [])`
Assert the real exported constant degrades. **Cheapest, addon-free.**
- ✅ Binds the *real* tool declaration (not `cast-core.test`'s hand-built `{optionalMcp:["a"]}`).
- ❌ Does NOT touch the **materialized seed** — passes `[]` by hand, so it never proves the *scaffold*
  yields `[]`. That is exactly the "on the real seed, not the spike" clause the ticket exists for.
- ❌ Does not exercise the run-record marker (clause "sets the flag" only inferred, not observed).

### B. Scaffold-reality + pure-resolve (two focused pins)
(1) `runInit(root,"kitchen")` ⇒ `readProjectMcpServers(root).available` lacks codebase-memory-mcp.
(2) `resolveTools(DECOMPOSE_TOOLS, available)` ⇒ strict, `reducedGrounding:true`, `mcp:[]`, no andon;
and `toolFlags(...)` ⇒ read-only argv, no `mcpConfig`.
- ✅ Closes the gap A leaves: the **scaffold** is what produces the empty registry the degrade reads.
- ✅ Addon-free (uses `DECOMPOSE_TOOLS` from the addon-free core + the pure resolve/flags + the impure-
  but-light `readProjectMcpServers`).
- ⚠️ "Sets the reduced-grounding flag" is proven at the resolution layer, not on a run **record**. The
  record-marker round-trip is already covered by `cast.test.ts` + `run-log.test.ts` (with a mirror).

### C. B + a full cast through the stub executor on the scaffolded root (chosen)
Add (3): cast a play carrying the **real `DECOMPOSE_TOOLS`** through the **stub-executor seam**
(`castPlay({executor})`) against the **real scaffolded root**, asserting `outcome:"success"` (≠
`"missing-capability"`) and the run record's `reducedGrounding:true` (survives `reviveRecord`).
- ✅ Most faithful to the AC's *verb*: it actually **drives a cast** ("Driving … work … completes …
  sets the flag … no andon"), end to end, on the real seed, offline.
- ✅ Strictly stronger than `cast.test.ts:118`: that uses an **ad-hoc empty temp dir** + a **hand-
  mirrored** tools object; (3) uses the **materialized kitchen scaffold** + the **real exported
  constant**, closing both substitutions in one test.
- ✅ Still addon-free: the cast play is a thin echo-shaped fixture (parse=echo, gates=clear,
  effect=noop) whose ONLY real ingredient is `tools: DECOMPOSE_TOOLS`. The real `decomposeEpicPlay`
  is not imported (it would load BAML); we bind its *tool contract*, which is all the seam reads.
- ⚠️ Slightly more fixture (a stub executor + echo play), but both are ~15 lines and mirror
  `cast.test.ts` precedent exactly.

**Chosen: C** (which contains B). Three layers, each with a clean failure message: scaffold-reality,
the real-constant resolve/flags, and the real-constant cast. Together they are the end-to-end chain
the AC names, with no spike, no mirror, no ad-hoc dir.

## Rejected and why

- **A alone** — never touches the materialized seed; fails the ticket's whole "not the spike" reason.
- **Casting the REAL `decomposeEpicPlay`** — value-imports the BAML addon into `bun test`, violating
  the house addon-free doctrine; and its `parse`/`effect` would need real BAML output + would write
  tickets. The seam reads only `play.tools`, so binding `DECOMPOSE_TOOLS` on an echo play is the exact
  same input to `resolveTools` with none of the addon weight.
- **A live `vend work` drive in this pass** — non-deterministic, spends tokens, needs a login; it is
  T-062-03-03's job. We record its expected outcome as a pending gold-master instead.
- **Adding a `.mcp.json` to the kitchen overlay** — would DEFEAT the ticket: the whole point is that a
  fresh cook repo lacks the server and still clears. The overlay correctly ships none; we confirm it.
- **Asserting steer andon-freedom via a steer cast** — steer declares no tools, so there is nothing to
  resolve; a passthrough cast proves nothing about the degrade. Documented in prose instead.

## The record artifact (gold-master component)

Mirror T-062-03-01's pending-capture form, scoped to the degrade path only (the full epic-level
`EXPECTED-OUTCOME.md` is T-062-04-01's; the live capture is T-062-03-03's):

- **`docs/active/work/T-062-03-02/EXPECTED-OUTCOME.degrade.md`** — banner `⚠️ NOT YET CAPTURED —
  PENDING THE HUMAN-AUTHORIZED METERED DRIVE (T-062-03-03)`. Carries:
  - the **deterministic half, proven for free**: a `degrade-resolve.proof.txt`-style block showing the
    scaffold yields no codebase-memory-mcp and `resolveTools(DECOMPOSE_TOOLS, scaffoldAvailable)`
    degrades to strict read-only with `reducedGrounding:true` and no andon (generated by the test, or
    transcribed from it);
  - a `What | Target | Actual (live)` table with `⟪…⟫` slots for the live drive's `runs.jsonl`
    `reducedGrounding:true` line, the decompose `outcome`, and the absence of any `missing-capability`
    record;
  - a re-run block (the exact `vend init --template kitchen` + `vend steer` + `vend work` gestures
    T-062-03-03 will meter).

This keeps the artifact **honest-on-outcome**: the free half is captured now; the metered half is an
explicit pending slot, never a fabricated "Actual."

## Expected outcome of the confirm (stated up front, honestly)

The seam is expected to **already hold**: the overlay ships no `.mcp.json`, `DECOMPOSE_TOOLS` is already
`optionalMcp`, and E-060 already built + tested the degrade. So the deliverable is a **green confirm +
a record**, not a fix. If, contrary to expectation, the scaffold DID ship a registry declaring
codebase-memory-mcp (it does not), the test would fail loud and the finding would flip to a real gap —
the test is written to surface that either way.

## House conventions to obey

- **Test style:** `init-kitchen.test.ts` (guarded-live `mkdtemp → runInit → assert → rm` in `finally`,
  `exists` helper, no mocks) for the scaffold layer; `cast.test.ts` (stub executor, `BIG_BUDGET`,
  `runLogPath` under the temp root, `reviveRecord` round-trip) for the cast layer.
- **Addon-free:** import `DECOMPOSE_TOOLS`/`AUTONOMOUS_DENY` from `decompose-epic-core.ts` /
  `autonomous-deny.ts` (never `decompose-epic.ts`), `resolveTools`/`toolFlags` from `cast-core.ts`,
  `readProjectMcpServers` from `mcp-registry.ts`, `castPlay` from `cast.ts` (already addon-free; the
  cast play is a fixture).
- **No silent caps / honest tally:** assert the *exact* degraded shape (deny = `AUTONOMOUS_DENY`,
  allow = the three built-ins, `mcp: []`) so a regression that, say, re-required the MCP fails loudly.
- **Gate:** `bun run check`. New `.test.ts` only; no `src` production change anticipated.
