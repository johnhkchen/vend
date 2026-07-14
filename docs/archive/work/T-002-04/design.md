# T-002-04 — Design: live-dispense-proof

The decision: **how do we prove the loop dispenses for real, across all four ACs,
without mutating the live board and without writing throwaway product code?** Grounded
in Research: the spine is built and green; the only unproven surface is the live
round-trip; `materialize` writes to the board so isolation is mandatory; `lisa
validate` needs a `lisa init`-ed root.

## D1 — Apparatus: a committed driver script, not ad-hoc CLI invocations

**Options.**
- (a) Drive each scenario with the existing CLI (`vend run decompose-epic … --budget
  …`), manipulating `cwd` to isolate. Rejected: the CLI exposes neither `projectRoot`
  nor `transcriptDir` nor a run-log path (cli.ts:83 calls `runDecomposeEpic` with only
  `epicPath`+`budget`). Isolating AC1's materialization would force `cwd=sandbox`,
  which **splits the run-log ledger** across sandboxes — AC1 wants the record in
  `.vend/runs.jsonl`. It also can't set distinct `runId`s for readable transcripts.
- (b) **A small driver (`live-proof.ts`) that calls `runDecomposeEpic` directly**,
  passing `projectRoot` per scenario, a shared repo-rooted `transcriptDir`, and an
  explicit `runId`. Chosen. It exercises the *exact same* impure orchestrator the CLI
  does (no test-double), keeps one ledger at the repo `.vend/runs.jsonl`, and is
  **re-runnable proof apparatus** — it can be re-run any time to re-verify the play.
- (c) Add `--project-root` to the CLI. Rejected for this spike: that's product scope
  (belongs to the E-003 shelf CLI), not a proof; it would also normalize materializing
  into arbitrary roots, which we don't want to bless yet. Flagged as a follow-up.

**Why (b) wins.** It is the thinnest thing that proves the live loop honestly: real
orchestrator, real seam, real gates, real `lisa validate`, one ledger, isolated
materialization. By the house purity rule it is an *impure verb composed of tested
impure verbs* — untested, exactly like the CLI `import.meta.main` dispatch.

## D2 — Isolation: one `lisa init`-ed sandbox per scenario, real charter copied in

Every run targets its own `projectRoot` under `.vend/live-proof/<scenario>/`
(gitignored). The driver prepares each sandbox by spawning `lisa init --path
<sandbox>` (scaffolds `CLAUDE.md`, `rdspi-workflow.md`, hooks, `.lisa.toml`,
`.claude/settings.local.json` — all of which `lisa validate` demands, per Research)
and copying the **real** `docs/knowledge/charter.md` in (so the bounds gate greps the
live `P#`/`N#`, not a stub). Consequence: even a scenario that *unexpectedly* succeeds
materializes into a sandbox — **the live board can never be touched**, which closes
review concern #5 structurally rather than by care. The run-log path stays
cwd-relative (driver runs from repo root) ⇒ one ledger at repo `.vend/runs.jsonl`.

Rejected alternative: run the non-materializing scenarios (AC2/AC3) against the repo
root directly (safe *because* they stop before materialize). Rejected because it
relies on the outcome being a stop — if AC3's under-specified epic surprised us by
clearing, it would clobber the live board. Uniform sandboxing removes that footgun.

## D3 — Scenario mapping (one run per AC, plus one bonus for P7's other dimension)

| # | AC | Epic input | Budget `{timeMs, tokens}` | Expected outcome | Materializes? |
|---|---|---|---|---|---|
| **A1** | AC1 + AC4 | **E-001.md** (the real, hand-cleared epic) | `{600000, 400000}` generous | `success` | yes → sandbox, `lisa validate` ✓ |
| **A2** | AC2 (token dim) | tiny fixture epic | `{600000, 1}` | `budget-exhausted` | no |
| **A3** | AC3 | under-specified fixture epic | `{600000, 400000}` | `gate-failed` (named gate) | no |
| **A4** | AC2 (time dim) | tiny fixture epic | `{1, 400000}` | `timed-out` | no |

**Why E-001 for A1.** AC1 says "a real epic"; AC4 wants the gap vs the **by-hand
E-001** decomposition. Running the machine over E-001 itself satisfies both at once
and yields the canonical kaizen diff (E-001.md:75 asks for exactly this). Its
materialized ids (S-001…, T-00x-…) would collide with the live board — harmless
because A1 materializes into a sandbox (D2).

**Why a tiny fixture for A2/A4.** The token check is post-completion (Research hazard
4): a tiny **token** budget still makes a full live call before tripping
`budget-exhausted`, so we minimize the wasted call by feeding the smallest viable epic.
A4's tiny **time** budget SIGKILLs near-instantly (near-free) and proves the *other*
P7 dimension — together A2+A4 prove "budget is a hard contract **both ways**" (P7)
across both faces (tokens + wall-clock). A2 is the literal "budget andon"; A4 is the
companion. Both satisfy AC2's "no partial materialization."

**Why a deliberately empty epic for A3.** The most *reliable* gate stop given a
non-deterministic model is the SAP empty-degradation path (Research hazard 2): an epic
with no groundable content makes an honest model decline / emit nothing → SAP yields an
**empty `WorkPlan`** → the **value** gate stops it (`<plan>`: "plan has no tickets —
it advances nothing (malformed/empty)"). Even if the model emits a few half-formed
tickets, the value gate's purpose/advances/doneSignal checks are the next most likely
trip. Either way A3 produces a **named** gate andon and zero materialization (AC3).

## D4 — Non-determinism: record reality, assert *shape*, re-run A1 if it stops

Live output is probabilistic. The spike's contract is honesty, not a fixed transcript.
The driver records each run's actual outcome; the proof note (AC4) reports what
happened. For A1 specifically AC1 *requires* a validated success — if the model trips a
gate or returns malformed output on the first pass, the driver surfaces the andon and
the run is **re-attempted** (the same gesture, the probabilistic process the gates
exist to tame). If A1 cannot clear after a couple of attempts, that itself is a
high-value finding recorded as the first kaizen signal (the gates are doing their job;
the prompt or the epic needs tightening). We do **not** weaken a gate to force a pass —
that would invert the contract (P3).

## D5 — Capturing the AC4 numbers without new code

Tokens / cost / wall-clock come from three places already produced: the terminal
`result` message in each transcript (`usage`, `total_cost_usd`, and the true model
id — closing review concern #4 by *reading* it, not threading it), the run-log record
(`outcome`, normalized `usage`, `costUsd`), and the driver wrapping each run in a
`Date.now()` wall-clock measurement (the driver is allowed a clock; it is apparatus,
not the pure runner). The driver writes a machine-readable `results/summary.json` and
the human-readable kaizen note lives in `proof.md`.

## D6 — What gets committed vs what stays gitignored

Committed (the durable proof): the driver `live-proof.ts`, the fixtures, and the
write-ups (`proof.md`, plus the RDSPI artifacts). Gitignored (run-time output): the
sandboxes, transcripts, and `.vend/runs.jsonl` under `.vend/` — these are *evidence*
quoted into `proof.md`, not source. This keeps the working tree clean while the proof
itself (apparatus + recorded numbers) is reviewable in git.

## Decision summary

A committed, re-runnable **driver** (D1) runs **four scenarios** (D3) each in an
isolated **`lisa init`-ed sandbox with the real charter** (D2), proving success+validate
(AC1), both P7 budget dimensions (AC2), a named gate stop with no garbage (AC3), and
recording tokens/cost/wall-clock + the E-001 by-hand-vs-machine gap (AC4) — without a
line of new product code and without ever touching the live board.
