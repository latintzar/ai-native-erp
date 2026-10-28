"""test_routing_allocation.py — who a customer talks to, and from which of our numbers.

Peter, 2026-08-19: «the company being able to create new users for the different salespeople…
allocating a number to them. There might be a sub-specification, which is also that certain
customers get routed to them, even if they have another number — because the customer is used to
that.»

THE LAW UNDERNEATH ALL OF IT: a restaurant that has written to «Frutas Sitjar» for two years must
never receive a reply from a number they have never seen. That is indistinguishable from a scam.
`sender_for` encodes the order that respects them; these tests hold the shape that feeds it.
"""
import inspect
import os

import channels

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_keep_and_clear_are_different_instructions():
    """Both are real things the panel says. Using None for both — the first cut — made «send this
    customer back to the house number» IMPOSSIBLE to express, which is the shape of bug where a UI
    ships a control that silently does nothing."""
    sig = inspect.signature(channels.set_routing)
    for arg in ("channel_number_id", "assigned_to"):
        assert sig.parameters[arg].default is channels.KEEP, f"{arg} must default to KEEP"
    assert channels.KEEP is not None


def test_set_routing_reads_before_it_writes():
    """KEEP means «leave alone», which is only possible if the current row is read first — an
    upsert with coalesce cannot express clearing."""
    src = inspect.getsource(channels.set_routing)
    assert "select channel_number_id, assigned_to from customer_routing" in src
    assert "is KEEP" in src


def test_the_two_questions_stay_independent():
    """«I changed who owns this customer» must never silently also change which number they talk
    to. They are separate columns, separately defaulted, separately cleared."""
    src = inspect.getsource(channels.set_routing)
    assert src.count("is KEEP") >= 2, "each question needs its own KEEP check"


def test_a_number_can_belong_to_a_person_or_to_the_house():
    """NULL owner is «the house» and is a real answer — most suppliers are one person with one
    number and must never be made to invent an owner."""
    src = inspect.getsource(channels.set_number_owner)
    assert "nullif($3,'')" in src, "an empty owner must store NULL, not an empty string"
    assert "tenant_id = $2" in src, "a number id from another distributor must touch nothing"


def test_ownership_is_an_admin_decision():
    """Who answers a customer is an org decision. A comercial reassigning their own line would
    change who a restaurant talks to without the boss knowing."""
    src = open(os.path.join(HERE, "sup_api.py")).read()
    i = src.index('@router.post("/channels/numbers/{number_id}/owner")')
    head = src[i:i + 400]
    assert 'require_cap("admin' in head, "number ownership must be admin-capped"


def test_routing_refuses_a_number_from_another_distributor():
    src = open(os.path.join(HERE, "sup_api.py")).read()
    i = src.index('@router.post("/customers/{phone}/routing")')
    body = src[i:i + 2600]
    assert "numbers_for" in body and "no_such_number" in body, \
        "an attachable number must be proven to belong to this tenant"


def test_sender_for_still_prefers_the_number_they_wrote_to():
    """The ordering IS the law. If this ever inverts, a customer starts hearing from a stranger."""
    src = inspect.getsource(channels.sender_for)
    i_routed = src.index("customer_routing")
    i_primary = src.index("primary")
    assert i_routed < i_primary, "the customer's own number must be consulted before the primary"
