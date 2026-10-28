import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider } from 'baseui';
import { RocotoTheme } from '../../../rocoto-theme';
import { ChannelsCheck } from './app';

/* The focused check page for the phone and email rails: the same origin, the same channel
 * workspace and the same runtime as Cedar, with one walk per provider and the evidence beside it.
 * It imports neither the fixture model nor product analytics. */
const theme = RocotoTheme;
document.body.style.backgroundColor = theme.colors.backgroundPrimary;
document.body.style.color = theme.colors.contentPrimary;
document.body.style.fontFamily = theme.typography.ParagraphMedium.fontFamily;
const engine = new Styletron();
createRoot(document.getElementById('root')!).render(
  <StyletronProvider value={engine}>
    <BaseProvider theme={theme}><ChannelsCheck /></BaseProvider>
  </StyletronProvider>,
);
