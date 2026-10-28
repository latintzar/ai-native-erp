import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND } from 'baseui/button';
import { Check, ChevronRight, Landmark, MessageCircle } from 'lucide-react';
import type { Cast } from '../../scenarios/data/cast';
import { useBankCapability } from './money-bank-api';
import { useWhatsAppCapability } from './whatsapp-connection';
import { useEmailCapability } from './email-provider';
import { usePhoneCapability } from './phone-runtime';
import { communicationReady, connectedChannelsOf } from './onboarding-model';
import { useWorkspaceCapabilities } from './workspace-capabilities';
import { ProgressRing } from './activation-web';
import { WorkflowDialog } from './workflow-dialog';

type Milestone = {
  title: string; detail: string; Icon: typeof Landmark; complete: boolean; hash: string; posture: string;
};

/* ── THE RING COUNTS WHAT THIS WORKSPACE HAS (FEED-IA §247.9) ──────────────────────────────────
 * «also ensure you have the good spain / peru toggle which in spains case hides the money shit»
 *                                                                      — Peter, 13 September 2026
 * A Spanish workspace keeps no bank account here, so a bank milestone in this ring was a second of
 * two that could never close and a door into an area with no seat — the card offered
 * `#/money/setup/payments`, which the router sends home. With Money off the ring counts its one
 * milestone, the order channel, and says so.
 *
 * AND THE PROVIDER READ GOES WITH THE MILESTONE. `useBankCapability` asks the money API for this
 * workspace's bank posture on mount, and this card sits in the rail of every desk screen — so a
 * workspace with Money off would have gone on asking Money a question whose answer it never shows.
 * The hook lives in `BankMilestone`, which mounts only where the milestone does.
 */
export function OnboardingCard({ cast, open }: { cast: Cast; open: boolean }) {
  const { money } = useWorkspaceCapabilities(cast.sector);
  return money
    ? <BankMilestone cast={cast} open={open} />
    : <SetupCard cast={cast} open={open} bank={[]} />;
}

function BankMilestone({ cast, open }: { cast: Cast; open: boolean }) {
  /* THE BANK MILESTONE IS THE BANK CARD'S OWN ANSWER (§246 · §247.2). It read
     `money.setup.payments === 'demo-connected'` — a local flag — while Settings → Connections read
     the live `bankCapabilityOf`, so one workspace could show ✓ here and `Connect bank` there. */
  const bank = useBankCapability(cast.sector);
  const ready = bank.posture === 'ready';
  return <SetupCard cast={cast} open={open} bank={[{
    title: 'Bank account', detail: 'Balances and payments', Icon: Landmark,
    complete: ready, hash: '#/money/setup/payments', posture: ready ? 'ready' : 'setup',
  }]} />;
}

/** Essential setup is the milestones this workspace keeps: the order channel always, the bank
 * account where Money is on. Additional business data has its own settings doors. */
function SetupCard({ cast, open, bank }: { cast: Cast; open: boolean; bank: Milestone[] }) {
  const [css, theme] = useStyletron();
  const whatsapp = useWhatsAppCapability(cast.sector);
  const email = useEmailCapability();
  const phone = usePhoneCapability();
  const [visible, setVisible] = React.useState(false);
  /* §246 · §247.2 — ONE PREDICATE, THREE PROVIDERS, AND NO LOCAL ROW WITH A VOTE.
     This milestone used to read `state.channels.some(status === 'connected' || 'sample' ||
     'prepared')` as well, so a row written by the Meta test-data walk or by demo-welcome painted a
     ✓ on a workspace with nothing connected, and a half-finished phone walk read `Ready`. It also
     never asked the phone at all, so a commissioned, caller-ID-verified line read 0 of 2 while the
     onboarding tile on the very next screen read that same line as connected. Both surfaces call
     `communicationReady` now, over the three live capabilities and nothing else. */
  const connected = connectedChannelsOf({ whatsappBound: whatsapp.bound, emailConnected: email.posture === 'ready', phoneReady: phone.posture === 'ready' });
  const communication = communicationReady(connected);
  const milestones: Milestone[] = [...bank, {
    title: 'Communication', detail: 'WhatsApp, email or phone', Icon: MessageCircle,
    complete: communication, hash: '#/admin/connections', posture: communication ? 'ready' : 'setup',
  }];
  const total = milestones.length;
  const done = milestones.filter(item => item.complete).length;
  const link = (hash: string) => { setVisible(false); window.location.hash = hash; };
  return <>
    <button type="button" data-testid="journey-card" data-of={total} data-done={done} data-journey={open ? 'expanded' : 'collapsed'}
      data-communication={communication ? 'ready' : 'setup'} data-whatsapp-posture={whatsapp.posture}
      data-bank={bank[0]?.posture}
      aria-label={`Business setup · ${done} of ${total} complete`} onClick={() => setVisible(true)} className={css({
        display: 'flex', alignItems: 'center', justifyContent: open ? 'flex-start' : 'center', gap: theme.sizing.scale400,
        width: open ? '100%' : '44px', minWidth: '44px', minHeight: '44px', flexShrink: 0,
        padding: open ? theme.sizing.scale500 : 0, textAlign: 'left', cursor: 'pointer',
        backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary,
        border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300,
        ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' },
      })}>
      <ProgressRing done={done} of={total} size={28} />
      {open && <span style={{ display: 'grid', gap: theme.sizing.scale200 }}><strong style={theme.typography.LabelSmall}>Business setup</strong>
        <span data-testid="journey-next" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{done === total ? 'Ready' : `${done} of ${total} complete`}</span></span>}
    </button>
    {visible && <WorkflowDialog title="Business setup" onClose={() => setVisible(false)} testId="setup-progress">
      <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
        {milestones.map(item => <button key={item.title}
            onClick={() => link(item.hash)} style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, padding: theme.sizing.scale600,
              textAlign: 'left', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, cursor: 'pointer',
              color: theme.colors.contentPrimary, backgroundColor: theme.colors.backgroundPrimary }}>
            <item.Icon size={28} strokeWidth={1.6} aria-hidden /><span style={{ display: 'grid', flex: 1, gap: theme.sizing.scale200 }}>
              <strong style={theme.typography.LabelLarge}>{item.title}</strong><span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{item.detail}</span>
            </span>{item.complete ? <Check size={20} aria-label="Ready" /> : <ChevronRight size={20} aria-hidden />}
          </button>)}
        <details><summary style={{ ...theme.typography.LabelSmall, minHeight: 44, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>Business details and imports</summary>
          <div style={{ display: 'grid', gap: theme.sizing.scale300 }}>
            <Button kind={KIND.tertiary} onClick={() => link('#/admin/business')}>Business details</Button>
            <Button kind={KIND.tertiary} onClick={() => link('#/onboarding/catalogue')}>Product catalogue</Button>
            <Button kind={KIND.tertiary} onClick={() => link('#/onboarding/history')}>Invoice history</Button>
            <Button kind={KIND.tertiary} onClick={() => link('#/welcome')}>Open setup</Button>
          </div>
        </details>
      </div>
    </WorkflowDialog>}
  </>;
}
