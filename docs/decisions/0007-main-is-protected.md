# 0007 · `main` is protected, and the release tag is the approval
**Date:** 2026-09-06 · **Status:** accepted

Publication authority and readiness interpretation updated by [0011](0011-evidence-and-engineering-boundaries.md). The original decision below remains historical.


## Context
The repository was set up private on a plan whose branch protection did not reach it, so «`main`
takes no direct pushes» was kept by convention alone. The same night the organisation moved to
GitHub Team, and the server could keep the line instead.

## Decision
**`main` is protected by the settings rather than by promises.** Pull requests only; the `gates`
check required; the branch up to date before it merges; force-pushes and deletions refused; squash
the only merge. **A `production` environment exists**, carrying a deployment branch policy. **The
approving step is the release tag, not a GitHub reviewer**: required reviewers on an environment
need Enterprise, so on Team the environment holds its branch policy alone and the required review
count is zero. `deploy/release.sh` refuses a dirty tree and any branch but `main`, and asks for a
typed `y` before it tags and publishes.

## Consequences
One maintainer can still land work, while nothing reaches `main` without green CI and nothing
reaches a box without a tag and a typed `y`. An agent session cannot push to `main` by mistake,
which is the property the convention stood in for. `AGENTS.md` step 4 is stale as of this record.

## Source
GitHub settings, 2026-09-06: branch protection on `main` (required check `gates`, strict, no force
pushes, no deletions), squash-only merges, one `production` environment with a branch policy ·
[`deploy/release.sh`](../omitted-sources.md) · [`AGENTS.md`](../../AGENTS.md).
