/* The Spanish app entry — the SAME application as `main.tsx`, in the snapshot's words.
 *
 * The source transform (`Spanish-snapshot.md`) rewrites this file and everything `app-root.tsx`
 * reaches, so the two entries stay one application by construction: a host, a provider or a
 * surface added to the English entry is in the Spanish one on the next build.
 *
 * What this entry adds is the one thing the transform cannot reach — the words Base's own
 * components carry. `LocaleProvider` hands them Spanish, with the datepicker's screen-reader
 * sentence written for this product rather than inherited from the Argentine bundle.
 */
import * as React from 'react';
import LocaleProvider from 'baseui/locale';
import esAR from 'baseui/locale/es_AR';
import { mountCedar } from '../app-root';

const locale = {
  ...esAR,
  datepicker: {
    ...esAR.datepicker,
    screenReaderMessageInput: 'Pulsa la flecha abajo o Intro para elegir una fecha. Pulsa Escape para cerrar el calendario.',
  },
};

mountCedar((app: React.ReactNode) => <LocaleProvider locale={locale}>{app}</LocaleProvider>);
