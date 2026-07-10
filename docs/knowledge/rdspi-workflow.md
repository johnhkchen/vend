## RDSPI Workflow

Every ticket passes through six phases in order. No phases are skipped regardless of ticket size. Complete all phases in a single continuous pass — do not stop between phases.

### Research

First read the ticket's parent story — the `story:` field in the frontmatter names it, and it answers the "why" questions Research would otherwise re-derive (see The Story Layer below).

Map the codebase. Produce `research.md` (~200 lines).

Descriptive, not prescriptive. What exists, where, how it connects. Identify the files, modules, patterns, and boundaries relevant to the ticket. Surface assumptions and constraints. Do not propose solutions.

Artifact: `docs/active/work/{ticket-id}/research.md`

### Design

Explore options, evaluate tradeoffs, decide with rationale. Produce `design.md` (~200 lines).

Enumerate viable approaches. Assess each against the codebase reality from Research. Choose one and explain why. Document what was rejected and why. The decision must be grounded in the research, not assumptions.

Artifact: `docs/active/work/{ticket-id}/design.md`

### Structure

Define file-level changes, architecture, and component boundaries. Produce `structure.md` (~200 lines).

Specify which files are created, modified, or deleted. Define module boundaries, public interfaces, and internal organization. Establish the ordering of changes where it matters. This is the blueprint -- not code, but the shape of the code.

Artifact: `docs/active/work/{ticket-id}/structure.md`

### Plan

Sequence the implementation steps. Produce `plan.md` (~200 lines).

Break the work into ordered steps that can be executed and verified independently where possible. Define the testing strategy: what gets unit tests, what needs integration tests, what the verification criteria are. Each step should be small enough to commit atomically.

Artifact: `docs/active/work/{ticket-id}/plan.md`

### Implement

Execute the plan. Track progress in `progress.md`. Commit incrementally.

Follow the plan step by step. After each meaningful unit of work, commit. Update `progress.md` with what has been completed, what remains, and any deviations from the plan. If the plan needs adjustment, document the deviation and rationale before proceeding.

Artifact: `docs/active/work/{ticket-id}/progress.md`

### Review

Self-assess the completed work. Produce `review.md` (~200 lines).

Summarize what changed: files created, modified, or deleted. Evaluate test coverage and flag gaps. Surface open concerns, TODOs, or known limitations. Flag critical issues that need human attention. This is the handoff document — what a human reviewer needs to understand the work without reading every diff.

Artifact: `docs/active/work/{ticket-id}/review.md`

---

## Phase Rules

1. **All six phases always run.** Research, Design, Structure, Plan, Implement, Review. Each phase is cheap (~200 lines, a few minutes). Skipping phases based on ticket size is how context degrades.

2. **~200 lines per artifact.** This is not a hard limit but a forcing function for structured thinking. Enough to be thorough, short enough to review quickly.

3. **Phase transitions.** Lisa detects completed artifacts and advances the ticket's `phase` field in the YAML frontmatter automatically. Do not update phase or status fields manually — just produce the artifact and continue to the next phase.

4. **High-leverage phases.** Research and Design artifacts are the best return on review time. Reviewing ~200 lines of research or design catches problems before they become thousands of lines of wrong code. Structure and Plan may auto-advance depending on project configuration.

5. **Artifacts are insurance.** If a session crashes or hits limits, the latest artifact plus the ticket is enough to seed a new session at the correct phase.

---

## The Story Layer

Every ticket belongs to a story, and the story is a contract — the middle layer between epic intent and ticket execution. The ticket says what to build; its parent story says why this slice exists, what "done" means for the slice as a whole, and what was deliberately left out. Stories live in `docs/active/stories/`, one file per story, named by the `story:` field in the ticket frontmatter.

A story body carries five sections:

- **Scope** — which parts of the system the story touches, and what it explicitly does not.
- **Story acceptance** — verifiable done-conditions for the whole story, beyond any single ticket's checkboxes.
- **Honest boundary** — what this story actually proves versus what it defers or leaves unverified, stated plainly rather than hidden.
- **Wave rationale** — why the ticket DAG is shaped the way it is: what runs alone, what runs in parallel, and why that is safe. It sits under the story's `## DAG` block, beneath the ticket graph it explains.
- **Out of this slice** — adjacent work deliberately excluded, so a worker does not scope-creep into it.

The story is written to be read, and its readers are:

- **Executing agents** — you. This matters most for workers arriving cold — for example a cross-vendor agent whose entire context is `AGENTS.md` plus this injected document. For a cold worker, the parent story is the whole brief: the intent that would otherwise be two hops away.
- **The sweep** — the board-review pass that checks Story acceptance when work is closed out.
- **Allocation policy** — downstream tooling that treats the story as the unit of allocation, reading Scope, the DAG, and Wave rationale to decide what can be routed where and run in parallel.

**Working rule: read your ticket's parent story before starting the Research phase.** Return to it whenever a mid-ticket question is really a scope question — "should I also fix X?" is usually answered by Scope or Out of this slice.

These sections are load-bearing, not aspirational: a generated story missing any of them is refused at the source with a named error, before the story file is ever written.

---

## Ticket Format

Tickets live in `docs/active/tickets/`. Each ticket is a markdown file with YAML frontmatter:

```yaml
---
id: T-024-03
story: S-024
title: migrate-climate-calls
type: task
status: open
priority: high
phase: ready
depends_on: [T-024-01, T-024-02]
---

## Context

Description of the work and why it matters.

## Acceptance Criteria

- Concrete, verifiable conditions for done.
```

Fields:
- `id`: Unique ticket identifier (e.g., `T-024-03`)
- `story`: Parent story ID
- `title`: Kebab-case short name
- `type`: `task` | `bug` | `spike`
- `status`: `open` | `in-progress` | `review` | `done` | `blocked`
- `priority`: `critical` | `high` | `medium` | `low`
- `phase`: `ready` | `research` | `design` | `structure` | `plan` | `implement` | `review` | `done`
- `depends_on`: List of ticket IDs that must complete before this ticket starts
- `blocks`: *(optional)* List of ticket IDs that depend on this ticket. Lisa computes this automatically from `depends_on`, so you do not need to maintain it by hand

---

## Concurrency

Lisa computes the DAG from ticket dependencies and spawns threads for all tickets whose dependencies are satisfied. Multiple threads work on the same branch. Commit serialization is handled via file locking -- agents do not need to coordinate with each other.

If two tickets modify the same files, that is a missing dependency edge in the DAG. The lock is a safety net, not a substitute for correct dependency modeling.
