# Playbook — Codebase Index (grounding the dev loop in a structural graph)

A **development-time practice**, not a Vend product feature. Index *vend itself* with
the local `codebase-memory-mcp` so the agents that **build** vend — the RDSPI Research
phase, the steering moves, decompose/propose — ground in a structural knowledge graph
(type-resolved calls, Leiden modules, complexity hot-paths) instead of ad-hoc file
reads. Cheaper (mana: query the graph, don't re-read the tree), more complete
(cross-file call resolution the agent would miss), and it surfaces real issues grep
can't (hidden O(n²), god-functions, dependency-direction violations).

**Local-first is moot here** (it would matter for a *product* play, not this): the MCP
is a stdio binary (`~/.local/bin/codebase-memory-mcp`) — nothing leaves the machine.
This is tooling for *us*, the way `lisa` and `dagger` are.

## The play — how to index

- `index_repository(repo_path, mode="moderate")`. **moderate** = filtered files +
  similarity/semantic edges — the clean-source-graph default. Verified on vend: it
  auto-excludes `node_modules`, `baml_client`, `.git`, `docs`, `ci/sdk`, and the
  `.vend/*` runtime (10 dirs) with no config. Result: **466 nodes / 1051 edges** over
  37 TS files. Use `full` only when you need similarity over *every* file; `fast` to
  skip semantic edges for speed.
- **Verify** the index: `index_status`, then `get_architecture(aspects=["all"])`.
- **Freshness is the discipline.** The graph goes stale the moment the loop commits.
  Re-index (or `detect_changes` for a delta) **after code moves**. Candidate follow-up:
  wire a re-index to the `on-clear` lisa hook (the same coarse trigger as `check:head`)
  so the dev index stays auto-fresh — a small buildable signal, pull if it pays off.
- **Sharing:** `persistence=true` writes `.codebase-memory/graph.db.zst` so teammates /
  CI bootstrap from the artifact instead of re-indexing. (gitignore or commit the
  artifact per team call; default `false` keeps the repo clean.)

## How to query — the value, by phase

- **Research (RDSPI):** `get_architecture` for the map — `layers` (entry/core/internal/
  leaf), `clusters` (de-facto modules), `boundaries` (cross-package calls), `hotspots`
  (fan-in). `search_code` for graph-ranked grounded search (definitions first, tests
  last — token-efficient). `query_graph` (Cypher) for complexity hot-paths.
- **Design / Structure:** read `boundaries` + `clusters` to keep a change on the *real*
  seams. On vend the graph confirms the keystone invariant (engine=core, executor=core,
  `play` depends up) — a violation would show as a new boundary edge the wrong way.
- **Steering:** the index *generates kaizen signals*. Example from the first index:
  `parseDemandSignals` carries `linear_scan_in_loop=2` — a hidden O(n²) in the demand
  parser (harmless at board scale; noted, not pulled). That is the index earning its
  place — surfacing what a file-read wouldn't.

## Best practices (distilled)

1. **moderate mode** for a clean source graph; **re-index for freshness**; **persistence**
   only to share.
2. **Query the graph before reading files** — `get_architecture`/`search_code` first,
   open the file second (mana-efficiency; `mana-economics.md`).
3. **Trust but verify** — the graph is a *map*; confirm against source before editing.
4. **Don't adopt its stores as Vend's.** Its `manage_adr` overlaps our
   `.vend/decisions.jsonl`; its `ingest_traces` overlaps `.vend/runs.jsonl` (the E-013
   calibration dataset). For dev we use the MCP as a **read/query layer only** — our
   local-first stores stay canonical; dual-write would drift (`go-and-see.md`).

## Verified — is it fleshed out?

Yes (indexed 2026-06-19). The server is empty until `index_repository`, but the
machinery is real: type-aware LSP call resolution, Leiden community detection, and
complexity analysis (`cyclomatic`/`cognitive`, `transitive_loop_depth`,
`linear_scan_in_loop`). On vend it correctly recovered the layering, clustered the true
modules, and found real hot-paths — accurate enough to ground the dev loop.
