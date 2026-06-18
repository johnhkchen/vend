# Mana Economics — the cost layer of the card model

The companion to `card-model.md`. If budget is mana and the subscription is your
land pool, this doc is **how Vend spends that mana well** — caching, model routing,
and bounding the agent — so each cast does more with the same lands.

## The thesis: you don't structure the prompt, Vend does

**You shouldn't have to be an expert in prompt structuring to get good results.**
Vend takes your goals and structures your *demands* into clean, cache-warm,
right-model executions. Efficient prompt layout, cache breakpoints, and model
choice are **authoring-time concerns Vend owns** — paid once, encoded in the play,
and improved over time (charter **P1**, author once). The person at the counter
states intent and allocates a budget; the casting engine does the rest.

This is the clearing house applied to execution: the hard specification (including
*how* to structure the call cheaply) is paid once, not re-paid per cast.

## Knob 1 — cache-aware order (stable → variable)

Casting the same spell on different targets (e.g. `DecomposeEpic` on E-002, then
E-003, then E-004) is one stable spell with a swapped target. Prompt caching is a
**prefix match** (render order `tools → system → messages`; any byte change
invalidates everything after it). So the engine lays the prompt out:

```
[ play instructions + charter + KB snapshot ]   ← stable across casts; cache breakpoint here
[ the specific epic / target ]                  ← the only thing that changes; after the breakpoint
```

- **Reads cost ~0.1× base input; writes cost 1.25× (5-min TTL) or 2× (1-h TTL).**
  Break-even is **2 casts** at 5-min, **3** at 1-h. So clustering same-spell casts
  inside the TTL turns the expensive prefix *write* into a cheap *read*.
- **Minimum cacheable prefix on Opus 4.8 is 4096 tokens** (Sonnet 4.6 / Fable: 2048).
  The charter+KB block clears it; a bare epic wouldn't — another reason the big
  stable block goes first.
- **Parallel fan-out:** a cache entry is readable only once the first response
  *starts streaming*. Fire N identical casts at once → all N pay full price. The
  engine warms one, awaits its first token, then releases the rest.
- Place the breakpoint at the **end of the shared block**, never the end of the
  whole prompt (max 4 breakpoints/request) — else every cast writes a distinct
  entry and nothing is ever read.

## Knob 2 — model routing (the cascade)

Don't tap Opus-mana for a Haiku-cantrip. Three tiers, cheapest first:

| Tier | Work | $/MTok (in / out) |
|---|---|---|
| **Code (free)** | Deterministic gates — structural, allocation, `lisa validate` | $0 (where our gates already live) |
| **Haiku 4.5 / Sonnet 4.6** | Easy/mechanical: screening, classification, extraction | 1 / 5 · 3 / 15 |
| **Opus 4.8** | The hard judgment: the decomposition reasoning | 5 / 25 (5× Haiku) |

**The cache tension you must respect: caches are model-scoped.** Bouncing
Opus↔Haiku *mid-prompt* throws away both caches. So route at **sub-play
granularity, not mid-prompt** — run a whole easy step on Haiku as a *subagent*,
keep the hard loop on one model (exactly how Claude Code's Explore subagents use
Haiku). BAML's per-function client assignment makes this clean: `DecomposeEpic` →
an Opus client; a cheap `ScreenEpic` pre-check → a Haiku client. Each function
keeps its own warm cache.

## Knob 3 — bound the wandering (complementary)

Caching cuts the *input-prefix* cost; it does nothing for *exploration*. `claude -p`
is the full agent — A2 burned 119k tokens on a tiny fixture by wandering. Bounding
it (`--max-turns` / a tighter system prompt) cuts that. The three knobs are
independent: **order** (cheap input), **route** (cheap model), **bound** (less
output). (Tracked as the *bound-dispense-exploration* signal on `demand.md`.)

## The honest constraint, and the path

Through `claude -p` we ride Claude Code's own cache breakpoints — we can only
*order* the prompt to help. Full control (Vend setting its own `cache_control` on
the charter+KB prefix, and clean per-function routing) is a reason to evolve the
executor toward the Agent SDK / Messages API. Ordering is free upside now;
breakpoints are the payoff then.

## Measured, and improving over time

We already log the inputs: `runs.jsonl` carries `cache_read_input_tokens`,
`cache_creation_input_tokens`, and cost per run. The consistency layer reads
**cache-hit ratio** and **per-model cost** to tell whether the ordering and routing
are paying off — and that signal feeds kaizen on the structuring (and, eventually,
the steering-data-model loop). The author never sees any of it. A well-authored
card is already cost-shaped; you just press the button.
