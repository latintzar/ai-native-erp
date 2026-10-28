-- WP-A1 phase C · step 3 CONTRACT — make (tenant_id, phone_number) the primary key.
--
-- RUN ONLY AFTER the new code is live. Until then the old code issues
-- `on conflict (phone_number)` and needs the old PK.

do $$
begin
  if not exists (select 1 from pg_indexes
                  where tablename='customer_profiles'
                    and indexname='customer_profiles_tenant_phone_key') then
    raise exception 'REFUSING: the (tenant_id, phone_number) key does not exist yet — run the expand file first';
  end if;
  if exists (select 1 from (select phone_number from customer_profiles
                             group by phone_number having count(*) > 1) d) then
    raise exception 'REFUSING: a phone already has profiles under two tenants; promoting the PK now would need a delete';
  end if;
end $$;

alter table customer_profiles drop constraint if exists customer_profiles_pkey;
alter table customer_profiles add constraint customer_profiles_pkey
  primary key (tenant_id, phone_number);

--   before: PRIMARY KEY (phone_number)            → one profile per phone, box-wide
--   after:  PRIMARY KEY (tenant_id, phone_number) → one profile per phone PER TENANT
