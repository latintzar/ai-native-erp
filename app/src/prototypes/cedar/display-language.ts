/* DISPLAY LANGUAGE — THE WORDS THE INTERFACE USES, AND NOTHING ELSE.
 *
 * Two facts were one control for a long time, and they are not the same fact:
 *
 *   LANGUAGE  which words a person reads. English is the design source; Castellano is the Spanish
 *             snapshot the build generates from it. Nothing else renders, so nothing else is offered.
 *   COUNTRY   which market the workspace presents — currency, the Money book, fiscal examples.
 *             `workspace-capabilities.ts` owns it, and a country change leaves the words alone.
 *
 * Spanish is a SOURCE TRANSFORM, not a runtime locale (`Spanish-snapshot.md`): the two languages
 * are two built entries, so choosing one is a navigation. That is the whole reason this module
 * exists — the preference, the entry paths and the boot decision have to be one answer, written
 * once, before anything renders. It holds no React and touches no window, so `tools/test-display-
 * language.mjs` reads it directly.
 *
 * THE KEY IS DELIBERATELY OUTSIDE `rocoto-app-`. The standalone Spanish snapshot rewrites every
 * `rocoto-app-` key to `rocoto-spanish-app-` so a disposable demo keeps its own browser state. A
 * preference whose whole job is to survive the hop between the two entries has to sit outside that
 * prefix, the same way `rocoto-workspace-capabilities:` already does.
 */

export type DisplayLanguage = 'en' | 'es';

/** One shared preference, read by both entries. */
export const DISPLAY_LANGUAGE_KEY = 'rocoto-display-language';
/** The Spanish entry a person actually opened, so a build that publishes it elsewhere is honoured. */
export const SPANISH_ENTRY_KEY = 'rocoto-spanish-entry';

/** Exactly the languages that render. A language with no build is not an option. */
export const DISPLAY_LANGUAGES: ReadonlyArray<{ value: DisplayLanguage; label: string }> = Object.freeze([
  Object.freeze({ value: 'en' as DisplayLanguage, label: 'English' }),
  Object.freeze({ value: 'es' as DisplayLanguage, label: 'Castellano' }),
]);

export const ENGLISH_ENTRY = '/cedar/';
export const SPANISH_ENTRY = '/cedar/es/';
/** The document the Spanish directory resolves to, and the one hop a fallback is tested with. */
export const SPANISH_INDEX = '/cedar/es/index.html';

/* ── THE MARKER: A LANGUAGE WITH NO BUILD IS NOT A DESTINATION ────────────────────────────────
 * Relocation used to be a constant, so `make dev` — which publishes no `/cedar/es/` — sent a
 * person from Cedar to the kit gallery and the stored preference sent them back there on every
 * later load. `tools/build-english-app.mjs` writes this meta into every entry document it
 * publishes, carrying the Spanish entry it actually wrote; a document without it publishes no
 * Spanish, so the boot stays where it is and Settings offers the one language that renders. */
export const SPANISH_ENTRY_META = 'rocoto-spanish-entry';

/** Every path the development artifact and the standalone snapshot publish, by language. */
const ENGLISH_PATHS: ReadonlyArray<string> = ['/cedar/', '/cedar/index.html', '/app.html', '/', '/index.html'];
const SPANISH_PATHS: ReadonlyArray<string> = ['/cedar/es/', '/cedar/es/index.html', '/app-spanish.html'];

/** `/cedar/es` and `/cedar/es/` are the same entry; a server hands the directory either way. */
const normalise = (pathname: string): string => {
  const path = (pathname || '/').split('?')[0].split('#')[0];
  if (path.endsWith('/')) return path;
  return path.slice(path.lastIndexOf('/')).includes('.') ? path : `${path}/`;
};

export function entryLanguage(pathname: string): DisplayLanguage {
  if (SPANISH_PATHS.includes(normalise(pathname))) return 'es';
  return 'en';
}

/** The narrowest document this module needs; a browser `document` satisfies it. */
export type MetaSource = { querySelector(selector: string): { getAttribute(name: string): string | null } | null };

/** The Spanish entry THIS build publishes, read off the running document. */
export function publishedSpanishEntry(doc: MetaSource | null | undefined): string | null {
  try {
    const raw = doc?.querySelector(`meta[name="${SPANISH_ENTRY_META}"]`)?.getAttribute('content') ?? null;
    if (!raw) return null;
    const path = normalise(raw);
    return SPANISH_PATHS.includes(path) ? path : null;
  } catch {
    return null;
  }
}

/** What a document DECLARES it is, which outranks what its address promises. */
export function documentLanguageOf(declared: string | null | undefined): DisplayLanguage {
  return declared === 'es' ? 'es' : 'en';
}

/** Exactly the languages this build can hand somebody, so Settings offers what renders. */
export function availableLanguages(published: string | null): ReadonlyArray<{ value: DisplayLanguage; label: string }> {
  return published ? DISPLAY_LANGUAGES : DISPLAY_LANGUAGES.filter((l) => l.value === 'en');
}

/* WHAT THE DOCUMENT PROVED, FOR THE REST OF THIS PAGE'S LIFE. A marker can promise a Spanish
   entry that the host then answers with the English fallback (an older generation, a partial
   copy). The boot sees that once, and every later reader takes this answer. */
let provedUnpublished = false;
export function markSpanishUnpublished(): void { provedUnpublished = true; }
export function spanishUnpublished(): boolean { return provedUnpublished; }
/** The test's way back to a clean module; nothing in the app calls it. */
export function resetSpanishPublication(): void { provedUnpublished = false; }

/** Where `language` lives, starting from the entry a person is on now. */
export function entryPath(language: DisplayLanguage, pathname: string): string {
  const path = normalise(pathname);
  if (language === 'es') {
    if (SPANISH_PATHS.includes(path)) return path;
    if (path === '/app-spanish.html') return path;
    return SPANISH_ENTRY;
  }
  if (path === '/app-spanish.html') return '/app.html';
  if (SPANISH_PATHS.includes(path)) return ENGLISH_ENTRY;
  if (ENGLISH_PATHS.includes(path)) return path;
  return ENGLISH_ENTRY;
}

/** The hash is the surface a person is standing on, so it crosses with them. */
export function relocationTarget(language: DisplayLanguage, pathname: string, hash: string): string {
  return `${entryPath(language, pathname)}${hash || ''}`;
}

/** The narrowest storage this module needs; a browser `localStorage` satisfies it. */
export type PreferenceStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export function readDisplayLanguage(store: PreferenceStore | null | undefined): DisplayLanguage | null {
  try {
    const raw = store ? store.getItem(DISPLAY_LANGUAGE_KEY) : null;
    if (raw === 'en') return 'en';
    if (raw === 'es') return 'es';
    return null;
  } catch {
    /* A browser with site data blocked reads as no preference, and the entry stands as it is. */
    return null;
  }
}

export function writeDisplayLanguage(store: PreferenceStore | null | undefined, language: DisplayLanguage): boolean {
  try {
    if (!store) return false;
    store.setItem(DISPLAY_LANGUAGE_KEY, language);
    return true;
  } catch {
    return false;
  }
}

/** A recorded entry is honoured only when this build publishes it: storage is not a redirector. */
export function readSpanishEntry(store: PreferenceStore | null | undefined): string | null {
  try {
    const raw = store ? store.getItem(SPANISH_ENTRY_KEY) : null;
    return raw && SPANISH_PATHS.includes(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeSpanishEntry(store: PreferenceStore | null | undefined, pathname: string): boolean {
  try {
    const path = normalise(pathname);
    if (!store || !SPANISH_PATHS.includes(path)) return false;
    store.setItem(SPANISH_ENTRY_KEY, path);
    return true;
  } catch {
    return false;
  }
}

export type BootDecision =
  | { action: 'relocate'; language: DisplayLanguage; to: string }
  | { action: 'record'; language: DisplayLanguage }
  | { action: 'stay'; language: DisplayLanguage }
  | { action: 'unpublished'; language: 'en' };

/* WHAT BOOT DOES, IN ONE ANSWER.
 *
 *   on the English entry   a stored Castellano sends the browser to the Spanish entry this build
 *                          published, hash and all. A build that published none keeps the person on
 *                          Cedar: `make dev` and the kit gallery have no `/cedar/es/` to go to.
 *   on the Spanish entry   it stays. A Spanish link opened directly is a person asking for Spanish,
 *                          so the entry records itself as the answer rather than bouncing back.
 *   on a Spanish address   the document is the proof. A host answering it with the English
 *   answering English      fallback gets one hop to `/cedar/es/index.html`; English there too means
 *                          this origin publishes no Spanish entry, so English stands and says so. */
export function bootDecision(input: {
  pathname: string;
  hash: string;
  stored: DisplayLanguage | null;
  storedEntry: string | null;
  /** The Spanish entry the running document says this build published. */
  published: string | null;
  /** What the served document declares, which outranks what its address promises. */
  documentLanguage: DisplayLanguage;
}): BootDecision {
  const here = normalise(input.pathname);
  const published = input.published && SPANISH_PATHS.includes(input.published) ? input.published : null;
  if (entryLanguage(here) === 'es') {
    if (input.documentLanguage === 'en') {
      if (here !== SPANISH_INDEX) return { action: 'relocate', language: 'es', to: `${SPANISH_INDEX}${input.hash || ''}` };
      return { action: 'unpublished', language: 'en' };
    }
    if (input.stored === 'es' && input.storedEntry === here) return { action: 'stay', language: 'es' };
    return { action: 'record', language: 'es' };
  }
  if (!published) return { action: 'stay', language: 'en' };
  if (input.stored === 'es') {
    const known = input.storedEntry && SPANISH_PATHS.includes(input.storedEntry) ? input.storedEntry : published;
    return { action: 'relocate', language: 'es', to: `${known}${input.hash || ''}` };
  }
  if (input.stored === 'en') return { action: 'stay', language: 'en' };
  return { action: 'record', language: 'en' };
}

/** What choosing a language in Settings means: the preference, the entry, and where to go. */
export function languageChoice(language: DisplayLanguage, pathname: string, hash: string): {
  language: DisplayLanguage;
  entry: string;
  to: string;
} {
  const entry = entryPath(language, pathname);
  return { language, entry, to: `${entry}${hash || ''}` };
}

/** The company record keeps one language field; it carries the same answer this preference does. */
export function companyLanguageOf(language: DisplayLanguage): DisplayLanguage {
  return language;
}

/** The browser's own store, when there is one. Everything above stays testable without it. */
export function displayLanguageStore(): PreferenceStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The language this document is showing, read from the document itself and then its address. */
export function currentDisplayLanguage(): DisplayLanguage {
  if (typeof window === 'undefined') return 'en';
  /* THE DOCUMENT IS THE PROOF. An English fallback served at `/cedar/es/` is an English screen,
     and Settings has to name what a person is actually reading rather than what the URL says. */
  if (typeof document !== 'undefined') {
    const declared = document.documentElement.getAttribute('lang');
    if (declared === 'es' || declared === 'en') return declared;
  }
  return entryLanguage(window.location.pathname);
}

/** The Spanish entry this document offers, after the boot has had its say. */
export function offeredSpanishEntry(doc: MetaSource | null | undefined): string | null {
  return spanishUnpublished() ? null : publishedSpanishEntry(doc);
}
