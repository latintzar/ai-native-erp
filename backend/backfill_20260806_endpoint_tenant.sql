-- WP-A1 phase C · step 1 EXPAND — endpoint learns about tenants, WITHOUT breaking the old code.
--
-- THE BUG (A1-TENANT-SCOPE-CUTOVER §7.1): `endpoint` had no tenant column and carried
-- UNIQUE (kind, addr), so the identity graph permitted ONE party per phone number across every
-- tenant on the box. A second distributor asking for its customer by phone received the FIRST
-- distributor's party, with nothing raised.
--
-- WHY THIS IS SPLIT IN TWO. The deploy harness applies migrations at step 5 and only restarts at
-- step 7 — the full regression runs in between, so the LIVE SERVICE KEEPS RUNNING THE OLD CODE FOR
-- ~10 MINUTES AFTER THE SCHEMA MOVES. Old code says `on conflict (kind, addr)`; new code says
-- `on conflict (tenant_slug, kind, addr)`. If this file dropped the old constraint, every inbound
-- WhatsApp message that bootstrapped a new party would throw for the whole of that window.
--
-- So EXPAND is purely additive and BOTH constraints exist at once — old code and new code are each
-- satisfied. `..._contract.sql` drops the old key, and is run only once the new code is live.

begin;

alter table endpoint add column if not exists tenant_slug text;

-- Every existing row belongs to the deployment tenant: only one runtime has ever served this box.
-- `contact.tenant_slug` is the authority (it is what the party was created under).
update endpoint e
   set tenant_slug = coalesce(c.tenant_slug, 'rocoto')
  from contact c
 where c.id = e.contact_id and e.tenant_slug is null;

update endpoint set tenant_slug = 'rocoto' where tenant_slug is null;   -- orphan belt-and-braces

commit;

-- NULLS NOT DISTINCT (PG15+): an unowned party is a real supported state (the try-chat rail), but
-- plain NULLs are DISTINCT in a unique index, which would silently re-permit duplicate unowned
-- parties — the exact failure being closed. CONCURRENTLY: no write lock on the identity graph.
create unique index concurrently if not exists endpoint_tenant_kind_addr_key
  on endpoint (tenant_slug, kind, addr) nulls not distinct;

-- NOTE: `endpoint_kind_addr_key` (kind, addr) SURVIVES this file on purpose. See the header.
