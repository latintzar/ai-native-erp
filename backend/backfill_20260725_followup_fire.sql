-- backfill_20260725_followup_fire.sql — one-shot deploy backfill for the follow-up-firing fix.
--
-- WHY: the seed rows in schema_runtime.sql are `on conflict do nothing`, so the new follow_up cadence
-- (r1 4h → r2 1d → r3 2d, the cadet's ladder) does NOT propagate to an existing install; and rows
-- written under the old code carry the two defects this deploy fixes:
--   · open_loop.due_at was hardcoded now() at open (the phantom-overdue label lie);
--   · one-shot boss debrief tabs ('callreport:%') stayed open forever with no armed clock.
-- Prod snapshot 2026-07-25: stuck-forever loops 59/61/63 (callreport), phantom-overdue 60/64 (followup,
-- chase armed +2d out). This file makes the stranger's stuck follow-up FIRE post-deploy.
--
-- RUN ONCE on the live DB AT DEPLOY, after the new code is live (worker restarted), inside one tx:
--   psql "$ROCOTO_DSN" -1 -f backfill_20260725_followup_fire.sql
-- Idempotent: re-running is a no-op. Rehearse on rocoto_rehearsal first (vital_followup_fire.py does).
--
-- NOTE: already-open followup tabs keep their OLD pre-armed contingency (the single r1_chase sentence,
-- slots already filled at open) — contingencies are baked at open time by design. Step 3 pulls their
-- armed chase to NOW so the worker fires it on the next tick (T1 verify + the outbound gate still
-- apply, and reach/pacing may hold it to a human hour — held, never lost). NEW promises get the ladder.

-- 1) the manifest cadence + the cadet's sentences (matches the schema_runtime.sql seed verbatim).
update manifest_duty set gate_policy = $d$
{"opens_on": {"event": "call.promise", "key": "followup:{promise_key}"},
 "resolves_on": {"event": "followup.done", "branch_id": "kept"},
 "tab": {"kind": "pending", "answer_shape": "yesno", "money": false,
         "text": "Seguimiento prometido a {name}: {promise}"},
 "rungs": [
  {"branch_id": "r1_chase", "after": "4h", "gated": false,
   "trigger": "promised outcome unmet +4h — same-day follow-up on the call promise",
   "sentence": "¡Hola! Te escribo por lo que hablamos en la llamada de antes: quedé en {promise}. Ya lo tengo entre manos — ¿lo dejamos confirmado, o quieres ajustar algo antes?"},
  {"branch_id": "r2_chase", "after": "1d", "gated": false,
   "trigger": "promised outcome still unmet +1d — next-day follow-up",
   "sentence": "¡Buenas! Sigo pendiente de lo que quedamos en la llamada — {promise}. En cuanto me digas lo cierro y te lo quito de la cabeza."},
  {"branch_id": "r3_chase", "after": "2d", "gated": false,
   "trigger": "promised outcome still unmet +3d — last gentle chase",
   "sentence": "No quiero ser pesado — solo que no se nos pierda lo de la llamada: {promise}. Con un «sí» me basta y me encargo yo del resto."}],
 "lifecycle": {"prefix": "followup.", "initial": "open", "terminal": ["kept", "dropped"],
   "transitions": {"followup.done": "kept", "followup.dropped": "dropped"}},
 "soul": {"tier": "customer", "label": "SEGUIMIENTO PENDIENTE TRAS LLAMADA"}}
$d$::jsonb
where scope = 'peter'::ltree and name = 'follow_up' and created_by = 'L1';

-- 2) resolve the leaked one-shot debrief tabs: rung already FIRED (debrief delivered), nothing armed,
--    tab open forever. New code resolves these at fire time (worker boss block); this clears the stock.
update open_loop l
   set status = 'resolved', resolved_at = now(),
       resolution = '{"branch_id": "r1_debrief", "note": "backfill 2026-07-25: one-shot boss debrief already delivered"}'::jsonb
 where l.status = 'open' and l.entity_key like 'callreport:%'
   and exists (select 1 from timer t where t.loop_id = l.id and t.state = 'fired')
   and not exists (select 1 from timer t where t.loop_id = l.id and t.state = 'armed');

-- 3) FIRE the stranded follow-up chases: every armed chase on an open 'followup:' tab still waiting on
--    the old +2d clock comes due NOW — the worker fires it within one tick (verify + gate + reach/pacing
--    all still apply; nothing bypasses the gate).
update timer t
   set fires_at = now()
  from open_loop l
 where l.id = t.loop_id and t.state = 'armed' and l.status = 'open'
   and l.entity_key like 'followup:%' and t.fires_at > now();

-- 4) re-mirror due_at on EVERY open tab that has an armed clock (heals the phantom-overdue label lie
--    for rows written under the old code; new code keeps the two clocks as one expression).
update open_loop l
   set due_at = a.next_fire
  from (select loop_id, min(fires_at) as next_fire from timer where state = 'armed' group by loop_id) a
 where a.loop_id = l.id and l.status = 'open'
   and (l.due_at is distinct from a.next_fire);
