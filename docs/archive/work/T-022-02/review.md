# T-022-02 — Review: consistency-contract-and-fork

Handoff for a human reviewer. This ticket is the **decide** half of E-022: it runs no new
mechanism — it captures the **consistency contract** the T-022-01 judge lets Vend write, and
surfaces the converge-vs-by-design fork for assent. **Doc-only change; no `src/` touched.**

## What changed

| File | Change | Role |
|---|---|---|
| `docs/active/work/T-022-02/findings.md` | **new** | The sweep findings note (AC#1/#3/#4): contract, per-play recommendation, fork, runnable protocol |
| `docs/knowledge/information-architecture.md` | **+IA-17** (additive) | The captured contract principle (AC#2): gated validity, not lexical identity |
| `docs/active/demand.md` | E-022 row Status | The bridge (AC#3): contract captured, fork surfaced, lever named-but-unbuilt |
| `docs/active/work/T-022-02/{research,design,structure,plan,progress}.md` | **new** | RDSPI work artifacts |

`git diff --stat` for code: **empty.** `equivalence.ts`, `run-equivalence-judge.ts`, the
consistency-probe path — all untouched. IA-1…IA-16 are byte-for-byte unchanged (IA-17 + its
Index line are pure additions). The demand.md change is a single row's Status field.

## The contract, in one line

**Vend promises gated validity, not lexical identity** (IA-17). Every cast is valid/grounded/
gated (the gates' job — the real promise, evidenced by E-014 ~21% + E-020's eliminated
honest-empty); repeated casts do not promise the same wording. Lexical divergence among valid
outputs is adjudicated **per play**: expand → **by-design**, survey → **converge (lean)**,
steer → **the human's call**.

## Test coverage

- **No new code ⇒ no new tests.** The classifier `equivalence.ts` is already covered by 12 pure
  unit tests (T-022-01). This ticket adds executable nothing.
- **Gate:** `bun run check` → **743 pass / 0 fail** (typecheck clean), at both baseline and
  after the doc changes — identical, as a doc-only change must be. **AC#4 green satisfied.**
- **Doc-consistency checks (by eye):** the per-play verdicts in IA-17 match the findings note's
  recommendations exactly (expand by-design / survey converge-lean / steer human-call); the
  dispersion numbers (0.50 / 0.69 / 0.72) match E-019 + E-020 (`demand.md:75,77`); IA-17's
  Index entry and body both present (`grep IA-17` → 2 hits).

## Open concerns — one is load-bearing

1. **CRITICAL FOR THE HUMAN: the live equivalence sweep was not run — by design.** E-022's
   decomposition designates it *"the human step,"* and it is a ~30-min, subscription-credit-
   spending, non-deterministic operation (9 play casts at 250–400k tokens + 3 judge casts),
   flagged unproven-end-to-end in T-022-01's review. So **the per-play equivalence classes in
   this note are recommendations, not measured judge reads.** The contract *spine*
   (validity-not-lexical) is evidenced (E-014/E-020); the per-play converge/by-design leaves
   rest on N=3 dispersion + stakes reasoning. **To close AC#1 with live data, run the protocol
   in `findings.md` §"The sweep protocol"** and tee to `work/T-022-02/sweep-logs/<play>.log`. A
   surprise read (e.g. expand → genuine-disagreement, or steer → clean equivalent-diversity)
   re-opens that play's fork with the live datum.
2. **The fork is genuinely open; this ticket does not decide it.** Recommendation-first means
   the human assents (IA-5 / E-018 fork-genuineness). Survey's **converge** is the load-bearing
   call — it drives IA-1's single recommended pull, so a #1 signal that flips run-to-run is the
   one genuine-disagreement that directly erodes the product spine. Steer carries no
   recommendation on purpose (0.72 dispersion may be legitimate diversity of *valid* directions).
3. **The convergence lever is named, not built** (E-022 non-goal). If "converge" is chosen for
   any play, the mechanism (canonical-form gate / consensus cast / lowered temperature) is a
   **downstream epic**, minted only on the converge assent. No such epic/row was created — the
   bridge records the pending fork, it does not pre-decide it.
4. **The "by-design" recommendations are the less certain ones.** "Accept the divergence" can be
   refuted by a single genuine-disagreement pair; "converge" is the safer default under
   uncertainty. Read expand's by-design as the weakest-held leaf — the sweep should target it.

## Nothing else flagged

The change is additive and doc-only, the gates pass green unchanged, and the durable principle
(IA-17) does not overclaim a decision the human hasn't made — it states the settled spine and
marks the per-play leaves as E-022 recommendations pending the sweep. **Recommended next step:**
the human runs the three-line sweep protocol, records the live equivalence reads beside this
note, and assents to (or overrides) the per-play fork — at which point any "converge" branch
mints its downstream lever epic.
