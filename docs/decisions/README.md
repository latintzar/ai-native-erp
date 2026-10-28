# Engineering decisions

The record of the choices the code already depends on. A person arriving here should be able to
read these in order and know why the repository, the providers, the builds and the runtime look the
way they do — without reading eight specs to find the one sentence that settled it.

The specs say what the product does. These say what was decided, when, and on whose word.

## The convention

One file per decision, named `NNNN-slug.md` — four digits in order of acceptance, and the number
never changes. Each file is short, and carries four sections:

| section | what goes in it |
|---|---|
| **Context** | the situation that forced a choice, in a few sentences |
| **Decision** | what was decided, in the present tense, as law |
| **Consequences** | what this commits us to, what it costs, what it makes easy |
| **Source** | where the decision came from: a spec section, a FEED-IA §, a file, a setting |

Every record carries its date — the date the decision was made, which is often older than the day
someone wrote it down.

**A record stops changing once it is accepted.** A decision that moves gets a new record, and the
old one gains one line at the top naming its successor. That is the whole mechanism: the history
stays readable because nothing is quietly rewritten.

**The Source section carries a real citation.** A FEED-IA § number, a spec heading, a file path, a
GitHub setting with its date. A decision nobody can trace is a decision nobody can reopen.

## What lives elsewhere

- [`decisions/` in Rocoto-Labs/company](../omitted-sources.md)
  is the company's own record — market, pricing, positioning, the pivots — under its own
  dated-filename convention, in its own repository (record [0010](0010-three-repositories.md)).
- The specs (`docs/THE-*-SPEC.md`) hold the contract itself. A record here points at the spec
  section; it never restates it.
- Peter's directives live verbatim and numbered in [`docs/FEED-IA.md`](../FEED-IA.md). A record
  quotes the § number and leaves the words where they are.

## The records

| # | Decision | Date |
|---|---|---|
| [0001](0001-the-repository-and-the-organisation.md) | The repository, GitHub flow, releases from tags | 2026-09-06 |
| [0002](0002-the-model-is-always-anthropic.md) | The language model is always Anthropic's | 2026-09-05 |
| [0003](0003-document-reading-by-anthropic-vision.md) | Paper is read by Anthropic vision; Parsewise retired | 2026-09-06 |
| [0004](0004-artwork-by-ideogram.md) | Artwork is painted by Ideogram in the library's style | 2026-09-05 |
| [0005](0005-one-codebase-two-builds.md) | One codebase, two builds; the kit runtime stays theatre | 2026-09-05 |
| [0006](0006-the-kit-runtime-in-production.md) | The kit runtime runs in production behind kit.soyrocoto.com/api | 2026-09-04 |
| [0007](0007-main-is-protected.md) | main is protected; the release tag is the approval | 2026-09-06 |
| [0008](0008-environments.md) | Demo and staging deploy from main; production from a tag | 2026-09-07 |
| [0009](0009-experiments.md) | An experiment is its own repository, deployed to staging, archived when it dies | 2026-09-07 |
| [0010](0010-three-repositories.md) | Three repositories: the product, the company canon, the marketing site | 2026-09-07 |
| [0011](0011-evidence-and-engineering-boundaries.md) | Intent, implementation evidence, isolated work and release authority | 2026-09-07 |
