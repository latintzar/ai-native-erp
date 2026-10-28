import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { RocotoTheme, PROOF_BRAND, makeTheme } from '../../../rocoto-theme';
import { ConnectionsApp } from './app';

// This private entry imports neither the ordinary fixture model nor product analytics.
const theme = new URLSearchParams(window.location.search).get('theme') === 'proof'
  ? makeTheme(PROOF_BRAND) : RocotoTheme;
document.body.style.backgroundColor = theme.colors.backgroundPrimary;
document.body.style.color = theme.colors.contentPrimary;
document.body.style.fontFamily = theme.typography.ParagraphMedium.fontFamily;
const engine = new Styletron();
createRoot(document.getElementById('root')!).render(
  <StyletronProvider value={engine}>
    <BaseProvider theme={theme}><ConnectionsApp /></BaseProvider>
  </StyletronProvider>,
);
