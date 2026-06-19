# PM — Proposed batch (staged, un-promoted)

> Upstream staging only. These are **signals**, not epics — one-liners left
> un-elaborated until pulled (PE-6). Staging is not pulling; the human pulls one,
> a play clears it onto the active board. Ranked by **leverage, not effort**
> (`demand.md`). Surveyed 2026-06-19 against charter P1–P7 / N1–N4, the IA spine
> (IA-1…IA-16, esp. the open threads), and the codebase index.

## Context at survey time (go-and-see)

- **E-013 just landed** (`vend envelope <play>`): measured envelopes from run-log
  actuals, tier-percentile bound, bias-corrected, honest cold-start. The named
  prerequisite for the 2h macro-wallet is now **met**.
- **`vend envelope` is display-only by design** — code comment: it "DISPLAYS the
  measured default, it does not actuate it into a dispatch (IA-14 … is a later
  rung)." So both the *macro-spend loop* and the *auto-actuation* (IA-14) sit on
  top of a computed-but-unconsumed envelope. That is the live seam.
- **Surface is CLI-only.** Commands: `browse / select / run / chain / envelope`.
  **No TUI exists** — the entire IA spine (Home/Counter/Ledger, the andon
  language) is captured but un-implemented.
- **No Survey play is registered** (only decompose / propose / note / chain). So
  IA-3 (onboarding-*is*-the-core-loop, "run-0 casts Survey") is designed but the
  bootstrap play it names does not exist.
- **Run log = 10 records** → calibration is in the cold-start regime (priors, not
  measured tails). E-013 was built for exactly this, so the wallet can spend on
  priors honestly; but a hard token wall still doesn't exist (IA-8: tokens are
  detect-after).
- No real perf hotspot worth an epic (`pressShelf` is depth-5 branching, no
  `linear_scan_in_loop`); skip.

---

## Ranked shortlist

### 1. The "work for 2 hours" macro-wallet — **Keystone**
**Signal:** a single counter gesture allocates a ~2h feature-block budget; Vend
spends it *down* autonomously across casts (pull/chain until the wallet is empty
or the board is cleared), fitting each next cast into the **remaining** budget at
its measured price.
- **Advances:** P7 (a depleting macro budget as a hard contract), P4 (autonomous
  spend-until-exhausted, not per-cast supervision), P2 (the founding "work for 2
  hours" gesture made literal).
- **Budget:** multi-block (the wallet ledger + the spend-down loop + the
  fit-next-cast-to-remainder logic; bigger than one feature block — flag as
  possibly *several* epics per PE-7).
- **Readiness/deps:** E-013 (measured prices) is the named prerequisite, now
  **done**. `vend envelope` already computes the per-cast price the loop needs to
  subtract. Cold-start priors are honest enough to spend on (10-run log).
- **Rationale:** the explicit rung directly above E-013 (`demand.md` "Not yet
  pulled"), and *is* the vision's headline mechanic ("allocate a budget and run").
  Highest leverage on the board: it converts every prior rung (engine, chain,
  envelopes) into the actual product gesture.

### 2. Envelope actuation — auto-widen / slow-tighten / deadband (IA-14) — **High**
**Signal:** make the measured envelope *actuate* the Confirm default instead of
only displaying it: auto-widen fast on a starved/andon'd play, tighten slowly,
hold inside a ~10% deadband (asymmetric hysteresis).
- **Advances:** P7 (the budget self-corrects toward honest), P4 (auto where
  waiting is costly, per IA-14's stakes split), P1 (spec-once: the author never
  re-tunes budgets).
- **Budget:** ~1 feature block (≈2h). The math is `recalibrate.ts`; this is the
  actuation + deadband state on top.
- **Readiness/deps:** E-013 done; the explicit "later rung" the `envelope`
  command's own code defers. Cleanly *enables* the wallet (#1) spending against a
  self-correcting price rather than a frozen one — pairs naturally, can precede.
- **Rationale:** the one IA loop (IA-12…IA-16) still inert — recalibration
  computes but nothing closes the control loop. Named-deferred in shipped code.

### 3. Survey play — the run-0 bootstrap (IA-3/IA-4) — **High**
**Signal:** register the `Survey` play (read an arbitrary repo → propose a stocked
demand board) so a fresh install has its one honest first move: cast Survey.
- **Advances:** core feature (clearing *direction* into a board), P2 (Survey *is*
  the two-gesture transaction at run-0), N3 (a reusable gated play, not a one-off).
- **Budget:** ~1 feature block (≈2h); a propose-class dispense, board-shaped
  output — lighter than the engine work.
- **Readiness/deps:** the engine + ProposeEpic + materialize all exist; this is a
  new play *on* the proven engine, not new substrate. Surfaced friction F4
  (`project-steering.md`): a planning survey forced through lisa left no
  `runs.jsonl` entry — a registered Survey cast fixes that.
- **Rationale:** the whole onboarding arc (IA-3/4/5, State 0→1) is designed and
  unbuilt; without Survey, run-0 has no honest move and the cold-start story is
  vapor. Unblocks the empty-state half of any future TUI.

### 4. Token hard-wall via `--max-turns` (IA-8) — **Standard**
**Signal:** bound agentic exploration with `--max-turns` / a system-prompt
constraint so the token denomination becomes a real mid-flight wall, not only a
detect-after andon (proven overshoot live at 108.9k/60k).
- **Advances:** P7 (the token half of the budget contract becomes enforceable),
  budget predictability (kaizen "bound dispense exploration", still `ready`).
- **Budget:** small (~1h) — a seam constraint on the executor.
- **Readiness/deps:** independent of the wallet but **strengthens** it — a
  depleting macro budget is leakier while one runaway cast can blow its slice
  past the price the loop subtracted. Sequenced *before or with* #1 it de-risks
  the wallet's accounting.
- **Rationale:** IA-8 names this as "what would make ◇ a real wall"; the kaizen
  signal has sat `ready` since E-001's first runs. Cheap, compounding.

### 5. Design-language session — the visual surface charter — **High (precedes TUI)**
**Signal:** assemble the project-wide *look* (amber-andon palette per IA-9,
run-stream, budget meter, shelf cards) → a capped design charter, downstream of
the IA spine.
- **Advances:** the IA spine made buildable (IA-9 andon language, IA-6 Counter);
  enabler for every future TUI epic.
- **Budget:** ~1 feature block (≈2h); generative, not an audit.
- **Readiness/deps:** IA is captured and stable (the prerequisite). Precedes any
  TUI epic; nothing depends on it yet, so it's an *enabler*, pullable when a TUI
  push is imminent — not before (avoid inventory that rots, PE-1).
- **Rationale:** named in `demand.md` "Not yet pulled". Real, but lower urgency
  than the wallet/actuation while the surface is still CLI — stage it, don't rush.

### 6. The detached / notify mechanism (IA-11 open thread) — **Standard**
**Signal:** decide and build *how* an andon summons the user (terminal bell / OS
notification / an andon board on next launch) — IA-11 settles *that* it summons,
not *how*.
- **Advances:** P4 (Vend is built to be left; the stop is the one event worth
  interrupting for), IA-11.
- **Budget:** small (~1h) for a first mechanism (e.g. terminal bell + a
  next-launch andon summary).
- **Readiness/deps:** load-bearing once the wallet (#1) runs unattended for ~2h —
  an unwatched depleting run *needs* a summon on andon. So it trails #1, not leads.
- **Rationale:** an explicit IA open thread; gains urgency exactly when #1 lands
  (you can't walk away from a 2h run with no summon). Stage now, pull after #1.

---

## Recommended next pull

**#1 — The "work for 2 hours" macro-wallet.** Its named prerequisite (E-013
measured envelopes) just landed, it *is* the vision's headline gesture, and it
converts every rung built so far (engine → chain → measured prices) into the
actual product. One honest caveat: it likely exceeds a single 2h feature block
(PE-7) — when pulled, ProposeEpic should right-size it, plausibly splitting the
**wallet/ledger** from the **spend-down loop**; and pulling **#4 (token wall)**
either first or alongside tightens its accounting against a runaway cast.
