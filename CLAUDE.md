# CLAUDE.md

## Project

Vend — a local-first tool that turns repeatable AI-agent work into named, grab-and-go **playbooks**. You author a playbook once (encoding your judgment, process, and quality gates), then pick it off the shelf, allocate a time/token budget, and run it autonomously. Specification is paid once at authoring; every run after is a two-gesture transaction. Under the hood: typed, graph-structured agent orchestration (Claude Code as the first executor). The product is consistency — repeatability over a natively probabilistic process, with gates as the contract.

Canonical vision and design principles: `docs/knowledge/vision.md` (read this before proposing scope or architecture).

### Stack

TypeScript on **Bun**. Playbooks are typed code-as-config (a TS module that declares its graph). v1 surface is a terminal **TUI**. First executor is **Claude Code** (via the Claude Agent SDK), behind an executor interface so open models slot in later. Full toolchain record and rationale: `docs/knowledge/stack.md`.

```bash
bun install        # install dependencies
bun run build      # typecheck + bundle
bun test           # run tests
bun run lint       # lint + format check
```

*(Commands are the intended conventions; they become live once the project is scaffolded in the first epic.)*



### Directory Conventions

```
docs/active/tickets/    # Ticket files (markdown with YAML frontmatter)
docs/active/stories/    # Story files (same frontmatter pattern)
docs/active/work/       # Work artifacts, one subdirectory per ticket ID
```

---

The RDSPI workflow definition is in docs/knowledge/rdspi-workflow.md and is injected into agent context by lisa automatically.
