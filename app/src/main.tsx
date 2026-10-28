import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { RocotoTheme, PROOF_BRAND, makeTheme } from './rocoto-theme';
import './posthog';
import App from './kit/App';

/* `?theme=proof` renders the whole kit in a deliberately garish brand — the standing proof that
 * nothing is hard-coded: everything must move, or the unmoved element is a bug. */
const theme = new URLSearchParams(window.location.search).get('theme') === 'proof'
  ? makeTheme(PROOF_BRAND)
  : RocotoTheme;

const engine = new Styletron();
createRoot(document.getElementById('root')!).render(
  <StyletronProvider value={engine}>
    <BaseProvider theme={theme}>
      <App />
    </BaseProvider>
  </StyletronProvider>
);
