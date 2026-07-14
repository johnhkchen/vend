# A1 — machine decomposition of E-001 (materialized files)

## stories/S-001.md

```
---
id: S-001
title: metered-lever-foundation
type: story
status: open
priority: critical
tickets: [T-001-01, T-001-02, T-001-03, T-001-04]
---

Materialized by Vend's `decompose-epic` play — 4 ticket(s).
```

## stories/S-002.md

```
---
id: S-002
title: decompose-epic-play
type: story
status: open
priority: critical
tickets: [T-002-01, T-002-02, T-002-03, T-002-04]
---

Materialized by Vend's `decompose-epic` play — 4 ticket(s).
```

## tickets/T-001-01.md

```
---
id: T-001-01
story: S-001
title: bun-scaffold-and-check-surface
type: task
status: open
priority: critical
phase: ready
depends_on: []
---

## Context

Stand up the Bun project and the `bun run check:*` command surface every later unit invokes as an andon gate and CI invokes independently.

_Advances: P3_

## Acceptance Criteria

- [ ] `bun run check:test` exits 0 on a Bun project with tsconfig and the check:* scripts wired; nothing else in the epic can build until this passes.
```

## tickets/T-001-02.md

```
---
id: T-001-02
story: S-001
title: claude-dispense-seam
type: task
status: open
priority: critical
phase: ready
depends_on: [T-001-01]
---

## Context

Build the single dispense seam — `claude -p --output-format stream-json` behind an executor interface — so work can actually leave the house and open models slot in later.

_Advances: P6, P1_

## Acceptance Criteria

- [ ] A test spawns the child, streams each message to a hook, reads `usage`/`total_cost_usd` from the terminal `result`, and a wall-clock guard kills a non-returning child.
```

## tickets/T-001-03.md

```
---
id: T-001-03
story: S-001
title: budget-hard-contract
type: task
status: open
priority: critical
phase: ready
depends_on: [T-001-01]
---

## Context

Enforce the time/token budget as a two-way hard contract so a run can never silently overrun what it was allocated.

_Advances: P7_

## Acceptance Criteria

- [ ] Budget exhaustion is a clean hard stop with a clear andon; a test asserts both time and token ceilings refuse continuation rather than exceeding silently.
```

## tickets/T-001-04.md

```
---
id: T-001-04
story: S-001
title: countable-run-log
type: task
status: open
priority: high
phase: ready
depends_on: [T-001-01]
---

## Context

Persist every run's usage/cost/outcome by default in a countable shape, so the later consistency layer is just reading data already there — not a new system.

_Advances: P7, P3_

## Acceptance Criteria

- [ ] A test asserts that after a run a record exists carrying usage, cost, and outcome (including gate refusals), kept by default and countable.
```

## tickets/T-002-01.md

```
---
id: T-002-01
story: S-002
title: baml-decompose-epic-function
type: task
status: open
priority: critical
phase: ready
depends_on: [T-001-01]
---

## Context

Author the DecomposeEpic BAML function (render via `b.request.*`, SAP-parse via `b.parse.*`) encoding the five admission criteria — the play authored once.

_Advances: P1_

## Acceptance Criteria

- [ ] `baml:gen` succeeds under Bun and a test renders a prompt via `b.request` and SAP-parses a sample stream via `b.parse` into a typed WorkPlan.
```

## tickets/T-002-02.md

```
---
id: T-002-02
story: S-002
title: four-clearing-gates
type: task
status: open
priority: critical
phase: ready
depends_on: [T-002-01]
---

## Context

Implement the four value-ordered clearing gates (value → allocation → bounds → structural) that stop the line on the first failure rather than self-certifying.

_Advances: P3_

## Acceptance Criteria

- [ ] Per-gate tests: given a WorkPlan that fails a given gate, the gate refuses, names which gate failed, and halts in value order before later gates run.
```

## tickets/T-002-03.md

```
---
id: T-002-03
story: S-002
title: decompose-epic-runner
type: task
status: open
priority: critical
phase: ready
depends_on: [T-001-02, T-001-03, T-001-04, T-002-01, T-002-02]
---

## Context

Wire seam + budget + log + BAML fn + gates into the end-to-end runner — the convergence node that dispenses a gated, budgeted WorkPlan by gesture.

_Advances: P1, P2, P3, P7_

## Acceptance Criteria

- [ ] Running the runner on a real epic emits a gated, budgeted WorkPlan and refuses with a reason when a gate fails; `bun run check` is green.
```

## tickets/T-002-04.md

```
---
id: T-002-04
story: S-002
title: live-dispense-proof
type: spike
status: open
priority: high
phase: ready
depends_on: [T-002-03]
---

## Context

Run DecomposeEpic by machine on a real epic and compare its output against this hand-cleared decomposition — the keystone proof and the first kaizen signal.

_Advances: P1, P3, P7_

## Acceptance Criteria

- [ ] A live run dispenses a WorkPlan (and a budget-exhaustion run hard-stops cleanly with an andon); the machine decomposition is diffed against the hand-cleared E-001 plan and divergences are recorded.
```
