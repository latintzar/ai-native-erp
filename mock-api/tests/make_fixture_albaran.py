#!/usr/bin/env python3
"""The fixture albarán — one page, four goods lines, a total row (THE-PARSING-SPEC §PAR-06).

Deterministic: the same bytes every time, so a parse can be compared run to run. It is a SYNTHETIC
page — printed type, clean contrast, one language — and §PAR-06's own warning stands: it proves the
configuration and the failure modes, never accuracy on a creased note photographed at 05:40.

    python3 tests/make_fixture_albaran.py tests/fixtures/albaran-fixture.png
    python3 tests/make_fixture_albaran.py /tmp/albaran-20.png 20     # the same page, 20 goods lines

The optional line count exists for ONE measurement: PAR-10.2 asks whether a page's row count moves
the provider's reading time, and that question needs two pages that differ in nothing else — same
header, same column geometry, same typeface, same printed style. Four lines is the default and its
bytes are unchanged.
"""
import pathlib
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# The fourth line states NO lot on purpose: a borrowed lot is a traceability lie, and «the missing
# lot came back absent rather than borrowed from the row above» is the single most important
# behaviour this fixture tests (§PAR-06.2).
ROWS = [
    ("MER-001", "Merluza grande", "12,5", "kg", "13,50", "L-250903"),
    ("PUL-004", "Pulpo cocido", "21", "kg", "18,90", "L-250902"),
    ("GAM-010", "Gamba roja", "3", "caja", "92,00", "L-250903"),
    ("ALM-002", "Almeja fina", "4,25", "kg", "31,40", ""),
]

# The lines a longer page adds. Same market, same shape of value — a longer albarán, nothing else.
EXTRA = [
    ("RAP-006", "Rape blanco", "7,5", "kg", "16,80", "L-250903"),
    ("LUB-003", "Lubina salvaje", "9", "kg", "22,40", "L-250902"),
    ("DOR-007", "Dorada racion", "14,2", "kg", "11,20", "L-250903"),
    ("SEP-012", "Sepia limpia", "6", "kg", "14,75", "L-250901"),
    ("CAL-005", "Calamar patagonico", "18", "kg", "9,60", "L-250902"),
    ("MEJ-008", "Mejillon gallego", "5", "saco", "27,00", "L-250903"),
    ("NAV-011", "Navaja viva", "2,5", "kg", "38,90", "L-250903"),
    ("BAC-009", "Bacalao desalado", "11", "kg", "19,30", "L-250901"),
    ("ATU-014", "Atun rojo lomo", "4,8", "kg", "48,50", "L-250903"),
    ("SAL-013", "Salmonete de roca", "3,6", "kg", "26,10", "L-250902"),
    ("BOQ-015", "Boqueron fresco", "8", "caja", "12,40", "L-250903"),
    ("SAR-016", "Sardina grande", "10,5", "kg", "6,80", "L-250901"),
    ("LAN-017", "Langostino tigre", "6,4", "kg", "34,20", "L-250903"),
    ("CIG-018", "Cigala mediana", "2,2", "kg", "56,00", "L-250902"),
    ("BER-019", "Berberecho fino", "3,8", "kg", "29,90", "L-250903"),
    ("VIE-020", "Vieira limpia", "1,9", "kg", "62,50", "L-250901"),
]


def lines(count: int) -> list[tuple[str, ...]]:
    """`count` goods lines: the four canonical ones first, then EXTRA in order."""
    pool = ROWS + EXTRA
    if count > len(pool):
        raise SystemExit(f"this page holds at most {len(pool)} lines")
    return pool[:count]


def draw(path: pathlib.Path, count: int = len(ROWS)) -> pathlib.Path:
    rows = lines(count)
    # Four lines keeps the historical 900 px page byte for byte; a longer page grows to hold its table.
    height = max(900, 300 + 46 * len(rows) + 120)
    image = Image.new("RGB", (1240, height), "white")
    pen = ImageDraw.Draw(image)
    head = ImageFont.truetype(BOLD, 30)
    small = ImageFont.truetype(FONT, 22)
    column_head = ImageFont.truetype(BOLD, 22)
    pen.text((60, 50), "ALBARAN DE ENTREGA  Nº 2026/0418", font=head, fill="black")
    pen.text((60, 96), "Peix Fresc Sant Marti SL  ·  Fecha 03/09/2026", font=small, fill="black")
    pen.text((60, 130), "Cliente: Restaurant Can Sabate", font=small, fill="black")
    columns = [60, 220, 640, 780, 900, 1050]
    for x, title in zip(columns, ["CODIGO", "PRODUCTO", "CANTIDAD", "UNIDAD", "PRECIO", "LOTE"]):
        pen.text((x, 210), title, font=column_head, fill="black")
    pen.line((60, 244, 1180, 244), fill="black", width=2)
    y = 266
    for row in rows:
        for x, cell in zip(columns, row):
            pen.text((x, y), cell, font=small, fill="black")
        y += 46
    pen.line((60, y + 8, 1180, y + 8), fill="black", width=1)
    # The canonical four-line page keeps the total it has always printed, so its bytes never move
    # and every read recorded against it stays comparable. A longer page prints its own sum.
    printed = "1.146,03"
    if len(rows) != len(ROWS):
        total = sum(float(r[2].replace(",", ".")) * float(r[4].replace(".", "").replace(",", ".")) for r in rows)
        printed = f"{total:,.2f}".replace(",", "@").replace(".", ",").replace("@", ".")
    pen.text((640, y + 30), f"TOTAL  {printed} €", font=ImageFont.truetype(BOLD, 24), fill="black")
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    return path


if __name__ == "__main__":
    target = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "tests/fixtures/albaran-fixture.png")
    print(draw(target, int(sys.argv[2]) if len(sys.argv) > 2 else len(ROWS)))
