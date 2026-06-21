// The autonomous-cast denylist (T-051-02, story S-051-01, epic E-051) — the single source of
// truth for which interactive built-in tools an AUTONOMOUS (headless `claude -p`) cast makes
// UNAVAILABLE.
//
// WHY: an autonomous cast runs piped through `claude -p` with no human on the other end. If the
// agent invokes Claude Code's built-in AskUserQuestion tool there is no answerer, so the call HANGS
// the cast until it resolves empty or the wall-clock latch kills the pane — E-049's decompose hit
// exactly this, improvising a mid-cast question and stalling. Denying the tool via
// `--disallowedTools` makes it cleanly UNAVAILABLE, so the agent proceeds autonomously rather than
// blocking on a prompt it cannot deliver (P4 — autonomy by default, enforced not hoped).
//
// PURE & ADDON-FREE: a single frozen constant, no fs/clock/process/BAML. Shared by the two
// autonomous plays — propose-epic.ts (the impure play module) and decompose-epic-core.ts (the pure
// core that carries DECOMPOSE_TOOLS) — and by the cast-core resolution tests; a neutral home avoids
// coupling the two plays to each other and keeps the specific tool name OFF the generic engine (the
// engine plumbs a `deny` field it never interprets; the policy of WHICH tools lives here).
//
// SCOPE: declared ONLY on the autonomous plays. `vend work` / `vend chain` inherit it because they
// cast those plays through `castPlay`. Interactive / TUI plays (steer, survey, note, expand) do NOT
// declare it and stay byte-for-byte unchanged.

/**
 * The interactive built-in tools made unavailable on an autonomous cast (E-051) → threaded onto a
 * play's `PlayTools.deny`, projected by `toolFlags` to `--disallowedTools`. Currently just
 * `AskUserQuestion` (the only built-in that BLOCKS waiting for a human on a piped cast). `as const`
 * so the policy is a frozen, readonly tuple — it cannot be silently widened or emptied at a call
 * site, and is assignable to `PlayTools["deny"]` (`readonly string[]`).
 */
export const AUTONOMOUS_DENY = ["AskUserQuestion"] as const;
