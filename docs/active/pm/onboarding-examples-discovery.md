# Onboarding & `examples/` — driveable templates that teach vend+lisa (discovery)

> **Discovery note — gate down, nothing promoted.** Companion to
> [`deployability-discovery.md`](./deployability-discovery.md): that thread gets vend *onto*
> a machine; this one makes a brand-new user *understand what to do with it*. Together they
> form one frontier — **distribution & onboarding** — absent from the six in `demand.md`.

## The problem: the value only clicks once you've seen the loop

vend and lisa, as standalone tools, present a strange learning curve. The payoff is only
legible once you grasp the **engineer-caught-in-the-loop** role the vision names — *"turns you
from the thing in the loop into the thing that designs the loop."* Until you've felt that shift,
"author a playbook, allocate a budget, walk away" reads as abstract. Telling doesn't fix this;
**showing** does. A driveable example lets a new user *experience* stepping out of a loop in one
short session — which is the only thing that makes the rest of the product make sense.

So `examples/` is not docs-decoration — it's the **experiential onramp** and, because each
example is driveable end-to-end, simultaneously the **product-level validation harness** (see
§"Examples as a consistency probe").

## The pedagogical spine: each example escapes a different loop

The three canonical cases the human named map cleanly to three loops a user normally can't
escape — which is exactly the lesson:

| Example | The loop you're normally stuck in | What vend+lisa lets you do instead | Quality bar |
|---|---|---|---|
| **1 · Hackathon** | "code the whole time" | pair with a PM/designer, drive a *seed of an idea* into a real project in one session | speed over polish |
| **2 · Small-business site** | "hand-integrate every platform" | pick flexible **deploy presets**, integrate only the *usual APIs you actually need* | production-grade |
| **3 · Figma ↔ React SPA** | "changing the UI is a verbal request a dev has to translate (telephone)" | vend builds the SPA **and** publishes a real, Figma-native **design-token system** into the same project — the designer changes the UI by directly editing tokens/components in Figma, no dev in the middle | passes muster as a real design system |

The bars rise left→right; so does the new infrastructure each needs. That ordering is the
build sequence.

## What a "driveable template" is (grounded in `vend init`)

A template is a **pre-`vend init`'d vend+lisa project + a seed**, copy-to-instantiate:

```
examples/
  README.md                       # what examples are; the two-gesture "drive" instructions
  templates/
    hackathon-seed/
    small-business-site/
    figma-to-spa/
  templates/<each>/
    README.md                     # copy → run: the drive script in two gestures
    SEED.md                       # the small seed of an idea (the only thing the user edits)
    docs/active/demand.md         # board — starts honestly EMPTY (IA-4); first move is a Survey cast
    docs/knowledge/charter.md     # a charter TUNED to this domain (the value function for the demo)
    .mcp.json                     # the MCP servers this example needs (e.g. figma)
    shelf/ (or play tuning)       # the domain plays/presets stocked on the shelf
    EXPECTED-OUTCOME.md           # the golden quality bar to validate a drive against
```

This reuses everything from the deployability thread: a template *is* the output of
`vend init --template <name>` plus a seed. So **`vend init --template` is the connective tissue**
between the two frontiers — `brew install` → `vend init --template hackathon` → drive. Critically
(IA-3/IA-4): a template seeds **structure, knowledge, and a stocked shelf — never demand.** The
board starts empty; the first gesture is a **Survey/Steer cast** off the seed, not fabricated
signals. That's the whole point — the user watches demand get *read*, not handed to them.

## The three canonical examples

### 1 · Hackathon — seed → driveable project (the canonical first example)

- **Seed:** a one-paragraph idea + a team of two (a driver + a PM/designer).
- **The drive:** `vend steer` (or `survey`) reads the seed + tuned charter → proposes a ranked
  board and the real forks → the pair answers a handful of decisions → `chain`/`work` clears the
  first slice. Coding time is spent *designing the loop*, not sitting in it.
- **Exercises (all shipped):** the articulation trilogy (expand/survey/steer, E-016/17/18), the
  measured-budget envelope, the gate frame. **Lowest new infra** — this is why it's first: it
  validates capabilities that already exist and proves the cold-start experience.
- **Validates:** "felt idea → allocatable board in one short session," and the non-dev pairing
  (Frontier 4 / P5) — a designer or PM is a first-class driver, not a spectator.
- **Bar:** a coherent board + ≥1 cleared slice from a cold seed, fast.

### 2 · Small-business site — speedrun pick-choose-integrate, production bar

- **Seed:** a business (name, what it sells) + a required-capabilities checklist (payments? auth?
  email? CMS? booking?). The insight the example teaches: a "simple site" is really a meaty
  integration of several major platforms — **but not every site needs every API.**
- **The drive:** vend reads the checklist → recommends a **deploy preset** (a pre-authored stack
  of integration plays) → the user picks *only the APIs this business needs* → clears each
  integration as gated work. Demonstrates a cost-effective-yet-full-fledged production site
  assembled by *choosing*, not hand-wiring.
- **Exercises:** the shelf as a *catalog of integration presets*; E-032 per-play tooling (each
  integration declares its MCP/keys); production gates. **New infra: the deploy-preset shelf** —
  the meatiest new capability in this plan (Cloudflare Pages/Workers + DB + auth + email are
  natural first presets; the project already carries Cloudflare skills).
- **Validates:** the clearing house "picks the right work, right-sized, in the right order" at a
  *production* quality bar; flexible re-targeting (swap a preset, board shifts).
- **Bar:** a deployable production site with only the chosen integrations, reproducibly.

### 3 · Figma ↔ React SPA — an AI-built design system that *passes muster in Figma*

- **Seed:** a Figma file URL.
- **The forward drive:** via the **Figma MCP** (already available in-session) vend reads the design
  as a specification format → proposes the component/screen board → clears faithful React
  components, verified against **Storybook**. The user never handwrites the early issues — the
  design carries them.
- **The core outcome to showcase (the part that makes it special):** vend doesn't just emit code —
  it **publishes a real, Figma-native design-token system back into the same project.** The
  generated components land as proper Figma **variables/tokens, component sets with variants, and
  bound properties** — a legitimate design system, not a flat mockup. Then a designer changes the UI
  by **directly editing that system in Figma** — *"remove this, add that"* is a direct manipulation
  of real tokens/components, **not a verbal command a dev has to translate (the telephone problem
  that AI design tools usually re-create).** The designer never touches code; the dev is never the
  middleman.
- **Why this is the hard, impressive claim — and why it's vend's to make:** mostly-AI-driven design
  systems normally *don't* pass muster — inconsistent tokens, components built without real variants
  or variable bindings, broken theming. The showcase claim is that vend's **gated consistency** (the
  whole product thesis — gates as the contract) produces a token system a real designer accepts as
  professional. A design-token system is the *ideal* consistency demo: a token system's entire value
  *is* consistency.
- **The loop closes through the shared system.** Because code and Figma share the same token system
  (bound via **Code Connect**), a designer's edit to a token/component in Figma is an edit to the
  design system the code is built from → vend re-derives the affected code from the updated tokens →
  the Storybook gate re-verifies. Not a verbal round-trip; a shared-source-of-truth one.
- **Exercises:** E-032 per-play tooling (`mcp: ["figma"]`, andon if missing — architecturally
  proven); a non-text spec→demand bridge; **a code→Figma design-system generation play** (the
  available `figma-generate-library` skill does exactly this — variables/tokens, variant sets,
  variable bindings, theming), **Code Connect** binding (`figma-code-connect`), and the Storybook
  gate. **New infra: the Figma-read play, the design-system publish play, the Code-Connect binding,
  token-coherence gates, and the token-edit→re-derive loop.** Highest setup, most impressive demo.
- **Validates:** vend ingesting a *non-text spec* as demand, faithful recreation as a gate-checked
  outcome — and, the headline, **an AI-built design-token system that passes muster as a real Figma
  design system**, so a designer steers the UI directly (P5, at its fullest).
- **Bar:** a React SPA faithful to the Figma source (Storybook-verified), **plus** a Figma design
  system a real designer would accept (proper variables/variants/bindings/theming), **plus** a
  demonstrated designer-edits-a-token-in-Figma → code-re-derives → verified loop — no code, and no
  dev-telephone, anywhere in the designer's path.

## Examples as a product-level consistency probe (the second payoff)

Because each template is driveable **and** ships an `EXPECTED-OUTCOME.md`, an example is a
re-runnable, gold-mastered demo. Drive it twice → compare outcomes → that *is* the vision's
consistency promise made visible (and it can ride the existing `src/probe` consistency layer).
So examples are onboarding, marketing demo, **and** an end-to-end regression/quality harness in
one artifact — the strongest argument for building them well rather than as throwaways.

## Candidate signals (un-promoted — the onboarding half of the new frontier)

Pairs with the deployability candidates (D-1 delivery, D-2 doctor, D-3 init). Examples *depend
on* D-3 (`vend init`), so the connective `--template` flag is the seam between the two halves.

- **X-0 · `examples/` scaffold + `vend init --template`** — the directory contract + the flag that
  instantiates a template into a live project. The shared foundation. *Advances P5/IA-3.* **High.**
- **X-1 · Hackathon canonical example** — seed→board→clear on shipped features; lowest infra;
  proves cold-start. *Advances the core feature + P5 (non-dev pairing).* **High** — start here.
- **X-2 · Small-business example + deploy-preset shelf** — the production-bar pick-choose-integrate
  speedrun; needs the new preset capability. *Advances the core feature at a production gate bar.*
  **High** — meatiest.
- **X-3 · Figma↔SPA example — the AI design system that passes muster** — design-as-spec via Figma
  MCP + Storybook gate, **plus publishing a real Figma-native design-token system** (variables,
  variant sets, bindings, theming via `figma-generate-library` + Code Connect) so a designer steers
  the UI by direct token edits — no dev-telephone. *Advances P5 (the full non-dev round-trip) + E-032
  tooling; the purest consistency demo.* **High** — highest setup, best demo. *Split: X-3a forward
  (Figma→code, Storybook-gated); X-3b the published design system + token-edit→re-derive loop — ship
  the forward half first, add the design-system round-trip once it lands.*

## Sequencing & forks for the human

- **Recommended order:** X-0 → **X-1 (hackathon)** → X-3 (figma) → X-2 (small-biz). X-1 first
  because it validates the cold-start on *already-shipped* plays with the least new infra and is
  the purest "watch yourself leave the loop" lesson. X-2 last because the deploy-preset shelf is
  real new capability, not just a template.
- **Fork — how are golden outcomes validated?** Manual eyeball per drive, vs. wired into the
  `src/probe` consistency layer as a CI-gated product regression. (Recommend: manual first, probe
  later — don't over-build before one example exists.)
- **Fork — where do templates live?** In-repo `examples/` (ships in the bottle, dogfoods `vend
  init`), vs. a separate `vend-examples` repo. (Recommend: in-repo — they're the stocked shelf for
  a fresh install and the dogfood for `vend init`.)
- **Fork — how much does a template tune the charter?** A domain charter is the value function the
  demo is judged against; too generic and the demo is flat, too specific and it stops teaching the
  general move. Per-example calibration.

## Open questions to go-and-see before any pull

1. Does `vend steer`/`survey` produce a genuinely useful board off a *thin domain seed* (not the
   vend repo itself it was authored against)? The hackathon example is the test.
2. What's the minimal **deploy-preset** representation — a play, a shelf bundle, or a new card
   type? (Drives X-2's scope.)
3. Figma MCP read shape: can a play consume a Figma file as structured demand, and what's the
   Storybook verification gate's contract? (Drives X-3a, the forward half.)
4. **Does the published design system pass muster (drives X-3b)?** The headline claim — can vend
   generate a Figma design system a real designer accepts as professional: proper variables/tokens,
   variant sets, variable bindings, theming (not AI slop)? `figma-generate-library` is the tool;
   the open question is whether the *output quality* clears a designer's bar, and what coherence
   gates enforce it. Then: when a designer edits a bound token in Figma, does vend reliably
   re-derive the affected code without clobbering in-flight work? Highest-uncertainty item in the
   plan — spike the design-system *quality*, not just the mechanism, before X-3b is pulled.
5. Does a copied template survive `vend doctor` clean on a fresh `brew install` box (the
   distribution + onboarding handshake)?
