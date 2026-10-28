# 0008 · Three environments: demo and staging deploy from main, production from a tag
**Date:** 2026-09-07 · **Status:** accepted

Publication authority updated by [0011](0011-evidence-and-engineering-boundaries.md).
The [2026-09-09 correction](#correction--2026-09-09) defines independent publication targets.
The original decision below remains historical.

The proposed kit-to-demo redirect was retired on 2026-09-07: the kit also publishes the gallery,
scenarios and documentation, which demo's app-only build does not contain. Host migration remains
tracked in [#49](../omitted-sources.md), with artifact preservation required
before DNS changes. See the current [staging configuration](../omitted-sources.md).


## Context
There was one deployed surface of the app and it was a publication. `kit.soyrocoto.com` served the
prototype on the production box, put there by `deploy/kit/publish-chain.sh` — a guarded chain that
builds a clean worktree, packages a payload, publishes it, proves it byte for byte and records a
release. That is the right amount of ceremony for a thing customers are pointed at, and far too much
for the ordinary question of the day: *does what just landed on `main` work?*

The cost showed up as habit. A merge reached nothing, so the way to see a change was to build it
locally and look at `localhost:8080`, which is the one place a bug in the deploy itself can never
appear. Nothing at all stood between a laptop and production for the backend: `main` had no address
where the real runtime ran against a real Postgres, so the first time a schema change met a live
service was on the box that holds the houses' data.

Decision record 0007 closed the other half of this — `main` is protected and nothing lands without
green CI — which is what makes an automatic deploy safe to have. A branch that cannot receive a
direct push is a branch whose head is always a reviewed, gated commit.

## Decision
**Three environments, one address each, and the address says what it is.**

| address | built from | deployed | what is behind it |
|---|---|---|---|
| `demo.soyrocoto.com` | `main`, every merge | by CI, automatically | the prototype: fixtures in the page, the kit runtime (`mock-api/`) behind `/api` |
| `staging.soyrocoto.com` | `main`, every merge | by CI, automatically | the app in front of a staging copy of the real runtime (`backend/`) with its own Postgres |
| `app.soyrocoto.com` | a tag | by `deploy/release.sh`, with a human typing `y` | production |

**Demo and staging live on one box, `rocoto-staging`** (Hetzner cx33, Nuremberg, `178.105.84.66`),
and that box is code: `deploy/staging/` holds its Caddyfile, its two systemd units, its sudoers
line, the script that receives a deploy, and `bootstrap.sh`, which turns a fresh Ubuntu 24.04
machine into it and can be run again on the box it already built.

**CI deploys by piping a tar into a forced command.** The `deploy` job in
`.github/workflows/ci.yml` runs on a push to `main`, after `gates`, `vitals` and `deps`, in the
`staging` environment. It builds the prototype, tars four directories, and pipes them over SSH to a
key that can run exactly one program on the box — `/srv/rocoto/bin/receive.sh`, root-owned, which
unpacks, installs dependencies when the pinned list moved, imports the incoming code before
swapping it in, swaps atomically, applies the schema, restarts the two services, and polls their
health. Then CI reads both public addresses from outside the box.

**Production stays where it is.** Nothing in this record touches `app.soyrocoto.com`, the release
chain, or the production box. `deploy/release.sh` is still the only road there, and it still wants a
tag and a typed `y`.

**Staging holds no provider key.** `/srv/rocoto/.env` carries every name from `.env.example`, the
eight this box decides, and commented placeholders for the rest. `IS_PROD` stays unset until
`FB_APP_SECRET` and `WA_CLOUD_VERIFY_TOKEN` are filled from the vault, because
`config.assert_prod_ready()` refuses to boot without them.

## Consequences
A merge is now visible. Two links show what `main` does — one with the prototype's fixtures, one
with a real backend, a real Postgres and the row-level-security wall forced — and both are reachable
from a phone, which is the review Peter actually does.

The backend gets a rehearsal it never had. A schema change now meets a running service on a machine
that holds nothing, one merge before it meets the machine that holds everything.

`kit.soyrocoto.com` becomes legacy. It still serves the published kit from the production box; the
day its DNS record moves to `rocoto-staging`, the redirect block already written in
`deploy/staging/Caddyfile` is uncommented and every old kit link lands on the demo. The publish
chain in `deploy/kit/` keeps working and is marked legacy in its header.

The costs, stated: one more machine (€10.19 a month gross, in THE-VENDOR-REGISTER.md), one more key
to rotate (`STAGING_SSH_KEY`), and a `main` that is now deployable — which means a merge that breaks
the box is visible to anyone holding the link, and is meant to be.

What this deliberately does **not** buy: staging is not production's twin. It runs one service where
production runs a backend and a worker; it has no provider key, so every road that needs one answers
«awaiting key»; and its database is empty. It proves the code boots, the schema applies, the wall
stands and the app loads. Anything that needs a real rail still needs production.

## Source
Peter, 2026-09-07: «If staging is the best way to do this, then we should probably do it well» ·
[`deploy/staging/`](../omitted-sources.md) ·
[`.github/workflows/ci.yml`](../omitted-sources.md) ·
[0007 · `main` is protected](0007-main-is-protected.md) ·
[0006 · the kit runtime in production](0006-the-kit-runtime-in-production.md).

## Correction — 2026-09-08

Peter's [FEED-IA §214](../FEED-IA.md#214) corrects the migration's implementation:
prototype builds belong on demo; staging rehearses product code. The earlier four-directory
payload copied the fixture frontend into staging even though its product adapter did not exist.
That deployment choice is superseded. The original record above is retained as history.

CI now packages `demo/`, `backend/` and `mock-api/`. The receiver rejects the former `staging/`
frontend payload before changing dependencies or published services. Staging keeps its product
API routes and isolated database; unmatched frontend requests return 404. A wired frontend will
have its own build and integration evidence when implemented. Demo and staging can share a host
while retaining these distinct artifacts and services.

Current installation, recovery and monitor targets are in the [staging runbook](../omitted-sources.md).

## Correction — 2026-09-09

The earlier combined publication is superseded by [independent targets](../omitted-sources.md).
Changed prototype UI/API inputs select `development`; maintained backend/operator inputs select
`staging`. Each target owns its artifact roots, dependency generation, lock, state, service restarts
and rollback. Development runs no maintained-product schema migration. Real provider calls, durable
state and public callbacks remain part of the explicitly selected prototype environment.

The physical host and existing GitHub SSH credential profile retain the name `staging`; callers
select a logical target explicitly. Production remains separately authorized. The shared kit stays
the shared kit: its gallery publishes independently; Cedar's named development entry and the
preserved old kit URL transition are tracked in [the kit runbook](../omitted-sources.md).
Earlier descriptions in this decision record document the replaced system. Current installation
evidence is recorded in [engineering readiness](../ENGINEERING-READINESS.md).
