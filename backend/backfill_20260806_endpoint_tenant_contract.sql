-- WP-A1 phase C · step 1 CONTRACT — retire the box-wide key.
--
-- RUN ONLY AFTER the new code is live (rocoto_deploy step 7 has restarted the service). Until then
-- the old code is still issuing `on conflict (kind, addr)` and needs this constraint to exist.
-- Running it early does not corrupt anything — it makes new-party bootstrap throw until restart.
--
-- Verify first:  select count(*) from endpoint where tenant_slug is null;   -- expect 0
--                select indexname from pg_indexes where tablename='endpoint';  -- new key present

do $$
begin
  if not exists (select 1 from pg_indexes
                  where tablename='endpoint' and indexname='endpoint_tenant_kind_addr_key') then
    raise exception 'REFUSING: the (tenant_slug, kind, addr) key does not exist yet — run the expand file first';
  end if;
end $$;

alter table endpoint drop constraint if exists endpoint_kind_addr_key;

--   before: UNIQUE (kind, addr)              → one party per phone number, box-wide
--   after:  UNIQUE (tenant_slug, kind, addr) → one party per phone number PER TENANT
