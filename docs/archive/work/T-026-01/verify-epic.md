---
id: verify-e1-instrument-readiness
title: verify-e1-instrument-readiness
status: probe
---

## Context
Throwaway subject epic for T-026-01's instrument-readiness smoke. NOT a board epic.
Exists only to give `vend run` a real epic to render a decompose prompt from. The cast
is run under a 1-token ceiling so it deterministically budget-exhausts before any
materialize effect — nothing here ever reaches the board.

## Intent
Prove the live `vend run --intervened|--no-intervened` path writes the `intervened`
bit to the run ledger and that `vend audit` reads it back.
