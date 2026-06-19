# T-020-02 — Design: recalibrate-expand-honest-empty

> Options, tradeoffs, decision with rationale — grounded in `research.md`. The problem: expand's
> model abstains on **grounded** input (33%, T-019-02). The lever is the **prompt**
> (`baml_src/expand.baml`), not the gate. Goal: raise the abstention bar so a groundable fragment
> extracts, while a fragment that grounds *nothing* still abstains.

## The decision in one line

**Rewrite the prompt's `## Honest-empty` section to reframe abstention as a RARE exception gated on a
concrete "can you cite ONE real source?" test, add a calibrated example pair (thin = abstain /
grounded = extract), and reinforce the same bar in the `what`/`why` field `@description`s.** No code
changes; `expand-core.ts` and the harness are untouched.

## What is in scope to change

The over-firing is a **model decision** produced by prompt language (research §"two layers"). The
only honest levers are therefore textual, inside `ExpandFragment`'s prompt and the `Signal` field
descriptions. Everything else (gate logic, parse closure, probe targets, budgets) is correct.

## Options considered

### Option A — Tune the GATE threshold (`expand-core.ts`)  ❌ rejected

Make `honestEmptyGate` require *more* than blank `what`/`why` to STOP (e.g. also require blank
`grounding`).

- **Why tempting:** deterministic, unit-testable, no live-cast dependence.
- **Why rejected:** the gate is **not** where over-firing happens. The model returns a Signal with
  `what`/`why`/`grounding` ALL blank when it abstains — tightening the gate's blank-detection cannot
  conjure content the model declined to emit. It would only change what "abstention" *means*, risking
  a Signal that is half-blank slipping past honest-empty into read-never-invent (a *worse*,
  more-confusing andon). The research is explicit: classification is correct; the model abstains too
  eagerly. Wrong layer.

### Option B — Delete the honest-empty section from the prompt  ❌ rejected

Remove the abstention instruction so the model always extracts.

- **Why rejected:** directly **disables** the gate — the thin fragment would stop abstaining, failing
  the AC's negative control. It also violates IA-4 (honest-empty is a first-class contract) and
  invites manufactured busywork on genuinely empty input (the overproduction waste the contract
  exists to prevent). The ticket says *tighten*, not *remove*.

### Option C — Reframe abstention as a rare, source-gated exception + calibrated examples  ✅ chosen

Keep the honest-empty branch but **raise its bar** with three moves:

1. **Reframe the default.** Lead with "abstention is the EXCEPTION, not a co-equal branch." Most
   fragments are NOT empty; the model exists to clear rough input, so roughness/terseness is never a
   reason to abstain.
2. **A concrete decision test.** "Can you cite even ONE real thing the fragment points at — a phrase
   in it, a file/doc/TODO it names, a run-log fact it implies? If YES → extract (that citation is the
   `grounding`). Abstain ONLY when the honest answer is 'there is nothing here to read.'" This binds
   abstention to the *same* evidence read-never-invent already requires, resolving the tension the two
   sections currently create (research §"current prompt language").
3. **A calibrated example pair.** Show the boundary explicitly: the thin "water the office plants"
   fragment → ABSTAIN (off-topic, grounds nothing); the grounded "run log records the bucket but not
   which gate" fragment → EXTRACT (names a real gap). Few-shot calibration is the most reliable way to
   move a model's decision boundary without hand-waving.

Plus reinforce the bar at the **type level**: tighten the `what`/`why` `@description`s so the
abstention instruction the model sees in `{{ ctx.output_format }}` matches the prose ("blank ONLY
when the fragment grounds NOTHING — off-topic noise / empty input; a rough-but-grounded fragment is a
signal, not an abstention").

- **Why chosen:** it is the *minimal* change at the *correct* layer. It preserves the honest-empty
  contract (thin still abstains → negative control holds) while removing the easy off-ramp that
  produced the 33% false negative. Few-shot examples + a concrete predicate are the standard,
  evidence-backed way to relocate an LLM decision boundary. It is fully reversible and leaves all code
  and tests untouched.
- **Cost:** verification needs **live casts** (the AC), which are non-deterministic and slow. Accepted
  — it is inherent to any prompt change and matches the T-019-02 / T-020-01 precedent.

## Why the example pair specifically uses those two fragments

Using the **actual probe fixtures** as the in-prompt examples is deliberate alignment: the model is
calibrated on exactly the inputs the AC measures. The thin example is the negative control verbatim;
the grounded example is a paraphrase of `grounded-fragment.txt`'s core (kept short — one clause, not
the full fixture, to avoid over-fitting / leaking a full answer). This is calibration, not cheating:
the examples teach the *boundary* ("off-topic noise vs a real gap"), which generalizes — they do not
encode the fixtures' specific signals.

## Interaction with read-never-invent (the gate that follows)

honest-empty runs FIRST, then read-never-invent (`EXPAND_GATE_NAMES`). The new language makes them
**collaborate** instead of conflict: abstain when there is nothing to cite; otherwise extract AND put
the citation in `grounding` (which read-never-invent then checks). A fragment the model now extracts
must still carry grounding — so the recalibration cannot produce *ungrounded* signals; a model that
extracts without a citation simply trips read-never-invent (a correct, different STOP), not a false
honest-empty. The negative control thin fragment grounds nothing, so the model still finds no
citation → still abstains. The bar moved up cleanly.

## What "done" looks like (verification design)

- **Deterministic:** `bun run check` green — regenerated `baml_client/` compiles, all tests
  (incl. `expand-core.test.ts`, unchanged) pass. Proves the prompt edit did not alter the
  `Signal`/`SignalTier` shape.
- **Directional (the AC):** probe `expand` on the grounded fragment N≥2 → raw `gate-failed`
  (honest-empty) rate ~0; probe `expand-thin` N≥2 → at least one `gate-failed` honest-empty STOP
  persists. Logs captured under `docs/active/work/T-020-02/sweep-logs/`.

## Risks & mitigations

- **Over-correction (the central risk).** A too-aggressive rewrite disables the gate → thin stops
  abstaining (AC fail). *Mitigation:* keep the honest-empty branch with an explicit, example-anchored
  empty case; verify the negative control every run.
- **Model nondeterminism.** "~0" is not guaranteed at small N. *Mitigation:* frame results as
  directional (E-014), report the raw tally honestly (IA-8 no-silent-caps), re-cast if a single
  outlier dominates a tiny N.
- **Shape drift.** An accidental edit to a field name/type breaks `baml:gen`/tests. *Mitigation:* edit
  only `@description` text and prose — never field names, types, or the enum. `bun run check` catches
  any drift.
