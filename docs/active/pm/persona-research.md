# Persona research — the visually-oriented worker pushed into AI coding

> **Desk-only research artifact** (per `README.md` — staging, not a pull). Grounds the three
> board-view personas (Maya / Devraj / Sam, from the visualizer-view persona work) in **primary
> source**, replacing the earlier "hypothesis, no data" flag. Pairs the **internal** user voice that
> spawned the visual surface with **external** 2025–26 evidence for the en-masse-push inflection.
> Anchored on the **current epic E-055** (`projection-to-svg-renderer` — a static SVG of the whole
> work-graph, openable as a file). Nothing here is promoted.

## Evidence tiers (how to read every claim below)

- **[S] Survey/primary-document** — gold-standard (named survey, internal email/doc, first-party vendor data).
- **[N] Named first-person / named publication** — a real person or reputable outlet, on the record.
- **[A] Anecdotal / motivated / evergreen** — blog, vendor-of-a-fix, or pre-2025 general-purpose. Directional only.
- **[I] Inferred** — a strong proxy, not a direct measurement. Flagged as such.

The honesty rule for this desk: the **push** half of the thesis is **[S]-backed**; the **"and they
can't read the text surface"** half rests mostly on **[N]/[A]/[I]** — say so, don't launder it.

---

## The inflection (why this persona set matters *now*)

The thesis has two halves. They are **not** equally evidenced:

**Half 1 — people are being pushed into AI coding agents en masse. [S] CLOSED on survey grade.**
Four independent named surveys corroborate near-universal adoption — this half is over-evidenced:
- **JetBrains State of Developer Ecosystem 2025** (n=24,534, 194 countries): 85% regularly use AI
  tools, 62% rely on a coding assistant. **AI Pulse Jan 2026** (n=10,000+): 90% use an AI tool at
  work. [S]
- **GitHub Octoverse 2025** (telemetry): **80% of new developers use Copilot in their first week**;
  36M+ new developers in a year. [S, telemetry]
- **DORA 2025** State of AI-assisted Software Development (n≈5,000): ~90% of tech professionals use AI
  at work, median 2 hrs/day. [S]
- **Stack Overflow 2025:** 84% use or plan to use AI tools (↑ from 76%). [S]
- **Anthropic's own occupation data** ("Agentic coding and persistent returns to expertise"):
  Claude Code's largest *non-software* user groups are Business/Financial, **Arts/Design/Media**, and
  Management. **The non-technical cohort is already inside the exact executor we orchestrate.** [S]
  — *the single load-bearing citation for the **visual/non-technical** cohort specifically.*
- **Discipline note:** Octoverse's "new developer" = new GitHub *account*, **not** a first-time
  coder/designer/career-switcher. Do **not** claim "non-traditional onboarding" from that telemetry.

**Half 2 — and the visual/non-technical among them bounce off the text surface. SPLITS into two claims
that are evidenced very differently:**

*2a — "people can't easily follow/verify what the agent did." [S] Survey-proven.*
- **Sonar State of Code 2026** (n=1,100+): **96% don't fully trust AI code is correct**; only **48%
  always check before committing**; **38% say reviewing AI code takes more effort than a human
  colleague's.** [S] *(NB: these are Sonar's numbers — several blogs misattribute them to JetBrains.
  Do not cite as JetBrains.)*
- **SO 2025:** 66% frustrated by "almost-right" output; 45% say debugging AI output is more
  time-consuming; 16.3% find it "hard to understand how or why the code works." [S]
- **DORA 2025 (qualitative):** "I spend more time babysitting the AI"; "reviewing code is so much
  harder than writing it." [S, qualitative] — *but this is about output quality, not the rendering surface.*

*2b — "...therefore they want a VISUAL surface to see it." [N]/[A] Hypothesis-supported, NOT survey-proven.*
- **Best bridge — rigorous but small-N:** "Vibe Coding for UX Design" (arXiv 2509.10652, 2025), a
  20-person interview study of **non-technical UX professionals**, hits the full claim: text-surface
  friction + missed errors + explicit desire for visual previews. *"If you can't read code well, you
  may not even notice when it's wrong"*; *"I use Bolt when I want more visual feedback… instant UI
  previews… like a visual playground."* [S-qualitative, n=20 — not a population %.]
- The named first-person account (XDA, terminal "a wall of exact syntax") [N] and the **supply** of
  GUI/Agent-View wrappers [A] corroborate the direction, motivated-source.

**The seam — closed, partially-closed, open (the settled finding):**
- **2a is closed** [S]. The "can't follow/verify" pain is independently survey-proven (Sonar, SO, DORA).
- **2b stays open** on survey grade. **No named, methodology-stated survey measures "wants a visual
  surface."** Our remedy is **product hypothesis** + one rigorous qualitative study + product-demand
  signals — *honest, but not a measured population finding.* State this every time.
- **Counter-signals we must carry, not hide:**
  1. **GitHub Copilot productivity/happiness study** (survey n≈2,000 + experiment n=95): AI *reduces*
     cognitive load — 87% preserved mental effort, 73% stayed in flow. [S, but autocomplete-era +
     vendor-run.] The strongest published **counter** to our cognitive-load premise.
  2. **UK neurodivergence + AI** (DBT, Nov 2025): ND workers report **25% *more* satisfaction** with AI
     assistants. [A] **This points *against* "ND people struggle with these surfaces"** — a different
     claim; **do not lean on neurodivergence for the seam.** (Directly weakens Persona 3 — see Sam.)
- **Bottom line:** cite Sonar/SO/DORA for the *verification pain*, the UX vibe-coding study as the
  *qualitative bridge*, and label the *visual-surface remedy* as our hypothesis — while naming the
  counter-evidence. The thesis is *strong on pain, hypothesis-grade on the chosen cure.*

---

## Persona 1 — Maya, the designer dropped into the agent loop

**Grounding — internal primary source (strongest we have).** This persona is not invented: she is the
**real inbound designer request** that spawned the entire visual-surface line of work
(`staged/graph-view-human-projection.md`, 2026-06-19). The founder relayed a designer having a
**"mini stroke looking at text-heavy views"**; the success bar was set as **"the designer deems the
view good enough."** E-055 exists *because of her*.

**External corroboration that she is a cohort, not an outlier:**
- Anthropic occupation data: **Arts/Design/Media** is a top-three non-software Claude Code cohort. [S]
- Intuit "encourages product managers and **designers** to build feature prototypes themselves… using
  vibe coding"; Global Engineering Days had "non-technical designers build out the designs they
  created in Figma." [N] (CACM + Intuit blog)
- A "Therapy for Designers" community formed to support designers under "the psychological weight of
  an industry in rapid transition." [A] — vivid, on-thesis, anecdotal.

**JTBD.** *"Let me see what the agents are building for my product, and steer it, without a developer
translating."* **Pains:** the board is a markdown wall; she's an involuntary bottleneck (the telephone
game); pressure with a text-only on-ramp. **Gains:** one openable picture of the whole board; color as
pre-attentive status; a shareable artifact. **Unexpected:** she wants a *frozen, trustworthy snapshot*,
not a live dashboard — "did I break it?" anxiety. **Validates E-055's static-file-over-live-MCP choice.**

**How vend is designed to help her** (pain → mechanism → shipped state):
- *Markdown wall* → the **card model** (`card-model.md`) renders work as recognizable card faces, not
  prose, and **E-055** projects the whole graph to one openable SVG. [card model **shipped**; SVG
  render **E-055 active/unbuilt**]
- *Involuntary bottleneck / telephone* → the **annotation round-trip** (`graph-view-human-projection`,
  reusing `expand-fragment` E-016): she annotates the rendered view, it returns as *proposed demand* —
  she steers without touching code. [**staged, charter-gated**]
- *"did I break it?"* → **two-way data / one-way authority**: her edits enter a clearing queue, never
  silently mutate the canonical graph; the static snapshot is hers to inspect safely. [**design intent**]
- **Deepest help:** she never has to *perform* EL VETERANO's squint or LA REVISIÓN's red pen — the
  author already encoded that judgment as **gates** (P3). She reads the board, not the verification.

**Risk:** if the card *face* stays dense/jargon-heavy, the SVG just reframes the text wall — fit depends
on *face legibility* (the vocabulary policy stripping charter codes/BAML/paths), which geometry doesn't solve.

## Persona 2 — Devraj, the visual-thinking non-technical founder

**Grounding — external [N]/[S], with an [A] caveat on the headline stat.**
- The cohort is real and named: Fortune on solo founders running "entire teams" via AI automation
  [N]; a designer shipping a "production UI prototype" via agents [N]; Anthropic's Management cohort
  inside Claude Code [S].
- **Caveat stat:** "63% of vibe-coding users identify as non-developers (PMs, founders, designers)"
  and the ~$200k→$5k / 6mo→6wk build-cost claims come from **stat-roundup blogs [A]** — could not
  trace to a named survey. **Do not put this number in an external deck without sourcing it.**

**JTBD.** *"Show me where my product stands and what's stuck, so I can decide what to fund next."*
**Pains:** can't read the run well enough to make the pull (vend's whole *pick+budget+go* model
assumes he can choose); status lives in artifacts he can't audit (`runs.jsonl`, frontmatter); confuses
motion with progress. **Gains:** a funding map (pull the keystone, not a leaf); glanceable
done/blocked; an investor-legible artifact. **Unexpected:** he reads the **edges before the boxes** —
dependency structure *is* his decision surface. **Makes E-055's `ProjectionLink` edges primary payload,
not ornament.**

**How vend is designed to help him** (pain → mechanism → shipped state):
- *Can't read the run well enough to pull* → he **is the Puller** (`clearing-roles` CR-1); the whole
  **two-gesture transaction** (P2: pick + budget + go) is built for someone who allocates, not someone
  who reads logs; **recommend-never-auto-cast** (IA-5) surfaces a *ranked board* so he decides without
  authoring. [articulation trilogy + board **shipped**]
- *Status in unauditable artifacts* → **E-055's dependency edges** are his funding map — pull the
  keystone, not a leaf. [**E-055 active**]
- *Motion vs. progress* → **gates** (P3) make "done" mean something; the **budget hard contract** (P7)
  makes spend legible against the envelope he set. [**shipped**]
- **Deepest help:** vend's economic core — *value × budget* allocation — **is literally his job.** He's
  not a reluctant user bolted onto a dev tool; he's the **designed-for human at the counter.**

**Risk:** the deterministic hand-rolled grid could bury the critical path in a thicket on a busy board;
**edge legibility at scale** is his make-or-break and the hardest part of the layout.

## Persona 3 — Sam, the neurodivergent builder drowning in terminal text

**Grounding — the persona with the thinnest evidence, AND a survey-grade counter-signal. Be honest.**
- ADHD/dyslexia ↔ terminal inaccessibility: "Vi and Vim are among the least accessible text editors…
  they don't offer any cues to their different commands"; design principle "use visual indicators for
  time-consuming actions." [N but **evergreen, 2021**, general-purpose — not about AI agents.]
- Dyslexia → visual-spatial strength; neuroinclusive workplaces favor visual aids. [A] (advocacy/trade
  bodies, directional).
- Run-log fatigue is real and current but evidenced by **motivated sources**: "output flashes every
  time a tool call streams in, and your scroll position jumps to the top" — the reason third-party
  Agent-View dashboards exist. [A]
- ⚠ **Counter-signal — and it's better-evidenced than the support.** A UK DBT study (Nov 2025) found
  neurodivergent workers report **25% *more* satisfaction with AI assistants**, and GitHub's Copilot
  study found AI *reduces* cognitive load (87% preserved mental effort). [A]/[S] **These point
  *against* "ND people struggle with these surfaces."**
- **Verdict on Sam:** the survey weight currently runs *against* his premise, not for it. He is best
  reframed **not** as "neurodivergent → struggles with AI" (the data contradicts that), but as the
  narrower, still-plausible claim: *a streaming linear log has no persistent spatial shape to
  re-orient to after a context-switch* — a **layout-stability** need, not a neurodivergence claim. Keep
  the design input (deterministic, stable-under-delta layout); **drop the neurodivergence framing as a
  selling point** until [S] evidence ties it to AI-agent surfaces. He is a design hypothesis, not a
  validated segment.

**JTBD.** *"Give me a stable spatial map I can re-orient to, so I don't lose the board on every
context-switch."* **Pains:** text output evaporates on switch (no persistent shape); no object
permanence (working-memory tax); "master Claude Code" measured in the text fluency that taxes him most.
**Gains:** a persistent spatial anchor (recognition, not re-reading); offload working memory to the
page; pre-attentive status. **Unexpected:** **layout *stability* beats visual richness** — a plain SVG
whose boxes stay put across renders beats a prettier one that reflows. **Elevates E-055's
"deterministic, no force-directed" choice from convenience to an accessibility property.**

**How vend is designed to help him** (pain → mechanism → shipped state):
- *Context-switch re-entry cost* → **E-055's deterministic, stable-under-delta** layout = a persistent
  spatial anchor (recognition, not re-reading). [**E-055 active**, conditional on the stability check]
- *Working-memory tax* → the card board **externalizes the graph onto the page** instead of his head.
  [**design intent**]
- *"master Claude Code in text"* → **autonomy by default** (P4): he doesn't babysit the run, and
  **gates** let him trust the output without re-reading every log line. [**shipped**]
- ⚠ **Honest caveat — vend helps Sam *least* of the three today.** Vend's *current* primary surface is a
  **TUI + markdown** — the very text-heavy thing he struggles with. E-055 is the *bet* that closes this
  for him; until it ships, the design intent outruns the shipped reality. Combined with his retired
  neurodivergence framing and weakest validation, Sam is a **design hypothesis to test, not a segment to
  sell** — keep him for the layout-stability requirement he sharpens, not as a go-to-market claim.

---

## The deepest fit — vend moves the *lotería* labor to authoring

`hero_loteria.PNG` draws the four expensive labors as cards: **EL VETERANO** (judgment), **LA
SÍNTESIS** (context), **EL CRITERIO** (the gate), **LA REVISIÓN** (the check) — one-to-one with
`vision.md`'s "explain your process, set context, define what good looks like, check the output." For
these three personas that reframes what "help" even means:

**The shallow help is a prettier surface; the deep help is not having to do the labor at all.** A
visual/non-technical person's real relief isn't a nicer-looking run — it's that **the author already
performed EL VETERANO's squint and LA REVISIÓN's red pen, and froze them as gates (P3).** The counter
persona doesn't re-verify; the gate verified. That's `author once, run forever` (P1) aimed straight at
the survey-proven verification pain (Sonar/SO/DORA). The visual board (E-055) relieves the *counter*;
the **gates** relieve the deeper thing — they remove the labor, not just re-render it.

So vend helps each persona at **two depths**:
- **Surface (E-055 + card model):** see the work as glanceable cards, not a text wall.
- **Structure (gates + two-gesture transaction):** never perform the lonely judgment the cards depict —
  it was paid once, by the author.

## Design intent vs. shipped reality (the honesty the desk owes this)

Most of the *visual* help is **intended, not yet shipped.** Don't let "designed to help" read as "helps today":

| What helps | Persona | State | Note |
|---|---|---|---|
| Gates / two-gesture / budget contract (P1/P2/P3/P7) | All, esp. **Devraj** | **Shipped** | The *structural* relief is real now. |
| Card model (`card-model.md`) | All | **Shipped** | Work already modeled as cards. |
| **E-055 SVG board** | **Maya, Sam** | **Active / unbuilt** | The *surface* relief is a bet in flight. |
| Annotation round-trip (steer-without-code) | **Maya** | **Staged, charter-gated** | The telephone-killer is furthest out. |
| Current primary surface (TUI + markdown) | **Sam (against)** | **Shipped** | Still text-heavy — the thing E-055 must displace. |

**Reading:** vend's *structural* fit (gates, allocation, autonomy) is shipped and strongest for
**Devraj** — the designed-for puller. Its *visual* fit (the board, the round-trip) is the part still
being built, and it's what **Maya and Sam** depend on. The honest one-liner: **vend is designed to help
all three, ships help for one, and is mid-bet (E-055) on the other two.**

## Cross-persona synthesis → design inputs for E-055

| Signal (who) | Design input | Evidence strength |
|---|---|---|
| All three lead with **structure over prose** | Card *face* legibility/vocabulary is the weak link, not the geometry | [N internal] + [S cohort] |
| **Edges are payload** (Devraj) | Give blocked / critical-path edges visual weight; edge density at scale is the open risk | [I] from the persona, design-judgment |
| **Determinism → stability** (Sam) | "No force-directed" is an *accessibility* property; add a stability-under-delta check | [A]/[N evergreen] |
| **Static file is a feature** (Maya) | Validates SVG-as-file ahead of live MCP — the constraint serves the audience | **[N internal — the originating request]** |
| **Color carries status** (Maya, Devraj) | Color tokens were chosen for *card semantics*, not contrast/color-blind safety — add redundant position/shape signal | design-judgment; accessibility gap |

## Gaps — what the JetBrains/Octoverse/DORA seam-closing pass settled (and didn't)

*Updated after the survey-grade pass. Several gaps closed; the core one is now a **settled finding**,
not an open to-do.*

1. **~~"Can't follow the run" is unmeasured~~ → CLOSED [S].** The verification pain is now
   survey-proven: Sonar 2026 (96% distrust / 48% verify / 38% takes longer), SO 2025, DORA
   "babysitting" quotes. Claim 2a stands on survey grade.
2. **"Wants a *visual* surface" — STAYS OPEN [hypothesis].** No named survey measures it; settled as
   *our product hypothesis*, bridged by one rigorous n=20 qualitative study (UX vibe-coding). This is
   no longer a gap to "fix" — it's a labeled hypothesis. The honest move is to *test it* (E-055's own
   render-and-watch probe), not to keep hunting for a survey that may not exist.
3. **The neurodivergence framing — RETIRE it [counter-evidenced].** Survey weight runs *against*
   "ND → struggles with AI" (DBT +25% satisfaction; Copilot reduces cognitive load). Reframe Sam as a
   *layout-stability* need; drop ND as a selling point. This gap didn't close — it **inverted**.
4. **Vibe-coding cohort numbers still [A]** — the 63%-non-developer stat still lacks a named primary
   survey; caveat before external use.
5. **Mandate evidence still skews engineering** — for designers/PMs it's "encouraged" (Intuit), not
   "reviewed." The push on the *visual* persona is adoption-by-encouragement + ambient pressure.
6. **Residual unverified:** DORA/Sonar primary PDFs exceeded fetch limits (figures via publisher
   blog/press, not PDF body); GitHub's "72.6% agent effectiveness" has no locatable methodology [A];
   Atlassian DevEx 2025 full report is gated. Low priority.

## Cheapest validations (per persona, if a human pulls this forward)

- **Maya:** hand her one real rendered `.svg` and ask her to narrate what's happening — measure where
  she gets lost. (This is literally the founder's original "near-free" test from
  `graph-view-human-projection.md`.)
- **Devraj:** render a tangled 20-node board, ask "what should I unblock first?" — if he can't point,
  the edges aren't working.
- **Sam:** render a board, add one card, re-render — measure how much the layout moved.

## Sources (primary, by tier)

**[S] Survey / primary document / first-party vendor**
- Anthropic, *Agentic coding and persistent returns to expertise* — anthropic.com/research/claude-code-expertise
- JetBrains State of Developer Ecosystem 2025 (n=24,534) — devecosystem-2025.jetbrains.com/artificial-intelligence · blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/
- JetBrains AI Pulse 2026 (n=10,000+) — blog.jetbrains.com/research/2026/04/which-ai-coding-tools-do-developers-actually-use-at-work/
- GitHub Octoverse 2025 (telemetry) — octoverse.github.com · github.blog/news-insights/octoverse/...
- GitHub Copilot productivity/happiness study (the cognitive-load **counter**-signal) — github.blog/news-insights/research/research-quantifying-github-copilots-impact-on-developer-productivity-and-happiness/
- DORA 2025 State of AI-assisted Software Development (n≈5,000) — dora.dev/research/2025/dora-report/ · services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf
- Sonar State of Code 2026 (n=1,100+) — the verification-gap survey — sonarsource.com/company/press-releases/sonar-data-reveals-critical-verification-gap-in-ai-coding/
- Stack Overflow 2025 Developer Survey (AI section) — survey.stackoverflow.co/2025/ai/
- "Vibe Coding for UX Design" (arXiv 2509.10652, n=20 qualitative — the seam bridge) — arxiv.org/html/2509.10652v1
- Microsoft "AI no longer optional" (internal email, reported) — entrepreneur.com/business-news/microsoft-staff-told-to-use-ai-more-at-work-report/
- JPMorgan ~65k engineers AI usage → performance — letsdatascience.com/blog/jpmorgan-tracks-65000-engineers-ai-usage-performance-reviews
- UK DBT neurodivergence + AI (the **counter**-signal: ND +25% satisfaction) — webpronews.com/uk-study-neurodiverse-workers-25-more-satisfied-with-ai-assistants/

**[N] Named first-person / named publication**
- XDA, "Claude Code finally made the terminal accessible to people like me" — xda-developers.com/claude-code-finally-made-terminal-accessible-for-people-like-me/
- CACM, "The Vibe Coding Imperative for Product Managers" — cacm.acm.org/blogcacm/the-vibe-coding-imperative-for-product-managers/
- Intuit, AI at Global Engineering Days — intuit.com/blog/innovative-thinking/ai-powered-experiences-at-global-engineering-days/
- Fortune, solo founders running teams via AI — fortune.com/2026/05/18/solo-founders-ai-automation-entire-teams-entrepreneurs/
- Bloomberg, "AI Coding Agents… Productivity Panic" (headline only; body paywalled) — bloomberg.com/news/articles/2026-02-26/...
- Opensource.com, open source & neurodiversity (2021, evergreen) — opensource.com/article/21/7/open-source-neurodiversity

**[A] Anecdotal / motivated / directional**
- AgentsRoom (GUI wrapper; articulates run-log pain) — agentsroom.dev/claude-code-gui
- Joe Njenga, Claude Code Agent View — medium.com/@joe.njenga/i-tried-claude-code-agent-view-...
- "Your Terminal is Fighting You" — amanparmar3.substack.com/p/claude-code-for-everything-your-terminal
- 13Labs / Keyhole vibe-coding stats (untraced — caveat) — 13labs.au/guides/vibe-coding-statistics-2026
- Built In, Therapy for Designers — builtin.com/articles/unlock-vibe-coding-designers-product-managers
- Dyslexia.com, visual-thinker strengths — blog.dyslexia.com/the-power-of-being-a-visual-thinker/

**Internal primary source**
- `docs/active/pm/staged/graph-view-human-projection.md` — the originating designer request ("mini
  stroke looking at text-heavy views"; "deems the view good enough"). The single most load-bearing
  source for this whole persona set, because it is *our* user, in the founder's own relay.
