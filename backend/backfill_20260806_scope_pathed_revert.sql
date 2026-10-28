-- backfill_20260806_scope_pathed_revert.sql — the exact inverse of phase M.
--
-- Pairs with backfill_20260806_scope_pathed.sql. Strips the `t.<slug>.` prefix back off any scope
-- whose remainder is a WhatsApp party, returning the spine to the flat shape.
--
-- WHAT IT DELIBERATELY DOES NOT TOUCH: `t.<slug>.c.<id>` scopes. Those are the tenant-world
-- customer scopes that have ALWAYS been pathed (tenancy.py's documented shape, e.g. the live
-- t.test_1334.c.1) — they were never flat, so un-pathing them would not be a rollback, it would be
-- a new and worse migration. Only `t.<slug>.wa.<digits>` comes back.
--
-- ROLLBACK ORDER (design doc §5): set SCOPE_PATHED=0 FIRST so the writer stops emitting pathed
-- scopes, then run this. The other order leaves the writer minting rows this script has already
-- walked past.
--
--   psql "$DSN" -v ON_ERROR_STOP=1 -f backfill_20260806_scope_pathed_revert.sql

\set ON_ERROR_STOP on

begin;

create temp table _scope_unmap on commit drop as
select scope::text as old_scope,
       -- t.<slug>.wa.<digits>  →  wa.<digits>   (subpath from label 2 to the end)
       subpath(scope, 2)::text as new_scope
  from scope_node
 where scope::text like 't.%'
   and nlevel(scope) >= 4
   and subltree(scope, 2, 3)::text = 'wa';

create unique index on _scope_unmap (old_scope);

do $$
declare
  n_map  int;
  n_conf int;
begin
  select count(*) into n_map from _scope_unmap;
  raise notice 'revert map: % scope(s) to un-path', n_map;

  select count(*) into n_conf
    from _scope_unmap m
   where exists (select 1 from scope_node   x where x.scope::text = m.new_scope)
      or exists (select 1 from card         x where x.scope::text = m.new_scope)
      or exists (select 1 from pending_turn x where x.scope::text = m.new_scope)
      or exists (select 1 from scope_state  x where x.scope::text = m.new_scope)
      or exists (select 1 from sweep_state  x where x.scope::text = m.new_scope);
  if n_conf > 0 then
    raise exception 'ABORT: % flat target(s) already exist — the forward migration was partial or a party was re-created flat', n_conf;
  end if;
end $$;

do $$
declare
  r        record;
  n_before bigint;
  n_after  bigint;
  n_moved  bigint;
  total    bigint := 0;
begin
  for r in
    select c.table_name as t
      from information_schema.columns c
     where c.table_schema = 'public' and c.udt_name = 'ltree' and c.column_name = 'scope'
     order by c.table_name
  loop
    execute format('select count(*) from %I', r.t) into n_before;
    execute format(
      'update %I x set scope = m.new_scope::ltree from _scope_unmap m where x.scope::text = m.old_scope',
      r.t);
    get diagnostics n_moved = row_count;
    execute format('select count(*) from %I', r.t) into n_after;
    if n_after <> n_before then
      raise exception 'ABORT: % changed row count % -> %', r.t, n_before, n_after;
    end if;
    total := total + n_moved;
    if n_moved > 0 then
      raise notice '  % — % row(s) un-rooted', r.t, n_moved;
    end if;
  end loop;
  raise notice 'revert: % row(s) returned to the flat shape', total;
end $$;

commit;
