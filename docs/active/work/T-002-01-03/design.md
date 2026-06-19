# T-002-01-03 — Design: verify-no-drift

*Options, tradeoffs, decisions with rationale — grounded in Research. This is a
spike, so the "design" is the **design of the experiment**: how to prove the gate
agrees, can fail, and stays a separate program — honestly and cheaply.*

## The shape of the problem

We are not building; we are **demonstrating**. The three ACs map to three proofs:

- **P1 (agreement):** standalone `bun run check:test` and `dagger call test run`
  give the **same verdict** (both green) on the current tree.
- **P2 (can-fail):** a deliberately-broken test turns the gate **red**, then is
  reverted — proving the gate is a real detector, not a pass-through.
- **P3 (separateness + timing):** record cold-start/run time and re-confirm `/ci`
  imports nothing from the app.

Each proof has design choices. The over-arching constraint: **do not mutate
anything durable**, and **never touch the `check:test` definition** to make a
proof pass (that would void the Central Rule the whole spike defends).

---

## Decision 1 — Invocation: `dagger call test run`, with `--source=.` fallback

**Options:**
- (a) Trust `@argument defaultPath: "/"` → `dagger call test run` bare.
- (b) Always pass `--source=.` explicitly from the repo root.
- (c) Bare first; fall back to (b) only if the default mounts the wrong root.

**Decision: (c).** T-002-01-02 surfaced `defaultPath: "/"` as *unverified* — this
spike exists partly to verify it. Running bare first **tests the surfaced
assumption** (good: a spike should confirm assumptions, not paper over them). If
the suite passes from the bare call, the default resolves correctly and we record
that as a confirmed finding. If it mounts `/ci` or fails to find the app, fall
back to `--source=.` and **record the deviation** — that is itself a finding the
next gate's author needs. (b) alone would hide whether the default works; (a)
alone has no safety net. (c) gets both the test and the fallback.

## Decision 2 — Agreement criterion: verdict-equality, not stdout-equality

**Options:**
- (a) Assert the two runs produce **identical stdout**.
- (b) Assert the two runs produce the **same pass/fail verdict** (both exit 0,
  same pass count).

**Decision: (b).** Stdout will *not* be byte-identical — the container prints
`bun install` / `baml:gen` provisioning lines the standalone run does not, and Bun
test output can carry timing. The drift that matters is **"do they agree on
good-vs-bad,"** not "are the logs character-equal." The Central Rule guarantees
the *check string* is identical (`bun run check:test` both places); what we verify
is that running that identical string in both environments yields the **same
verdict** and the **same test tally** (229 pass / 0 fail). Recording the tally
from both sides is the concrete evidence of agreement.

## Decision 3 — The deliberate break: a throwaway failing test, created and deleted in-run

**Options:**
- (a) Edit an existing test to assert something false.
- (b) Add a new throwaway test file (e.g. `scratch.drift-check.test.ts`) that
  asserts `expect(true).toBe(false)`, run both gates, then **delete** it.
- (c) Break a source file so a test fails indirectly.

**Decision: (b).** A *new, clearly-named, self-contained* file is the cleanest
break: it cannot corrupt a real test's intent, it is unambiguous in `git status`,
and its removal is a single `rm` (no diff to reconcile, no risk of leaving an
existing test subtly wrong). (a) risks forgetting to restore the exact original
assertion; (c) couples the break to source semantics and may fail to *compile*
rather than fail as a *test* (a weaker proof — we want a test **failure**, red
suite, not a build error). The file is **never committed**; it exists only between
"introduce break" and "revert" inside Implement, and `git status` must be clean of
it before the spike ends.

**Symmetry of the proof:** run **both** standalone and `dagger call test run`
against the broken tree, so we prove *the gate* fails (not just that standalone
fails). The container going non-zero on the same break is the real P2 evidence.

## Decision 4 — Timing: record what we observe, don't engineer keep-warm

**Options:**
- (a) Implement keep-warm / engine pre-warming to get a fast number.
- (b) Just record the cold-start `connect` and total `dagger call` wall-time as
  observed, and note keep-warm is **out of this slice**.

**Decision: (b).** Keep-warm is explicitly **out of scope** (ticket AC4;
`ci-strategy.md` "not this slice"). The spike's timing job is *descriptive*:
record the cold-start (~18.4s expected per `ci-strategy.md`) and the run time so a
human can see the per-increment cost that *motivates* keep-warm later. Building
keep-warm here is the over-building reflex `ci-strategy.md` rule 6 warns against.
If the engine is already warm from this session, note that too (the number will be
smaller and we say why).

## Decision 5 — Separateness proof: re-run the grep invariant + show no app dep

**Options:**
- (a) Re-assert from T-002-01-02's prior evidence.
- (b) Re-run the boundary checks live in this spike as part of the record.

**Decision: (b).** AC3 asks this spike to "confirm `/ci` stays a separate program
(imports nothing from the app)." Confirming = running it here, not citing the
predecessor. Cheap checks: `grep -RnE "from \"\.\.|/src/|@boundaryml" ci/src`
(must be empty); `@dagger.io/dagger` absent from every `package.json`; `ci/sdk`
gitignored. Re-running makes the spike's evidence self-contained.

---

## What we deliberately reject

- **Changing `check:test` to make agreement easier** — voids the Central Rule.
- **Committing the broken test** — it is scratch; clean tree is an exit condition.
- **Adding `lint`/`typecheck`/`consistency` gates, or keep-warm** — out of slice.
- **Editing `ci/src/*` to fix any runtime surprise** *unless* it is pure **prep**
  (container env) and never the check; if a prep fix is needed, record it as a
  deviation, keep the check string untouched, and prefer surfacing over silently
  patching.
- **Running `dagger develop`** — andon. Engine is at the pin; no regen needed.

## Exit conditions (all must hold)

1. P1 recorded: both green, tallies match.
2. P2 recorded: broken tree → both red; break reverted; `git status` clean of it.
3. P3 recorded: timing noted; boundary greps green.
4. No durable change to `ci/` or app source; no new commit of production code
   (RDSPI artifacts + this evidence are the only things that may be committed).
