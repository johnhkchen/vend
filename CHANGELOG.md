# Changelog

What each vend release means for you, in plain terms. Newest first; upgrade with
`brew update && brew upgrade vend`. Every release adds an entry.

## 0.2.2 — 2026-07-01

- Retired `vend work`; drive the loop one deliberate pull at a time (`vend steer` → `vend chain "<signal>"` → let lisa build → sweep).

## 0.2.1 — 2026-06-30

- `vend chain "<signal>" --after <ticket>` queues an epic behind a running loop so its tickets aren't grabbed early.
- Mints fail far less often — non-goal tagging slips are auto-dropped and the default token budget now covers dense epics.

## 0.2.0 — 2026-06-30

- `vend init` scaffolds a larger project (epic dir + a drive-the-loop guide) on top of `lisa init`.
- Boards always mint graph-valid, and an epic can't be marked done until its work is actually committed.
