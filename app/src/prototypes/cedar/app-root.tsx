/* THE ONE MOUNT, SHARED BY BOTH ENTRIES.
 *
 * Cedar has two built entries — `app.html` in English and `app-spanish.html` generated from the
 * same source (`Spanish-snapshot.md`) — and for a while they mounted different applications. The
 * Spanish one had no collection sync, no WhatsApp, email or phone host, and still carried a front
 * door the English one had dropped. A demo in Spanish was therefore a different product.
 *
 * So the providers, the hosts and the boot decision live here, once. An entry supplies only what
 * is genuinely its own: the Spanish entry adds Base's `es` locale for the components that carry
 * their own words (the datepicker), and nothing else.
 *
 * `?theme=proof` works here too, so the re-brand proof covers the app by construction: open the
 * app under the proof brand and every surface, chip, ghost and albarán tile must move.
 */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import './motion.css';
import './setup-frame.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { RocotoTheme, PROOF_BRAND, makeTheme } from '../../rocoto-theme';
import '../../posthog';
import { ConfigProvider } from './config';
import App from './App';
import { companyNow, setCompany } from './company';
import {
  bootDecision, companyLanguageOf, currentDisplayLanguage, displayLanguageStore, documentLanguageOf,
  markSpanishUnpublished, publishedSpanishEntry, readDisplayLanguage, readSpanishEntry,
  writeDisplayLanguage, writeSpanishEntry, type DisplayLanguage,
} from './display-language';
/* ── THE LAYER THAT STANDS ABOVE THE APP (FEED-IA §102.1 · §105) ──────────────────────────────
 * The chapter divider is not chrome of any surface and not chrome of the frame: it has to SURVIVE
 * the navigation it performs. So it is a sibling of the router, under the same theme and the same
 * config, and nothing the router does can take it away. */
import { ChapterHost } from './activation-web';
const OrderPaymentSync = React.lazy(() => import('./order-payment-sync'));
const CollectionSync = React.lazy(() => import('./money-sync'));
const WhatsAppConnectionHost = React.lazy(() => import('./whatsapp-connection'));
const WhatsAppIntake = React.lazy(() => import('./whatsapp-intake').then(module => ({ default: module.WhatsAppIntake })));
const PhoneCallController = React.lazy(() => import('./phone-controller').then(module => ({ default: module.PhoneCallController })));
const EmailConnectionHost = React.lazy(() => import('./email-connection').then(module => ({ default: module.EmailConnectionHost })));
const EmailIntake = React.lazy(() => import('./email-intake').then(module => ({ default: module.EmailIntake })));
const PhoneIntake = React.lazy(() => import('./phone-intake').then(module => ({ default: module.PhoneIntake })));

/* THE LANGUAGE IS SETTLED BEFORE A PIXEL IS DRAWN. A stored Castellano on the English entry is a
 * navigation, so it replaces the address rather than pushing one: Back goes where the person came
 * from, not into a loop between the two entries. Returns true when this document is leaving.
 *
 * TWO FACTS THE DOCUMENT ITSELF CARRIES, AND THE BOOT READS BOTH. The marker says which Spanish
 * entry this build published — a build that published none (`make dev`, the kit gallery, an older
 * artifact) keeps the person on Cedar rather than sending them to a path the server answers with
 * something else. `lang` says what the server actually served, so a Spanish address answering
 * English is recognised as a fallback instead of being presented as Castellano. */
function settleDisplayLanguage(): boolean {
  const store = displayLanguageStore();
  const decision = bootDecision({
    pathname: window.location.pathname,
    hash: window.location.hash,
    stored: readDisplayLanguage(store),
    storedEntry: readSpanishEntry(store),
    published: publishedSpanishEntry(document),
    documentLanguage: documentLanguageOf(document.documentElement.getAttribute('lang')),
  });
  if (decision.action === 'relocate') {
    window.location.replace(decision.to);
    return true;
  }
  if (decision.action === 'unpublished') {
    /* The address says Spanish and the document answers English: this origin serves no Spanish
       entry. English is recorded so the next load stops travelling, and Settings offers English
       alone for the rest of this page's life. */
    markSpanishUnpublished();
    writeDisplayLanguage(store, 'en');
  }
  if (decision.action === 'record') {
    writeDisplayLanguage(store, decision.language);
    if (decision.language === 'es') writeSpanishEntry(store, window.location.pathname);
  }
  /* ONE LANGUAGE, TWO RECORDS, SAME ANSWER. The company record carries a language field that
     Account reads back to a person. The document being served is the fact, so the field follows
     it — including when a Spanish address was answered with the English document. */
  const showing: DisplayLanguage = currentDisplayLanguage();
  if (companyNow().language !== companyLanguageOf(showing)) setCompany({ language: companyLanguageOf(showing) });
  return false;
}

/** Mount Cedar. `wrap` sits inside the theme and above the config, for an entry's own locale. */
export function mountCedar(wrap: (app: React.ReactNode) => React.ReactNode = (app) => app): void {
  if (settleDisplayLanguage()) return;

  const theme = new URLSearchParams(window.location.search).get('theme') === 'proof'
    ? makeTheme(PROOF_BRAND)
    : RocotoTheme;
  const engine = new Styletron();
  const app = (
    <ConfigProvider>
      <App />
      <React.Suspense fallback={null}><CollectionSync /><OrderPaymentSync /></React.Suspense>
      <React.Suspense fallback={null}><WhatsAppConnectionHost /><WhatsAppIntake /></React.Suspense>
      <React.Suspense fallback={null}><PhoneCallController /></React.Suspense>
      <React.Suspense fallback={null}><EmailConnectionHost /><EmailIntake /></React.Suspense>
      <React.Suspense fallback={null}><PhoneIntake /></React.Suspense>
      <ChapterHost />
    </ConfigProvider>
  );
  createRoot(document.getElementById('root')!).render(
    <StyletronProvider value={engine}>
      <BaseProvider theme={theme}>{wrap(app)}</BaseProvider>
    </StyletronProvider>
  );
}
