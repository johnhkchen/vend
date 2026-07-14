# T-040-04 — Design: init-idempotency-and-validate

One decision per axis, each grounded in Research (and in a live go-and-see), with the
rejected alternatives named. The work is a single guarded-live end-to-end proof; the design
is mostly about *how faithfully* to stage and assert it, not *what* to build.

## D1 — What "bare lisa project" means (the central call)

**Decision: the fixture is a *minimal VALID* lisa project = real `lisa init` + exactly one
seed ticket.** Not the raw, ticketless `lisa init` output.

Grounded in the live finding: `lisa validate` on a ticketless project exits 1 ("no tickets
found"). The AC requires `lisa validate` to *pass after* `vend init`, and `vend init` neither
creates tickets nor should it (it must not fabricate work). The only coherent reading is that
the *input* is already lisa-valid (has a ticket) and `vend init` *preserves* that validity
while layering its demand/PM/archive/knowledge tree.

- Rejected — *seed the bare project ticketless and expect validate to pass*: contradicts the
  observed lisa contract; the test would fail at the first `validate`. Not viable.
- Rejected — *have `vend init` add a placeholder ticket to force validity*: that is fabricated
  work, the exact anti-pattern the empty-board rule (IA-3/IA-4) exists to prevent, and it would
  reopen the reviewed T-040-01 manifest. Wrong layer, wrong principle.
- The seed ticket is **lisa work, not vend demand** — orthogonal to the demand board, which
  stays empty. Proving "validate passes" AND "board has zero demand rows" together is precisely
  the epic's claim: vend rides on top of lisa without inventing anything.

## D2 — Build the fixture with real `lisa init`, or hand-seed the lisa tree?

**Decision: drive the real `lisa init` binary (cwd-targeted spawn), then seed one ticket.**

The proof is "turns a *bare lisa project* into…". The most honest bare lisa project is the one
`lisa` itself produces — same dirs, same markers, same `rdspi-workflow.md`. Hand-seeding a
hand-rolled approximation of lisa's tree would prove a claim about *my* fixture, not about lisa.

- Rejected — *hand-seed `CLAUDE.md` + `docs/active/tickets/` + a ticket only*: cheaper and
  lisa-free, but it dodges the real coexistence question (does vend's tree collide with the
  full lisa layout — `.lisa/`, `docs/archive/{tickets,stories,work}`, `docs/knowledge/...`?).
  Go-and-see showed the real layout coexists; a hand-seed wouldn't have tested that.
- Cost accepted: the test now requires `lisa` on PATH → guarded (D4).

## D3 — Drive `vend init` via `runInit(root)` or by spawning the CLI?

**Decision: call `runInit(root)` directly.**

`runInit` IS `vend init` — the dispatch arm is `runInit(process.cwd())` + a printed tally.
Calling the seam directly is the house discipline (test the composition, not the untested
`import.meta.main` shell), is faster (no extra `bun` subprocess), and lets the test assert on
the typed `{created, skipped}` result — exactly the "zero new writes" evidence the AC names.

- Rejected — *spawn `bun run src/cli.ts init` with cwd=root*: re-tests the untested shell, is
  slower, and forces brittle stdout parsing ("0 created, 17 skipped") instead of structured
  assertions. The CLI path was already live-smoked in T-040-03; re-proving it here adds noise.
- Faithfulness preserved: `runInit` takes an explicit `projectRoot`, so pointing it at the temp
  dir exercises the identical code the cwd dispatch runs.

## D4 — The guard: how to be "guarded-live"

**Decision: `Bun.which("lisa")` gates a `describe.skipIf(!LISA)` block.** When lisa is absent
(a CI box without it), the whole end-to-end block is SKIPPED, not failed; when present, it runs
fully live against the real binary. `lisa validate` is invoked WITHOUT `--check-tools` (this proof
is about the scaffold's lisa-validity, not the zellij/claude runtime — those are `vend doctor`,
E-042). The pure machinery (manifest, planner, no-clobber, idempotency) is already exhaustively
covered by the unguarded `init-effect.test.ts`; this guarded file adds only the lisa-binary proof,
so skipping it loses no pure coverage.

- Rejected — *no guard, assume lisa present*: would hard-fail the suite on any box without lisa,
  turning an environment gap into a red build. "Guarded-live" in the AC explicitly calls for the skip.
- Rejected — *mock/stub `lisa validate`*: a stub proves nothing about real lisa-validity; the entire
  value of this slice is the live external contract.

## D5 — Where the test lives

**Decision: a NEW file `src/init/init-idempotency.test.ts`** (named for the ticket title), not an
added block in `init-effect.test.ts`.

Isolation: `init-effect.test.ts` is pure-bun, mock-free, lisa-free — adding a lisa-spawning block
would make that whole (currently unconditional) file depend on a guarded external binary. A separate
file keeps the lisa dependency quarantined behind its own `skipIf`, and names the proof for what it
is. Mirrors how `head-build-core.test.ts` (the spawn-an-external-binary integration proof) is its own
file beside the pure `*-core` tests.

- Rejected — *extend `init-effect.test.ts`*: blurs the pure/guarded boundary and risks the skip
  logic leaking onto the pure tests.

## D6 — Assertions: how to discharge each clause

**Decision: one end-to-end test for the AC's twice-run scenario, plus one focused
one-way-to-lisa test.**

- **Test A — "scaffolds → lisa-valid → idempotent → still valid":**
  1. `lisa init` (spawn, assert exit 0) → seed one ticket → assert `lisa validate` exit 0 (valid input).
  2. `runInit` #1 → assert `kind==="scaffolded"`; every `SCAFFOLD_MANIFEST` path exists; `lisa
     validate` exit 0; `countDemandRows(demand.md)===0` AND `countDemandRows(demand-cleared.md)===0`.
  3. `runInit` #2 → assert `created===[]` and `skipped.length===SCAFFOLD_MANIFEST.length`; `lisa
     validate` exit 0 (the "zero new writes, still valid" clause).
- **Test B — "one-way to lisa: the pre-existing ticket is left byte-identical":** snapshot the seed
  ticket before `runInit`, assert it is unchanged after — reinforcing that vend writes ONLY vend-owned
  paths (the headline one-way property, now proven against a *real* lisa-owned file, not just `CLAUDE.md`).

Rejected — *split Test A into three micro-tests sharing setup*: the AC is one continuous scenario
("runs `vend init` twice"); a single test reads as the scenario and avoids re-spawning `lisa init`
three times. Test B is genuinely independent (a different property), so it earns its own case.

## Net

No production code changes. One new guarded-live test file, two tests, skipping cleanly without
`lisa`, proving — against the real binary — every clause of the epic's "done looks like."
