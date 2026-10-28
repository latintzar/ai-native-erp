import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button } from 'baseui/button';
import { EMAIL } from '../../rocoto-theme';
import { FeatureArtwork } from './feature-artwork';
import { CONNECTIONS_EMAIL_HASH, useEmailCapability } from './email-provider';

/* ── ONE PICTURE AND ONE ACT AT EVERY EMAIL ENTRANCE (FEED-IA §247.2) ─────────────────────────
 *
 * «same for emailabout the connection state. always we havbe to be super consistent and not fget
 *  people igo confusing menus when they shouldnt see them»                  — Peter, 11 Sept 2026
 *
 * This is the phone's `phone-call-setup-state` for mail, and deliberately identical in shape: the
 * feature illustration, ONE short sentence, and one button labelled `Connect email`. Checking, a
 * workspace with no mailbox, a mailbox still authorizing and a forwarding address on its own all
 * present exactly this — so a person who presses an email action twice sees the same thing twice,
 * whatever the service is doing.
 *
 * WHAT IT REPLACES IS NEVER THE RECORD. Mail that already arrived stays readable in every posture;
 * what this state stands in place of is the SEND and the MAILBOX controls — Refresh email, Read
 * earlier email, the invoice search and the composer — that the connection does not justify.
 *
 * IT LIVES IN ITS OWN MODULE so that the surfaces which only need the picture — onboarding's
 * channel step, the customer sheet, the connected inbox and Prep's scheduled-email destination —
 * import the illustration, the theme and one capability rather than the whole mailbox stack. A
 * static `import { EmailSetupState } from './email-connection'` beside that file's own
 * `React.lazy` made the lazy boundary inert and pulled email-thread, email-model and the document
 * line table into the chunk that held the importer.
 */
export function EmailSetupState({ onOpenSetup, size = 184, says = 'Connect your mailbox to read and answer customer email.' }: {
  onOpenSetup?: () => void; size?: number; says?: string;
}) {
  const [, theme] = useStyletron();
  const capability = useEmailCapability();
  const open = () => { if (onOpenSetup) { onOpenSetup(); return; } window.location.hash = CONNECTIONS_EMAIL_HASH; };
  return <div data-testid="email-setup-state" data-email-posture={capability.posture}
    style={{ display: 'grid', justifyItems: 'center', gap: theme.sizing.scale500, textAlign: 'center' }}>
    <FeatureArtwork kind="email" size={size} />
    <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0, maxWidth: 320 }}>{says}</p>
    <Button onClick={open} data-testid="email-open-setup" overrides={{ BaseButton: { style: {
      minHeight: '44px', backgroundColor: EMAIL.blue, color: EMAIL.onBlue,
      ':hover': { backgroundColor: `color-mix(in srgb, ${EMAIL.blue} 88%, ${theme.colors.contentPrimary})` },
      ':active': { backgroundColor: `color-mix(in srgb, ${EMAIL.blue} 78%, ${theme.colors.contentPrimary})` },
    } } }}>Connect email</Button>
    {capability.error && <p role="status" data-testid="email-setup-note"
      style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0, maxWidth: 320 }}>{capability.error}</p>}
  </div>;
}
