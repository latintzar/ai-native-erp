/* test-display-language.mjs — THE DISPLAY LANGUAGE, DECIDED BEFORE ANYTHING RENDERS.
 *
 * `display-language.ts` is the one place that answers three questions: which entry am I on, where
 * does the other language live, and what does a stored preference mean at boot. It holds no React
 * and touches no window, so the answers are checked here rather than guessed from a screenshot.
 *
 * RUN: node tools/test-display-language.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTypeScript, APP_ROOT } from './ts-module.mjs';

const {
  DISPLAY_LANGUAGES, DISPLAY_LANGUAGE_KEY, SPANISH_ENTRY_KEY, ENGLISH_ENTRY, SPANISH_ENTRY,
  SPANISH_ENTRY_META, SPANISH_INDEX, availableLanguages, documentLanguageOf, markSpanishUnpublished,
  offeredSpanishEntry, publishedSpanishEntry, resetSpanishPublication, spanishUnpublished,
  entryLanguage, entryPath, relocationTarget, readDisplayLanguage, writeDisplayLanguage,
  readSpanishEntry, bootDecision, languageChoice, companyLanguageOf,
} = loadTypeScript('src/prototypes/cedar/display-language.ts', 'cedar-display-language');

let checks = 0;
const check = (fn) => { fn(); checks += 1; };

/** Every boot in this file names the two facts the document carries, because both decide. */
const boot = (input) => bootDecision({ published: SPANISH_ENTRY, documentLanguage: 'en', ...input });

/* ── EXACTLY THE LANGUAGES THAT RENDER ──────────────────────────────────────────────────────── */
check(() => assert.deepEqual(DISPLAY_LANGUAGES.map((l) => l.value), ['en', 'es']));
check(() => assert.deepEqual(DISPLAY_LANGUAGES.map((l) => l.label), ['English', 'Castellano']));

/* ── ONE SHARED, UNPREFIXED KEY ─────────────────────────────────────────────────────────────
 * The Spanish snapshot rewrites every `rocoto-app-` key to `rocoto-spanish-app-`. A preference
 * that has to survive the hop between the two entries must sit outside that prefix. */
check(() => assert.equal(DISPLAY_LANGUAGE_KEY, 'rocoto-display-language'));
check(() => assert.equal(DISPLAY_LANGUAGE_KEY.startsWith('rocoto-app-'), false));
check(() => assert.equal(SPANISH_ENTRY_KEY.startsWith('rocoto-app-'), false));

/* ── WHICH ENTRY AM I ───────────────────────────────────────────────────────────────────────── */
check(() => assert.equal(entryLanguage(ENGLISH_ENTRY), 'en'));
check(() => assert.equal(entryLanguage(SPANISH_ENTRY), 'es'));
check(() => assert.equal(entryLanguage('/cedar/es'), 'es'));
check(() => assert.equal(entryLanguage('/cedar/es/index.html'), 'es'));
check(() => assert.equal(entryLanguage('/app-spanish.html'), 'es'));
check(() => assert.equal(entryLanguage('/app.html'), 'en'));
check(() => assert.equal(entryLanguage('/'), 'en'));
check(() => assert.equal(entryLanguage('/index.html'), 'en'));

/* ── WHERE THE OTHER LANGUAGE LIVES ─────────────────────────────────────────────────────────── */
check(() => assert.equal(entryPath('es', '/cedar/'), '/cedar/es/'));
check(() => assert.equal(entryPath('es', '/cedar/index.html'), '/cedar/es/'));
check(() => assert.equal(entryPath('es', '/app.html'), '/cedar/es/'));
check(() => assert.equal(entryPath('es', '/'), '/cedar/es/'));
check(() => assert.equal(entryPath('es', '/cedar/es/'), '/cedar/es/'));
check(() => assert.equal(entryPath('en', '/cedar/es/'), '/cedar/'));
check(() => assert.equal(entryPath('en', '/cedar/es'), '/cedar/'));
check(() => assert.equal(entryPath('en', '/cedar/'), '/cedar/'));
check(() => assert.equal(entryPath('en', '/app.html'), '/app.html'));
/* The standalone snapshot publishes both entries side by side; each stays with its own sibling. */
check(() => assert.equal(entryPath('es', '/app-spanish.html'), '/app-spanish.html'));
check(() => assert.equal(entryPath('en', '/app-spanish.html'), '/app.html'));

/* ── THE HASH IS THE SURFACE A PERSON IS ON, AND IT SURVIVES THE HOP ─────────────────────── */
check(() => assert.equal(relocationTarget('es', '/cedar/', '#/admin/app-settings'), '/cedar/es/#/admin/app-settings'));
check(() => assert.equal(relocationTarget('en', '/cedar/es/', '#/money'), '/cedar/#/money'));
check(() => assert.equal(relocationTarget('es', '/cedar/', ''), '/cedar/es/'));

/* ── THE PREFERENCE ─────────────────────────────────────────────────────────────────────────── */
const store = (seed = {}) => {
  const held = new Map(Object.entries(seed));
  return { held, getItem: (key) => held.get(key) ?? null, setItem: (key, value) => held.set(key, value) };
};
check(() => assert.equal(readDisplayLanguage(store()), null));
check(() => assert.equal(readDisplayLanguage(store({ [DISPLAY_LANGUAGE_KEY]: 'es' })), 'es'));
check(() => assert.equal(readDisplayLanguage(store({ [DISPLAY_LANGUAGE_KEY]: 'en' })), 'en'));
check(() => assert.equal(readDisplayLanguage(store({ [DISPLAY_LANGUAGE_KEY]: 'ca' })), null));
check(() => assert.equal(readDisplayLanguage(null), null));
check(() => assert.equal(readDisplayLanguage({ getItem() { throw new Error('blocked'); }, setItem() {} }), null));
check(() => {
  const held = store();
  assert.equal(writeDisplayLanguage(held, 'es'), true);
  assert.equal(held.held.get(DISPLAY_LANGUAGE_KEY), 'es');
});
check(() => assert.equal(writeDisplayLanguage({ getItem: () => null, setItem() { throw new Error('full'); } }, 'es'), false));

/* A stored entry is honoured only when it is one this build publishes. */
check(() => assert.equal(readSpanishEntry(store({ [SPANISH_ENTRY_KEY]: '/app-spanish.html' })), '/app-spanish.html'));
check(() => assert.equal(readSpanishEntry(store({ [SPANISH_ENTRY_KEY]: 'https://elsewhere.example/' })), null));
check(() => assert.equal(readSpanishEntry(store({ [SPANISH_ENTRY_KEY]: '//elsewhere.example/' })), null));
check(() => assert.equal(readSpanishEntry(store()), null));

/* ── THE BOOT DECISION ──────────────────────────────────────────────────────────────────────
 * English entry: a stored Spanish preference relocates. Spanish entry: a Spanish link opened
 * directly stays Spanish and records itself, whatever the preference said. */
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/', hash: '#/money', stored: 'es', storedEntry: null }),
  { action: 'relocate', language: 'es', to: '/cedar/es/#/money' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/', hash: '', stored: null, storedEntry: null }),
  { action: 'record', language: 'en' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/', hash: '', stored: 'en', storedEntry: null }),
  { action: 'stay', language: 'en' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/es/', hash: '#/sales', stored: null, storedEntry: null, documentLanguage: 'es' }),
  { action: 'record', language: 'es' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/es/', hash: '', stored: 'en', storedEntry: null, documentLanguage: 'es' }),
  { action: 'record', language: 'es' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/es/', hash: '', stored: 'es', storedEntry: '/cedar/es/', documentLanguage: 'es' }),
  { action: 'stay', language: 'es' },
));
/* The Spanish entry a person actually used wins over the default, so the standalone snapshot
   sends them back to the entry that exists on its own origin. */
check(() => assert.deepEqual(
  boot({ pathname: '/app.html', hash: '#/sales', stored: 'es', storedEntry: '/app-spanish.html', published: '/app-spanish.html' }),
  { action: 'relocate', language: 'es', to: '/app-spanish.html#/sales' },
));

/* ── A LANGUAGE WITH NO BUILD IS NOT A DESTINATION (§246 review) ─────────────────────────────
 * `make dev` publishes no `/cedar/es/`, and the relocation used to be a constant: one press of
 * Castellano sent a person off Cedar to whatever the dev server's fallback answers with, and the
 * stored preference sent them back there on every later load — with the Settings screen that
 * could undo it exactly what could no longer mount. The marker the build writes decides. */
check(() => assert.deepEqual(
  boot({ pathname: '/app.html', hash: '#/sales', stored: 'es', storedEntry: null, published: null }),
  { action: 'stay', language: 'en' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/', hash: '', stored: 'es', storedEntry: '/cedar/es/', published: null }),
  { action: 'stay', language: 'en' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/', hash: '', stored: null, storedEntry: null, published: null }),
  { action: 'stay', language: 'en' },
));
/* A marker naming something this module does not publish is no marker at all. */
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/', hash: '', stored: 'es', storedEntry: null, published: 'https://elsewhere.example/' }),
  { action: 'stay', language: 'en' },
));

/* ── A SPANISH ADDRESS ANSWERED IN ENGLISH SAYS SO, ONCE ─────────────────────────────────────
 * A host can serve the English document at `/cedar/es/` — an older generation, a partial copy, an
 * SPA fallback. The boot tries the Spanish index once, and English there too is the answer. */
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/es/', hash: '#/sales', stored: 'es', storedEntry: '/cedar/es/', documentLanguage: 'en' }),
  { action: 'relocate', language: 'es', to: '/cedar/es/index.html#/sales' },
));
check(() => assert.deepEqual(
  boot({ pathname: '/cedar/es', hash: '', stored: null, storedEntry: null, documentLanguage: 'en' }),
  { action: 'relocate', language: 'es', to: '/cedar/es/index.html' },
));
check(() => assert.deepEqual(
  boot({ pathname: SPANISH_INDEX, hash: '#/money', stored: 'es', storedEntry: null, documentLanguage: 'en' }),
  { action: 'unpublished', language: 'en' },
));
/* And the document that really is Spanish is untouched by any of it. */
check(() => assert.deepEqual(
  boot({ pathname: SPANISH_INDEX, hash: '', stored: 'es', storedEntry: SPANISH_INDEX, documentLanguage: 'es' }),
  { action: 'stay', language: 'es' },
));

/* ── THE MARKER THE BUILD WRITES ────────────────────────────────────────────────────────────── */
const meta = (content) => ({ querySelector: (selector) => (selector === `meta[name="${SPANISH_ENTRY_META}"]` && content !== null ? { getAttribute: () => content } : null) });
check(() => assert.equal(SPANISH_ENTRY_META, 'rocoto-spanish-entry'));
check(() => assert.equal(publishedSpanishEntry(meta('/cedar/es/')), '/cedar/es/'));
check(() => assert.equal(publishedSpanishEntry(meta('/cedar/es')), '/cedar/es/'));
check(() => assert.equal(publishedSpanishEntry(meta('/app-spanish.html')), '/app-spanish.html'));
check(() => assert.equal(publishedSpanishEntry(meta(null)), null));
check(() => assert.equal(publishedSpanishEntry(meta('https://elsewhere.example/')), null));
check(() => assert.equal(publishedSpanishEntry(null), null));
check(() => assert.equal(publishedSpanishEntry({ querySelector() { throw new Error('detached'); } }), null));

/* THE MARKER IS A FACT OF THE PUBLISHED ARTIFACT, so the script that publishes one writes it. */
const buildScript = readFileSync(join(APP_ROOT, 'tools/build-english-app.mjs'), 'utf8');
check(() => assert.match(buildScript, /name="rocoto-spanish-entry"/));
check(() => assert.match(buildScript, /markEntry\('app\.html'\)/));
check(() => assert.match(buildScript, /markEntry\(`\$\{SPANISH_ENTRY\}\/index\.html`\)/));

/* ── WHAT A DOCUMENT DECLARES ───────────────────────────────────────────────────────────────── */
check(() => assert.equal(documentLanguageOf('es'), 'es'));
check(() => assert.equal(documentLanguageOf('en'), 'en'));
check(() => assert.equal(documentLanguageOf('es-ES'), 'en'));
check(() => assert.equal(documentLanguageOf(null), 'en'));

/* ── SETTINGS OFFERS WHAT RENDERS ───────────────────────────────────────────────────────────── */
check(() => assert.deepEqual(availableLanguages('/cedar/es/').map((l) => l.value), ['en', 'es']));
check(() => assert.deepEqual(availableLanguages(null).map((l) => l.value), ['en']));
check(() => assert.deepEqual(availableLanguages(null).map((l) => l.label), ['English']));
check(() => {
  resetSpanishPublication();
  assert.equal(spanishUnpublished(), false);
  assert.equal(offeredSpanishEntry(meta('/cedar/es/')), '/cedar/es/');
  markSpanishUnpublished();
  assert.equal(spanishUnpublished(), true);
  /* The document outranks the marker: a promise the host failed to keep is taken off the menu. */
  assert.equal(offeredSpanishEntry(meta('/cedar/es/')), null);
  assert.deepEqual(availableLanguages(offeredSpanishEntry(meta('/cedar/es/'))).map((l) => l.value), ['en']);
  resetSpanishPublication();
});

/* ── CHOOSING IN SETTINGS ───────────────────────────────────────────────────────────────────── */
check(() => assert.deepEqual(
  languageChoice('es', '/cedar/', '#/admin/app-settings'),
  { language: 'es', entry: '/cedar/es/', to: '/cedar/es/#/admin/app-settings' },
));
check(() => assert.deepEqual(
  languageChoice('en', '/cedar/es/', '#/admin/app-settings'),
  { language: 'en', entry: '/cedar/', to: '/cedar/#/admin/app-settings' },
));

/* The company record keeps one language field, and it carries the same answer. */
check(() => assert.equal(companyLanguageOf('es'), 'es'));
check(() => assert.equal(companyLanguageOf('en'), 'en'));

/* ── THE FOUR SHIPPED OUTPUT NAMES: SPANISH ON SCREEN, ENGLISH IN THE RECORD ─────────────────
 * `output-templates.ts` SEEDS the shipped templates, and the two entries share one unprefixed
 * store key — so a seed-dictionary entry for «Delivery notes» wrote «Albaranes» into the record
 * the English design build then read back, and the English Sales day header said «Albaranes · 32
 * left». The record is one language-neutral set of English names; the display adapter translates
 * them where they are RENDERED. */
const { prepareSpanishDisplaySource } = loadTypeScript('src/prototypes/cedar/snapshot/spanish-display-source.ts', 'cedar-spanish-display-source');
const { translateSpanishSnapshotSource } = loadTypeScript('src/prototypes/cedar/snapshot/spanish-source-transform.ts', 'cedar-spanish-transform');
const spanishOf = (source) => {
  const text = readFileSync(join(APP_ROOT, source), 'utf8');
  return prepareSpanishDisplaySource(translateSpanishSnapshotSource(text, source, () => undefined) ?? text, source, { sharedState: true });
};

const seeded = spanishOf('src/prototypes/cedar/output-templates.ts');
check(() => assert.match(seeded, /id: 'albaran-default'[\s\S]{0,140}?name: 'Delivery notes'/));
check(() => assert.match(seeded, /id: 'packing-default'[\s\S]{0,140}?name: 'Packing list'/));
check(() => assert.equal(/name: ["']Albaranes["']/.test(seeded), false));
check(() => assert.equal(/name: ["']Lista de preparación["']/.test(seeded), false));

const renderedSales = spanishOf('src/prototypes/cedar/areas/sales.tsx');
check(() => assert.match(renderedSales, /const __snapshotOutputName = /));
check(() => assert.match(renderedSales, /__snapshotOutputName\(seat\.template\.name\)/));
/* ⚠ RETARGETED 13 September 2026. The packing seat drew the literal «Packing list» whatever the
   template was called, so `spanish-display-source.ts` mapped that literal too and this check read
   `'packing' ? 'Lista de preparación'`. The seat reads `seat.template.name` on both seats now
   (THE-OUTPUTS-SPEC OUT-03.3), so ONE rule — the `template.name` adapter above — carries the four
   shipped names into Spanish, and the literal stands in neither language. */
check(() => assert.equal(/'packing' \? 'Packing list'/.test(readFileSync(join(APP_ROOT, 'src/prototypes/cedar/areas/sales.tsx'), 'utf8')), false));
check(() => assert.equal(/'packing' \? 'Lista de preparación'/.test(renderedSales), false));

const renderedPrint = spanishOf('src/prototypes/cedar/print-screen.tsx');
check(() => assert.match(renderedPrint, /title=\{__snapshotOutputName\(template\.name\)\}/));
check(() => assert.match(renderedPrint, /\{__snapshotOutputName\(template\.name\)\}\s*<\/h2>/));
/* The name a person TYPES stays their own words, so the editable field keeps the record's value. */
check(() => assert.match(renderedPrint, /value=\{template\.name\}/));

const renderedLibrary = spanishOf('src/prototypes/cedar/shell/printing.tsx');
check(() => assert.match(renderedLibrary, /__snapshotOutputName\(template\.name\)/));
check(() => assert.equal(/React\.useState\(__snapshotOutputName/.test(renderedLibrary), false));
check(() => assert.equal(/name: __snapshotOutputName\(template\.name\),/.test(renderedLibrary), false));

/* ── THE BANK CARD'S HEIGHT IS AN ID, NOT A NAME ─────────────────────────────────────────────
 * The snapshot rewrites `name="Bank account"` to «Cuenta bancaria», so a height decided by that
 * comparison stopped matching and the Banca card grew 48px in Castellano alone. */
const card = readFileSync(join(APP_ROOT, 'src/prototypes/cedar/connection-card.tsx'), 'utf8');
check(() => assert.equal(/minHeight: name ===/.test(card), false));
check(() => assert.match(card, /minHeight: short \? '172px' : '220px'/));
/* ⚠ RETARGETED 13 September 2026. The height then rode on `testId === COMPACT_CONNECTION`, which
   reads the same in every language and is still a guess made inside the card about the group it
   stands in. The call site states it: `areas/admin/connections.tsx` passes `compact` on the one
   Banking card, and the card draws what it is told, in both languages. */
check(() => assert.equal(/COMPACT_CONNECTION/.test(card), false));
check(() => assert.match(card, /const short = compact;/));
const connections = readFileSync(join(APP_ROOT, 'src/prototypes/cedar/areas/admin/connections.tsx'), 'utf8');
check(() => assert.match(connections, /connected=\{bank\.posture === 'ready'\} compact/));
const renderedCard = spanishOf('src/prototypes/cedar/connection-card.tsx');
check(() => assert.match(renderedCard, /const short = compact;/));
check(() => assert.match(renderedCard, /minHeight: short \? '172px' : '220px'/));

console.log(`${checks} display-language checks passed`);
