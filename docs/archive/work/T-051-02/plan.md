# T-051-02 — Plan

Two atomic commits, each green. Pure plumbing first (no behavior change), then the autonomous-play
wiring (the slice that flips the argv). Testing strategy + verification per step.

## Step 1 — Pure deny plumbing (engine + constant + unit tests)

**Goal:** `deny` flows `PlayTools → resolveTools → toolFlags → disallowedTools`, fully unit-tested, with
zero argv change for any play that doesn't declare `deny`.

1a. Create `src/play/autonomous-deny.ts` with `export const AUTONOMOUS_DENY = ["AskUserQuestion"] as const`
    and its doc-block.

1b. `src/engine/play.ts`: add `readonly deny?: readonly string[]` to `PlayTools` + doc-comment (the
    orthogonal subtractive sibling; deny-only stays passthrough).

1c. `src/engine/cast-core.ts`:
    - `ResolvedTools`: add `deny: readonly string[]` to both ok-variants.
    - `resolveTools`: undefined → `{ok:true,passthrough:true,deny:[]}`; else extract
      `deny = [...(declared.deny ?? [])]`, compute `missing`; missing → andon; **strict iff
      `declared.mcp !== undefined || declared.allow !== undefined`** else passthrough — both carry
      `deny`. Update doc-comment.
    - `ToolFlags`: add `disallowedTools?: readonly string[]`.
    - `toolFlags`: emit `disallowedTools` from `resolved.deny` (non-empty) on passthrough AND strict;
      passthrough returns deny-only (or `{}`). Update doc-comment.

1d. `src/engine/cast-core.test.ts`:
    - Add `deny: []` to existing strict/passthrough result expectations.
    - Re-point `resolveTools({}, …)` and `resolveTools({skills:[…]}, …)` to passthrough + `deny:[]`,
      and their `toolFlags` to `{}`; rename/comment with the "scopes nothing ⇒ passthrough" rationale.
    - New pure cases: deny-only resolution → passthrough+deny; mcp+allow+deny → strict+deny;
      `toolFlags` projections for both; and the **AC live-proof argv** trio (autonomous strict carries
      `--disallowedTools AskUserQuestion`; autonomous deny-only passthrough carries it without
      allow/strict flags; interactive `undefined` omits it and equals the base argv).

**Verify:** `bun test src/engine/cast-core.test.ts` green; `bun test src/executor/claude.test.ts`
still green (seam untouched); `bun run build` (typecheck) clean. **Commit 1.**

## Step 2 — Wire the autonomous plays

**Goal:** propose-epic and decompose-epic emit `--disallowedTools AskUserQuestion`; interactive plays
unchanged; `work`/chain inherit.

2a. `src/play/decompose-epic-core.ts`: import `AUTONOMOUS_DENY`; add `deny: AUTONOMOUS_DENY` to
    `DECOMPOSE_TOOLS`; extend its doc-comment with a `deny` bullet.

2b. `src/play/propose-epic.ts`: import `AUTONOMOUS_DENY`; add `tools: { deny: AUTONOMOUS_DENY }` to
    `proposeEpicPlay` with the "deny-only stays passthrough" comment.

2c. Declaration-guard test: assert `DECOMPOSE_TOOLS.deny` includes `"AskUserQuestion"` (in
    cast-core.test.ts or decompose's pure test, addon-free). Assert `AUTONOMOUS_DENY` is exactly
    `["AskUserQuestion"]` so the policy can't silently widen/empty.

**Verify:** full `bun test` green; `bun run build` clean; `bun run lint`. Confirm via the pure argv
test that `resolveTools(DECOMPOSE_TOOLS, ["codebase-memory-mcp"])` and
`resolveTools(proposeEpicPlay.tools, …)`-shaped input both yield the deny flag. **Commit 2.**

## Step 3 — Dogfood / live confirmation (AC, best-effort)

The AC asks that "the E-049-style decompose that previously stalled on a mid-cast question now
completes unattended." This needs a live `claude -p` subscription cast and the BAML addon. Attempt a
real `vend chain`/`vend run decompose-epic` if the environment allows; otherwise record in `review.md`
that the argv now provably carries `--disallowedTools AskUserQuestion` (the deterministic oracle) and
flag the live dogfood as the prescribed manual confirmation. Inspect a real transcript under
`.vend/transcripts/` for an `AskUserQuestion`-unavailable proceed if a live run is taken.

## Testing strategy summary

- **Unit (pure, the AC oracle):** `resolveTools`/`toolFlags`/`buildArgs` composition in
  cast-core.test.ts — deny present for autonomous, absent for interactive, byte-identical base.
- **Wiring guard:** `DECOMPOSE_TOOLS.deny` + `AUTONOMOUS_DENY` shape assertions.
- **Regression:** full `bun test` (the strict/passthrough semantics change touches only the two
  unused `{}`/skills cases, both updated).
- **Live:** the dogfood decompose (best-effort, documented).

## Risks / rollback

- The discriminator change (`{}`/skills-only → passthrough) is the only semantic shift; contained to
  two unused unit cases. Rollback = revert Step 1.
- If a future play wants strict-empty deliberately, it declares `allow: []` (key present ⇒ strict),
  which the new rule still honors — documented in the `resolveTools` comment.
