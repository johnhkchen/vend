# T-026-01 — Design: how to smoke-verify the E1 instrument

Goal (from AC): one `vend run … --intervened` and one `--no-intervened` each **complete and append a genuine record carrying the `intervened` bit**, and `vend audit` **reads them back**; record readiness (or a named blocking flaw) in `docs/active/work/T-026-01/`.

Three real decisions: **(D1)** how to make the smoke deterministic and side-effect-free, **(D2)** what epic to point at, **(D3)** how to verify write + read.

---

## D1 — Outcome control: force a deterministic non-materializing outcome

The full real-session path must run (A3), but the materialize effect must not fire (A2). `castPlay` runs the effect only when `verdict.materialize` is true — i.e. only on `success`. Every andon (`budget-exhausted`, `timed-out`, `gate-failed`) logs the record (with the bit) and writes nothing.

### Options

- **Option A — tiny token ceiling ⇒ `budget-exhausted`.** `--budget 600000,1`. The LLM call completes normally (10-min wall-clock is ample), then `check()` compares real usage (~tens of thousands of tokens) against the ceiling of `1` ⇒ `exhausted` ⇒ effect skipped. **Deterministic** (any real generation exceeds 1 token), real metered usage logged, **zero board writes**, bit logged. Cost ≈ one full decompose generation.
- **Option B — tiny wall-clock ⇒ `timed-out`.** `--budget 1000,200000`. Kills the SDK early via SIGKILL → `ClaudeTimeoutError` → `timed-out`. Cheaper (generation aborted) but **flaky** (race against spawn/first-token; a too-short timeout can fail to produce a clean terminal message) and logs `usage: {}` (0 tokens) — a less honest "real session". Rejected for flakiness.
- **Option C — let it succeed, accept materialize.** Real success, but writes story/ticket files → board pollution, then a cleanup step. Rejected (A2; cleanup is error-prone and a `git`-tracked board churn).
- **Option D — target an already-decomposed epic hoping for `id-collision`.** Non-deterministic: the model may invent fresh ids and materialize duplicates. Rejected (A2 not guaranteed).

### Decision: **Option A** — `--budget 600000,1`.

Rationale: it is the only option that is simultaneously **deterministic**, **side-effect-free**, and **honest** (real LLM call, real metered usage in the record). `budget-exhausted` is a clean terminal outcome whose record carries the same `intervened` field a `success` would; the bit's threading is outcome-independent (research §"Key structural fact"), so an andon proves the wire exactly as well as a success — without the materialize blast radius. The token ceiling does not reduce generation cost (A4), but cost is intrinsic to a real smoke and bounded.

> Note on honesty: a `budget-exhausted` record is an **andon**, not a walk-away success. That is correct for an *instrument-readiness* probe (A1): T-026-01 proves the bit is recorded and read; it does not claim to measure the walk-away rate. The sprint's real measurement (T-026-02+) casts under real budgets.

## D2 — Subject: a dedicated `verify-*` probe epic, off the board

The record's `epic` field comes from the epic frontmatter `id:` (`epicIdOf`). To keep the two probe records clearly **excludable** from the real E1 dataset (A1) and to avoid adding a real epic to the board:

### Decision: create `docs/active/work/T-026-01/verify-epic.md` with `id: verify-e1-instrument-readiness`.

- Lives **inside the ticket's work dir**, not in `docs/active/epic/` — so `lisa`/the board never see it as a real epic. (It is a work artifact like the others.)
- `id: verify-e1-instrument-readiness` matches the `verify-*` exclusion convention the attestation basis already uses — the two records are self-labelling probes.
- Because Option A guarantees `budget-exhausted` (no materialize), the epic's *content* never reaches the board regardless of what it says. A minimal but well-formed epic body is enough for `assembleInputs` to read and `render` to prompt on.

Rejected: pointing at a real epic (e.g. `E-014.md`) — would log `epic: "E-014"`, indistinguishable from real E1 data and polluting the very dataset the sprint will read.

## D3 — Verification: assert both write and read

Two independent checks, both scriptable and deterministic:

1. **Write check.** After each cast, read the **last** line of `.vend/runs.jsonl` and assert: `epic === "verify-e1-instrument-readiness"`, `intervened === true` (first cast) / `intervened === false` (second cast), and `outcome === "budget-exhausted"`. The `false` case is the important one — it proves the writer distinguishes "clean walk-away" from "unknown" (research: `normalizeIntervened` keeps `false`, omits absence).
2. **Read check.** Run `vend audit verify-e1-instrument-readiness` and assert the findings fragment reports `reported: 2`, `intervened: 1`, walk-away rate `50%` (1 of 2 ran untouched). This proves `auditWalkAway` picks up **both** records (both outcomes carry the bit) and that `false`/`true` are counted correctly.

   - Scoping audit to the probe play/epic is via the `[<play>]` positional — but audit filters by **play**, not epic. The probe play is `decompose-epic`, which has many other records. So instead assert against the **full** ledger delta: capture `vend audit` intervention `reported`/`intervened` counts before and after, and assert they increase by exactly `+2` / `+1`. (This is more robust than an epic filter audit does not support.)

> The 50%/2-report numbers are **probe** numbers, not the sprint's verdict. They demonstrate the audit math reads both bits; they are not E1 evidence.

## What this design explicitly is NOT

- Not building or modifying any source code. T-026-01 is a spike: the deliverable is a **readiness verdict** + the evidence behind it. The instrument already exists (T-014-01); this verifies it on the live path. If a flaw is found, it is recorded as a **named blocking prerequisite**, not fixed here.
- Not collecting E1 walk-away data. That is the rest of E-026.

## Risks & mitigations

- **R1 — live cast fails (auth/network).** Then the live AC cannot be met; record it as a *named blocking flaw* ("live `vend run` unavailable in this environment") plus the code-path readiness proof. Mitigation: the autonomous loop cast successfully earlier today, so this is unlikely.
- **R2 — a generation somehow stays ≤1 token.** Impossible for a real decompose (it emits a plan); `check` would then return `ok` and the gate phase would run — still no materialize unless gates pass *and* the (≤1-token) output parses to a valid plan, which it cannot. Negligible.
- **R3 — board pollution.** Eliminated by Option A (effect never runs on `budget-exhausted`). Verified post-hoc with `git status` showing no new `docs/active/{stories,tickets}` files.
