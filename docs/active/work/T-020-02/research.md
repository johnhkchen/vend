# T-020-02 — Research: recalibrate-expand-honest-empty

> Descriptive map of the terrain. What exists, where, how it connects. No solutions — those are
> `design.md`. The ticket asks to tighten **expand's** honest-empty abstention so a *grounded*
> fragment stops abstaining while a *thin* fragment still STOPs the line.

## What the ticket asks

Tighten expand's honest-empty abstention criteria in **`baml_src/expand.baml`** so that:

- a **grounded** fragment (one that maps to real demand) **stops abstaining** — its raw
  `gate-failed` (honest-empty) rate over a probe sweep drops to **~0** (was **33%**, T-019-02), AND
- the **T-020-01 thin-fragment fixture** still yields a `gate-failed` **honest-empty STOP** — the
  negative control proving the gate was **tightened, not disabled**.

_Advances P3 (consistency — the IA-4 honest-empty gate the whole shelf leans on)._

## Where the behavior lives — the two layers

The honest-empty contract is split across **two** layers, and only **one** is the lever here.

1. **The PROMPT (`baml_src/expand.baml`) — THE LEVER.** The `ExpandFragment` function's prompt has a
   dedicated `## Honest-empty (IA-4)` section (lines 68–72) instructing the model: "If the fragment
   closes NO vision-distance … ABSTAIN: return a Signal with `what` and `why` BLANK." The model
   decides whether to emit a blank Signal. **Over-firing is a model decision driven by this prompt
   language** — the model reads a genuinely-grounded fragment and *still* decides "no demand," then
   blanks `what`/`why`. The `what`/`why` field `@description`s (lines 43–44) reinforce the same
   instruction at the type level (shown to the model via `{{ ctx.output_format }}`).

2. **The GATE (`src/play/expand-core.ts`) — NOT the lever.** `honestEmptyGate` (lines 111–119)
   classifies an already-parsed Signal: `what` AND `why` both blank ⇒ a STOP (`gate-failed`). This
   logic is **correct and must stay unchanged** — it faithfully reports the model's abstention. The
   bug is not in classification; it is that the model abstains too eagerly. Touching the gate would
   change what "blank" *means*, not when the model *chooses* blank. **This ticket edits the prompt,
   not the gate.**

This mirrors the T-020-01 research finding: "The honest-empty gate is a poka-yoke over the model's
parsed reply, not over the raw input — the fixture biases the model toward an empty reply; the gate
then classifies it." The recalibration biases the model the *other* way on grounded input.

## The current prompt's honest-empty language (the thing being tightened)

`baml_src/expand.baml` lines 68–72:

```
## Honest-empty (IA-4) — abstain rather than manufacture
If the fragment closes NO vision-distance — it maps to no real demand against THIS project —
then ABSTAIN: return a Signal with `what` and `why` BLANK. An honest empty result is correct;
manufactured busywork is the worst waste (overproduction). Do not invent a move to fill the fields.
```

Structurally this presents abstention as a **co-equal branch** to extraction ("If … then ABSTAIN /
Otherwise author"). It gives the model a low-friction off-ramp ("maps to no real demand against THIS
project") that a cautious model takes even on a real fragment — especially under the adjacent
**Read, never invent** section (lines 62–66), which warns hard against speculation. The two
sections pull in opposite directions and the model resolves the tension by abstaining. The field
`@description`s say "Leave BLANK … ONLY when the fragment grounds no real demand" — the `ONLY` is
present but weak against the prose.

## The grounded vs thin fixtures (the two probe inputs)

- **Grounded** (`docs/active/work/T-019-02/fixtures/grounded-fragment.txt`): a real observability
  gap — "the run log records the outcome bucket … but NOT the specific reason … Surface the
  structured stop reason on the run record." This **demonstrably grounds real demand** (it is
  literally the basis of sibling ticket T-020-03's predecessor work). Correct outcome: a **signal**.
  T-019-02 measured it abstaining **1/3 (33%)** — the false negative to eliminate.
- **Thin** (`docs/active/work/T-020-01/fixtures/thin-fragment.txt`): "Remember to water the office
  plants and restock the coffee filters before the weekend." A grammatical but **off-topic**
  non-sequitur — grounds no demand against Vend. Correct outcome: an **honest-empty STOP**. This is
  the negative control that must survive the tightening.

## The probe harness (the AC's measurement instrument)

`src/probe/run-consistency-probe.ts` (T-019-01/02, extended by T-020-01). The relevant targets:

- **`expand`** — casts the **grounded** fragment (CLI `input.md`) against the live charter + board.
  `expandTarget` (lines 226–239). `isAbstention: emptyOutput`.
- **`expand-thin`** — casts the **fixed** thin fragment (`THIN_FRAGMENT_PATH`, pinned — no CLI
  input). `resolveTarget` case at lines 282–288, reuses `expandTarget` verbatim with a "thin"
  subject override.

**The D4 asymmetry (load-bearing for reading results):** expand abstains by **STOPPING** (honest-empty
gate fails ⇒ `gate-failed` non-`success`), so `classifyRun` folds it into `budget-exhausted` and it
**never reaches `isAbstention`**. Expand's honest-empty is therefore read from the **raw
`RunOutcome` tally** (`gate-failed` count) + the per-cast andon line — **NOT** the headline mix.
The AC's "raw gate-failed rate" is exactly this number.

Invocation (per T-019-02 / the play's 250k-token budget):
```bash
# grounded — expect honest-empty (gate-failed) rate ~0:
bun run src/probe/run-consistency-probe.ts expand docs/active/work/T-019-02/fixtures/grounded-fragment.txt N
# thin — expect a gate-failed honest-empty STOP to persist:
bun run src/probe/run-consistency-probe.ts expand-thin N
```

## Baseline evidence already on disk (T-020-01 sweep log)

`docs/active/work/T-020-01/sweep-logs/expand-thin.log` (N=2, **pre-recalibration**):
- cast 1/2: `budget-exhausted` (spent 335k/250k — the model churned instead of cleanly abstaining)
- cast 2/2: **`gate-failed` honest-empty** — "the fragment grounds no demand … (IA-4)"

So the thin fixture *does* produce the honest-empty STOP (the negative control fires). Note cast 1
shows a failure mode adjacent to over-firing: faced with off-topic input the model can also **burn
budget** flailing. The recalibration's clarity ("cite a source or abstain cleanly") should help both
the grounded false-negative AND this thin-input churn, but the AC only commits to the gate-failed
rate.

## Constraints & assumptions

- **Prompt-only change.** `expand-core.ts` and its tests stay byte-for-byte unchanged; so does the
  probe harness (T-019/T-020-01 already wired it). The diff is `baml_src/expand.baml` + the
  regenerated `baml_client/` (a `baml:gen` artifact).
- **`bun run check`** (`baml:gen` → `tsc --noEmit` → `bun test`) is the **deterministic** gate and
  must stay green. The prompt text is not type-checked, but the regenerated client must compile and
  every existing test (incl. `expand-core.test.ts`) must still pass — the prompt change must not
  alter the `Signal`/`SignalTier` *shape*.
- **Live casts are directional, not proof** (E-014 discipline). The AC requires *running* the probe;
  small N (2–3) is the precedent. Model behavior is not guaranteed — "~0" is the expected outcome of
  a clearer prompt on a grounded fragment, not a hard guarantee.
- **Sibling boundary.** T-020-03 recalibrates **survey** (`survey.baml`), T-020-01 built the
  fixtures. This ticket is **expand only** — do not touch `survey.baml`.
- The negative control is the safety rail: any tightening that makes the thin fragment *also* stop
  abstaining has **disabled** the gate, not tightened it — an AC failure.
