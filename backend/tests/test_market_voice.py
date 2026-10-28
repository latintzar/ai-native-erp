"""test_market_voice.py — the two sentences that would lose Raquel her customers.

Both are enforced AFTER the model, not asked of it in a persona, because a persona is a request.
"""
import ast
import os

import market_voice as mv

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


# ── ① never promise stock we cannot see ───────────────────────────────────────────────────────────
def test_a_confirmation_is_replaced_wholesale():
    """«Mientras no se vincule con mi ERP: "ok, recibido" — NO "confirmado".» The sentence is wrong
    about the world, not badly phrased, so it is replaced rather than edited: trimming the word out
    of «te lo confirmo para mañana» leaves a sentence that still promises."""
    for claim in [
        "Te lo confirmo para mañana, 4 cajas de lubina.",
        "Perfecto, lo tenemos disponible.",
        "Te lo guardo para el jueves.",
        "Queda confirmado.",
        "Seguro que llega mañana.",
    ]:
        assert mv.apply(claim) == mv.ACK_ES, claim


def test_the_replacement_is_the_sentence_she_authorised():
    """Her words, and positive throughout — it says what WILL happen, never what we cannot do."""
    assert mv.ACK_ES.startswith("Recibido")
    assert "avisamos" in mv.ACK_ES
    for negative in ("no ", "No ", "sin ", "todavía"):
        assert negative not in mv.ACK_ES, f"the acknowledgement must not spend a word on {negative!r}"


def test_an_honest_reply_passes_untouched():
    """Booking the order is not promising stock. «Apuntado» is exactly what she does all morning."""
    ok = "Apuntado. 4 cajas de lubina para mañana."
    assert mv.apply(ok) == ok


def test_an_erp_linked_supplier_may_confirm():
    """The gate exists because we cannot SEE the stock. A supplier who linked their ERP can."""
    claim = "Confirmado, 4 cajas para mañana."
    assert mv.apply(claim, erp_linked=True) == claim


# ── ② never write more than a busy buyer reads ────────────────────────────────────────────────────
def test_long_replies_are_cut():
    long = "Hola, buenos días. " * 40
    out = mv.apply(long)
    assert len(out) <= mv.MAX_CHARS


def test_the_cut_lands_on_a_sentence_where_it_can():
    t = "Apuntado. " + ("Palabra " * 60) + "Fin."
    out = mv.apply(t)
    assert out.endswith(".") or not out.endswith(" "), out[-30:]


def test_short_replies_are_never_touched():
    for ok in ["Ok", "Apuntado 👍", "¿4 o 6?", "No me queda. ¿Te vale del 3?"]:
        assert mv.apply(ok) == ok


# ── the wiring, structurally ──────────────────────────────────────────────────────────────────────
def test_the_gate_is_on_the_one_outbound_path_and_exempts_the_human():
    """It must sit in `send_whatsapp_as_rocoto` — the single door — and must NOT touch an
    `override` send, which is a human speaking through Rocoto. Their words are their own."""
    src = open(os.path.join(HERE, "actions.py")).read()
    fn = next(n for n in ast.walk(ast.parse(src))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "send_whatsapp_as_rocoto")
    body = ast.dump(fn)
    assert "market_voice" in body, "the outbound gate does not apply the market voice"
    # THE PROPERTY: market_voice runs only on the branch where override is FALSE. Checked over
    # both guard shapes — `if not override: <call>` and `if override: … else/elif: <call>` — so a
    # refactor between them (2026-08-19: the human-hold merge turned the first into the second)
    # does not fail the test while the property holds.
    ok, leaked = False, False
    for node in ast.walk(fn):
        if not isinstance(node, ast.If) or "override" not in ast.dump(node.test):
            continue
        negated = "Not" in ast.dump(node.test)
        in_body = "market_voice" in " ".join(ast.dump(b) for b in node.body)
        in_orelse = "market_voice" in " ".join(ast.dump(b) for b in node.orelse)
        if (negated and in_body) or (not negated and in_orelse):
            ok = True
        if not negated and in_body:
            leaked = True
    assert ok, "the market voice must run on the not-override branch"
    assert not leaked, "the market voice must never touch a human's own words"


# ── THE SETTINGS MUST REACH THE MOUTH (2026-08-19) ────────────────────────────────────────────────
# Peter: «the configuration of what the runtime knows about their inventory, whether it says
# anything about inventory or doesn't; whether it does confirmations; whether it says anything
# about price or doesn't». A setup question that does not change behaviour is a form, not a setting.
def test_a_supplier_who_keeps_stock_here_may_speak_about_it():
    """The gate exists because we cannot SEE the shelf. `stock: yes` means we can."""
    claim = "Confirmado, 4 cajas para mañana."
    assert mv.apply(claim, erp_linked=True) == claim
    assert mv.apply(claim, erp_linked=False) == mv.ACK_ES


def test_prices_are_detected_wherever_they_are_written():
    for said in ["Son 24,90 € el kilo.", "24.90€", "€ 18", "eur 12,50", "12 euros"]:
        assert mv.quotes_price(said), said
    for not_a_price in ["4 cajas de lubina", "del 3 o del 4", "mañana a las 6"]:
        assert not mv.quotes_price(not_a_price), not_a_price


def test_the_settings_gate_is_the_one_the_outbound_door_calls():
    """`apply_for` is what resolves THIS supplier's answers. If actions.py calls the constant
    version instead, the setup questions are decoration."""
    import ast
    src = open(os.path.join(HERE, "actions.py")).read()
    fn = next(n for n in ast.walk(ast.parse(src))
              if isinstance(n, ast.AsyncFunctionDef) and n.name == "send_whatsapp_as_rocoto")
    assert "apply_for" in ast.dump(fn), "the outbound door must resolve the supplier's own settings"


def test_approve_actually_routes_an_order():
    """It had ZERO readers: every supplier got `review` whether they chose it or not. And the
    fail-soft direction must stay `review` — the wrong error here is an order leaving without the
    boss ever seeing it."""
    src = open(os.path.join(HERE, "agent_reply.py")).read()
    i = src.index("orders_tool.place_order")
    window = src[i - 900:i + 120]
    assert '"approve"' in window or "'approve'" in window, "take_order ignores the approve setting"
    assert "_auto = False" in window, "the cautious answer must be the starting point"
    assert "approved=_auto" in window
