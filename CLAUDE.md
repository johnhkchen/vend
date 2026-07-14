# CLAUDE.md

## Project

Vend — a local-first tool that turns repeatable AI-agent work into named, grab-and-go **playbooks**. You author a playbook once (encoding your judgment, process, and quality gates), then pick it off the shelf, allocate a time/token budget, and run it autonomously. Specification is paid once at authoring; every run after is a two-gesture transaction. Under the hood: typed, graph-structured agent orchestration (Claude Code as the first executor). The product is consistency — repeatability over a natively probabilistic process, with gates as the contract.

Canonical vision and design principles: `docs/knowledge/vision.md` (read this before proposing scope or architecture).

### Stack

TypeScript on **Bun**. Playbooks are typed code-as-config (a TS module that declares its graph). v1 surface is the **CLI + SVG desk** (ratified 2026-07-13; a TUI may come later as a `vend interactive` mode). First executor is **Claude Code** (via the Claude Agent SDK), behind an executor interface so open models slot in later. Full toolchain record and rationale: `docs/knowledge/stack.md`.

```bash
bun install        # install dependencies
bun run check      # THE gate: BAML codegen + typecheck + full test suite — must be green before any commit
bun test           # tests only
bun run build      # typecheck
```

Bun is pinned ≥ 1.3.13 (`.github/release-target.env`); do not upgrade it — 1.3.14 segfaults under the BAML native addon.

### Directory Conventions

```
docs/active/epic/       # Epic cards (markdown with YAML frontmatter)
docs/active/stories/    # Story files (same frontmatter pattern)
docs/active/tickets/    # Ticket files (same frontmatter pattern)
docs/active/work/       # Work artifacts, one subdirectory per ticket ID
```

---

The RDSPI workflow definition is in docs/knowledge/rdspi-workflow.md and is injected into agent context by lisa automatically. Read your ticket's story (the `story:` frontmatter, under `docs/active/stories/`) before research — it carries the contract: scope, acceptance, honest boundary, out-of-slice.

`AGENTS.md` is this file's counterpart for Codex workers (self-contained — it inlines what lisa injects). When editing shared content here, mirror it there.
