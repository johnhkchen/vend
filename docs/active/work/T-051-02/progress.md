# T-051-02 — Progress

Tracking the plan's two-commit implementation. Updated as each step lands.

## Step 1 — Pure deny plumbing — ✅ DONE

- `src/play/autonomous-deny.ts` (new): `AUTONOMOUS_DENY = ["AskUserQuestion"] as const` + rationale.
- `src/engine/play.ts`: `PlayTools.deny?: readonly string[]` added (orthogonal subtractive sibling;
  deny-only stays passthrough), doc updated.
- `src/engine/cast-core.ts`:
  - `ResolvedTools`: `deny: readonly string[]` on both ok-variants; doc rewritten.
  - `resolveTools`: undefined → passthrough+`deny:[]`; **strict iff `mcp`/`allow` declared** else
    passthrough; both carry `deny`. New `scopes` discriminator + comment.
  - `ToolFlags`: `disallowedTools?` added.
  - `toolFlags`: emits `disallowedTools` from non-empty `resolved.deny` on passthrough AND strict.
- `src/engine/cast-core.test.ts`: every ok-result expectation now carries `deny:[]`; `{}` and
  skills-only re-pointed to passthrough (the "scopes nothing ⇒ passthrough" sharpening); new deny
  resolution/projection cases; **AC live-proof argv block** (autonomous strict + deny-only carry
  `--disallowedTools AskUserQuestion`; interactive undeclared omits it, byte-identical base).

**Verification:** `bun test src/engine/cast-core.test.ts src/executor/claude.test.ts` → 85 pass / 0
fail. `bun run build` (tsc --noEmit) clean. No behavior change for any real play yet (no play declares
`deny` until Step 2). Committed.

## Step 2 — Wire the autonomous plays — ✅ DONE

- [x] `decompose-epic-core.ts`: `DECOMPOSE_TOOLS.deny = AUTONOMOUS_DENY` (+ doc bullet).
- [x] `propose-epic.ts`: `proposeEpicPlay.tools = { deny: AUTONOMOUS_DENY }` (deny-only ⇒ passthrough).
- [x] wiring-guard test: `DECOMPOSE_TOOLS.deny` includes `"AskUserQuestion"`; `AUTONOMOUS_DENY` is
      exactly `["AskUserQuestion"]`; real DECOMPOSE_TOOLS resolves to an argv carrying the deny flag.

**Verification:** full `bun test` → **1188 pass / 0 fail** (77 files); `bun run build` (tsc) clean;
`check:precommit` green on commit. Committed `a249836` (Step 2) atop `a2d9a44` (Step 1).

**Note:** no `lint` script exists in package.json (the CLAUDE.md `bun run lint` is aspirational); the
live gate is `check:precommit` (tests) + `check:typecheck`, both green.

## Step 3 — Dogfood/live — documented (not executed)

A live decompose dogfood needs a real `claude -p` subscription cast + the BAML addon (spends tokens
against a real epic). Not run autonomously in this loop. The deterministic argv proof
(cast-core.test.ts "autonomous-deny LIVE PROOF") is the green unit oracle satisfying the PURE half of
the AC; the live decompose-completes-unattended confirmation is left as the prescribed manual check
(see review.md "Open concerns"). End-to-end wiring is proven by: DECOMPOSE_TOOLS/propose deny shapes →
`resolveTools` → `toolFlags` → `buildArgs` all carry `--disallowedTools AskUserQuestion`, and `castPlay`
already spreads `...tflags` into `dispense` (unchanged), so the flag reaches every autonomous cast.

## Deviations

- None so far. The strict-discriminator sharpening (`{}`/skills-only → passthrough) was anticipated
  in design.md D-decision; only the two unused unit cases changed, both updated with rationale.
