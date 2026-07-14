# AGENTS.md

Agent context for Codex (and any client that reads `AGENTS.md`). This mirrors `CLAUDE.md` and adds what is normally injected for you elsewhere — as a Codex worker you arrive cold, so **everything you need is either in this file or explicitly linked from it**.

## Project

Vend — a local-first tool that turns repeatable AI-agent work into named, grab-and-go **playbooks**. You author a playbook once (encoding your judgment, process, and quality gates), then pick it off the shelf, allocate a time/token budget, and run it autonomously. Specification is paid once at authoring; every run after is a two-gesture transaction. Under the hood: typed, graph-structured agent orchestration (Claude Code as the first executor, behind an executor interface so other models slot in). The product is consistency — repeatability over a natively probabilistic process, with gates as the contract.

Canonical vision and design principles: `docs/knowledge/vision.md` (read this before proposing scope or architecture).

### Stack

TypeScript on **Bun**. Playbooks are typed code-as-config (a TS module that declares its graph). v1 surface is the **CLI + SVG desk** (ratified 2026-07-13; a TUI may come later as a `vend interactive` mode). Full toolchain record and rationale: `docs/knowledge/stack.md`.

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

## Working a ticket (read this — it is NOT auto-injected for you)

Claude Code workers get the workflow injected into context by lisa automatically. **You do not.** Before starting any ticket:

1. **Read `docs/knowledge/rdspi-workflow.md`** — the six-phase ticket workflow (Research → Design → Structure → Plan → Implement → Review). One markdown artifact per phase, written to `docs/active/work/<ticket-id>/` (research.md, design.md, structure.md, plan.md, progress.md, review.md).
2. **Read your ticket's story first, then the ticket.** The story file (named in the ticket's `story:` frontmatter, under `docs/active/stories/`) carries the contract — scope, acceptance, honest boundary, wave rationale, out-of-slice. Read it before research, every time; the ticket alone is not the full picture.
3. **Respect the charter grounding.** Tickets cite charter codes with their one-line meaning inline (e.g. "P7 — Budget is a hard contract"). The full charter is `docs/knowledge/charter.md`.

House rules that gates and reviewers will hold you to:

- **Done means committed.** A ticket is not done until its code, tests, and work artifacts are committed and `bun run check` is green (the pre-commit hook runs the tests — do not bypass it).
- **Pure core, impure shell.** Logic lives in pure functions taking plain values (see any `*-core.ts`); fs/clock/network live in thin effect wrappers. Tests pin the pure core.
- **Honest on outcome.** If acceptance isn't met, say so in review.md and stop — never soften a red result. Stay inside the story's stated scope; out-of-slice items are listed in the story for a reason.
- No `codebase-memory` MCP assumptions — explore with plain file reads; the repo is small enough.
