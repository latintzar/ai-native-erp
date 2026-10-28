# 0001 · The repository, GitHub flow, releases from tags
**Date:** 2026-09-06 · **Status:** accepted

## Context
The product left the monorepo it grew up in and took its own repository. One maintainer and several
agent sessions work in it at once, so it needs one written answer to two questions: how a change
reaches `main`, and how anything reaches a box.

## Decision
The repository is **github.com/Rocoto-Labs/rocoto**, private, in the Rocoto-Labs organisation.
Work is GitHub flow: a branch off `origin/main` named `<type>/<slug>` — `feat`, `fix`, `docs`,
`chore` — carrying one concern, a pull request with the template, CI green, then **squash-merge**
and the branch deleted. A release is a **tag**: `make release` runs `deploy/release.sh`, which tags
`main` `vX.Y.Z` and runs the guarded chain in `deploy/` — build, package, byte proof, deploy, public
proof, record — behind one human approval. A merge on its own reaches no box.

## Consequences
`main` stays deployable, history reads as one commit per pull request, and every release is a tag
with a `CHANGELOG.md` line and a record beside it — which is what makes «what is live» answerable.
The cost is ceremony: a one-line fix is still a branch and a wait for CI.

## Source
[`CONTRIBUTING.md`](../../CONTRIBUTING.md) · [`AGENTS.md`](../../AGENTS.md) ·
[`deploy/release.sh`](../omitted-sources.md) · [`CHANGELOG.md`](../omitted-sources.md) · commit `e26315d0`, 2026-09-06.
