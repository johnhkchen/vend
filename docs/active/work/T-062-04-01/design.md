# T-062-04-01 — Design

Decide how to freeze the kitchen drive into one committed `EXPECTED-OUTCOME.md` gold-master, grounded
in the Research. Three real decisions: **(D1) honest scope** of what gets captured vs left `⟪…⟫`,
**(D2) file placement**, **(D3) document shape**.

---

## D1 — Honest scope: capture-the-deterministic, slot-the-metered

The tension: the AC says "capturing the cleared board, the rendered menu, and the budget envelope of
the **clean drive**." A naïve reading implies a *completed live drive* with real numbers. But
honest-on-outcome (a binding project value) forbids inventing the metered line, the live `vend
steer`/`vend work` casts have **no offline path**, the drive is **human-authorized (P7)**, and **no
live kitchen numbers exist in the tree** (Research §3).

### Options

- **(A) Run the metered drive now and capture real numbers.** Rejected. It spends real tokens on a
  human-authorized cast without authorization (P7), and this card is an autonomous RDSPI execution.
  It also conflates this synthesis card with the live drive the predecessors deferred *to a human*.
  Doing it would violate the same discipline every predecessor footer upheld.
- **(B) Fabricate plausible numbers to "complete" the table.** Rejected outright — this is exactly
  the laundered-evidence failure the project vetoes (memory: *Honest-On-Outcome Discipline*; the
  hackathon gold-master's rule: "a number that was not observed must stay `⟪…⟫`").
- **(C) Freeze the gold-master with every deterministic component captured as FACT and the single
  live metered line recorded as explicit `⟪…⟫`.** **Chosen.** This is precisely the state the
  hackathon gold-master held *before* T-060-03-01's authorized drive filled it — a legitimate,
  shipped, committed shape. The AC is satisfiable under it: the **board** (the expected/target board,
  captured deterministically from the seam proof — clause "cleared board" as the consistency target),
  the **rendered menu** (captured as fact — the render contract + a real green build), and the
  **budget envelope** (the cold-start mechanism named + the live value as the metered slot).

### Why (C) honors the AC

- "the cleared board" → the **expected board** (gold-master target) is captured from
  `expected-board.md`; the live *ranking* that confirms it is the `⟪…⟫` slot. The board the drive is
  diffed against IS captured — that is the consistency bar's whole job.
- "the rendered menu" → captured as fact: the render spec + the **real green `astro build`** of the
  gold-master reference page (clauses 1+2 are not deferred).
- "the budget envelope" → the cold-start envelope mechanism (E-060) is named and its live value is
  the metered `⟪…⟫` (it is logged on the run line, not a hand-pickable constant — Research §4).
- "in a form a later drive can be diffed against" → the re-run block + the target board + the
  reference render + the bound make it diffable. **This is the operative requirement**, and it is met
  in full without a live drive.

The card therefore ships an **honest frozen bar**: deterministic halves as fact, the one metered line
as a pending slot with a re-run block that the human-authorized drive (or the downstream clean-room
epic) fills in place. I will **strengthen** the captured half by re-running the *free* stages
(init/doctor/svg) live during Implement and recording their real output — so the gold-master's
deterministic numbers are freshly observed, not merely cited.

---

## D2 — File placement: the seed template (mirroring hackathon), with a work-dir trail

### Options

- **(A) `docs/active/work/T-062-04-01/EXPECTED-OUTCOME.md` only.** Literal "epic work dir" reading.
  Rejected as the *canonical* home: a clean-room drive **copies the seed**, not the vend repo's
  `docs/active/work/`, so a work-dir-only file is **not diffable by the later drive** — it fails the
  AC's operative clause ("a form a later drive can be diffed against").
- **(B) `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md` (canonical), mirroring
  `examples/templates/hackathon-seed/EXPECTED-OUTCOME.md`.** **Chosen for the canonical file.** It is
  the shipped precedent, it **travels with the seed** so the clean-room drive carries its own bar, and
  it is the literal artifact a `cp -R seed sandbox` diff compares. This is the diffable form.
- **(C) Both — canonical in the seed, a duplicate in the work dir.** Rejected: two copies drift, and
  drift in a *consistency bar* is self-defeating.

### Decision

Canonical gold-master at **`examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`** (mirrors hackathon
exactly; travels with the seed; diffable by the clean-room drive). The **RDSPI trail** (research,
design, structure, plan, progress, review) lives in `docs/active/work/T-062-04-01/` as always, and
`progress.md`/`review.md` will point to the canonical file. I read "the epic work dir" as "the epic's
deliverable home," which for a seed-diffable consistency bar is the seed template — and I will flag
this interpretation explicitly in `review.md` for the human (the one judgment call worth surfacing).

This also keeps the kitchen seed symmetric with the hackathon seed: both ship a gold-master beside
`SEED.md`/`charter.md`/`README-STACK.md`.

---

## D3 — Document shape: the hackathon structure, kitchen-specialized, honest split

Adopt the hackathon `EXPECTED-OUTCOME.md` skeleton (Research §2), specialized to the kitchen drive and
to the capture/pending split (D1):

1. **Header banner** — what this is (the frozen consistency bar), provenance of the *captured* half
   (host, executor, the free stages re-run), and a loud honest-on-outcome note: deterministic halves
   are FACT; the single live metered line is `⟪…⟫` pending the human-authorized drive.
2. **Headline** — the dress-rehearsal verdict: the bootstrap path drives **clean and free** end to
   end (init→doctor→svg honest-empty, scaffold + seam + render contract + green build + degrade +
   idempotent re-drive all gated); the one remaining line is the metered steer→work clear.
3. **What the drive yields** — a table: each row CAPTURED (with the real value) or PENDING (`⟪…⟫`).
4. **The board** — the kitchen gold-master board (Keystone = menu render; the Cloudflare deploy slice;
   the SSG-vs-SSR fork), carried from `expected-board.md` as the diff target.
5. **The rendered menu** — the render contract + the example-dish card + the green build (captured).
6. **The degrade line** — MCP-absent → reduced grounding (captured deterministically; live line
   `⟪…⟫`).
7. **The budget envelope** — the cold-start mechanism (omit `--budget` ⇒ `coldStartEnvelope`), the
   "lands inside" definition, the live values as `⟪…⟫`.
8. **Residual / honest boundaries** — what stays pending and why (the metered cast; live EmDash REST;
   live Cloudflare deploy) → the proposed downstream clean-room epic.
9. **Re-run block** — the exact free + metered commands + the `jq`/`grep` budget checks, so the
   human-authorized drive (or the clean-room epic) fills the `⟪…⟫` in place.
10. **Honest-on-outcome footer** — the capture/pending contract; "no live number was invented"; the
    gates that void the premise if the captured half ever breaks.

This shape makes the file **simultaneously** a captured record (the free half) and a re-runnable bar
(the metered half) — which is exactly what a gold-master frozen *before* the authorized drive should
be, and it converges to the hackathon file's filled form once the drive runs.

### Rejected shape variants

- **A pure forward-looking spec** (all `⟪…⟫`, no captured values). Rejected — it would waste the real,
  free, observable deterministic facts and read as weaker than the predecessors' component files.
- **A pure backward record** (claim the drive happened). Rejected — dishonest (D1-B).

---

## Summary of decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | Capture deterministic as fact; metered line stays `⟪…⟫` (option C) | Honest-on-outcome; P7; no live numbers exist; matches the hackathon pre-fill state |
| D2 | Canonical file at `examples/templates/kitchen-seed/EXPECTED-OUTCOME.md`; RDSPI trail in work dir | Mirrors hackathon; travels with the seed; diffable by the clean-room drive |
| D3 | Hackathon skeleton, kitchen-specialized, capture/pending split | Reuses the shipped pattern; converges to the filled form on the authorized drive |
