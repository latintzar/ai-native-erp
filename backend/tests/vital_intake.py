"""vital_intake.py — WP-6 transcript+notes INTAKE (M1M2-BUILD-PLAN WP-6).

Peter's definition (2026-07-24): "transcript-based intake, WITH my own notes to ensure we capture it"
— NOT auto-prefill. One Sonnet structured pass reads the call TRANSCRIPT **and** Peter's own `## Notes`
→ a ficha {name, business, products mentioned, how orders arrive today, column-habit hints}, STAGED
into wizard_state for Peter to CONFIRM (a pending shape the wizard shows, never silently committed).

  1. INGEST PARSES NOTES — a call note with `## Transcript` + `## Notes` → calls_onboard row carries
     BOTH the transcript and Peter's notes (the ingestion "carries both").
  2. DOC CARRIES BOTH — the single document handed to the model contains BOTH sources (labelled).
  3. EXTRACT FROM BOTH — the extraction receives both sources; a NOTES-only fact (formal business
     name) and a TRANSCRIPT-only fact (a product, how orders arrive) both land in the ficha.
  4. STAGED NOT COMMITTED — the ficha lands under wizard_state.ficha_staged {pending, confirmed:false,
     source.from_transcript+from_notes}; the real wizard fields (skus) are untouched, no top-level
     name/business overwrite.
  5. FACTS PERSISTED + IDEMPOTENT — five per-field transcript_facts rows; a re-run replaces, never
     duplicates (still exactly five).
  6. STAGE-ON-MINT — a call ingested BEFORE any token exists still stages once a token is minted
     (facts → stage_ficha_for_token, no second LLM call).
Run on the clone: PYTHONPATH=. venv/bin/python tests/vital_intake.py
"""
import asyncio
import os
from pathlib import Path

# Load the prod/clone env if present (harmless locally — setdefault only).
for _l in Path("/opt/rocoto/.env").read_text().splitlines() if Path("/opt/rocoto/.env").exists() else []:
    _l = _l.strip()
    if _l and not _l.startswith("#") and "=" in _l:
        k, _, v = _l.partition("="); os.environ.setdefault(k.strip(), v.strip())

# The intake reads its notes dir from CALLS_DIR at import — point it at a vital-owned temp dir.
_CALLS = Path(os.getenv("ROCOTO_MEDIA_DIR", "/tmp")) / "vital_intake_calls"
_CALLS.mkdir(parents=True, exist_ok=True)
os.environ["CALLS_DIR"] = str(_CALLS)

import db  # noqa: E402
from brain import onboarding as ob  # noqa: E402

PHONE = "+34655100277"
LEAD = "vitalintake_lead1"
LEAD2 = "vitalintake_lead2"
TOKEN = "vitalintake_tok1"
TOKEN2 = "vitalintake_tok2"
PHONE2 = "+34655100288"

R = []
def ck(n, ok, d=""):
    R.append(bool(ok)); print(f"  [{'PASS' if ok else 'FAIL'}] {n}" + (f" — {d}" if d else ""))

# Distinguishing tokens: TRANSCRIPT-only vs NOTES-only, so "extracted from BOTH sources" is provable.
T_ONLY = "chorizo"                    # only in the transcript
N_ONLY = "Brújula Ibéricos SL"        # only in Peter's notes (formal razón social)

NOTE_MD = f"""# Call — {LEAD}

- **Kind:** discovery
- **Phone:** {PHONE}
- **Duration:** 7:20

---

## Transcript

**Peter:** ¿Qué distribuís y cómo os entran los pedidos?

**Cliente:** Somos de embutido — {T_ONLY} y salchichón sobre todo, y algo de queso. Los pedidos me
entran por WhatsApp y por llamada, algún mensaje de voz.

---

## Notes

Razón social real: {N_ONLY} (facturar a ese nombre).
Llevan el código de cliente en Sage. Corte a las 10:30. Mínimo 60 €.
"""

# Whether the seam actually received BOTH sources (set by the stub).
_seen = {"transcript_ok": False, "notes_ok": False}

async def _stub_llm(transcript: str, notes: str):
    """Deterministic stand-in for the Sonnet pass. ASSERTS both sources arrived (the transcript-only
    and notes-only tokens are each present in the right arg) → returns a ficha whose `business` is a
    NOTES-only fact and whose products are TRANSCRIPT-only facts, so staging proves BOTH fed it."""
    _seen["transcript_ok"] = (T_ONLY in (transcript or "")) and (N_ONLY not in (transcript or ""))
    _seen["notes_ok"] = (N_ONLY in (notes or "")) and (T_ONLY not in (notes or ""))
    return {
        "name": {"value": "Juan", "confidence": "high", "mentions": ["Juan"]},
        "business": {"value": N_ONLY, "confidence": "high", "mentions": [N_ONLY]},          # NOTES
        "how_orders_arrive_today": {"value": "WhatsApp y llamadas", "confidence": "medium",
                                    "mentions": ["WhatsApp"]},                               # TRANSCRIPT
        "products_mentioned": [{"text": "chorizo", "confidence": "high"}, {"text": "salchichón"}],  # TRANSCRIPT
        "column_habit_hints": [{"text": "corte a las 10:30", "kind": "corte"},
                               {"text": "código de cliente en Sage", "kind": "erp"}],        # NOTES
    }

async def _noop(*a, **k):
    return None

async def _cleanup():
    async with db.get_pool().acquire() as con:
        await con.execute("delete from transcript_facts where lead_id = any($1::text[])", [LEAD, LEAD2])
        await con.execute("delete from calls_onboard where lead_id = any($1::text[])", [LEAD, LEAD2])
        await con.execute("delete from onboarding_progress where token = any($1::text[])", [TOKEN, TOKEN2])
        await con.execute("delete from onboarding_tokens where token = any($1::text[])", [TOKEN, TOKEN2])
        await con.execute("delete from events where lead_id = any($1::text[])", [LEAD, LEAD2])
        await con.execute("delete from leads where id = any($1::text[])", [LEAD, LEAD2])
    for p in (_CALLS.glob("*.md")):
        try: p.unlink()
        except Exception: pass

async def _mk_lead(lead_id, phone):
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into leads (id, phone, name, business, status, is_test) "
            "values ($1,$2,'','','signed_up',true)", lead_id, phone)

async def _mk_token(token, lead_id, wizard_state):
    async with db.get_pool().acquire() as con:
        await con.execute(
            "insert into onboarding_tokens (token, lead_id, status, is_test) values ($1,$2,'active',true)",
            token, lead_id)
        await con.execute(
            "insert into onboarding_progress (token, wizard_state, step, version, is_test) "
            "values ($1,$2,1,1,true)", token, wizard_state)

async def _state(token):
    async with db.get_pool().acquire() as con:
        ws = await con.fetchval("select wizard_state from onboarding_progress where token = $1", token)
    return (ws if isinstance(ws, dict) else __import__("json").loads(ws or "{}"))

async def _facts(call_id):
    async with db.get_pool().acquire() as con:
        return [dict(r) for r in await con.fetch(
            "select field from transcript_facts where call_id = $1 and field = any($2::text[])",
            call_id, list(ob._FICHA_FIELDS))]

async def main():
    await db.init()
    await _cleanup()
    # Deterministic + offline: stub the LLM seam, and neutralise ingest's fire-and-forget so our
    # awaited extract_ficha is the only writer (no create_task race on the same call's facts).
    ob._run_ficha_llm = _stub_llm
    ob._extract_ficha_bg = _noop

    # ── fixtures ──
    await _mk_lead(LEAD, PHONE)
    # skus already parsed in the wizard — must survive intake untouched.
    orig_skus = [{"code": "CH-01", "name": "Chorizo casero", "unit": "kg"}]
    await _mk_token(TOKEN, LEAD, {"skus": orig_skus, "catalogue_uploaded": True})
    (_CALLS / "2026-07-24_1015_labrujula.md").write_text(NOTE_MD, encoding="utf-8")

    # 1. INGEST PARSES NOTES
    n = await ob.ingest_calls_once()
    async with db.get_pool().acquire() as con:
        crow = await con.fetchrow(
            "select id, transcript, notes from calls_onboard where lead_id = $1", LEAD)
    ck("ingest wrote the call row", crow is not None and n >= 1, f"n={n}")
    ck("transcript parsed", bool(crow and T_ONLY in (crow["transcript"] or "")))
    ck("notes parsed (Peter's ## Notes)", bool(crow and N_ONLY in (crow["notes"] or "")))
    ck("notes did NOT leak into transcript", bool(crow and N_ONLY not in (crow["transcript"] or "")))
    call_id = crow["id"]

    # 2. DOC CARRIES BOTH SOURCES
    doc = ob._ficha_doc(crow["transcript"], crow["notes"])
    ck("model doc carries transcript + notes", (T_ONLY in doc) and (N_ONLY in doc)
       and "<transcript>" in doc and "notas_del_comercial" in doc)

    # 3. EXTRACT — awaited, deterministic
    fields = await ob.extract_ficha(call_id)
    ck("extract returned all five fields", bool(fields) and all(k in fields for k in ob._FICHA_FIELDS))
    ck("seam received BOTH sources (transcript-only + notes-only isolated)",
       _seen["transcript_ok"] and _seen["notes_ok"])

    st = await _state(TOKEN)
    staged = st.get("ficha_staged") or {}
    # 4. STAGED NOT COMMITTED
    ck("staged present + pending, not confirmed",
       bool(staged) and staged.get("pending") is True and staged.get("confirmed") is False)
    ck("source flags both sources",
       staged.get("source", {}).get("from_transcript") is True and
       staged.get("source", {}).get("from_notes") is True)
    ck("business = the NOTES-only fact (notes flowed through)",
       staged.get("business", {}).get("value") == N_ONLY)
    prods = [p.get("text") for p in staged.get("products_mentioned", [])]
    ck("products = TRANSCRIPT-only facts (transcript flowed through)", T_ONLY in prods)
    ck("name + how-orders + habits captured",
       staged.get("name", {}).get("value") == "Juan"
       and "WhatsApp" in staged.get("how_orders_arrive_today", {}).get("value", "")
       and any("Sage" in h.get("text", "") for h in staged.get("column_habit_hints", [])))
    ck("real wizard fields UNTOUCHED (skus survive, no top-level name/business commit)",
       st.get("skus") == orig_skus and "name" not in st and "business" not in st)

    # 5. FACTS PERSISTED + IDEMPOTENT
    f1 = await _facts(call_id)
    ck("five per-field transcript_facts rows", len(f1) == 5, f"got {len(f1)}")
    await ob.extract_ficha(call_id)   # re-run
    f2 = await _facts(call_id)
    ck("re-run replaces, never duplicates (still five)", len(f2) == 5, f"got {len(f2)}")

    # 6. STAGE-ON-MINT — a call ingested with NO active token; facts exist but weren't staged.
    await _mk_lead(LEAD2, PHONE2)
    async with db.get_pool().acquire() as con:
        c2 = "vitalintake_call2"
        await con.execute(
            "insert into calls_onboard (id, lead_id, phone, note_path, transcript, notes, is_test) "
            "values ($1,$2,$3,$4,$5,$6,true)", c2, LEAD2, PHONE2,
            "/vital/intake/no-token.md",
            f"Vendemos {T_ONLY} y jamón, pedidos por WhatsApp.", f"Razón social: {N_ONLY}. Sage.")
    fields2 = await ob.extract_ficha(c2)     # no active token yet
    ck("extract with no token still writes facts", bool(fields2) and len(await _facts(c2)) == 5)
    # now the token is minted → staging rebuilds from facts (no new LLM call)
    await _mk_token(TOKEN2, LEAD2, {"skus": []})
    staged_ok = await ob.stage_ficha_for_token(TOKEN2)
    st2 = await _state(TOKEN2)
    ck("stage-on-mint stages the earlier ficha from facts",
       staged_ok and (st2.get("ficha_staged") or {}).get("business", {}).get("value") == N_ONLY)

    await _cleanup()
    ok = all(R)
    print(f"\nvital_intake: {'GREEN' if ok else 'RED'} ({sum(R)}/{len(R)} checks)")
    if not ok:
        raise SystemExit(1)

if __name__ == "__main__":
    asyncio.run(main())
