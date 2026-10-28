# The Kernel's PUBLIC API (the surface an app may depend on)
Convention: app code calls ONLY what is listed here; every other kernel symbol is internal and may
change without notice within a MAJOR version.

- `runtime.run_turn / ingest_inbound / emit_sense / run_wake_turn` — the one cycle
- `spine.append_event / ingest_chat / ingest_webhook / arm_wake` — the event floor
- `memory.search / lookup_fact / write_fact / regen_card` — memory
- `assemble.assemble` — the fold
- `gate.check_outbound / standing_prices / extract_prices` — the money floor
- `lifecycle.status / notes` · `tenancy.tenant_of` — identity/stage
- `soul.assemble_soul / voice_persona / VOICE_OVERLAY / PROSPECT_PITCH` — the SOUL + overlays
- `voice_fabric.register / fire_named / fire_triggers / stall_hint / pending_say / fold_results` — the fabric
- `voice_protocol.in_call_turn` — the spoken turn
- `directory.build / schedule_rebuild / block_for_scope` — the supplier directory
- `presence_call.call_started / call_ended / ahora_block / register_reset_hook` — continuity
- `triggers.*` — the trigger vocabulary (read-only)
