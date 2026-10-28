-- REVERT of backfill_20260806_customer_profiles_tenant.sql.
-- Reversible ONLY while no phone number is shared by two tenants — after that, restoring a global
-- PK would require deleting one supplier's real customer profile. Refuse instead of destroying.
do $$
declare dupes int;
begin
  select count(*) into dupes from (
    select phone_number from customer_profiles group by phone_number having count(*) > 1) d;
  if dupes > 0 then
    raise exception
      'REFUSING to revert: % phone number(s) now have a profile under more than one tenant. '
      'Restoring PRIMARY KEY (phone_number) would mean deleting a real customer profile.', dupes;
  end if;
end $$;

alter table customer_profiles drop constraint if exists customer_profiles_pkey;
alter table customer_profiles add constraint customer_profiles_pkey primary key (phone_number);
drop index if exists ix_customer_profiles_phone;
