# Playbooks (codified) — the bridge from by-hand to automated

This folder is where a process we currently run **by hand** gets **codified as
standardized work** before it becomes a real Vend playbook (a BAML function under
`baml_src/`). It is the TPS middle step (`../tps.md`):

```
genchi genbutsu          standardized work             kaizen → automation
(do it by hand, see it) → (codify the repeatable    →  (graduate to a BAML
                           shape — HERE)                 playbook / executor)
```

Each entry captures the **nature** of one process — its repeatable steps, the
boundaries that must hold, and the andon that stops it — so that:

- the next person or agent runs it the *same* way (consistency), and
- it is shaped to be **systematized**: a codified process here is a playbook spec
  waiting for an executor.

Codifying these is our role in these sessions: turning judgment trapped in our
hands into a standard a system can run.

## What lives here vs. elsewhere

- **Here** = the *how-to-repeat* (standard work).
- `../ci-strategy.md`, `../charter.md`, `../tps.md` = the *why* (architecture,
  value, lens). Process docs reference them rather than restating them.
- `../playbook-decompose-epic.md` = the shape of the first play already in build
  (E-001) — conceptually a sibling of these, left in place so the running loop's
  tickets don't lose their path reference.
- `baml_src/` (later) = the *implementation*. A doc here graduates into a play
  there; it does not duplicate it.

## Entries

- **`project-steering.md`** — the **meta-play**: steering and driving a project
  (what *this session* is). Codifies the interaction — read state, sharpen framing,
  surface the real forks, capture durably, resist over-build, queue the next pull —
  not the outputs it calls for. The top of the clearing stack; commissions the
  others. → the eventual "ask for 2 hours of steering" playbook.
- **`steering-data-model.md`** — what to keep (a decision log + reward rubric
  mapped to the charter) so the steering play becomes *learnable*, not just run.
  A capture spec, not a pipeline.
- **`ci-structural-gate.md`** — adding one independent structural gate the
  Dagger-clean way (E-002's first-gate slice, generalized). → future
  "add-a-gate" playbook.
