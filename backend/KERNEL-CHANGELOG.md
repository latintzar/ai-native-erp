# The Employee Kernel — changelog (SemVer: breaking.feature.fix)

**Scope, 2026-09-08:** this preserves the July extraction releases and their publishing procedure.
The maintained kernel source and [API](KERNEL-API.md) live in this repository's `backend/`.
Current review and release commands are in [AGENTS.md](../AGENTS.md) and the
[deployment runbook](../docs/omitted-sources.md). The historical private snapshot workflow below
is not an additional publication step for current Rocoto changes.

## 0.1.0 — 2026-07-22 (first versioned extraction)
The generic AI-employee nervous system, extracted from Rocoto and proven transplantable.
- ONE event-sourced runtime; 7 organs (spine · sensing · memory · mind+reflexes · gate · agency · self).
- The fold (one context contract, all channels); tabs (open matters, incl. `aprender` learning);
  the deterministic money gate; lifecycle→SOUL role blocks + channel overlays (one SOUL, many mouths).
- The process fabric (`voice_fabric.register` — background work on ONE envelope, gated mouth / fold merge).
- Triggers-as-data (`triggers.py`); tenancy (`tenancy.py`); channel presence/continuity (`presence_call.py`).
- Boundary: `tests/vital_kernel_boundary.py` — 0 new kernel→app imports (5 legacy edges ratcheted, count may only shrink).
- Transplant: `harness/transplant_drill.sh` — uninstall → reinstall from code → data back in → vitals green (PROVEN).
- Data compatibility: additive-migration law + N-1 rollback check in the deploy harness.

Versioning rules from here: kernel-touching changes bump this file + a `kernel-v<semver>` git tag;
BREAKING (organ contract / fold shape / envelope / schema-non-additive) bumps MAJOR and requires a
migration note here; the snapshot repo (github.com/latintzar/employee-kernel, private) is refreshed
per tag — the monorepo stays the source of truth.

## 0.2.0 — 2026-07-22 (channel continuity + onboarding lifecycle + cleanup)
- Channel continuity organ (`presence_call`): call.started/ended events + AHORA-MISMO block in every fold.
- Lifecycle stage `onboarded_unpaid` (deterministic, from the onboarding wizard's paid_at) + its SOUL block.
- De-workflow pass: one SOUL + channel overlays, triggers-as-data (`triggers.py`), one fabric envelope.
- Kernel boundary vital + tenancy organ; transplant drill proven green.
- Docs: `ARCHITECTURE.md` (every module→organ), product `README.md` (folder map).
