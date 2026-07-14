# T-062-03-02 — Review

**Ticket:** `confirm-graceful-degrade-without-codebase-memory-mcp` (S-062-03, E-062).
**Verdict:** ✅ done. The E-060 graceful-degrade seam is **confirmed to hold on the materialized
kitchen seed** with codebase-memory-mcp absent, locked by a new addon-free test, and the degrade
gold-master is recorded for the live drive. **No production code changed** — the seam already degrades
correctly; this ticket binds it to the real seed + real constant and records it.

## What changed

| File | Kind | Summary |
|---|---|---|
| `src/kitchen/kitchen-degrade.test.ts` | **new** | 3 blocks, 19 `expect()`: scaffold-reality, real `DECOMPOSE_TOOLS` resolve/flags, cast-through-stub on the real seed |
| `docs/active/work/T-062-03-02/EXPECTED-OUTCOME.degrade.md` | **new** | pending-capture degrade gold-master (T-062-03-01 form) |
| `docs/active/work/T-062-03-02/{research,design,structure,plan,progress,review}.md` | **new** | the RDSPI trail |
| `src/**` production | **unchanged** | none needed (see "Why no fix") |

Committed as `e5677bc`.

## How the AC is met

> Driving steer→work with codebase-memory-mcp absent from the registry completes via reduced-grounding
> read-only tools, sets the reduced-grounding flag, and throws no missing-capability andon.

Proven deterministically, offline, on the **materialized** seed (not the spike, not a mirror):
- **absent from the registry** — Block 1: `runInit(root,"kitchen")` ⇒ `readProjectMcpServers(root)
  .available === []`. The scaffold ships no `.mcp.json`, so the server is genuinely absent.
- **completes via reduced-grounding read-only tools** — Block 2: `toolFlags(resolveTools(
  DECOMPOSE_TOOLS, []), path)` ⇒ `allowedTools:["Read","Grep","Glob"]`, `strictMcp:true`, **no
  `mcpConfig`** (no server to load).
- **sets the reduced-grounding flag** — Block 3: `castPlay(...)` on the scaffolded root ⇒ `runs.jsonl`
  `reducedGrounding:true`, surviving `reviveRecord`.
- **no missing-capability andon** — Blocks 2+3: `resolved.ok === true` and `summary.outcome ===
  "success"` (≠ `"missing-capability"`).

The "steer" leg needs no test of its own: `steerPlay` declares no `tools` ⇒ passthrough ⇒ it never
requires (so never andons on) codebase-memory-mcp. The degrade lives in the **decompose leg inside
`vend work`'s chain** — the only play in the flow declaring `optionalMcp` — which is exactly what the
test exercises.

## Why no production fix (and how that's honest, not a skip)

Unlike T-062-03-01 (which found a real gap — the seed didn't carry intent — and fixed it), the
graceful-degrade seam was **already correct**:
- the kitchen overlay + base scaffold ship **no `.mcp.json`** (the cold-start state is real);
- `decomposeEpicPlay` already declares the MCP **optional** (`DECOMPOSE_TOOLS`, E-060 #3);
- E-060 already built + tested the resolve→flags→cast→run-log mechanism.

The value this ticket adds is **closing the substitutions** the prior tests left open:
`cast-core.test.ts` resolved a hand-built `{optionalMcp:["a"]}`; `cast.test.ts` cast a hand-mirrored
play under an ad-hoc empty dir. This ticket feeds the **real scaffold's actual registry** into the
**real exported `DECOMPOSE_TOOLS`** — so a regression that re-required the MCP, or an overlay that
accidentally shipped a `.mcp.json`, now fails loudly. The test is written to surface a real gap either
way; it confirmed there is none.

## Test coverage

- **Strong** on the deterministic seam: all four AC clauses pinned, each with a clean failure message;
  the full degraded shape asserted exactly (deny = `AUTONOMOUS_DENY`, allow = the three built-ins,
  `mcp:[]`) so partial regressions bite.
- **Addon-free + guarded-live**: real `mkdtemp`/`runInit`/`castPlay`, torn down in `afterEach`, no
  mocks; the real BAML-laden `decomposeEpicPlay` is never imported (only its tool contract).
- `bun run check` — **1479 pass, 1 skip, 0 fail**; typecheck clean. No regression in the
  cast/init/run-log suites.

### Gaps / what is NOT covered (by design)
- **The live metered drive** — `vend steer` → `vend work` actually spending tokens is **T-062-03-03**
  (non-deterministic, needs a Claude login); recorded as `⟪…⟫` slots in `EXPECTED-OUTCOME.degrade.md`,
  never fabricated.
- **The real `decomposeEpicPlay`'s `parse`/`effect`** under degrade — not exercised offline (would load
  the BAML addon); the seam reads only `play.tools`, which is bound to the real constant, so this is a
  deliberate, safe scope cut.

## Open concerns / handoff

- **None blocking.** The seam holds; the gate is green; the record is honest (confirm + pending).
- **T-062-03-03** fills the live `⟪…⟫` slots (the real `reducedGrounding:true` line + zero
  `missing-capability` rows) and asserts them against this record.
- **T-062-04-01** rolls the degrade component into the epic-level `EXPECTED-OUTCOME.md`.
- **Watch-for-regression**: if any future overlay change ships a `.mcp.json` or re-requires the MCP,
  `kitchen-degrade.test.ts` Blocks 1–2 fail — the intended tripwire.

## Reviewer's quick-look

Read `src/kitchen/kitchen-degrade.test.ts` (the whole confirm, ~160 lines) and
`EXPECTED-OUTCOME.degrade.md`'s "deterministic half" block. The test's asserted shape and the record's
proof block are intentionally verbatim-aligned — if they ever drift, one is wrong.
