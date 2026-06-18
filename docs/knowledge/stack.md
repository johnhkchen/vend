# Vend — Stack & Tooling

Canonical record of the implementation toolchain and the decisions behind it.
Read alongside `vision.md` (the why) and `rdspi-workflow.md` (how we work).
When a ticket proposes a tool or pattern that contradicts this doc, one of the
two is wrong — surface it.

---

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Language / runtime** | **TypeScript on Bun** | Only option that is both strongly typed *and* has a native Claude Agent SDK (best Claude Code integration). Fast local startup, single toolchain (runtime + package manager + test runner), clean path to a TUI. |
| **Playbook format** | **Typed code-as-config** | A playbook *is* a typed TS module that declares its graph. Types for free; gates are real functions; maximally expressive. Fastest to build; a declarative export layer can come later. |
| **v1 surface** | **TUI (terminal)** | Closest to the "grab a Coke" shelf feel while staying local-first. Browse the shelf, pick, allocate budget, watch runs — all in the terminal. |
| **Executor (first)** | **Claude Code** via Claude Agent SDK (TypeScript) | Vision mandate. Abstracted behind an executor interface so open models slot in later. |

---

## Available toolchain (verified on this machine)

| Category | Available |
|---|---|
| Typed runtimes | TypeScript (Node 22.22, **Bun 1.3.9**), Rust/cargo 1.96, Python 3.14 |
| Package managers | bun, npm 10, pnpm 10, yarn, uv |
| Agent / exec | **Claude Code CLI 2.1** (+ Agent SDK), lisa 0.2.11, **zellij 0.44** (terminal multiplexer), gh 2.93, jq |

---

## Project conventions (Bun TypeScript)

These are the intended conventions; they become real when the project is
scaffolded (first epic). Codified here so every ticket targets the same setup.

- **Runtime & package manager:** `bun` for both. Lockfile: `bun.lock`.
- **TypeScript:** strict mode on. `tsconfig.json` with `"strict": true`,
  `"noUncheckedIndexedAccess": true`.
- **Tests:** `bun test` (built-in runner; no separate framework).
- **Lint / format:** Biome (single fast tool for both) — to be confirmed at
  scaffold time.
- **Local state:** `bun:sqlite` (built-in) for run state and the shelf index;
  plain files for playbook source. To be confirmed at scaffold time.

### Intended commands

```bash
bun install        # install dependencies
bun run build      # typecheck + bundle
bun test           # run tests
bun run lint       # lint + format check
vend               # launch the TUI shelf (once built)
```

### Intended source layout

```
src/
  playbook/    # typed authoring API — definePlaybook(), node/gate/budget types
  engine/      # graph orchestrator — DAG scheduling, concurrency, retries
  executor/    # executor interface + Claude Code (Agent SDK) adapter
  gate/        # gate evaluation: pass | fail | retry | escalate
  budget/      # time/token allocation + hard-contract enforcement
  shelf/       # playbook discovery, registry, naming
  tui/         # terminal surface: browse, pick, allocate, watch
  state/       # local-first persistence (run state, shelf index)
```

*This layout is provisional — it sketches the subsystem boundaries that the
epics will formalize, not a committed file tree.*

---

## Open / to-confirm at scaffold time

- **TUI library** — e.g. Ink (React-for-terminals) or OpenTUI vs. a lower-level
  lib; and whether zellij is used as a multiplexing substrate for concurrent run
  panes (as lisa does) or runs are rendered in-process.
- **Lint/format tool** — Biome vs. ESLint+Prettier.
- **Persistence** — `bun:sqlite` vs. flat files for run state.
- **Claude Agent SDK** — exact package + invocation mode (SDK session vs.
  headless `claude -p` subprocess).
