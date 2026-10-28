-- WP-A1 phase C · step 3 EXPAND — customer_profiles gains a per-tenant key, old code still works.
--
-- THE BUG (A1 §7.2, found by the adversarial fence audit): PRIMARY KEY (phone_number) meant ONE
-- profile row per phone across every tenant. `GET /api/sup/orders` returns this row's lat/lon as
-- customer_lat/customer_lon, and the writers keyed on phone alone — so a second supplier's
-- coordinates landed on the row labelled with the first supplier's tenant, and the join predicate
-- then handed one supplier a rival's delivery point for a shared customer.
--
-- SPLIT for the same reason as the endpoint migration: the deploy window runs OLD code against the
-- NEW schema for ~10 minutes. Old code says `on conflict (phone_number)`, new code says
-- `on conflict (tenant_id, phone_number)`. Both keys exist after this file, so both are satisfied.

begin;

-- tenant_id is already `not null default 'rocoto'`, so there is nothing to backfill.
create unique index if not exists customer_profiles_tenant_phone_key
  on customer_profiles (tenant_id, phone_number);

-- the genuinely cross-tenant probes (Control Room, ops counts) keep a phone-leading index
create index if not exists ix_customer_profiles_phone on customer_profiles (phone_number);

commit;

-- NOTE: PRIMARY KEY (phone_number) SURVIVES this file on purpose. See the header.
