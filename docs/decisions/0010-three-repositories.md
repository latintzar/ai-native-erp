# 0010 · Three repositories: the product, the company canon, the marketing site
**Date:** 2026-09-07 · **Status:** accepted

## Context
The product left a monorepo in September 2026 and brought its neighbours with it. Alongside the app,
the backend and the specs, this repository also held `company/` — 277 files of pitch, decisions,
research notes, legal text and deck source, including 26 files and 4.6 MB of another company's deck
— `site/`, the 394 files of soyrocoto.com, and `packages/`, two modules of Leo's brand and core
libraries that `app/`, `backend/` and `mock-api/` all imported zero times. The company skills sat in
`.agents/skills/` beside the product ones, and 4.7 MB of that was third-party writing: Paul Graham,
the YC library, deck templates.

Four things ship on four different roads. The product ships from a tag, through `deploy/`, with a
typed `y`. The site ships when a person runs the Vercel CLI. The canon ships when Peter opens a
Google Doc. Nothing ships `packages/` at all. Carrying them in one tree meant one CI run gated all
four, one clone pulled 43 MB nobody was working on, and a gate written for the product had to hold
an exception for the canon.

Peter, 2026-09-07: «my company is Rocoto, everything else is for leo-projects; anything separate is
unprofessional to have» and «I'm not reinventing the wheel, I want to be conventional». The
conventional shape is the one every seed-stage company converges on: the product repository holds
what ships together, and everything else is its own repository.

## Decision
**Three repositories, one road each.**

| repository | what it holds | how it ships |
|---|---|---|
| **Rocoto-Labs/rocoto** | the product: `app/`, `backend/`, `mock-api/`, `drives/`, `tools/`, `docs/`, `library/`, `deploy/` — and the skills that build it, `deploy` and `test` | a tag, through the chain in `deploy/`, behind a typed `y` |
| **Rocoto-Labs/company** | the company canon: pitch, decisions, notes, customers, legal, outward, specs, the deck — and the skills that run the company: `pitch`, `startup-canon`, `yc-startup`, `office-hours`, `pivot`, `retro`, `embody`, `context-save` | Google Docs, made from what is written there |
| **Rocoto-Labs/site** | soyrocoto.com | `vercel deploy --prod` from a checkout, by hand |

**A skill lives with what it acts on.** A skill that builds the product lives with the product; a
skill that runs the company lives with the canon. Each repository carries `.agents/skills/` with
`.claude/skills` and `.codex/skills` as symlinks, so a Claude or Codex session opened in any of the
three finds the skills for the work in front of it.

**Third-party writing leaves the product repository.** The YC and Paul Graham corpus and the deck
templates travel with the company canon, which is what reads them.

**Another company's material leaves altogether.** The Sancho y Panza deck source went to
leo-projects, `~/.leo-root-backup/sancho-deck-2026-09-07.tgz`, on 2026-09-07.

**`packages/` is deleted rather than moved.** `core` and `brand` were Leo's, nothing here imported
them, and `brand`'s build wrote to a monorepo path that no longer exists. The three generated files
soyrocoto.com actually consumed — `brand-vars.css`, `brand-effects.css`, `fluid-gradient-v4.js` —
were already copies inside `site/`, and they travelled with it, so the site repository renders on
its own. The last state of `packages/` is in this repository's history at commit `6990c120`.

## Consequences
**A session opens in one place and knows what it is for.** Product work, the specs, the gates, the
drives and the release: this repository. The pitch, a decision, a research report, the deck's
substance, the legal text: the company repository, cloned at `/home/peter/rocoto-company`. A
landing-page change: the site repository, cloned at `/home/peter/rocoto-site`. Research about
Rocoto files in the company repository, and `peter-research`, `peter-deep-research`, `peter-find`
and `peter-docs` say so in their own SKILL.md.

**CI gets smaller and stricter.** Ruff and mypy stop excluding four trees that hold no Python this
repository owns. `tools/prod-ip-gate.py` drops its one exclusion and searches every tracked file.
`tools/link-gate.py` stops resolving `/route` links under `site/`: a link to a page on
soyrocoto.com is a link into another repository now, so it is written as a full URL, and the gate
reports anything else.

**A citation across a boundary carries a URL.** `AGENTS.md` already required that a document whose
target left the tree names where it is. Eleven links and a dozen prose citations into `company/`
now name `Rocoto-Labs/company` by URL.

**One drive keeps its fixture.** `drives/drive-199-runtime.py` built its Spanish audio out of
`site/assets/voices/`. Three of those files are copied to `drives/fixtures/voices/` so the pinned
manifest stays self-contained and offline.

**The cost is three clones and three places to look.** A change that touches the product and the
site is two branches and two pull requests, and there is no single command that proves both. That
is the price of the roads being different, and it is the price every company this size pays.

## Source
Peter, 2026-09-07: «my company is Rocoto, everything else is for leo-projects; anything separate is
unprofessional to have» · «I'm not reinventing the wheel, I want to be conventional» ·
[`README.md`](../../README.md) · [`AGENTS.md`](../../AGENTS.md) · [`STACK.md`](../omitted-sources.md) ·
[0001 · the repository and the organisation](0001-the-repository-and-the-organisation.md) ·
[0008 · three environments](0008-environments.md) ·
[Rocoto-Labs/company](../omitted-sources.md) ·
[Rocoto-Labs/site](https://github.com/Rocoto-Labs/site).
