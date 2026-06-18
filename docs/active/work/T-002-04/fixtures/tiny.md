---
id: E-900
title: run-log-pretty-print
status: open          # open | clearing | active | done
advances: [P3, P7]
serves: >
  Make the countable run log readable at the counter — a single read-only command
  that pretty-prints `.vend/runs.jsonl` so a human can see what each run cost and
  whether it cleared, without piping through `jq`.
---

## Intent — the bigger-picture play

The run log (`src/log/run-log.ts`) already writes one JSONL record per run. It is
countable by machine but not glanceable by a human. Add one small, read-only
`vend runs` command that reads the existing ledger and prints a compact table —
run id, play, epic, outcome, tokens, cost. Nothing new is stored; this only *reads*
data the log already keeps. Small on purpose: a single grounded slice.

## Value to the design

Gates and budgets are only trustworthy if their results are visible (P3 — gates are
the contract; P7 — budget is a hard contract). A readable ledger makes "you got what
you paid for" inspectable at a glance instead of only `jq`-able.

## Done looks like

- `vend runs` reads `.vend/runs.jsonl` and prints one row per run (id, play, epic,
  outcome, tokens, cost), newest last.
- It is read-only — it never writes, mutates, or deletes the ledger.
- An empty or absent ledger prints a clean "no runs yet" line, not an error.

## Context & constraints

- Read-only over the existing `run-log.ts` shape; do not change the record schema.
- Pure formatter + one thin fs read, mirroring the house purity split.
- Out of scope: filtering, sorting flags, the full TUI surface (later epics).
