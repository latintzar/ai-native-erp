# THE AUTH WIRING SPEC — login, user management, every settings surface, bit by bit
**§124's ordered plan. Written 2026-08-29 by the orchestrator off the REAL rails: the
runtime's working auth (`app.py` bearer gates · `sup_session.py` membership · `cr_session.py`
sessions · `claim.py` W1's rail · `provisioning.py`) and the kit's admin surfaces. Stance:
§95 — the runtime auth is KEPT and rewired, never reinvented. Executes at the ONE full
wiring (§118), not before.**

## 0 · What already works (evidence, not hope)
- **Identity** = a Supabase bearer. `require_app_user` verifies it per request and returns
  `{email, tenant_slug, tenant_name, role}` — already serving the Android app.
- **Membership** resolves SERVER-SIDE: `operators.email → team_members → tenants`;
  `is_founder` → founder; `active_tenant` picks among several teams; an unrecognised role
  is DENIED EVERYTHING (the privilege-escalation lesson, already learned and coded).
- **Capabilities**: `ROLE_CAPS` / `can(role, cap)`; per-route deps `require_app_cap`.
- **The tenant fence**: `ctx.tenant_slug` is the only tenant a handler may use; the legacy
  single-tenant runtime tables refuse other scopes LOUD (403), never quietly.
- **Sessions** (control room): mint/verify/rotate, CSRF, revoke-all, rate limits, audit.
- **The claim rail** (W1, landed): mint → peek → consume, hashed tokens, fail-closed base URL.
- **Provisioning**: creates `operators` + `team_members(owner)` rows today.

## Environment identity boundary

The backend selects Supabase with explicit `SUPABASE_URL` and `SUPABASE_ANON_KEY` for each
runtime environment. Missing configuration leaves token authentication disabled before any
provider request. Admin magic-link creation also requires that environment's project URL and
`SUPABASE_SERVICE_ROLE_KEY`. Development/staging auth commissioning uses its own project and
test identities, with memberships and sessions in that environment's database. The prototype's
fixture users remain prototype data. This foundation keeps the existing authentication model;
connecting the shared frontend remains the wiring work below.

## The bits

### BIT 1 · The front door becomes the login
The §105 front door is the design; wired, it is the product's login at app.soyrocoto.com:
Supabase OAuth (Google) + email magic link, password-less throughout, recovery = Supabase's
own. **There is no open signup** — accounts are BORN from the claim rail (§91: the pilot's
claim link) or from a team invitation. The commercial model (booked-call pilot) is the
door's shape: you are let in, you don't register.

### BIT 2 · The session model
Browser session = the Supabase JWT, refreshed by supabase-js; the server verifies the
bearer on EVERY request and resolves the role server-side every time — the client's word
for its role or tenant is never accepted. Cookie-carried surfaces keep the CSRF pattern;
sign-out revokes; every auth act writes an audit row. The kit never holds a service key —
anon key + RLS only.

### BIT 3 · Tenancy binding and the house switcher
`ctx.tenant_slug` stays the one tenant a handler may use. Multi-team operators get the
kit's house dropdown MADE REAL: §105's bottom-right chooser lists YOUR tenants (from
membership), switching writes `active_tenant`. The runtime fence stands until the legacy
tables carry `tenant_id` (the spine dual-write is already tracking that migration).

### BIT 4 · User management = the team surface, wired
`areas/admin/team.tsx` (already live-editable per §122) gets one contract per act:
- READ: the team = `operators ⋈ team_members` for the tenant.
- INVITE: an `invitation` row + a claim-style magic link, sent on the email rail; the
  invited address is their profile's fact (§3). Consuming it creates the operator +
  membership — the claim rail's own beat, reused.
- ROLE CHANGE: only names `ROLE_CAPS` knows; the kit's role vocabulary is ALIGNED to the
  runtime's (one vocabulary, `sup_session.py` is canon); unknown stays denied-everything.
- REMOVE: membership row deleted + that operator's sessions revoked in the same act.
- FOUNDER: immutable per the admin-exemption ruling; `is_founder` never editable from a
  surface.

### BIT 5 · Grants ↔ capabilities, one truth
`grants.ts` (what the house lets Rocoto do alone) is TENANT policy, not browser state:
wired as a `grants.changed` event on the spine, folded into `agent_settings` — the SAME
row the runtime brain reads before acting. The settings screen writes the event; brain and
UI read one fold; a grant flipped in Settings is the brain's law on the next message.

### BIT 6 · Every settings area, one contract each
| Kit surface | Writes today | Wired contract |
|---|---|---|
| `account.tsx` | module store | profile facts → `operators` (name, phone); tenant name → `tenants` |
| `business.tsx` | module store | sector, registry, hours → tenant metadata events on the spine |
| `team.tsx` | `setMember` | BIT 4 whole |
| `plan.tsx` | theatre | READ from Stripe state (`pedidos_subscription`); the card door → Stripe portal; the rate stays contractual (§122 ruling) |
| `connections.tsx` | theatre | WhatsApp = read `channel_connection`/`channel_number` status; email rail status; ERP target → config events |
| `geography.tsx` | `setRoundOverride` | zones/trucks/runs → `delivery_routes`/`customer_routing` via events |
| `agent.tsx` | module store | voice/tone/confirm persona → `agent_settings` (beside BIT 5's grants) |
| `data.tsx` | theatre | exports → the export endpoints; seed/reset = founder-only and TEST-lineage only (§27.14 taint) |
| `app-settings.tsx` | `useConfig().set` | per-person preferences → `doc_prefs`; per-house rules → spine events |
Each row is the same move: the surface keeps its writer's NAME, the writer gains transport.
The read-back is the fold the kit already renders — so the screens do not change at wiring;
their store's transport does.

### BIT 7 · The transport seam (answers «separate or referencing the kit?»)
The kit's module stores gain ONE adapter seam: in-memory (the theatre, today) or HTTP (the
product, at wiring) — the ports THE-WIRING-INDEX already names (OrgPort, AgentPort…).
**Recommendation: the wired app IS the kit's codebase** — same surfaces, adapter flipped,
login gate in front. No fork, no second frontend to drift. The design probe and the product
stay one artifact, which is what makes the probe honest.

### BIT 8 · The arrival flows
Claim link (W1) → first login → the §91 journey stages, gated by the journey ledger
(`journey.py`, landed): org → WhatsApp → data → processing. The login door is stage-aware:
an account mid-journey resumes where it stood; a finished account lands on Sales.

### BIT 9 · The security posture (kept, stated)
Fail-closed roles · loud tenant fence · rate limits · audit rows · GDPR controls (WP-9) ·
CSRF on cookie routes · ltree-scoped spine reads (`scoped_tx`) · secrets in env only ·
test lineage tainted at the row (§27.14).

### BIT 10 · The order of work on wiring day
1. Login door + session + membership onto the kit (mostly REUSE — it serves the app today).
2. The transport seam, then `account` + `team` (BIT 4) through it.
3. Grants → `agent_settings` (BIT 5) — the brain obeys the settings screen.
4. The remaining areas' contracts (BIT 6), one commit each.
5. House switcher + claim handoff + journey resume (BITs 3/8).
6. The security/GDPR verification pass + audits red-proved.
The auth core is reuse; the genuinely new work is the seam (BIT 7) and the per-area
contracts (BIT 6) — which is why the wiring can be smaller than the UX build was.
