#!/usr/bin/env python3
"""THE PARSING DEGRADATION HARNESS — how bad a photograph can get before the rows stop being right.

    «i expect this to be fully working when we wire everything… you can even test it by exporting
     and downresolutioning and even muddling or adding fake dirt to the image and then running it
     through scanning all programmatically without requiring me to print and test»
                                                             — Peter, 2026-09-04 (FEED-IA §198)

THE-PARSING-SPEC §PAR-06 proved the CONFIGURATION against the live API on one clean page, and said
so in its own words: «they do not measure accuracy on a creased handwritten note photographed in a
market at 05:40». This harness is the first half of that debt paid — the same page, degraded the
way a morning degrades it, read through the LIVE runtime, and compared field by field against the
clean read.

⚠ WHAT «CORRECT» MEANS HERE, AND WHY IT IS THE CLEAN READ AND NOT A HAND-TYPED KEY. The clean read
is what the provider returns from the undamaged page, and PAR-06.2 already checked that read
against the paper by eye: four lines, comma decimals as decimals, «caja» beside three «kg», the
total row not read as a line, the missing lot absent rather than borrowed. Comparing every degraded
read against THAT isolates exactly one variable — the damage — and asks the only question this
harness is entitled to ask: **does the picture getting worse change the answer?** A separate key
would fold the provider's own accuracy back into the number and measure two things at once.

THE COST IS REAL AND THE HARNESS RESPECTS IT. Each read is a full Parsewise project — upload,
dimension, seven agents, launch, poll, delete — and PAR-06.2 measured that at about two and a half
minutes. So: **eight variants, serially, cached on disk.** A re-run reads the cache and burns
nothing; `--refresh` is the only way to spend the provider's time twice.

RUN IT
    python3 tools/parse-harness.py                       # eight variants against the live runtime
    python3 tools/parse-harness.py --variants clean,dirt-05
    python3 tools/parse-harness.py --report              # the tables, from the cache, no calls
"""
from __future__ import annotations

import argparse
import io
import json
import pathlib
import sys
import time
import urllib.error
import urllib.request
import uuid

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from PIL import Image  # noqa: E402

from degrade import VARIANTS, Sheet, apply_variant, variant_names  # noqa: E402

HERE = pathlib.Path(__file__).resolve().parent
SITUATIONS = HERE.parent
FIXTURE = SITUATIONS / 'runtime' / 'tests' / 'fixtures' / 'albaran-fixture.png'
RUNTIME = 'https://kit.soyrocoto.com/api'
# The fields a row of an albarán is made of. `raw` is deliberately NOT compared: it is the
# provider's own reconstruction of the printed line and it moves with the OCR, so comparing it
# would report a difference every time a character was read differently even where every extracted
# FIELD came back identical — which is the opposite of what this harness is asking.
FIELDS = ('name', 'qty', 'unit', 'price', 'lot')


def post_parse(image: Image.Image, kind: str, base: str, timeout: int) -> dict:
    """One multipart POST, built by hand — the harness carries no HTTP library of its own, and the
    runtime holds the key, so nothing secret passes through this file."""
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    boundary = '----rocoto' + uuid.uuid4().hex
    body = b''
    body += ('--%s\r\nContent-Disposition: form-data; name="kind"\r\n\r\n%s\r\n' % (boundary, kind)).encode()
    body += ('--%s\r\nContent-Disposition: form-data; name="file"; filename="albaran.png"\r\n'
             'Content-Type: image/png\r\n\r\n' % boundary).encode()
    body += buffer.getvalue() + b'\r\n'
    body += ('--%s--\r\n' % boundary).encode()
    request = urllib.request.Request(base + '/parse', data=body, method='POST', headers={
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': str(len(body)),
        'Origin': 'https://kit.soyrocoto.com',
    })
    with urllib.request.urlopen(request, timeout=timeout) as answer:
        return json.loads(answer.read().decode())


def compare(clean: dict, other: dict) -> dict:
    """Field by field, row by row, matched by POSITION — which is a claim the runtime earns by
    sorting on its own «Line number» agent (THE-RUNTIME-SPEC §RUN-04.2). A reader that returned the
    right values in the wrong order would be a reader a person has to re-sort by hand, so an order
    change is a difference here and is meant to be."""
    left, right = clean.get('rows', []), other.get('rows', [])
    per_field = {field: {'same': 0, 'of': 0, 'wrong': []} for field in FIELDS}
    for index in range(max(len(left), len(right))):
        a = left[index] if index < len(left) else None
        b = right[index] if index < len(right) else None
        for field in FIELDS:
            per_field[field]['of'] += 1
            want = (a or {}).get(field)
            got = (b or {}).get(field)
            if isinstance(want, float) and isinstance(got, float):
                same = abs(want - got) < 1e-9
            else:
                same = want == got
            if same:
                per_field[field]['same'] += 1
            else:
                per_field[field]['wrong'].append({'row': index + 1, 'want': want, 'got': got})
    cells = sum(value['of'] for value in per_field.values())
    same = sum(value['same'] for value in per_field.values())
    return {
        'rows_clean': len(left), 'rows_read': len(right),
        'rows_match': len(left) == len(right),
        'fields': per_field, 'cells': cells, 'same': same,
        'identical': same == cells and len(left) == len(right),
        'share': (same / cells) if cells else 0.0,
    }


def run(args) -> int:
    if not FIXTURE.exists():
        raise SystemExit('no fixture at ' + str(FIXTURE))
    out = pathlib.Path(args.out)
    (out / 'variants').mkdir(parents=True, exist_ok=True)
    cache_path = out / 'reads.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    page = Image.open(FIXTURE).convert('RGB')
    names = args.variants.split(',') if args.variants else variant_names('parse')
    # The albarán is a PAGE, so the whole image is the box a damage budget is a share of; the
    # millimetre scale is the fixture's own (a 1240 px render of an A4-ish sheet, ~5.9 px/mm).
    sheet = Sheet(region=None, px_per_mm=page.width / 210.0)

    if not args.report:
        print('THE LIVE RUNTIME · ' + args.base)
        try:
            with urllib.request.urlopen(args.base + '/health', timeout=20) as answer:
                health = json.loads(answer.read().decode())
            print('  health ' + json.dumps(health))
            if health.get('providers', {}).get('parsewise') != 'configured':
                print('  ⚠ parsewise is not configured on this runtime — nothing here would be a read.')
                return 2
        except Exception as error:  # noqa: BLE001 — an unreachable runtime is a stated outcome
            print('  UNREACHABLE · ' + type(error).__name__ + ': ' + str(error)[:120])
            return 2

    for name in names:
        if name not in VARIANTS:
            raise SystemExit('no such variant: ' + name)
        hurt = apply_variant(page, name, args.seed, sheet)
        hurt.save(out / 'variants' / (name + '.png'))
        if args.report:
            continue
        if name in cache and not args.refresh:
            print('  %-14s cached (%d rows)' % (name, len(cache[name].get('result', {}).get('rows', []))))
            continue
        started = time.time()
        print('  %-14s reading…' % name, flush=True)
        try:
            result = post_parse(hurt, args.kind, args.base, args.timeout)
            cache[name] = {'result': result, 'seconds': round(time.time() - started, 1),
                           'at': time.strftime('%Y-%m-%dT%H:%M:%S')}
            print('    %d rows · confidence %.2f · %.0f s'
                  % (len(result.get('rows', [])), result.get('confidence', 0), time.time() - started))
        except urllib.error.HTTPError as error:
            detail = error.read().decode()[:200]
            cache[name] = {'error': 'HTTP %d %s' % (error.code, detail), 'seconds': round(time.time() - started, 1)}
            print('    FAILED · HTTP %d · %s' % (error.code, detail))
        except Exception as error:  # noqa: BLE001 — a failed read is a result, and it is recorded
            cache[name] = {'error': type(error).__name__ + ': ' + str(error)[:160],
                           'seconds': round(time.time() - started, 1)}
            print('    FAILED · ' + type(error).__name__ + ': ' + str(error)[:160])
        cache_path.write_text(json.dumps(cache, indent=2))

    cache_path.write_text(json.dumps(cache, indent=2))

    # ── THE TABLES ─────────────────────────────────────────────────────────────────────────────
    clean = cache.get('clean', {}).get('result')
    if not clean:
        print('\nno clean read yet — the floor is measured against it, so nothing is stated.')
        return 1
    print('\n── THE CLEAN READ · what every degraded read is compared against ──')
    print('  %d rows · %s · confidence %.2f · %d page(s), %d table(s)'
          % (len(clean['rows']), clean.get('provider'), clean.get('confidence', 0),
             clean.get('evidence', {}).get('pages', 0), clean.get('evidence', {}).get('tables', 0)))
    print('| # | name | qty | unit | price | lot |')
    print('|---:|---|---:|---|---:|---|')
    for index, row in enumerate(clean['rows'], 1):
        print('| %d | %s | %s | %s | %s | %s |' % (
            index, row.get('name', ''), row.get('qty', ''), row.get('unit', '') or '',
            row.get('price', '') if row.get('price') is not None else '', row.get('lot') or '—'))

    print('\n── THE SWEEP · every variant against that read ──')
    print('| variant | what it is | rows | ' + ' | '.join(FIELDS) + ' | identical? | seconds |')
    print('|---|---|---:|' + '---:|' * len(FIELDS) + '---|---:|')
    rows = []
    for name in names:
        entry = cache.get(name)
        if not entry:
            continue
        if 'error' in entry:
            print('| `%s` | %s | — | %s | FAILED · %s | %.0f |'
                  % (name, VARIANTS[name].label, ' | '.join(['—'] * len(FIELDS)),
                     entry['error'][:60], entry.get('seconds', 0)))
            rows.append({'name': name, 'ok': False, 'error': entry['error']})
            continue
        verdict = compare(clean, entry['result'])
        print('| `%s` | %s | %d/%d | %s | %s | %.0f |' % (
            name, VARIANTS[name].label, verdict['rows_read'], verdict['rows_clean'],
            ' | '.join('%d/%d' % (verdict['fields'][field]['same'], verdict['fields'][field]['of']) for field in FIELDS),
            'yes' if verdict['identical'] else 'NO', entry.get('seconds', 0)))
        rows.append({'name': name, 'ok': verdict['identical'], 'verdict': verdict})

    print('\n── WHAT CHANGED, WHERE IT CHANGED ──')
    for row in rows:
        if row.get('ok') or 'verdict' not in row:
            continue
        for field, value in row['verdict']['fields'].items():
            for wrong in value['wrong'][:4]:
                print('  %-14s row %d · %s: «%s» → «%s»'
                      % (row['name'], wrong['row'], field, wrong['want'], wrong['got']))

    held = [row['name'] for row in rows if row.get('ok')]
    lost = [row['name'] for row in rows if not row.get('ok')]
    print('\n── THE FLOOR ──')
    print('  identical to the clean read: ' + (', '.join(held) if held else 'NONE'))
    print('  changed or failed:           ' + (', '.join(lost) if lost else 'none'))
    if args.json:
        pathlib.Path(args.json).write_text(json.dumps(
            {'clean': clean, 'rows': rows, 'variants': names, 'seed': args.seed,
             'base': args.base, 'at': time.strftime('%Y-%m-%d')}, indent=2, default=str))
        print('\nJSON → ' + args.json)
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--base', default=RUNTIME)
    parser.add_argument('--kind', default='albaran')
    parser.add_argument('--variants', default='')
    parser.add_argument('--seed', type=int, default=7)
    parser.add_argument('--timeout', type=int, default=420, help='seconds to hold one read open')
    parser.add_argument('--out', default='/dev/shm/rocoto-e193-parse-harness')
    parser.add_argument('--refresh', action='store_true', help='spend the provider\'s time again')
    parser.add_argument('--report', action='store_true', help='tables from the cache, no calls')
    parser.add_argument('--json', default=None)
    return run(parser.parse_args())


if __name__ == '__main__':
    raise SystemExit(main())
