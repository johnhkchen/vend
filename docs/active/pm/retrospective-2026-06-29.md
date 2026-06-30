# Retrospective — the E-055→E-060 arc + founding the kitchen phase (2026-06-29 desk cycle)

> The **retrospective desk-cycle deliverable** (not a minted epic): a grounded retrospective on the recent build arc, capturing fixes + forward
> gaps as ranked demand (staged in `proposed-batch.md`). **Read-never-invent** — every finding cites
> evidence (`.vend/runs.jsonl`, the `work/*/review.md` open-concerns, git, this session's friction).
> Desk-only; promotion stays a human pull. Run 2026-06-29.

## Headline finding — the Set-B round-trip is CODE-complete, not LIVE-verified

**[F1]** The closing "live re-drive → positive gold master" tickets (E-059 `T-059-03`, E-060 `T-060-03-01`)
are `phase:done`, but **the actual metered live drives have no run-log evidence on this device**, and the
reviews flag them as human-deferred:

- `.vend/runs.jsonl` holds **3 records total** — the `steer` + `propose-epic` + `decompose-epic` *I* ran
  this session. **No E-059/E-060 closing-drive casts.**
- `T-059-03` review: *"the one remaining step is a metered, human-authorized cast… not run autonomously… a
  human ran the metered drive after Lisa wrote the trail"* (the T-058-05 pattern).

So "the board renders / the slice clears" is **coded + unit-proven, not proven by a real drive here.**
**Caveat:** the drives may have run on another device whose gitignored run-log didn't transfer (see F3) —
but the proof isn't on this machine either way.

→ **Consequence:** the E-059/E-060 sweep crystallization ("closed with a LIVE re-drive → positive gold
master") **overstates** the live proof if the drives weren't run. Honest fix: soften those entries to "code
landed; live positive proof pending a human-authorized drive," **and run one cheap verification drive** to
close it. (The kitchen MVP's first drive also supplies this.)

## Backward fixes (grounded)

**[F2] Loop commit-consistency — "done" ≠ "committed."** Every E-059/T-060 review flags *"Not committed —
the code sits in the working tree for Lisa to commit."* lisa then **dropped** `T-060-01-02`'s code + the
entire E-060 board (epic/stories/tickets, untracked) while committing *later* tickets. Resolved in git at
this sweep. Fix: lisa commit serialization / commit-board-on-mint / a post-loop uncommitted-work guard.
*Tactical (auto-drain) — but it broke the verify-git contract, so it's surfaced.*

**[F3] The trust ledger doesn't transfer.** `.vend/runs.jsonl` is gitignored (under `.vend/`) → this device
has 3 records; the historical cleared-forward-E1 cadence (E-039/E-045) is gone. For a **long-lived** dogfood
(possibly a remote box) the Set-A trust ledger must be **portable/persistent**, or the keystone cadence
can't accumulate across devices/sessions. *Strategic — undercuts the Set-A measurement.*

**[F4] Fresh-device operability — secrets/keyring/topic/ledger are all per-device.** This session: a dead
Doppler token silently killed notifications + failed casts; the ntfy topic is gitignored; another instance
hit a keyring failure; the run-log is thin. Partly fixed (the `just setup` ntfy-topic recreation + the file
fallback). *The pattern founds E-061's install story.*

## Forward gaps (founding the kitchen phase)

**[F5] No end-user install path** → **E-061** (brew + make-a-workspace). lisa's mirror is verified (compiled
binary, tap, per-platform formula). Hard prerequisite for the kitchen MVP and every future user.

**[F6] vend can't yet drive an EmDash / Astro-6 project** → **E-062** (the kitchen seed; the A3-for-EmDash
risk). Precede with a cheap spike: does steer rank a coherent board for an EmDash project?

**[F7] Headless operability when remote from the dir** — notifications-as-status (fixed this session),
budget/andon legible in a diff/PR review, the SVG board as the remote glanceable read. The "dir you don't
access" operating model.

## Candidate (not a prerequisite)

**[F8] A `vend retrospect` play** — vend reading its own `runs.jsonl` + `work/` + git to **stage fixes
automatically** (advances P3/measurement). The dogfood that would make *this* retrospective a repeatable
gesture. Surface it; don't build it now.

## Output

Ranked into `proposed-batch.md` (this cycle). Strategic-first; the tactical fix (F2) auto-drains; promotion
stays a human pull. The next pulls found the kitchen phase: **E-061 (install) ∥ E-062 (seed)**, with a cheap
**live-verification drive (F1)** as the honest first move.

---

## Addendum — root-cause layer from landing E-061 (5 Whys)

> Added after the desk cycle, when the E-061 build was landed. The retrospective above named the *patterns*;
> this is the *root-cause layer* under fix-signals #8/#9 — three blockers, each run to a 5-why root, all
> reducing to one systemic seam. Evidence-cited; hypothesis links flagged.

**The episode.** E-061 (Homebrew) was minted, the loop built all 5 stories, but landing it surfaced three
blockers: the board was **graph-invalid from the mint** (gate red, 8 fails), the build was **almost entirely
uncommitted** (F2 repeating), and the epic **can't go live autonomously**. Resolved this session: board
renumbered to nest (`S-061-0X`), gate green (1414/0), work committed in coherent slices.

### Blocker A — board shipped graph-invalid (decompose flat IDs)
1. Gate red → the live board failed `GraphIntegrityError` (4 stories → missing epics).
2. → `decompose` emitted flat `S-061…S-065`; the model derives epic from the first number block, so `S-062`
   → absent `E-062`.
3. → decompose's ID generator is convention-blind (numbers stories like epics; no `S-<epic>-<NN>` nesting).
4. → no play gate runs the output through `buildGraph`; integrity is enforced only on the **read** path.
5. → engine⊥play: the play *writes files*, validation was built as a load-time concern; `lisa validate`'s
   laxer rule gave a false green.

**Root:** integrity is a read-side invariant, never a write-side gate. **Workable: fully, vend-side** — nest
decompose's IDs + wire `buildGraph` into its structural gate (signal #8; must precede E-062).

### Blocker B — "done" ≠ "committed" (F2, recurring)
1. Work uncommitted → loop advanced `phase:done` but didn't commit most tickets (only T-062-01).
2. → phase-advance and git-commit are separate steps; phase wrote, commit didn't.
3. → *(hypothesis, lisa-internal)* commit ordering/serialization skipped some tickets' files (matches the
   prior F2 — later tickets committed while earlier ones dropped). Confirm in lisa's loop commit logic.
4. → no invariant binds `done ⇒ committed`; phase-state and git-state are independent truths.
5. → phase-advance is a cheap local write, commit a separate heavier action; no post-step clean-tree assert.

**Root:** lisa-state and git-state are unbound; a silent commit-skip doesn't fail the loop. **Workable:
detection fully (vend-side guard — every `phase:done` ticket's files tracked + tree clean → andon); the
deeper fix needs lisa (atomic advance+commit, cross-repo).** Human net = verify-git-not-status (caught it).

### Blocker C — can't go live autonomously (human-owned tail)
1. Loop can't make `brew install` work → needs a published release + tap repo + fresh-machine install.
2. → those need external repo creation, a write-scoped secret, a tag-triggered CI run, outbound resolution.
3. → the executor is scoped to local edits + the gate; no publish/credential/outbound authority.
4. → outward credentialed hard-to-reverse actions require human authorization — by design.
5. → the epic's "done looks like" bundled code-complete (autonomous) with live-published (human-authorized).

**Root:** the done-definition conflates two authorization tiers; the boundary is correct, not a defect.
**Workable: as workflow** — split acceptance into code-complete (loop) vs live-verified (human tail + #7);
the tail is one-time setup (tap + secret) then a repeatable tag push. T-065-01 already honored this split.

### The systemic root — one seam under all three
Each blocker is **two sources of truth that don't reconcile at their seam**:

| Blocker | Truth A | Truth B | Missing seam gate |
|---|---|---|---|
| A | `lisa validate` (lax) | `vend buildGraph` (strict) | integrity gate at **mint** |
| B | lisa `phase:done` | git tree | `done ⇒ committed` at **sweep** |
| C | "code-complete" | "live-published" | explicit **two-tier "done"** |

This is the flip side of the [[vend-lisa-two-engine-split]]: the separation is the strength, the seams
aren't contracted. **None is fundamental; all are workable.** Highest leverage = a **graph-integrity
contract at the vend/lisa seam** (a mint-time + pre-sweep gate), which subsumes A and the detection half of
B. Ranked: (1) #8 decompose-nesting + mint integrity gate; (2) `done ⇒ committed` guard; (3) two-tier "done"
+ go-live runbook.
