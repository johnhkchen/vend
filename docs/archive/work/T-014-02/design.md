# T-014-02 — Design

*Options, tradeoffs, and the chosen approach — grounded in the Research map. Decisions, not
just preferences.*

## What we are deciding

1. **How to skip gates** (the run-mode mechanism).
2. **What "the materialized output" is** that we diff, and how the probe collects 5×2 of them.
3. **The variance metric** — the single number + per-run diffs.
4. **Where the harness lives and how it is invoked.**

---

## D1 — The `--no-gates` mechanism: a `skipGates` flag on `castPlay`

**Chosen.** Add `readonly skipGates?: boolean` to `CastOptions`; guard the one gate call:

```ts
gateVerdict = opts.skipGates ? null : play.gates(output, ctx);
```

Research established that a `null` `gateVerdict` already flows through `classify` as
"no stop → success → materialize". So skipping the call **is** the no-gates behaviour with
zero new branches downstream: parse still runs, the output still materializes, the run logs
`success` with `gateResults: []`. When the flag is absent, `opts.skipGates` is falsy and the
gated path is **byte-for-byte unchanged** (AC#4).

**Rejected — a raw-dispense comparison** (PRD's fallback option). The gates' only
consistency mechanism is *censoring* (Research): they don't transform the dispense, they stop
divergent outputs from materializing. Diffing the raw dispense text would measure a channel
the gates never touch and **under-measure their effect to ~zero by construction**. We must
diff *materialized* output to see the censoring channel. So a real gate-skip path (not a
dispense diff) is required.

**Rejected — a separate ungated cast loop / new engine entry.** A second orchestrator
duplicates the spine (a framework, not a switch) and risks drift from the gated path. One
guarded line keeps the two paths identical except for the gate call.

## D2 — Expose the run mode on `vend run`, and thread it minimally

**Chosen.** Wire `--no-gates` end-to-end so there is a genuine, usable "run mode" (AC#1's
words), reusing the single `skipGates` option:

- `cli.ts`: `parseRunArgs` detects `--no-gates`; the `run` `ParsedCommand` gains an optional
  `skipGates?: boolean`, **spread only when true** (house idiom) so existing `toEqual` parse
  tests stay green.
- `dispatch.ts` / `decompose-epic.ts`: `RunOptions` gains `skipGates?`; `assembleAndCast`
  passes it into `castPlay`'s `CastOptions`.

This is small (one flag, one threaded field) and makes the mode real beyond the probe. The
gated default is untouched.

**Rejected — flag only reachable through the probe.** Cheaper, but AC#1 asks for a "run
mode"; a public flag is the honest reading and costs little. (The probe still drives
`castPlay` directly — see D4 — because it needs ledger/output redirection the public `run`
path deliberately doesn't expose.)

## D3 — The variance metric: mean pairwise line-set Jaccard distance

**Chosen.** Define output divergence with **line-set Jaccard distance**, dispersion as the
**mean over all unordered pairs**, and the headline number as a **reduction ratio**:

- `distance(a, b) = 1 − |Lₐ ∩ L_b| / |Lₐ ∪ L_b|`, where `L` is the set of trimmed, non-blank
  lines. Both-empty ⇒ `0` (identical). Range `[0, 1]`.
- `dispersion(outputs) = mean of distance over all C(n,2) pairs`; `n < 2 ⇒ 0` (a single
  point cannot disperse). Range `[0, 1]`.
- `reduction = ungatedDispersion === 0 ? 0 : (ungatedDispersion − gatedDispersion) / ungatedDispersion`.
  `> 0` ⇒ gates made output **more** consistent (the hoped result, A5 confirmed); `≈ 0` ⇒ no
  effect (A5 flat); `< 0` ⇒ gates increased dispersion (unexpected — flag it).

**Why Jaccard over lines, vs alternatives:**

| Option | Verdict |
|---|---|
| **Line-set Jaccard** (chosen) | `O(n)` per pair, dependency-free, interpretable ("two outputs share X% of lines"), order-insensitive (we want *content* consistency, not ordering), and a natural "diff". |
| Normalized Levenshtein (char-level) | Faithful but `O(n·m)` per pair and noisy at the character level (a renamed id perturbs many chars); heavier for no semantic gain on structured markdown. Rejected. |
| Structural (ticket-count / field agreement) | Most semantic but couples the metric to DecomposeEpic's `WorkPlan` schema — not play-agnostic, and more than "a switch". Rejected. |

**Why a ratio, not a raw delta:** the findings note (KR4) wants "the gates reduce variance by
N%". A ratio normalizes against the ungated baseline so the number is comparable and
self-describing. Raw dispersions are still reported alongside (not hidden).

## D4 — The harness: a sweep-time script driving `castPlay` directly

**Chosen.** A standalone impure script `src/probe/run-probe.ts` (`import.meta.main`), run by a
human at sweep: `bun run src/probe/run-probe.ts <epic.md>`. Not part of the everyday `vend`
surface (it is a measurement instrument, run once), and **not unit-tested** (house rule for
impure verbs; AC#3 names it the human step).

Algorithm — one temp root, seeded once, **output dirs cleared between runs** to dodge the
collision guard (Research):

```
tmp = mkdtemp();  seed tmp with the fixed epic + the real charter
for variant in [gated (skipGates:false), ungated (skipGates:true)]:
  for i in 1..5:
    rm -rf tmp/docs/active/{stories,tickets}            # avoid IdCollisionError
    inputs  = assembleInputs({ epicPath, projectRoot: tmp })
    summary = castPlay(decomposeEpicPlay, inputs, budget,
                       { subject, projectRoot: tmp, runId: `${variant}-${i}`,
                         runLogPath: tmp/.vend/runs.jsonl, skipGates: variant==ungated })
    output  = read+concat(tmp/docs/active/{stories,tickets}/*.md)  or null if nothing materialized
    record(variant, output)
report = varianceReduction(gatedOutputs, ungatedOutputs)
print(formatVarianceReport(report))
```

**Why drive `castPlay` directly, not `assembleAndCast`/`vend run`:** the probe needs to
redirect the **ledger** (`runLogPath` → temp, so it never pollutes `.vend/runs.jsonl` —
Research) and the **output root** per run. `assembleAndCast`/`runPlay` expose neither. Driving
the exported `castPlay` + `assembleInputs` + `decomposeEpicPlay` reuses the **entire real
pipeline** (real dispense, real gates, real materialize) with the control the probe needs —
faithful, and still no new orchestration code.

**Why clear-between-runs, not N temp roots:** one seeded root + an `rm` per iteration is
fewer moving parts than seeding ten roots, and the cleared board is precisely what lets a
clearing run materialize instead of colliding.

## D5 — Honesty: censoring is surfaced, never silently inflating the win

The gated set can shrink below 5 (censored runs materialize nothing → `null`). If gates
censor almost everything, the 1–2 survivors are trivially consistent and `reduction → 1.0`,
which would **misread as a triumph**. So `VarianceReport` carries `censoredGated` /
`censoredUngated` and `gated.n` / `ungated.n`, and `formatVarianceReport` prints them inline:
`reduction 100% — but 4/5 gated runs censored`. This keeps the single number honest for the
findings note (IA-8: the meter must not lie), and feeds T-014-03's go/reroute read.

Edge cases the pure core must total over (→ tests): identical sets (reduction 0); ungated
varies / gated identical (reduction 1); ungated dispersion 0 (reduction defined as 0, not
NaN); `n < 2` after censoring (dispersion 0); empty sets.

## Scope guard

Production code change is exactly: **one `skipGates` option** (+ its minimal CLI/dispatch
threading) and **one pure variance module**. The harness is a sweep script. No benchmarking
framework, no second play, no schema change — matching PRD §7 and the ticket's anti-scope
clause.
