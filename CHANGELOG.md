# Changelog

What each vend release means for you, in plain terms. Newest first; upgrade with
`brew update && brew upgrade vend`. Every release adds an entry.

## 0.4.0-rc.6 — 2026-07-13

- The board picture and the trust readouts now speak plain English: card faces carry no leftover technical tokens, and `vend audit` explains itself in words you'd say aloud ("26 finished · 3 hit budget or time limit · 1 stopped by a check") — same honest numbers, no decoder ring.
- The shelf stops rounding down to zero: a playbook with a couple of real runs says "(default — 2 runs, measured at 3)" instead of claiming no runs yet.
- An empty board tells you what to do next instead of printing a bare "(no actions)".

## 0.4.0-rc.5 — 2026-07-12

- **Fixes rc.4's cast-killing bug — upgrade before running any metered command.** rc.4 tried to contact a local model server (port 11434) that nobody configured, crashing every `chain`/`steer`/`run` at its first step, leaving a half-minted epic and a spent cast missing from the ledger. Cross-vendor review now stays quietly out of the way unless you've actually set up a reviewer, and says so on the run record.
- If a configured reviewer can't be reached mid-cast, the cast stops with a named, plain-words explanation — never a crash — and the run always lands on the ledger, even when something goes wrong at the finish line.
- `vend doctor` now tells you what review will do before you spend: "cross-review: not provisioned — casts skip review" in green, or a red check naming an unreachable reviewer with the fix.
- If rc.4 left you an orphaned epic card: upgrade, then re-run `vend run decompose-epic <card>` — it completes normally now.

## 0.4.0-rc.4 — 2026-07-12

- `vend doctor` now proves your executor can actually run from where you are — not just that it's installed. A sandbox blocking credential access (the macOS Keychain case) shows up as a named red check with the fix, before any tokens are spent.
- If that failure happens mid-cast anyway, it lands as a clean named stop with the cause and the fix — never a raw error dump.
- Funding a cast far below what it's measured to need gets a warning at the counter ("steer measures ~400k; you funded 12.5k") — you can still proceed deliberately, but never by accident.
- Cross-vendor review: one seat's finished work can be reviewed by the other lab's seat before it settles — a second, independent pair of eyes as a real gate, with an honest refusal path when the reviewer says no.

## 0.4.0-rc.3 — 2026-07-12

- `vend help` (and `--help`) finally answers — every command listed, grouped free vs metered, with a pointer to `vend user-guide` for newcomers; a typo'd command now suggests the nearest real one (`sterr` → "did you mean steer?").
- A running cast shows its work: one live line of elapsed time, spend against the funded envelope, and turn count — instead of a silent stream of event names.
- Budgets speak human: `--budget 40m,350k` parses (hours/minutes and k/m token amounts), the raw millisecond form still works, and vend echoes back what it understood (`funding ~40m/350k`).
- Run summaries no longer look over-cap when they aren't: agent turns are shown against the real cap, with the executor's larger conversation-event count labeled separately.
- Leave `--agent` off and vend picks the cooler seat for you: when recent ledger burn shows one lane clearly hotter (≥2×), new tickets route to the other seat, with the evidence recorded on the run; explicit `--agent` always wins.

## 0.4.0-rc.2 — 2026-07-11

- Route work to a seat at mint time: `vend chain "<signal>" --agent codex` (also on `vend run decompose-epic`) stamps `agent: codex` into every ticket the cast writes — no more hand-editing frontmatter to allocate usage across agents.
- A typo'd or invalid seat no longer costs you the generation: the board lands on the default seat with an honest `seat-defaulted` note on the run record, instead of the whole decompose being refused.

## 0.4.0-rc.1 — 2026-07-11

- The budget meter now measures true cost: cached context is no longer counted as full-price tokens, so `vend chain` on a board that has grown stops tripping false budget-exhausted stops — big boards clear on default budgets (release candidate; try your previously-failing chains).
- A run that finishes its work and passes its gates but overshoots the envelope now lands with a warning on its record instead of being thrown away.
- `vend doctor` flags orphan epics — an epic card left with zero stories/tickets by a failed decompose no longer hides in a green board.

## 0.3.0 — 2026-07-10

- Stories come off `decompose-epic` as real contracts — scope, acceptance, honest boundary, why-these-tickets, out-of-slice — instead of ten-line shells, and a gate stops a shell story before anything lands on your board.
- Tickets and stories are now self-contained on charter grounding: every cited P/N code carries its one-line meaning inline (e.g. "P4 — Autonomy by default, not supervision"), so a cut artifact still makes sense to whoever picks it up, whenever. A cut whose charter can't explain a cited code is refused before a single file is written.

## 0.2.3 — 2026-07-01

- `vend user-guide` (also `guide` / `setup-guide`) prints a one-screen orientation on driving vend with lisa — so an agent landing in a fresh repo knows where to start.

## 0.2.2 — 2026-07-01

- Retired `vend work`; drive the loop one deliberate pull at a time (`vend steer` → `vend chain "<signal>"` → let lisa build → sweep).

## 0.2.1 — 2026-06-30

- `vend chain "<signal>" --after <ticket>` queues an epic behind a running loop so its tickets aren't grabbed early.
- Mints fail far less often — non-goal tagging slips are auto-dropped and the default token budget now covers dense epics.

## 0.2.0 — 2026-06-30

- `vend init` scaffolds a larger project (epic dir + a drive-the-loop guide) on top of `lisa init`.
- Boards always mint graph-valid, and an epic can't be marked done until its work is actually committed.
