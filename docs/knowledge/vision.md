# Vend — Vision

> Vend turns you from the thing *in* the loop into the thing that *designs* the loop.

This document is the canonical statement of what Vend is and why it exists. It is
durable knowledge: architecture, scope boundaries, and roadmap belong in tickets
and design artifacts, not here. When a decision elsewhere contradicts this
document, one of the two is wrong — surface it.

---

## What Vend is

Vend is a **local-first tool that turns repeatable AI-agent work into named,
grab-and-go items**.

You author a **playbook** once — encoding your judgment, your process, and your
quality gates. Afterward you just walk up, pick it off the shelf, allocate a
budget (time / tokens), and run it. The hard specification work is **paid once at
authoring**; every run after is a **two-gesture transaction**: *pick* + *run*.

Under the hood it is typed, graph-structured agent orchestration (Claude Code as
the first executor, open models later). On the surface it is as simple as
grabbing a Coke.

---

## The core mechanic

The expensive part of agent work — explaining your process, setting context,
defining what "good" looks like, checking the output — is normally re-paid on
every single run. Vend moves that cost to **authoring time, paid once**, and
amortizes it across every future run.

```
Author once  ──►  shelf it (named)  ──►  pick + budget + run  ──►  run  ──►  run ...
[expensive]                              └────────── two gestures, cheap ──────────┘
```

The vending-machine metaphor is load-bearing, not decoration: **no negotiation
at the point of use.** You don't re-specify, re-approve, or re-supervise. You
grab and go.

---

## The two pains it attacks

**1. Supervision doesn't scale.**
Vanilla Claude Code makes you a babysitter — in the loop, approving every step.
Your attention is the bottleneck, and it caps out the moment you run 3–5 agents
at once.
→ Vend lets playbooks **run autonomously against their own gates** instead of
against your live approval. You stop babysitting agents and start dispatching
pre-built work.

**2. Expertise isn't reusable.**
You re-specify the same work every time — re-explaining your process, re-setting
context, re-checking output by hand. Your judgment is trapped in your hands
instead of encoded in a system.
→ Vend lets you **encode a process once and reorder it by name forever**.

---

## The deeper promise: consistency

Underneath both fronts is a single promise — **consistency**.

Vend sells *repeatability over a process that is natively unrepeatable*. Agent
work is probabilistic; the same prompt does not give you the same result twice.
The **gates are what make "you got what you paid for" true** — they are the
contract that converts a probabilistic process into a dependable product.

A vending machine for probabilistic work. The gates are the machine.

---

## Design principles

These constrain every future decision. A proposal that violates one of these is
suspect until argued against this list explicitly.

1. **Author once, run forever.** Cost lives at authoring time. Anything that
   pushes specification effort back onto the run — re-prompting, re-approving,
   re-checking — is a regression, not a feature.

2. **The run is two gestures.** Pick + budget + go. The standard path to running
   a known playbook must stay a transaction, not a conversation. Configuration
   surfaces belong at authoring time, not at the counter.

3. **Gates are the contract.** A playbook's quality gates are what make its
   output trustworthy without a human in the loop. Gates are first-class, not an
   afterthought; a playbook without enforceable gates is not done.

4. **Autonomy by default, not supervision.** Runs proceed against their gates,
   not against live human approval. Human attention is for *designing* loops, not
   for sitting inside them. Escalation to a human is a deliberate, gated event —
   not the default control flow.

5. **Local-first.** Vend runs on your machine and owns its own state. Cloud and
   remote execution may come, but the tool must be fully usable offline and on
   one machine.

6. **Executor-agnostic underneath.** Orchestration is typed and graph-structured,
   independent of who executes. Claude Code is the first executor; the design
   must not assume it is the only one. Open models follow.

7. **Budget is a hard contract, not a hint.** A run is allocated a time/token
   budget at the counter and is accountable to it. "You got what you paid for"
   cuts both ways — the run respects what you paid.

---

## Non-goals

What Vend is deliberately **not**, so we don't drift into it:

- **Not a chat copilot.** The win is *removing* yourself from the loop, not
  conversing inside it more efficiently. If the answer to a problem is "talk to
  the agent more," that belongs upstream of Vend, at authoring.
- **Not a babysitting dashboard.** Better tools for approving each step is
  solving the wrong problem. The goal is to not approve each step at all.
- **Not a one-off prompt runner.** Vend's unit is the *reusable, gated playbook*.
  Single-shot, throwaway agent invocations are not the target — they are exactly
  the work Vend exists to graduate into playbooks.
- **Not an executor.** Vend orchestrates; Claude Code (and later others) execute.
  Vend's value is in the typed graph, the gates, and the shelf — not in being a
  better model runner.

---

## Vocabulary

The authored, kitchen-side noun is settled; the counter-side noun stays informal
for now.

| Term         | Meaning |
|--------------|---------|
| **Playbook** | The authored, named, reusable unit. Encodes process, judgment, and gates. The thing you write once and stock. Chosen because it carries *codified expertise*, *repeatability*, and *craft-neutrality* at once — a designer and a developer both have "plays." |
| **Shelf**    | The named collection of playbooks you can pick from. |
| **Run**      | A single execution of a playbook against an allocated budget. |
| **Gate**     | A quality check a run must pass to proceed or to be considered done. The contract that makes output trustworthy without a human in the loop. |
| **Budget**   | The time/token allocation given to a run at the counter. A hard contract. |
| **Executor** | The thing that actually runs the agent work. Claude Code first; open models later. Distinct from Vend, which orchestrates. |

*Open question:* the counter-side verb/noun for grabbing-and-running stays
informal ("grab a Vend," "run it"). A dedicated word (e.g. *order*, *dish*) may
be introduced later if the two surfaces — authoring vs. running — need distinct
vocabulary. Authoring is the surface with no good alternative; the counter can
stay casual.

---

## The one line

> Vend turns you from the thing in the loop into the thing that designs the loop.
