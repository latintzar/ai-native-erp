# THE SCHEMA SPEC — the database, as it is and as it must be

Peter, §205 and §208: «what database structures is it? How do we preprocess all the data that we get?» and «how will the shit be stored so it can't be tampered with». This is the one document about the database: what exists today (read from the code, not the prose), what THE-AI-SPEC, THE-CONNECTIONS-SPEC and THE-IMPLEMENTATION-SPEC need, and the migration path between the two. Postgres 16 on the Nuremberg box. Design, not build (§203.0).

**Scope and authority (2026-09-09).** SCH-00 preserves an earlier source inspection; the
[backend source and guide](../backend/README.md) establish current implementation. The additions
and migration sequence below are proposals whose applicable scope is selected through the
[engineering workflow](ENGINEERING.md#plan-and-schedule-work). This mixed document remains with
the maintained database contracts. [Source privacy](THE-SOURCE-PRIVACY-SPEC.md) governs which
data classes may be retained and takes precedence over the earlier storage proposals below.

## SCH-00 · Two layers exist today, and the spec names both honestly
| Layer | Created by | What it is |
|---|---|---|
| **The app layer** | `backend/db.py` (67 tables) | the WhatsApp-era product: `orders` (lines as JSON, keyed by `phone_number`), `order_events` (per-order bitemporal log), `whatsapp_messages`, `catalogue_skus`, `sku_aliases`, `customer_habits`, `customer_sku_prices`, `customer_window_dow`, `customer_profiles`, `learned_patterns`, `accept_rules`, `channel_connection`, `channel_number`, `inbound_mail`, `ingest_queue`, `wa_history_chunk`, `calls`, `transcript_facts`, `stock_levels`, `stock_captures`, `delivery_*`, `tenants`, `operators`, `team_members`, `agent_settings`, `aviso_routing`, `avisos`, `doc_prefs`, `dispatch_schedule`, `system_flags` … |
| **The spine** | `backend/schema_runtime.sql` (1,495 lines) + `schema_rls.sql` | [PRODUCT-SPEC §3](omitted-sources.md) as built: `scope_node` (ltree, tier, tenant_slug) · `contact` · `endpoint(kind, addr)` · `contact_role` · `event(scope, ts, type, caused_by, lineage, dedupe_key, payload)` · `fact` (bitemporal, disputed) · `card` · `summary` (embedding + fts) · `open_loop` (the tab: kind, status, resume_ref, contingencies, money) · `action` (state, confidence, needs_human) · `timer` · `pending_turn` · `sweep_state` · `standing_instruction` · `assembly_snapshot` (why_hash) · `dead_letter` · `manifest_*` (sense, reflex, duty, presence, stakeholder, tool) · `sup_audit` · `sup_session` · `spine_dualwrite_state` · billing (`credit_ledger`, `billing_run`, `pedidos_*`) |

**Facts that decide the migration:** the spine is scope-keyed (`ltree`, 36 uses); the app layer is tenant-keyed by `tenant_id text` and party-keyed by `phone_number`. `spine_dualwrite_state` exists: orders are written to both layers today. Row-level security is enabled on a handful of tables (`event`, `endpoint`, `dead_letter`, `alert`, `pedidos_subscription`) and nowhere else. There is no hash chain and no column encryption. Embeddings live on `summary`; `sku_aliases` has no embedding. `learned_patterns` is keyed by `phone_number` with `pattern_type/key/value`.

**The rule:** the spine is the truth for everything that happens (events, tabs, actions); the app layer holds the house's rows (catalogue, customers, orders as documents, habits, aliases, prices, connections, outputs). New tables join the layer they belong to. Nothing is duplicated a third time.

## SCH-01 · The tables THE-AI-SPEC adds (the model that feeds the runtime)
All `tenant_id text not null` with the RLS policy of SCH-05; all with `created_at`/`updated_at`; ids `bigserial` unless the row is addressed by a natural key.

```sql
-- what the house gave us, before it is proposals (§1 step 1–2)
ingest_file        (id, tenant_id, kind text            -- catalogue | wa_export | deliveries | customers | invoices
                    , sha256 text unique, filename, bytes int, status text  -- landed | parsed | proposed | accepted | refused
                    , rows int, error, landed_by, landed_at, parsed_at)
messages_history   (id, tenant_id, customer_id text, ingest_file_id, ts timestamptz, sender text -- customer | house
                    , body_enc bytea, key_version int, media text, unique(tenant_id, ingest_file_id, ts, sender, sha256(body)))
deliveries_history (id, tenant_id, customer_id, ingest_file_id, delivery_date date, doc_ref text
                    , line_no int, product_text text, sku_id text null, qty numeric, unit text, price numeric null
                    , provenance jsonb)                -- {file, row, page, span}
golden_pairs       (id, tenant_id, customer_id, message_id bigint null -- messages_history.id or the live event id
                    , delivered jsonb not null           -- [{sku_id, qty, unit, product_text}]
                    , spans jsonb, confirmed_by text     -- alignment | accept | correction | house
                    , confirmed_at timestamptz, source text -- history | live
                    , unique(tenant_id, message_id))
-- the derived rows the runtime reads at message time (§1 step 5); the four below EXIST and gain columns
sku_aliases        + customer_id text, confidence numeric, last_seen_at        -- keyed by customer, not only phone
customer_habits    + group_id text, window jsonb, typical_total numeric, last_ordered date
learned_patterns   + hits int, misses int, status text (candidate | shipped | pruned), golden_delta numeric
customer_sku_prices  (exists; + since date)
product_seasons    (tenant_id, sku_id, iso_week int, volume numeric, orders int, refreshed_at)   -- SQL nightly
product_substitutions (tenant_id, from_sku, to_sku, first_seen date, customers int, evidence jsonb)
```

## SCH-02 · The tables the runtime's decisions need (THE-AI-SPEC §2)
```sql
order_flags        (id, tenant_id, order_id, line_no int null, kind text    -- item | items | part | reply | both | shortfall | new_product
                    , reason text, evidence jsonb, primary boolean, opened_event bigint, resolved_at, resolved_by)
draft_replies      (id, tenant_id, order_id null, customer_id, channel text  -- whatsapp | email
                    , body_enc bytea, key_version int, flag_id bigint null, status text -- drafted | edited | sent | dropped
                    , sent_event bigint null, created_at)
-- orders (exists) gains: customer_id, predicted jsonb (lines in delivered form), primary_flag_id, delivery_date date (typed), template_id
```
`open_loop` stays the tab; a flag that needs the customer's answer opens a loop with `kind=question` and `resume_ref` → the flag.

## SCH-03 · Products, the central index, artwork (THE-IMPLEMENTATION-SPEC §3)
```sql
catalogue_skus     (exists: id, tenant_id, code, name, family, base_unit, price) + kind, sort, form, pack jsonb, tags text[], subject_id, art_status
catalogue_subjects (id text primary key            -- the library's slug, cross-tenant, NO tenant data
                    , family, kind, sort, form, clause text, prompt text, prompt_method, tile_path, ideogram jsonb, created_at)
subject_aliases    (subject_id, alias text, lang, source, primary key(subject_id, alias))
subject_requests   (id, tenant_id, sku_id, subject_id null, status -- matched | clause | painting | landed | awaiting_key
                    , clause text, prompt text, ideogram_request text, created_at, landed_at)
```
The index is shared and holds subjects, their clauses and tiles only. A house's own words for a product stay in that house's `sku_aliases`; `subject_aliases` carries only the library's words (Spanish and English names, spellings), so nothing a house typed ever crosses tenants.

## SCH-04 · Outputs, connections, history of prints (THE-OUTPUTS-SPEC, THE-CONNECTIONS-SPEC, THE-PAPER-SPEC)
```sql
output_templates   (id text, tenant_id, category, seed, name, paper, copies, layout jsonb, head jsonb, foot jsonb, marks jsonb
                    , language, day_button int null, selection jsonb, revision int, archived_at, created_*, updated_*)   -- E200.01's store, moved server-side
paper_manifests    (token text primary key, tenant_id, revision int, paper, page_mm jsonb, marks jsonb, pages jsonb, printed_at, template_id)
paper_reads        (id, tenant_id, token, page int, quality jsonb, readings jsonb, reader text, ms int, read_at)      -- no photo kept
channel_connection (exists) + external_id, endpoint_addr, mode (prueba | directo), credentials_enc bytea, key_version, last_seen_at, paused_at, webhook_failures int
print_activity     (exists as the kit's model; server-side: id, tenant_id, template_id, run jsonb, requested_at, confirmed_at, by)
```

## SCH-05 · Security: tenant walls, encryption, tamper evidence (THE-IMPLEMENTATION-SPEC §9)

**Source-retention authority.** The earlier `inbound_mail.body_text` → `body_enc` proposal below
is superseded by [SRC-PRIV-00](THE-SOURCE-PRIVACY-SPEC.md#src-priv-00--the-invariant): raw email
bodies, attachments and reply drafts stay within its transient/provider-backed boundary.
Encryption applies only to data classes that the source privacy contract permits Rocoto to retain.

- **Row-level security on every tenant table.** One policy per table: `USING (tenant_id = current_setting('app.tenant', true))`, the session variable set by the runtime from the session, never from the body. The spine's `scope_node.tenant_slug` gives the same wall for scoped rows: `USING (subpath(scope, 0, 1)::text = current_setting('app.tenant', true))`. A cross-tenant test runs with code changes in CI: as tenant A, every table returns zero rows of tenant B.
- **Column encryption** for bodies: `messages_history.body_enc`, `whatsapp_messages.message_text` → `message_text_enc`, `inbound_mail.body_text` → `body_enc`, `transcript_facts`, `draft_replies.body_enc`, `channel_connection.credentials_enc`. libsodium secretbox in a proposed Rocoto-owned backend cryptography module, a data key per tenant wrapped by the master key in the runtime's environment; `key_version` on every encrypted column so rotation is a background rewrite. Its implementation and migration proof belong to the schema workstream. Search over bodies uses the summaries' `fts`/`embedding` (already derived), never the ciphertext.
- **The hash chain.** `event` gains `prev_hash bytea` and `hash bytea = sha256(prev_hash || scope || ts || type || payload)`, computed in the insert function; `UPDATE`/`DELETE` revoked on `event` for the runtime role (append-only by grant, not by promise); a nightly job writes each tenant's day root (a Merkle root over the day's hashes) to `audit_roots(tenant_id, day, root, written_at)` and to object storage with object lock; the tenant's data page shows its roots. A check job recomputes a random day and alarms on mismatch.
- **Backups.** Nightly `pg_dump` encrypted to object storage; a monthly restore drill into a scratch database with a row-count comparison; the drill's result on the ops page.

## SCH-06 · Indexes that make the light layer fast (THE-AI-SPEC §3)
`pg_trgm` GIN on `catalogue_skus(name)`, `sku_aliases(alias)`, `customer_profiles(display_name)`, `units(name)`; `tsvector` on the same; partial indexes by tenant; `golden_pairs(tenant_id, customer_id, confirmed_at)`; `deliveries_history(tenant_id, customer_id, delivery_date)`; `event(scope, ts)` (exists). Target: every picker query under 20 ms at 10,000 rows per tenant.

## SCH-07 · Retention, in one table

These earlier proposed durations apply only to eligible data classes under
[SRC-PRIV-01](THE-SOURCE-PRIVACY-SPEC.md#src-priv-01--data-classes-and-retention). In particular,
the message-body and ingest-file rows do not authorize durable email or attachment copies.
Their scope follows that contract, including derived facts and separately authorized direct uploads.

| Rows | Kept | Then |
|---|---|---|
| `event` | forever (the log) | hash-chained; bodies referenced by id |
| message bodies (`*_enc`) | per tenant setting, default 24 months | key destroyed = body unreadable |
| media, recordings | per THE-RUNTIME-SPEC / VOICE-21 (default 30 days) | the retention sweeper (E195.40) |
| `paper_reads` | 12 months | dropped |
| `ingest_file` bytes | until parsed + 30 days | dropped; the row stays |
| `golden_pairs`, habits, aliases | as long as the tenant | deleted with the tenant |

## SCH-08 · The migration path, in order
1. `schema_rls.sql` extended to every tenant table (policy per table); the runtime sets `app.tenant` on every connection; the cross-tenant test goes green before anything else lands.
2. `event` hash chain (columns + insert function + grants) and `audit_roots`; the recompute job.
3. Column encryption for existing bodies: add `*_enc` + `key_version`, backfill in batches, switch reads, drop plaintext.
4. SCH-01 tables + the four column additions; `sku_aliases.customer_id` backfilled from `phone_number` through `endpoint`.
5. SCH-02 (`order_flags`, `draft_replies`, the `orders` columns); `spine_dualwrite_state` retired when orders read from one place.
6. SCH-03 (the index; `catalogue_skus` columns backfilled from the resolver's current answers).
7. SCH-04 (templates server-side, manifests, reads, connection columns).
8. SCH-06 indexes, SCH-07 jobs.
Each selected step uses an immutable Alembic revision under `backend/migrations/versions/`, with a safe downgrade or an explicit preservation refusal, deployment preflight and a test that reads migrated rows. [The implemented migration lifecycle](../backend/migrations/README.md) governs these mechanics; this proposed domain sequence still requires its own selection and implementation.

## SCH-09 · What this corrects in earlier prose
THE-AI-SPEC §1's table list named `open_loop`, `fact`, `card`, `summary` beside `db.py`'s tables; they live in `schema_runtime.sql` (the spine), and orders are dual-written today. THE-IMPLEMENTATION-SPEC §9's «append-only by construction» becomes append-only by grant (SCH-05). RLS is not «the second wall» today on most tables; SCH-08 step 1 makes it one.
