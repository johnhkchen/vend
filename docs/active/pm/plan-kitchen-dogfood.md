# Plan — Kitchen dogfood on EmDash (the long-lived real-project dogfood)

> **Desk planning doc** (the PM writes only to `pm/`). The strategic spine for vend's first
> **sustained, real-stakes** dogfood: vend+lisa drive a couple's home-kitchen app, on the **cook/dev's
> own repo**, EmDash-backed. Epics (E-061/062/063) are **pulled from here** via the board; this doc is
> upstream of the pull. Grounded in: the live `johnhkchen/homebrew-lisa` formula, EmDash docs,
> `demand.md` Frontier 7, and E-058/059/060.

## The story

A couple. One **cooks** (and is a **dev**); the other **orders/dines**. A home-kitchen app: the diner
orders dishes for a period; the cook provisions — shopping → prep → nutrition → the "hearty healthiness"
of two people eating well together. **vend gets a long-term user** (the cook/dev) and the project drives
on **strong autopilot**.

**Why it matters:** every dogfood to date was a *demo seed* cleared once. This is the first **sustained,
real-stakes, non-vend-domain** project — the strongest evidence available for both **Set A** (cleared
forward-E1 on work you need to be *right*) and **Set B** (the operator channel, used not surveyed). It is
the move from *demo seed* → *real project*.

## Two distinct users (don't conflate)

- **vend's user = the cook/dev** — technical; drives vend on their repo; the long-term user.
- **the app's end-users = the couple** — the **diner** is the non-dev visual surface; the cook uses the
  ops side.

## Architecture — EmDash CMS backbone

[EmDash CMS](https://github.com/emdash-cms/emdash) (Cloudflare's Astro 6 "WordPress successor", beta
v0.1) is an Astro integration giving **admin panel + REST API + auth + media library + plugin system**,
with portable storage (Kysely → SQLite/D1/Turso/Postgres; S3 API → R2/local).

- **Cook console** = the **EmDash admin** as-is (dishes = content, media library = photos) + logistics
  plugins later.
- **Diner storefront** (`/`) = a **custom Astro** frontend consuming EmDash content + REST API — the
  "online restaurant menu". Where the design polish goes.
- **Logistics** (order → shopping → nutrition → healthiness) = **sandboxed EmDash plugins** + custom
  content types over Kysely/D1.
- **Deploy:** Cloudflare (D1/R2/Workers) prod, local SQLite dev. The **deploy-preset shelf** ≈ EmDash's
  storage adapters (the CMS gives us the shelf).
- **Caveat:** EmDash is **v0.1 beta** — a real bet (thin ecosystem, will move). The long-lived autopilot
  dogfood is precisely what *absorbs* that risk: if EmDash shifts, vend re-clears the migration.

## The MVP (slice 0) — render the couple's menu

**Deliverable to the cook/dev:** a **seed** (EmDash+Astro repo, vend-wired, a `Dish` content type + a `/`
storefront menu route + Cloudflare config) **+ this implementation strategy**.

**Their path:** `brew install vend lisa` → make a workspace from the seed → `vend init` + `vend doctor`
→ add their real dishes (via EmDash admin) → vend drives the menu-render slice → **their menu renders**
(preview/deploy).

**Success = the couple's actual dishes render as an appetizing menu, on the cook/dev's own repo.** Not the
ordering loop yet — just the menu.

- **Honest-empty:** ship **one** example dish as format documentation; the couple adds their real dishes
  (IA-4).
- **Open decision — what vend's first drive clears:** (a) seed already renders an empty menu, cook just
  adds content; or **(b)** seed is intentionally incomplete and vend *clears the menu-render slice itself*
  — the honest first cleared-forward-E1 on their repo. **Lean: (b).** [pending]

## Maturation arc (post-MVP, vend-driven autopilot)

`ordering loop → derived shopping list → prep scheduling → nutrition rollup → the healthiness read.`
Each a vend-cleared slice on their repo; each accrues a cleared forward-E1. The healthiness read is the
soul of it — earned last, once the data exists.

## Operating model — autopilot in a directory you don't access

The cook/dev **steers + funds** vend; **lisa clears** on their repo; status arrives via the **ntfy
`on-notify` path + the SVG board** (now load-bearing — they're how a remote human knows the loop needs
them or finished); the diner **uses** the app. The cook/dev never hand-edits — reviews outputs / uses the
app (optionally a remote box). This is the P4/P5 walk-away model, on the cook/dev's repo.

## The epic arc (pulled from this plan)

```
E-061  Retrospective + capture fixes
        backward: E-058/059/060 findings · forward gaps grounded by THIS initiative ▼
            ├─ no end-user install path                → E-063
            ├─ vend can't yet drive an EmDash/Astro-6 project (the seed/template) → E-062
            └─ headless-operability when the human is remote from the dir
                 (notifications-as-status; budget/andon legible in review)
E-062  Kitchen QuickStart seed + strategy (EmDash) ─┐  the X-2 production-bar example, real
E-063  vend Homebrew distribution + "make a workspace" ─┤  the end-user install path
                                                       ▼
        MVP — cook/dev installs vend, makes a workspace from the seed, drives → menu renders
```

E-061 surfaces the demand; **E-062 (seed) ∥ E-063 (install)** are parallel prerequisites of the MVP (the
seed can be authored while the install epic is built; the drive needs both). **Numbering is provisional**
— pull-order ≠ ID-order (`demand.md`).

## E-063 distribution spec — mirror lisa exactly (verified)

**lisa's actual mechanism** (`johnhkchen/homebrew-lisa/Formula/lisa.rb`, lisa 0.3.0):
- **Compiled per-platform binary** (`bun build --compile` → Mach-O, 2.5 MB), **4 targets**:
  `{aarch64,x86_64} × {apple-darwin, unknown-linux-gnu}`, tarballs `lisa-cli-<arch>-<os>.tar.xz`.
- Published as **GitHub release assets** on `johnhkchen/lisa`; **sha256 per variant**.
- A **Homebrew tap** (`johnhkchen/homebrew-lisa`) whose formula selects by platform, verifies sha,
  extracts, `bin.install`. MIT, **no deps**, installs README/LICENSE/CHANGELOG. **No livecheck** (manual
  version bumps).

**vend mirror (E-063 scope):**
- Compile vend to per-platform self-contained binaries (`bun build --compile`); tar.xz; name
  `vend-cli-<arch>-<os>.tar.xz`.
- **Release CI** on the vend repo (build 4 assets + sha256) — **currently absent** (no `.github/workflows`).
- A `vend.rb` formula in a tap (a parallel `johnhkchen/homebrew-vend`, mirroring lisa's own-tap pattern).
- **package.json cleanup:** drop `private: true`, real semver (currently `0.0.0`), add `bin`.
- **"make a workspace":** extend the existing **`vend init --template <name>`** seam (E-058) so a
  brew-installed vend lays down the kitchen seed/workspace — **not** a new command. The cook/dev brings
  their own `claude login`; **no Doppler** (that's our-repo-only).

**Risks / decisions:**
- **BAML native addon × cross-compile.** vend's compiled binary is ~108 MB (bundles BAML) vs lisa's
  2.5 MB (no native deps). Cross-compiling the BAML native addon to all 4 platforms may not be as trivial
  as lisa's pure build. → **For the MVP, ship the cook/dev's platform first** (likely arm64-mac), add
  others later. **Need: the cook/dev's OS/arch.**
- **One tap vs two.** `brew install johnhkchen/lisa/lisa johnhkchen/vend/vend` (two taps, mirrors lisa) vs
  a consolidated tap. **Lean: mirror lisa** (its own tap), consolidate later if desired.

## Open decisions (carry)

1. **MVP first-drive:** (a) content-only vs **(b) vend clears the menu-render slice**. Lean (b). [pending]
2. **Distribution:** compiled-binary (lisa's verified mechanism) — confirmed mirror; ship cook/dev's
   platform first.
3. **Workspace command:** extend `vend init --template kitchen` (lean) vs a new `vend new`.
4. **EmDash beta-risk:** proceed on v0.1, re-clear migrations as it evolves. [confirm]
5. **Cook/dev's OS/arch** — needed to pick the first binary target. [need input]

## Status / next

Upstream of the pull. When ready: raise the process-gate with a **retrospective** focus and pull **E-061**
first; **E-062 ∥ E-063** follow. Nothing is minted to the board from here — promotion stays a deliberate
human pull (`vend chain`).
