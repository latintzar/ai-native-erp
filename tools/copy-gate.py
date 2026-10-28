#!/usr/bin/env python3
"""Copy gate · negatives in user-facing strings (Peter, 2026-08-09: «NEVER GIVE NEGATIVES»).

Scans string literals and JSX text in app/src/prototypes (comments stripped) for negative
constructions. Exit 1 with the list when any remain; exit 0 at zero. Fail-closed: an unreadable
tree is a red run, never a clean one. Allow-list: tools/copy-gate-allow.txt (exact strings,
one per line — reserved for Spanish snapshot dictionary rows and non-copy identifiers).

E194 hardening, three ways: block comments collapse to blank lines so reported line numbers are
the file's own; JSX text that stands on its own line (a child spread across lines, which the
one-line `>text<` shape misses) is read as copy too, along with the runs a `{expression}` splits;
and quoted runs are matched whole rather than from six characters up, because a short attribute
ahead of a long one (`label="Audio" value="Not recorded"`) paired the quotes wrong and swallowed
the copy that came after it."""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1] / 'app' / 'src' / 'prototypes'
ALLOW = pathlib.Path(__file__).resolve().parent / 'copy-gate-allow.txt'
SKIP_DIRS = ('_parked', 'snapshot')
NEG = re.compile(r"(?i)(^|[\s>«(·'\"`])(no|not|nothing|never|nobody|none|don't|doesn't|can't|cannot|won't|isn't|aren't|didn't|wasn't|hasn't|haven't|without|unless)\b(?! *=)")
LIT = re.compile(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`((?:[^`\\]|\\.)*)`")
JSX = re.compile(r">([^<>{}]{6,})<")
# JSX text a `{expression}` interrupts: the run before it and the run after it are copy too.
JSX_HEAD = re.compile(r">([^<>{}]{6,})\{")
JSX_TAIL = re.compile(r"\}([^<>{}]{6,})<")
# JSX child text on a line of its own: prose, no markup, no code punctuation.
BARE = re.compile(r"^\s*([A-Za-z«][^<>{}=;:`'\"]*)\s*$")
NONCOPY = re.compile(r"data-testid|aria-|^[a-z-]+$|https?:|^/|@media|no-repeat|Content-Security|none'|\bnone\b\s*[;,]|rotate\(|transform|\|[a-z0-9-]+\|[a-z]$|'\s*\|\s*'")

def strip(s: str) -> str:
    s = re.sub(r'/\*.*?\*/', lambda m: '\n' * m.group(0).count('\n'), s, flags=re.S)
    s = re.sub(r'(?m)^\s*//.*$', '', s)
    s = re.sub(r'(?m)(?<=[;{}\)])\s*//[^\n]*$', '', s)
    return s

def main() -> int:
    if not ROOT.is_dir():
        print(f'RED · source tree missing at {ROOT}'); return 1
    allow = set()
    if ALLOW.exists():
        allow = {l.strip() for l in ALLOW.read_text().splitlines() if l.strip() and not l.startswith('#')}
    hits, seen = [], set()
    for f in sorted(ROOT.rglob('*.ts*')):
        rel = f.relative_to(ROOT)
        if '.test.' in f.name or any(part in SKIP_DIRS for part in rel.parts):
            continue
        for i, line in enumerate(strip(f.read_text()).split('\n'), 1):
            texts = [m.group(1) or m.group(2) or m.group(3) or '' for m in LIT.finditer(line)]
            texts += [m.group(1) for m in JSX.finditer(line)]
            texts += [m.group(1) for m in JSX_HEAD.finditer(line)]
            texts += [m.group(1) for m in JSX_TAIL.finditer(line)]
            bare = BARE.match(line)
            if bare:
                texts.append(bare.group(1))
            for t in texts:
                t = t.strip()
                if not re.search(r'[a-z]', t) or ' ' not in t: continue
                if NONCOPY.search(t) or not NEG.search(t) or t in allow: continue
                key = (str(rel), t)
                if key in seen: continue
                seen.add(key); hits.append((str(rel), i, t[:120]))
    for rel, i, t in hits:
        print(f'{rel}:{i}: {t}')
    print(f'{"RED" if hits else "GREEN"} · {len(hits)} negative strings')
    return 1 if hits else 0

if __name__ == '__main__':
    sys.exit(main())
