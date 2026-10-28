"""§17.30g habit engine — pure halves. Deterministic: no DB, no clock (now is passed in).

Laws under test: populations not specimens · armed only at ≥0.8 (8/10 weeks) · quiet = armed +
past usual-by + no order today + not muted, ranked by usual_€ × confidence × lateness · the
baseline is the same history («one baseline, two surfaces»).
"""
from datetime import datetime, timedelta, timezone

from brain.habits import ARM_FLOOR, baseline_from, build_habits, quiet_from

TZ = timezone.utc
NOW = datetime(2026, 8, 4, 17, 30, tzinfo=TZ)          # a Tuesday, 17:30


def _tuesdays(n, hour=13, minute=45, phone="+34600000001", cents=7400, name="Bar Manolo"):
    """n consecutive Tuesdays back from NOW's week, ordering at hour:minute."""
    rows = []
    for k in range(1, n + 1):
        ts = NOW - timedelta(weeks=k)
        ts = ts.replace(hour=hour, minute=minute)
        rows.append({"phone_number": phone, "customer_name": name,
                     "created_at": ts, "cents": cents})
    return rows


def test_nine_weeks_arms_and_names_the_time():
    h = build_habits(_tuesdays(9), NOW)
    assert len(h) == 1
    hb = h[0]
    assert hb["armed"] and hb["confidence"] >= ARM_FLOOR
    assert hb["weekday"] == 1                       # Tuesday
    assert hb["usual_by_min"] == 13 * 60 + 45       # «orders by 13:45»
    assert hb["usual_cents"] == 7400


def test_three_weeks_never_rings_anyone():
    h = build_habits(_tuesdays(3), NOW)
    assert len(h) == 1 and not h[0]["armed"]        # visible, below the bar


def test_quiet_is_a_ranked_population():
    rows = (_tuesdays(9)                                                      # 74 € · 9w
            + _tuesdays(9, hour=12, minute=0, phone="+34600000002",
                        cents=9600, name="La Perla")                          # 96 € · 9w
            + _tuesdays(3, hour=10, minute=0, phone="+34600000003",
                        cents=20000, name="Asador Grande"))                   # rich but 3w: silent
    q = quiet_from(build_habits(rows, NOW), ordered_today=set(), now=NOW)
    assert [x["phone"] for x in q] == ["+34600000002", "+34600000001"]        # € × conf × lateness
    assert all(x["late_min"] > 0 for x in q)


def test_an_order_today_clears_the_habit():
    rows = _tuesdays(9)
    today = [{"phone_number": "+34600000001", "customer_name": "Bar Manolo",
              "created_at": NOW.replace(hour=9, minute=10), "cents": 7400}]
    hb = build_habits(rows + today, NOW)
    q = quiet_from(hb, ordered_today={"+34600000001"}, now=NOW)
    assert q == []


def test_not_today_mute_silences_without_unarming():
    hb = build_habits(_tuesdays(9), NOW)
    assert quiet_from(hb, set(), NOW, muted={"+34600000001"}) == []
    assert hb[0]["armed"]                            # the mute is state, the habit survives


def test_before_usual_by_nothing_is_quiet():
    early = NOW.replace(hour=11, minute=0)
    assert quiet_from(build_habits(_tuesdays(9), NOW), set(), early) == []


def test_baseline_is_median_by_now_same_weekday():
    rows = []
    for k in range(1, 5):                            # four past Tuesdays: 2,3,3,4 morning orders
        day = (NOW - timedelta(weeks=k))
        n = [2, 3, 3, 4][k - 1]
        for j in range(n):
            rows.append({"phone_number": f"+3460000{k}{j}", "customer_name": "x",
                         "created_at": day.replace(hour=8 + j, minute=0), "cents": 5000})
    b = baseline_from(rows, NOW)
    assert b["days"] == 4 and b["orders"] == 3 and b["cents"] == 15000


def test_baseline_excludes_today_and_after_now():
    rows = _tuesdays(4) + [{"phone_number": "+x", "customer_name": "x",
                            "created_at": NOW.replace(hour=9), "cents": 1}]      # today: excluded
    late = [{"phone_number": "+y", "customer_name": "y",
             "created_at": (NOW - timedelta(weeks=1)).replace(hour=19), "cents": 99999}]
    b = baseline_from(rows + late, NOW)              # 19:00 > 17:30 → the late order never counts
    assert b["cents"] == 7400 and b["orders"] == 1
