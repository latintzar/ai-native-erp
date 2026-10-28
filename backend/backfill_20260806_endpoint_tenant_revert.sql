-- REVERT of backfill_20260806_endpoint_tenant.sql (WP-A1 phase C step 1+2).
--
-- Restores the box-wide `UNIQUE (kind, addr)` and drops the tenant column. It is REVERSIBLE ONLY
-- WHILE ONE TENANT OWNS EACH ADDRESS — which is true right up until a second distributor's
-- customer shares a phone number with the first's. The guard below refuses rather than destroying
-- one of the two parties, because dropping to a global unique key with duplicates present would
-- fail anyway, and failing with an explanation beats failing with a constraint violation.

do $$
declare dupes int;
begin
  select count(*) into dupes
    from (select kind, addr from endpoint group by kind, addr having count(*) > 1) d;
  if dupes > 0 then
    raise exception
      'REFUSING to revert: % (kind, addr) pair(s) are owned by more than one tenant. Reverting '
      'would require deleting a real party. Resolve the sharing first, or stay on the new key.',
      dupes;
  end if;
end $$;

drop index if exists endpoint_tenant_kind_addr_key;
alter table endpoint add constraint endpoint_kind_addr_key unique (kind, addr);
alter table endpoint drop column if exists tenant_slug;
