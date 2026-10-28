"""§2b.2 geocode — pure half only (no network in vitals, ever)."""
from brain.geocode import parse_hit


def test_first_hit_wins():
    assert parse_hit([{"lat": "41.38", "lon": "2.17"}, {"lat": "0", "lon": "0"}]) == (41.38, 2.17)


def test_junk_shapes_return_none():
    for junk in (None, [], [{}], [{"lat": "x", "lon": "y"}], "nope", [{"lat": None, "lon": 2}]):
        assert parse_hit(junk) is None
