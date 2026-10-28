"""Order-brain: grounded WhatsApp/voice order intake.

Per message → durable queue → junk gate → ~2-min debounce → identity → 5 parallel Haiku
scale-readers → Sonnet synthesiser (merge + SKU match) → Sonnet decision (pick + doubt note)
→ deterministic validators → keep-in-mind bands → tabular order → Sonnet personalisation →
operator hold-to-submit + undo → event-sourced order → Excel/Sage.

See ORDER-BRAIN-REGISTER.md / ORDER-BRAIN-RUNTIME.md for the authoritative design.
"""
