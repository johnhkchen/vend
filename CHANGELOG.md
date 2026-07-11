# Changelog

What each vend release means for you, in plain terms. Newest first; upgrade with
`brew update && brew upgrade vend`. Every release adds an entry.

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
