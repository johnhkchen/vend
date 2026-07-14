# EXPECTED-OUTCOME — graceful degrade without codebase-memory-mcp (kitchen seed)

> ⚠️ **NOT YET CAPTURED — PENDING THE HUMAN-AUTHORIZED METERED DRIVE (T-062-03-03).**
> This records the **degrade path** component of the kitchen gold-master. The **deterministic half**
> (scaffold → empty registry → `DECOMPOSE_TOOLS` degrades) is **captured now, for free** (proven by
> `src/kitchen/kitchen-degrade.test.ts`). The **metered half** (a live `vend steer` → `vend work`
> drive writing a real `reducedGrounding:true` line) is captured by T-062-03-03 and rolled into
> T-062-04-01's full `EXPECTED-OUTCOME.md`. Every live value below is a `⟪…⟫` slot, never a fabricated
> Actual (honest-on-outcome).

**Seam:** E-060 #3 — `optionalMcp` reclassification. A fresh cook repo has no `codebase-memory-mcp`
installed; the cold-start steer→work path must **clear with reduced grounding**, not andon.
**Subject:** the materialized `vend init --template kitchen` workspace (EmDash+Astro seed).
**Outcome of the confirm:** the seam **already holds** — this is a confirm + record, not a fix. The
kitchen overlay correctly ships **no `.mcp.json`**, and `decomposeEpicPlay` already declares the
codebase-memory server **optional**, so the degrade is the designed path.

---

## The deterministic half — CAPTURED (free, offline)

Proven by `src/kitchen/kitchen-degrade.test.ts` (3 blocks, addon-free, guarded-live). The chain:

```
runInit(root, "kitchen")                       # the REAL scaffold (base + kitchen overlay)
  → readProjectMcpServers(root).available  ==  []          # no .mcp.json shipped ⇒ server ABSENT
  → resolveTools(DECOMPOSE_TOOLS, [])       ==  {
        ok: true,                  # NOT the missing-capability andon (ok:false)
        strict: true,
        mcp: [],                   # codebase-memory-mcp DROPPED from the scoped set
        allowedTools: ["Read", "Grep", "Glob"],   # read-only built-ins survive
        deny: ["AskUserQuestion"], # AUTONOMOUS_DENY
        reducedGrounding: true,    # the honest, countable degrade flag
      }
  → toolFlags(...)                          ==  {
        allowedTools: ["Read", "Grep", "Glob"],
        strictMcp: true,
        disallowedTools: ["AskUserQuestion"],
        # NO mcpConfig — no server left to load (no --mcp-config on the argv)
      }
  → castPlay(<play with DECOMPOSE_TOOLS>, …, {projectRoot: root, executor: stub})
        summary.outcome      == "success"           # completes; not "missing-capability"
        summary.materialized == true
        runs.jsonl[0].reducedGrounding == true       # the flag lands on the run RECORD
        reviveRecord(rec).reducedGrounding == true   # …and survives the read boundary
```

This is the AC, deterministically, on the real seed: **codebase-memory-mcp absent** → **completes via
reduced-grounding read-only tools** → **sets the reduced-grounding flag** → **no missing-capability
andon**. The cast even emits the honest live line:
`· reduced grounding — optional codebase-memory MCP absent; proceeding (degraded, recorded)`.

---

## The metered half — PENDING (T-062-03-03)

| What | Target | Actual (live) |
|---|---|---|
| `vend init --template kitchen` scaffolds the seed | `scaffolded`, no `.mcp.json` | ⟪…⟫ |
| `vend steer` (no MCP required → passthrough) | board clears, no andon | ⟪…⟫ |
| `vend work` drives the propose→decompose chain | clears, spends down the wallet | ⟪…⟫ |
| decompose cast `outcome` | `success` | ⟪…⟫ |
| decompose `runs.jsonl` line carries `reducedGrounding:true` | present (`true`) | ⟪…⟫ |
| any `missing-capability` record written | **none** | ⟪…⟫ |
| live drive emits the reduced-grounding stdout line | yes | ⟪…⟫ |

Note: `vend steer` never appears as a degrade — `steerPlay` declares **no tools**, so it is a
passthrough cast that inherits the global MCP set and **cannot andon** on a missing
codebase-memory-mcp. The degrade lives entirely in the **decompose leg inside `vend work`'s chain**
(the only play in the flow declaring `optionalMcp`).

---

## Re-run block (T-062-03-03 will meter this)

On a fresh machine WITHOUT `codebase-memory-mcp` installed (its expected cook-repo state):

```bash
vend init --template kitchen        # free — scaffolds the seed, writes NO .mcp.json
vend steer                          # METERED — ranks the kitchen board (passthrough; no MCP needed)
vend work                           # METERED — drives propose→decompose; decompose DEGRADES, clears
# then confirm the record:
grep '"reducedGrounding":true' .vend/runs.jsonl   # the decompose cast's honest degrade marker
grep '"outcome":"missing-capability"' .vend/runs.jsonl   # MUST be empty (no andon)
```

Expected: `vend work` clears the board with the decompose cast recording `reducedGrounding:true` and
**zero** `missing-capability` rows — the cold-start path drove to a clean stop on read-only grounding.

---

## Honest-on-outcome footer

This artifact records a **confirm**: the graceful-degrade seam already holds on the materialized kitchen
seed, locked by `kitchen-degrade.test.ts`. The deterministic half is captured for free; the metered
half is an explicit pending slot for the human-authorized drive (T-062-03-03), never a fabricated
Actual. If a future change ever ships a `.mcp.json` in the overlay or re-requires the MCP, the test
fails loudly and this record's premise is void.
