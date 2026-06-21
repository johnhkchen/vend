# T-039-01 — Plan (ordered, verifiable steps for the live re-sweep)

Each step has an action and an explicit verification. Steps 1–6 map to the ordering in
`structure.md`. Because this is a live metered operation, "testing strategy" means **deterministic
pre-checks before spend** + **verbatim capture + ledger/validate checks after**. There are no unit
tests to add (no code changes); the verification is observational and must be honest.

## Step 1 — Deterministic pre-check (free) — DONE

**Action:** `bun -e` to print `TIMEOUT_HEADROOM` and `timeoutMsFor({timeMs:72785})`; `stat` the
staged `steer.md` mtime vs the newest `docs/active/{epic,stories,tickets}` md.
**Verify:**
- `TIMEOUT_HEADROOM === 2` and `timeoutMsFor({timeMs:72785}) === 145570` (E-038 live). ✓
- `steer.md` mtime (16:02:44) < newest active (17:01:23) ⇒ stale ⇒ fresh board needed. ✓
**Gate:** both pass ⇒ a one-line **go**. (Both passed.) If either failed, abort and record why.

## Step 2 — Stage a fresh board (live cast)

**Action:** `bun run src/cli.ts steer` (the steer board). Capture stdout to the log.
**Verify:**
- Exit success; `run … success (materialized: true)`.
- `staged/steer.md` mtime now ≥ live state ⇒ `isBoardStale` false (the gate will accept it).
- Ledger appended one `play=steer outcome=success` record.
**Fallback:** if `steer` fails or rate-limits, retry once; if still failing, record the failure
verbatim and stop (do not fabricate a board).

## Step 3 — Inspect #1 (the clear-test validity gate)

**Action:** read the fresh board's `## Pull these` block; read signal #1 in full.
**Verify / branch:**
- **Concrete product demand** (decomposable feature/work) ⇒ proceed to Step 4 as-is.
- **Self-referential/meta** ("run the sweep" class) ⇒ record the finding in `sweep-log.md`, and
  point the sweep at the top *concrete* signal (re-rank or select a board whose #1 is real demand)
  before Step 4. A meta-#1 clearing is **not** a valid clear-test.
**Why a gate, not a note:** E-037's degenerate #1 was half its failure; proceeding on a meta-#1
would waste the spend.

## Step 4 — Fund the bounded budget and walk away (the metered sweep)

**Action:** `bun run src/cli.ts work --no-intervened --budget 3600000,1000000`, capturing combined
stdout+stderr verbatim to `docs/active/work/T-039-01/_sweep-raw.txt`. No mid-run steering.
**Verify (the headline observation):**
- Propose **FINISHES** — no `andon: timed-out` at ~72.8 s (the E-038 fix working live). If propose
  now runs past 72,785 ms and completes, that alone confirms E-038 in flight.
- The session reaches a **clean P7 stop** (`board-cleared` | `wallet-exhausted` | `andon`), wallet
  floored ≥0, no crash.
**Budget rationale:** identical to E-037 for comparability; the wallet was never the binding limit.

## Step 5 — Read the receipt + the stop reason

**Action:** render/inspect the `═ vend work — receipt ═` block from the captured output.
**Verify:**
- Per-cast lines: `✓ cleared` (with cost) or amber `⚠ andon: <outcome>`.
- `cleared N` count; final wallet (`◇ tokens / ⏱ time` remaining); `stopped: …` detail.
- auth==exec: the per-cast cost is consistent with the authorized envelope (no 227k→150k mismatch).

## Step 6 — Validate, read the ledger delta, write the verdict

**Action:**
- `lisa validate` — confirm green (the board/repo is consistent; any minted cards are valid).
- `tail` `.vend/runs.jsonl` — read the records this run appended.
- `git status docs/active/{epic,stories,tickets}` — confirm either valid minted cards (on a clear)
  or no partial state (on a 0-clear).
**Verify against AC:**
- **Cleared path:** ≥1 real epic+tickets minted, `lisa validate` green, auth==exec held, and the
  **first cleared forward-E1 record** present (`intervened:false` + `outcome:success`).
- **Honest 0-clear path:** record exactly where it stopped and the **named** bottleneck (e.g.
  "propose finished in ~90 s ✓ but decompose censored / wallet exhausted / token-exhausted"), noting
  it still confirms E-038 if propose finished. No over-claim.

## Step 7 — Write the artifacts

**Action:** write `sweep-log.md` (verbatim receipt + steps + cleared id(s)/named bottleneck + ledger
delta + honest AC verdict table), and `progress.md` (execution log + any deviations). `review.md`
follows in the Review phase.
**Verify:** `sweep-log.md` satisfies AC#5 (verbatim steps + receipt + ids + ledger delta, honest).

## Testing strategy (what stands in for unit tests)

- **Pre-spend (Step 1):** deterministic `bun -e` falsification — the cheapest possible check, run
  before any token is spent.
- **In-flight (Step 4):** the receipt is self-verifying (the meter renders the actual burn).
- **Post-spend (Step 6):** `lisa validate` (green), ledger inspection (the record outcomes), and
  `git status` (no partial state) cross-check the receipt against persisted truth.
- **No new code ⇒ no new unit tests.** The seams under test (`timeoutMsFor`, the spend path) were
  unit-tested in E-038/E-024; this ticket exercises them **live**. If the run surfaces a code defect,
  that is a finding for a follow-up ticket, captured in `review.md` — not patched here.

## Risks & contingencies

- **Live cast cannot run / auth fails:** record verbatim, do not fabricate; the pre-check go still
  stands as confirmation that E-038 is live, and the blocker is named honestly.
- **Still 0-clears:** acceptable per the E-037 standard — name the moved bottleneck.
- **Long wall-clock:** the bounded wallet guarantees a clean stop; capture output even across minutes.
- **Degenerate #1 again:** handled by Step 3's gate (re-point at concrete demand).
