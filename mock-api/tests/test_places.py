"""NUMBER → IDENTITY: the gate, the plan, and the refusal to guess (FEED-IA §196.6).

`fixtures/places-phone-lookup.json` holds three REAL Google responses recorded from the box on
2026-09-04: two legacy Find Place answers keyed by the number asked for, and one Places API v1
`searchText` answer. Everything asserted here is what this service does with them.
"""
from __future__ import annotations

from conftest import load

from app import places


def bodies():
    return load("places-phone-lookup.json")


def test_the_phone_matched_candidate_is_the_identity():
    picked = places.pick_find_place(bodies()["+34935563000"], "+34935563000")
    assert picked and picked["name"] == "Mercabarna"
    assert "Barcelona" in picked["address"]
    assert picked["place_id"].startswith("ChIJ")


def test_a_candidate_that_does_not_carry_the_number_is_not_an_identity():
    """VOICE-00 forbids «This is Customer X» from an approximate match. So it returns nothing."""
    assert places.pick_find_place(bodies()["+34935563000"], "+34600111222") is None


def test_the_v1_road_answers_with_the_same_gate():
    picked = places.pick_search_text(bodies()["searchText:+34935563000"], "+34935563000")
    assert picked and picked["name"] == "Mercabarna"
    assert places.pick_search_text(bodies()["searchText:+34935563000"], "+34910000000") is None


def test_the_gate_is_the_nine_significant_digits():
    assert places.same_number("+34 935 56 30 00", "0034935563000")
    assert places.same_number("935563000", "+34935563000")
    assert not places.same_number("+34935563000", "+34935563001")
    assert not places.same_number("", "+34935563000")


def test_the_spanish_plan_is_read_and_nothing_else_is_asserted():
    assert places.phone_type("+34600123456") == "mobile"
    assert places.phone_type("+34722123456") == "mobile"
    assert places.phone_type("+34935563000") == "landline"
    assert places.phone_type("+34800123456") == "landline"
    assert places.phone_type("+33145678901") == "unknown"
    assert places.phone_type("+15551234567") == "unknown"


def test_the_maps_url_is_built_from_the_place_id_or_not_at_all():
    assert places.maps_url("ChIJabc") == "https://www.google.com/maps/place/?q=place_id:ChIJabc"
    assert places.maps_url("") == ""


def test_keyterms_are_the_name_and_the_district():
    terms = places.keyterms({"name": "Mercabarna",
                             "address": "Carrer Major, 76, Sants-Montjuïc, 08040 Barcelona, Espanya"})
    assert terms[0] == "Mercabarna"
    assert "Sants-Montjuïc" in terms


def test_an_unmatched_number_is_an_answer_not_an_error(monkeypatch):
    """Empty is a state the kit can show. An exception would be a failure it cannot explain."""
    import asyncio

    from app import config

    monkeypatch.setattr(config.settings, "places_key", "a-key", raising=False)

    async def nothing(_client, _number):
        return None

    monkeypatch.setattr(places, "_find_place", nothing)
    monkeypatch.setattr(places, "_search_text", nothing)
    answer = asyncio.run(places.identity("+34999999999"))
    assert answer["confidence"] == 0.0
    assert "name" not in answer
    assert answer["provider"] == "google-places"
    assert answer["phoneType"] == "landline"
