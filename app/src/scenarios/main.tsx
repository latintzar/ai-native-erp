/* The scenarios entry — SAME providers, SAME theme, SAME components as the kit.
 * The linkage is structural: a scenario screen imports src/rocoto/* and reads the theme, so an
 * edit to a kit component or the BRAND block changes every scenario in the same build.
 * `?theme=proof` works here too — the re-brand proof covers the scenarios by construction. */
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { RocotoTheme, PROOF_BRAND, makeTheme } from '../rocoto-theme';
import '../posthog';
import App from './App';

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
