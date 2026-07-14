# T-026-04 — Design: confirm-go vs reroute, and how to record it

> Decide the verdict and the shape of the records it updates, grounded in the T-026-03 number
> and the provisional-go caveat from Research. The decision must be earned against the reroute
> branch, not assumed.

## The decision that has to be made

E-026's pre-framed fork (`E-026.md:49`): **reaffirm the provisional go on strong, variance-
bearing evidence — or revise to a reroute the weak sample masked.** The reroute branch for E1
is named in E-014's own rule (`E-014.md:61`, `measurement-sprint/findings.md:14`): *"author
keeps intervening" → andon-UX reroute.* So the test is sharp and binary:

> Does the forward, variance-bearing walk-away rate show the author **keeps intervening** —
> enough to contradict the back-fill's 100% and fire the andon-UX reroute? Or does it show the
> author **still walks away** even now that a discriminating case has appeared — confirming the
> go on stronger evidence?

## Reading the number against the reroute branch (the honest test)

**The back-fill (what we're hardening):** 100% (13/13), uniform, zero `--intervened`, post-hoc,
single-attestor. Its weakness was *structural*: no run where intervention was even possible to
observe, so 100% could not distinguish trust from absence-of-temptation.

**The forward read (what we now have):** 93% (14/15), with **one genuine `intervened=true`
record** — a real discriminating case finally in the sample. The rate dropped 100% → 93%, and
the trend reads 100% → 88%.

Two readings of the 7-point drop, tested against each other:

- **Reroute reading:** "the rate fell from 100%; the author intervened; the andon-UX branch
  fires." — **Rejected.** The branch is "author *keeps* intervening" — a pattern, a rate that
  says step-ins are common. One step-in in fifteen carriers (and that one on a *budget-
  exhausted* run, where stepping in is the system inviting a decision, not the work
  misbehaving) is the **opposite** of "keeps intervening." 14/15 = the author walked away from
  the overwhelming majority *including* now that variance exists.

- **Confirm reading:** "the back-fill's 100% was suspect *because* it was variance-free; the
  forward sample introduced exactly the discriminating case the caveat asked for, and trust
  **survived it** at 93%." — **Accepted.** The drop from 100% is not a regression; it is the
  back-fill's missing variance finally appearing, and the rate barely moving when it did. A
  100% that becomes 93% on the arrival of the first real intervention is a *stronger* signal
  than the original 100%, not a weaker one — it is no longer consistent with "no case arose."

**Verdict: confirm-go.** The provisional go stands on forward evidence. The forward rate
(93%/15) does not contradict the back-fill (100%/13); it **corroborates and hardens** it by
showing the same trust holding once a genuine step-in is in the sample.

### The caveat that rides with the confirm (non-negotiable, per AC + T-026-03)

Confirm-go is **not** "trends to 100% proven." The trend (100% → 88%) rests on a **single**
intervention bit; it is noise-dominated, not a trajectory (T-026-03 findings `:24-33,90-92`).
The honest confirm is: *the rate is a real, variance-bearing read and it clears; the
trajectory is still thin and wants more `--intervened` sessions before any "→ 100%" claim.*
The verdict states this in the same breath as the confirm — a hardened go, not a victory lap.

### Why not reroute (documented rejection)

Reroute would require either (a) a walk-away rate low enough to read as "keeps intervening"
— 93% is the inverse — or (b) the forward sample revealing a failure the back-fill hid. It
revealed the opposite: trust holding under the first real test. Rerouting on a 93% forward
rate would be measuring theatre — overriding strong evidence with a caveat about its
thinness. The thinness caveat bounds the *trend* claim, not the *rate* verdict.

## Option set for **how to record** the verdict

The verdict page is fixed (AC: one page at `work/T-026-04/`). The design choice is the
**E-014 verdict-note update** — scope and placement.

- **Option A — minimal one-line update + pointer (chosen).** Update `E-014.md:4`'s frontmatter
  comment `verdict HOLD (measure to unblock)` → `verdict go (forward-confirmed: E1 93%/15
  fwd, E-026)`, and add a short **Verdict** note to the E-014 body pointing at this page. Echo
  the forward-confirmed state in `demand.md`'s E-014 row + measurement-sprint section (one
  sentence each). Rationale: the AC asks to *update the verdict note*, not rewrite the epic;
  the reasoning lives on the verdict page, the records carry the one-line state + a pointer.
- **Option B — full forward-evidenced rewrite of E-014's body.** Rejected: scope creep on a
  done epic; duplicates the verdict page; the AC says "updates the verdict note," not "rewrite
  the epic."
- **Option C — verdict page only, leave E-014 untouched.** Rejected: the AC explicitly requires
  updating E-014's verdict note from its provisional/back-fill state. Leaving `E-014.md:4` at
  the stale "HOLD" fails the AC outright.

**Chosen: A.** Smallest change that satisfies the AC and keeps the canonical records honest:
the one-line verdict state where E-014's verdict lives, the full reasoning on the page, the
board echo so `demand.md` stops saying "HOLD."

## What the verdict page must contain (from the AC)

1. The call in one word — **confirm-go** — up top.
2. The measured rate/trend from T-026-03 cited **against the back-fill's 100%/13 caveat**.
3. The reroute branch tested and explicitly rejected with reasoning.
4. The trend-thinness caveat carried forward (no overclaim).
5. The E-014 verdict-note transition recorded (from → to).
6. An explicit "no remediation begun" boundary + a pointer that remediation, if ever needed,
   is a downstream epic (here: none needed — confirm-go leaves the wallet as shipped).

## Boundaries reaffirmed

No `src/` change. No ledger writes (read-only re-audit only, already done for reproducibility).
No remediation. The only edits outside `work/T-026-04/` are the verdict-note one-liners in
`E-014.md` and `demand.md`.
