# T-062-03-02 — Research

**Ticket:** task — `confirm-graceful-degrade-without-codebase-memory-mcp` (story S-062-03, epic E-062).
**Goal:** exercise the E-060 graceful-degrade seam **end-to-end on the real materialized seed** with
`codebase-memory-mcp` ABSENT (its expected state on a fresh cook repo), so the cold-start steer→work
path **clears with reduced grounding** instead of firing the missing-capability andon.

Descriptive only — what exists, where, how it connects, the constraints. No solution here.

## The acceptance criterion, read closely

> Driving steer→work with codebase-memory-mcp absent from the registry completes via reduced-grounding
> read-only tools, sets the reduced-grounding flag, and throws no missing-capability andon.

Four observable clauses, all on the **materialized seed** (not the spike, not an ad-hoc temp dir):
1. **codebase-memory-mcp absent from the registry** — the *scaffolded kitchen workspace* (what `vend
   init --template kitchen` lays down) does not declare the server, exactly as a brew-installed cook
   repo lands.
2. **completes via reduced-grounding read-only tools** — the cast scopes to the read-only built-ins
   (`Read`/`Grep`/`Glob`), the absent MCP dropped from the scoped set.
3. **sets the reduced-grounding flag** — the run record carries `reducedGrounding: true` (the honest,
   countable marker), so a degraded clear is visible in the ledger.
4. **throws no missing-capability andon** — `resolveTools` returns `ok: true` (a degrade), not the
   `ok: false` refusal; the cast renders, dispenses, gates, and logs.

## The seam, end to end (the E-032 → E-060 wire)

The capability path is the same one `castPlay` runs for every cast (`src/engine/cast.ts:140-180`):

```
readProjectMcpServers(root)  →  { available, path }        # IMPURE: reads <root>/.mcp.json
resolveTools(play.tools, available)  →  ResolvedTools       # PURE: the decision
  ├─ ok:false  → missing-capability ANDON (early return, logged, nothing dispensed)
  └─ ok:true   → toolFlags(resolved, path) → dispense → parse → gate → effect → appendRunLog
```

Key modules and the exact facts that matter here:

- **`src/engine/mcp-registry.ts`** — `readProjectMcpServers(root)` reads `<root>/.mcp.json` and returns
  `{ available: string[], path }`. **A MISSING file ⇒ `{ available: [], path }`** (the ENOENT catch,
  line 51-59). So a repo with no `.mcp.json` reports an empty server set — no crash, the "safe
  direction." `parseMcpServerIds` is the pure, unit-tested half; the read is the one thin impure verb.

- **`src/engine/cast-core.ts:112-138` — `resolveTools(declared, available)`** (PURE, the heart):
  - `declared === undefined` ⇒ passthrough (undeclared play inherits the global MCP set).
  - `required = declared.mcp ?? []`; a missing required id ⇒ `{ ok: false, missing }` — **the andon.**
  - `optional = declared.optionalMcp ?? []`; `presentOptional = optional ∩ available`;
    **`reducedGrounding = presentOptional.length < optional.length`** — true iff ≥1 optional id absent.
  - on success: `{ ok: true, strict: true, mcp: [...required, ...presentOptional], allowedTools:
    [...allow], deny, reducedGrounding }`. An absent **optional** id is **dropped, never andoned.**

- **`src/engine/cast-core.ts:175-186` — `toolFlags(resolved, path)`** projects the resolution to argv.
  On a degrade (`reducedGrounding: true`, `mcp: []`): `mcpConfig` is **omitted** (no servers to load),
  `allowedTools = [...allow]` (the read-only built-ins), `strictMcp: true`, `disallowedTools = deny`.
  So the degraded cast runs **strict, read-only, with no `--mcp-config`** — clause 2 exactly.

- **`src/engine/cast.ts:284-315`** — when `resolved.reducedGrounding` is truthy, `castPlay` threads
  `reducedGrounding: true` onto the `appendRunLog` input (one-way, spread only when true).

- **`src/log/run-log.ts`** — `reducedGrounding?: boolean` (record field, ~line 147),
  `normalizeReducedGrounding` (line 280: **only `true` is kept**, `false`/absent omitted),
  `buildRunRecord` spreads it (line 332), `reviveRecord` re-normalizes on read (line 443/460). The
  run-outcome union (line 52) carries the distinct `"missing-capability"` outcome — the andon's label.

## The one play in steer→work that exercises the seam

`vend work` (`src/play/work.ts:213-230` `castWork`) drives `spendDown`, casting
`castProposeDecomposeChain` per board signal → `proposeEpicPlay` then `decomposeEpicPlay`.

- **`decomposeEpicPlay` is the ONLY play in the flow that declares `optionalMcp`**
  (`src/play/decompose-epic-core.ts:74-78`, `DECOMPOSE_TOOLS`):
  ```ts
  export const DECOMPOSE_TOOLS: PlayTools = {
    optionalMcp: ["codebase-memory-mcp"],   // E-060 #3: reclassified required → optional
    allow: ["Read", "Grep", "Glob"],        // read-only built-ins
    deny: AUTONOMOUS_DENY,                   // ["AskUserQuestion"]
  };
  ```
  It lives in the **addon-free core** (`decompose-epic-core.ts` imports only types / pure modules —
  header lines 4-20), so a test can read the **real exported constant** WITHOUT loading the BAML addon.
  `decompose-epic.ts:234-239` sets `tools: DECOMPOSE_TOOLS` on the play and documents the degrade.
- **`proposeEpicPlay`** declares a deny-only `tools` (no MCP) ⇒ passthrough, never andons.
- **`steerPlay`** (`src/play/steer.ts:70-79`) declares **no `tools` field at all** ⇒ `resolveTools`
  passthrough ⇒ it inherits the global MCP set and **cannot andon on codebase-memory-mcp** (it never
  requires it). So the "steer" leg of steer→work completes trivially; the **degrade lives in the
  decompose leg inside `work`'s chain.** This is the load-bearing reading of the AC.

## The cold-start state is already real on the materialized seed (the central finding)

`runInit(root, "kitchen")` applies `mergeManifests(SCAFFOLD_MANIFEST, KITCHEN_OVERLAY)`. **Neither the
base scaffold nor the kitchen overlay ships a `.mcp.json`:**
- `grep -niE "mcp|\.mcp\.json" src/init/init-core.ts src/kitchen/kitchen-overlay.ts` ⇒ **no matches.**
- `find . -name .mcp.json -not -path '*/node_modules/*'` ⇒ only `./​.mcp.json` (the **vend dev repo's
  own** registry, which DOES declare codebase-memory-mcp — irrelevant to a scaffolded cook repo).

So a freshly scaffolded kitchen workspace has **no `.mcp.json`** ⇒ `readProjectMcpServers` returns
`available: []` ⇒ codebase-memory-mcp is **genuinely absent** ⇒ `resolveTools(DECOMPOSE_TOOLS, [])`
degrades (`reducedGrounding: true`, `ok: true`). **The seam already holds on the real seed** — unlike
T-062-03-01 (which found a genuine gap: the seed didn't carry intent), this ticket is expected to
**confirm an already-correct seam**, not fix one. The job is to **lock it with a test on the real
scaffold** and **record the degrade gold-master**, so a later drive can't silently regress it.

The reclassification rationale (`decompose-epic-core.ts:59-65`): requiring codebase-memory-mcp raised
fresh-seed onboarding friction against P2/P5; the make-or-break steer→board path never needs the MCP;
so a fresh seed without the server now clears with reduced grounding. The kitchen seed is precisely
the fresh-seed case that motivated E-060.

## Existing coverage — and the exact gap this ticket closes

- **`src/engine/cast-core.test.ts:181-233`** — pure `resolveTools`: optional present ⇒ scoped,
  `reducedGrounding:false`; optional **absent ⇒ strict + `reducedGrounding:true`, NOT andon**; the
  mix; the toolFlags degrade projection (line 321). All with **hand-built** `{optionalMcp:["a"],…}`.
- **`src/engine/cast.test.ts:118-143`** — `castPlay` against an **ad-hoc empty temp dir** with a
  **hand-mirrored** `groundedEchoPlay` (`tools: {optionalMcp:["codebase-memory-mcp"], allow:[…]}`):
  degrades, writes `reducedGrounding: true`, survives revive. Lines 145-163: the present-server case.
- **`src/log/run-log.test.ts`** — the marker's build/normalize/revive round-trip.

**The gap (the "on the real seed, not the spike/mirror" distinction):** nothing binds (a) the
**materialized kitchen scaffold's** actual registry state to (b) the **real exported `DECOMPOSE_TOOLS`**
declaration to (c) the degrade outcome. The existing tests prove the *mechanism* with mirrors and ad-hoc
dirs; this ticket proves the *shipped scaffold* feeds the mechanism — the same "materialized seed, not
the spike" move T-062-03-01 made for the steer-intent seam.

## The record / gold-master precedent (mirror T-062-03-01)

T-062-03-01 records the steer board as a **pending-capture** gold-master component (banner `⚠️ NOT YET
CAPTURED`, `⟪…⟫` slots for the live actuals, the deterministic half proven for free). The same form
applies here: the **deterministic degrade half** (scaffold → empty registry → `DECOMPOSE_TOOLS`
degrades → strict read-only argv, no `--mcp-config`) is provable **offline and for free**; the **live
runs.jsonl `reducedGrounding:true` marker** from a metered steer→work drive is captured by **T-062-03-03**
(the human-authorized cast) and rolled into **T-062-04-01**'s full `EXPECTED-OUTCOME.md`.

## Constraints carried into Design

- **No offline `vend work` / `vend steer` drive that gates honestly with the real plays** — the real
  `decomposeEpicPlay` value-imports the BAML addon (parse/effect), which `bun test` must not load
  (house addon-free doctrine). So the cast-level proof uses the **stub-executor seam**
  (`castPlay({executor})`, `cast.test.ts`) with a play carrying the **real `DECOMPOSE_TOOLS`**, against
  the **real scaffolded root** — the strongest offline binding without the addon.
- **The live metered drive is a DIFFERENT ticket** (T-062-03-03) — non-deterministic, spends tokens,
  needs a Claude login; it cannot run in this autonomous RDSPI pass.
- **`bun run check`** (`baml:gen → tsc --noEmit → bun test`) is the gate; new tests must stay
  addon-free and torn down in `finally` (the `init-kitchen.test.ts` / `cast.test.ts` discipline).
- **Honest-on-outcome** — if the confirm shows the seam already holds (the expectation), the artifact
  must say so plainly (a confirm, not a fabricated fix), and the record must mark the live half pending.

## Open questions for Design

- **Where the tests live** — a new `src/kitchen/kitchen-degrade.test.ts` (clear ownership of the
  degrade seam) vs. extending `init-kitchen.test.ts` (T-062-02-01's file).
- **How many layers** — (1) scaffold ⇒ registry has no codebase-memory-mcp; (2) `resolveTools(
  DECOMPOSE_TOOLS, scaffoldAvailable)` degrades; (3) full `castPlay` through the stub on the scaffolded
  root writes the marker + no andon. All three, or fold (1)+(2)?
- **Whether any production code changes** — expected NONE (the seam already degrades; the overlay
  already ships no `.mcp.json`); confirm this holds and record it honestly.
- **The record artifact's scope** — a degrade-only `EXPECTED-OUTCOME.degrade.md` component in this work
  dir vs. deferring entirely to T-062-04-01 (respecting its ownership of the full epic-level capture).
