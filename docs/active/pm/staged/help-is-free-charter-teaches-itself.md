# Staged signal — help is free, and the charter convention teaches itself

Field report (2026-07-13, agent-driven fresh repo): two counter-jank items, one burned metered
cast and one reverse-engineering session. Both confirmed at HEAD.

## Pull this

```
vend chain "Help is always free, and the charter convention teaches itself — two counter fixes from a live cold-start field report. (1) `--help`/`-h` anywhere in any vend invocation prints usage and exits free — today `vend chain --help` parses --help as the SIGNAL and runs a real metered cast (field-confirmed: a ~15k gate-refused burn for asking for help; reproduced at HEAD, killed mid-cast). One parse-level guard before any dispatch; a help gesture must be structurally incapable of spending. (2) The P1..P7 labeled-invariant charter convention stops being tribal knowledge: vend's epic schema requires advances codes that resolve against the charter, but a fresh organic charter has no labels — and the operator learns this only by autopsy (post-E-077 the dangling cites degrade, advances collapses to [], and the value gate refuses 'advances nothing', which teaches even less). Three small surfaces, one convention: the value/bounds refusal names the cause when the charter has NO labeled invariants ('your charter has no labeled invariants (P1..) — label them or cite none'); vend doctor gains a charter-convention check (green: N labeled invariants found; amber with the how-to when none); vend init's charter template ships the labels with a one-line comment saying casts cite them. Advances P5 (the cold-start operator meets the convention at the counter, not in a stack trace), P2 (asking for help can never cost tokens — the two-gesture promise includes the zeroth gesture: finding out how), P3 (refusals teach the fix, not just the verdict)."
```

Value: **High** (both bit a real operator on day one; the --help burn is severity-capped only by
luck — a bigger budget would have spent more). Budget: ~1 block (≈2h). Both slices are pure
parse/message/template work; no engine change.

Grounding: field report quoted in full in the 2026-07-13 session; `--help`-as-signal reproduced
at HEAD (cast started, killed, no ledger trace); `grep` confirms no init/doctor/refusal surface
mentions the labeling convention; value-gate path: src/play/propose-core.ts:121 ("advances
nothing"), degradation path: E-077 T-077-02-03 (dangling advances cites).
