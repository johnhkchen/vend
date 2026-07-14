# Plan — T-071-02-03

## 1. Establish baseline

- Run the focused existing effect/cast tests before editing.
- Confirm dependent lane-heat and run-log tests are green.
- Record any ambient failure separately from ticket-owned failures.

## 2. Extend the effect result contract

- Add `SeatInferred` to `src/engine/play.ts`.
- Add optional `EffectResult.seatInferred`.
- Keep the interface structural and independent of routing/log modules.
- Verify TypeScript accepts existing effect implementations unchanged.

## 3. Inject inference once

- Update `src/play/decompose-effect.ts` imports.
- When an explicit agent is present, skip the ledger read/inference path.
- Otherwise load `<root>/.vend/runs.jsonl`.
- Call the pure `inferDefaultSeat` reader.
- Pass explicit or inferred seat to `materialize`.
- Return the inference marker only on successful inference.
- Preserve existing seat-default and refusal behavior.

## 4. Thread provenance through cast

- Capture `eff.seatInferred` beside `eff.seatDefaulted`.
- Forward the exact marker into the final run-log input.
- Keep omission semantics for all non-inferred casts.
- Ensure early refusal records remain unchanged.

## 5. Add effect-level integration tests

- Build valid hot/cool ledger fixtures using run-log helpers.
- Drive the real effect with a stub executor.
- Hot Claude/no explicit agent: assert every ticket stamps Codex.
- Assert `seatInferred` contains Codex and the exact heat reason on the record.
- Both cool: compare story/ticket bytes with a current no-ledger baseline.
- Assert no `agent` key and no `seatInferred` marker.
- Explicit Claude under hot-Claude ledger: assert Claude stamps and marker is absent.

## 6. Prove both gestures use the injection

- Direct case uses `castPlay` over the decompose-shaped fixture.
- Chain case uses `castChain` with a first step that produces a reference.
- Its second step uses the same decompose-shaped play/effect, not copied inference logic.
- Assert the chained decompose output and record show the inferred Codex seat.
- Keep both paths addon-free and token-free.

## 7. Focused verification

Run:

```bash
bun test src/play/lane-heat.test.ts src/log/run-log.test.ts \
  src/play/decompose-effect.test.ts src/engine/cast.test.ts
bun run build
```

Fix only ticket-owned failures. Re-run until green.

## 8. Full quality gate

Run:

```bash
bun run check
```

The gate must complete BAML generation, typecheck, and the full suite successfully.

## 9. Ownership audit

Inspect exact ticket paths with `git diff --check`, `git diff`, and `git status --short`.
Confirm no ticket-owned file is staged and unrelated dirty files remain untouched.

## 10. Commit meaningful source unit

Use one exact-path Lisa commit because contract, effect, forwarding, and acceptance tests form one
inseparable integration unit:

```bash
lisa commit-ticket \
  --ticket-id T-071-02-03 \
  --message "feat(play): infer cooler default seat (T-071-02-03)" \
  --include src/engine/play.ts \
  --include src/play/decompose-effect.ts \
  --include src/engine/cast.ts \
  --include src/engine/cast.test.ts
```

If an additional focused effect test is modified, include its exact path too. Do not use `git add` or
ordinary `git commit`.

## 11. Record and review

- Write `progress.md` with observed commands, counts/results, commit id, and deviations.
- Write `review.md` with file summary, acceptance mapping, coverage, limitations, and honest result.
- Remain on this ticket and stop after review; Lisa handles publication/completion.
