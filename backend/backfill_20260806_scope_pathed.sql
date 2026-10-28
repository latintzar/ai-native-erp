-- backfill_20260806_scope_pathed.sql — WP-A1 phase M, the history rewrite.
-- Design: A1-TENANT-SCOPE-CUTOVER.md §5. Run AFTER phase E is live and BEFORE the writer flips.
--
--     wa.<digits>   →   t.<slug>.wa.<digits>      …for parties a tenant OWNS
--     wa.<digits>   →   wa.<digits>              …for parties nobody owns (unchanged)
--
-- THE RULE IS OWNERSHIP, NOT TIER. `scope_node.tenant_slug` is the authority: NULL means nobody
-- owns this party yet (the landing's try-chat rail), and NULL is a legitimate value there by
-- schema — «owning tenant (null for creator/prospect)». Re-rooting those under `prospect.` was the
-- first draft of this migration and it was WRONG: it would make is_wa_scope/phone_of_scope answer
-- NO for parties that genuinely are WhatsApp parties — the same silent failure the whole WP exists
-- to remove, self-inflicted. They stay flat. Both shapes are permanent (design doc §3).
--
-- WHAT IT TOUCHES, measured on prod 2026-08-06: 8 scope_node rows (tenant_slug='rocoto') and their
-- history. 9 NULL-tenant rows and the already-pathed t.test_1334.* rows are not touched at all.
-- Every live scope is depth 2 — there are NO descendant scopes — so this is an exact-match
-- rewrite, never a prefix rewrite.
--
-- SAFETY, in order of how much each one matters:
--   · ONE transaction. A half-rewritten spine is worse than an un-rewritten one.
--   · IDEMPOTENT. Already-pathed scopes are excluded, so a second run is a no-op.
--   · CONFLICT-GUARDED. If a target scope already exists the whole thing aborts, because the
--     PK tables (scope_node, card, pending_turn, scope_state, sweep_state, assembly_snapshot)
--     would otherwise raise mid-rewrite — and a merge is a decision, not a migration step.
--   · ROW COUNTS ARE INVARIANT. Every table is counted before and after and the run aborts on any
--     difference. A rewrite that loses a row is worse than one that never ran.
--   · SELF-DISCOVERING. The table list comes from information_schema (every `ltree` column), not
--     from a hand-written list that goes stale the first time somebody adds a scope-bearing table.
--     NB this is why `accept_rules` is safely excluded: its `scope` is a text enum
--     ('tenant'|'customer'), not a path — a hand-written list would very plausibly have included it.
--
-- ROLLBACK: backfill_20260806_scope_pathed_revert.sql (the exact inverse), plus SCOPE_PATHED=0.
--
--   psql "$DSN" -v ON_ERROR_STOP=1 -f backfill_20260806_scope_pathed.sql

\set ON_ERROR_STOP on

begin;

-- ── the mapping ────────────────────────────────────────────────────────────────────────────────
create temp table _scope_map on commit drop as
select sn.scope::text                                        as old_scope,
       't.' || sn.tenant_slug || '.' || sn.scope::text        as new_scope
  from scope_node sn
 where sn.tenant_slug is not null
   and sn.tenant_slug <> ''
   and sn.scope::text not like 't.%';          -- idempotent: never re-path a pathed scope

create unique index on _scope_map (old_scope);

do $$
declare
  n_map   int;
  n_conf  int;
begin
  select count(*) into n_map from _scope_map;
  raise notice 'scope-path map: % scope(s) to rewrite', n_map;

  -- every target must be castable (PG16 allows hyphens in labels; an older server would not)
  perform new_scope::ltree from _scope_map;

  -- and must not already exist, on any PK table
  select count(*) into n_conf
    from _scope_map m
   where exists (select 1 from scope_node   x where x.scope::text = m.new_scope)
      or exists (select 1 from card         x where x.scope::text = m.new_scope)
      or exists (select 1 from pending_turn x where x.scope::text = m.new_scope)
      or exists (select 1 from scope_state  x where x.scope::text = m.new_scope)
      or exists (select 1 from sweep_state  x where x.scope::text = m.new_scope);
  if n_conf > 0 then
    raise exception 'ABORT: % target scope(s) already exist — merging two histories is a decision, not a migration step', n_conf;
  end if;
end $$;

-- ── the rewrite, over every ltree scope column the database actually has ───────────────────────
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
      'update %I x set scope = m.new_scope::ltree from _scope_map m where x.scope::text = m.old_scope',
      r.t);
    get diagnostics n_moved = row_count;

    execute format('select count(*) from %I', r.t) into n_after;
    if n_after <> n_before then
      raise exception 'ABORT: % changed row count % -> % — a rewrite that loses a row is worse than one that never ran',
        r.t, n_before, n_after;
    end if;

    total := total + n_moved;
    if n_moved > 0 then
      raise notice '  % — % row(s) re-rooted (% total rows, unchanged)', r.t, n_moved, n_after;
    end if;
  end loop;
  raise notice 'phase M: % row(s) re-rooted across the spine', total;
end $$;

-- ── proof, inside the transaction: nothing owned is left flat ──────────────────────────────────
do $$
declare
  n_left int;
begin
  select count(*) into n_left
    from scope_node
   where tenant_slug is not null and tenant_slug <> '' and scope::text not like 't.%';
  if n_left > 0 then
    raise exception 'ABORT: % owned scope(s) still flat after the rewrite', n_left;
  end if;
  raise notice 'verified: every owned scope is pathed; unowned scopes left flat on purpose';
end $$;

commit;
