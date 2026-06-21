# Vend

Vend turns repeatable AI-agent work into named, grab-and-go **playbooks**. Author a
playbook once — encoding your judgment, process, and quality gates — then pick it off the
shelf, set a time/token budget, and run it. You pay for specification once; every run after
is a two-gesture transaction. The product is consistency: repeatability over a probabilistic
process, with gates as the contract.

Stack: TypeScript on Bun. Playbooks are typed code-as-config. The first executor is Claude
Code, behind an interface so open models slot in later.

## Set up a fresh device

You need [Bun](https://bun.sh) ≥ 1.3.9, the [Doppler CLI](https://docs.doppler.com/docs/cli),
and [Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/johnhkchen/vend.git
cd vend
bun install
doppler setup           # adopts doppler.yaml (project: vend, config: dev)
claude login            # the default executor authenticates here, not via a key
bun run hooks:install   # the test-green pre-commit gate
doppler run -- bun run check
```

`bun run check` regenerates the BAML client, typechecks, and runs the suite. It should end
green.

## Secrets

Secrets live in Doppler, never in the repo. `doppler run -- <cmd>` injects them. The default
`claude` executor needs no key — it uses your Claude Code login. The open-model runner is
opt-in; add `VEND_OPENAI_API_KEY` and friends to Doppler when you use it. `.env.example`
documents the full surface.

## Commands

```bash
bun run check     # baml client + typecheck + test (the gate)
bun test          # tests only
bun run build     # typecheck (run baml:gen first on a fresh clone)
```

Run anything that calls a model under `doppler run --`.

## Docs

- `docs/knowledge/vision.md` — vision and design principles. Read this first.
- `docs/knowledge/stack.md` — toolchain and rationale.
- `docs/knowledge/rdspi-workflow.md` — the authoring workflow.
