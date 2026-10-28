/** Connections groups Banking, Payments and Communications into one card per account.
 * Each card opens the same resumable setup content used by onboarding. Verified provider
 * state owns connection status; additional team numbers and accounting sit beneath the groups.
 * Product architecture: PRODUCT-SPEC.md · founder refinement: FEED-IA §241.
 */
import * as React from 'react';
import { openWhatsAppConnection, useWhatsAppCapability } from '../../whatsapp-connection';
import { WHATSAPP_OTHER_WORKSPACE, whatsappActs, whatsappStatusWord, whatsappWordFor } from '../../whatsapp-capability';
const EmailConnection = React.lazy(() => import('../../email-connection').then(module => ({ default: module.EmailConnection })));
import { useStyletron } from 'baseui';
import { Checkbox, STYLE_TYPE } from 'baseui/checkbox';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Input } from 'baseui/input';
import { OverlayCard, SCRIM } from '../../../../rocoto/overlay-card';
import { useConfig, type ErpTarget } from '../../config';
import { useWorkspaceCapabilities } from '../../workspace-capabilities';
import { List, Row, Section } from '../../rows';
import { anchorFor, anchorId, useSetupTail } from '../../anchors';
import { useGrants } from '../../grants';
import { ROLE_LABEL, memberOf, setCompany, setNumberOwner, useCompany } from '../../company';
/* ONE DRAWING OF A PERSON, IMPORTED FROM WHERE PEOPLE LIVE (§67.1). Team is the person object's
   home (`anchors.tsx`'s HOME_OF), so a number's owner is drawn with TEAM'S chip and never a second
   copy of one — the move Geografía already made for the comercial who holds a zone. */
import { PersonChip } from './team';
import type { AreaMeta } from '../../shell/area';
import { PhoneConnectionDialog } from '../../phone-connection';
import { usePhoneCapability } from '../../phone-runtime';
import { phoneStatusWord } from '../../phone-capability';
import { emailCardWords, emailStatusWord, useEmailCapability } from '../../email-provider';
import { capabilityAvailable } from '../../release-profile';
import { MoneySetup, type MoneySetupKind } from '../../money-setup';
import { useMoney } from '../../money-store';
import { useBankCapability, useInvoicingCapability, useWalletCapability } from '../../money-bank-api';
import { bankStatusWord, invoicingStatusWord, walletStatusWord } from '../../money-bank-capability';
import { ConnectionCard, ConnectionGroup, ConnectionState } from '../../connection-card';
import whatsappBusinessLogo from '../../connections/assets/whatsapp-business.webp';

export const meta: AreaMeta = {
  id: 'connections',
  title: 'Connections',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

const ERP_TARGETS: Array<{ value: ErpTarget; label: string }> = [
  { value: 'sage50', label: 'Sage 50' },
  { value: 'holded', label: 'Holded' },
  { value: 'a3', label: 'A3' },
  { value: 'file', label: 'A file you download' },
];

/** THE ROW'S OWN WORD FOR IT. The chip above can afford «A file you download»; the trailing column
 *  of a row on a 390px phone cannot, and a three-line label beside a two-line value is a row nobody
 *  reads. So the row says the app's own name for the thing and the card says the longer sentence. */
const ERP_NAME: Record<ErpTarget, string> = {
  sage50: 'Sage 50',
  holded: 'Holded',
  a3: 'A3',
  file: 'Today’s file',
};


/* ── PUTTING A FACT ON THE CLIPBOARD ──────────────────────────────────────────────────────────
 * Two roads, because one of them is refused often enough to matter: the async clipboard needs a
 * permission a browser may withhold, and the textarea road needs none. The FUNCTION REPORTS WHAT
 * HAPPENED rather than assuming — the act above only says «Copied» on a true, so the app never
 * claims to have handed somebody something it did not.
 */
async function putOnClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* the permission was withheld — the older road below asks for none */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * THE COPY ACT, AND ITS FEEDBACK (§76: «immediate feedback after saving»).
 *
 * A copy is the one act in this seat with no visible result of its own — the clipboard is
 * somewhere else — so the control itself is the receipt: it says what it did, in its own seat,
 * for two seconds, and then it is a Copy button again. No toast, because a toast for a press this
 * small is a second surface appearing over the one the person is reading.
 *
 * IT IS AN ACT IN A ROW OF ACTS, so it wears what they wear (`connect.tsx`'s ConnectAct reasoning,
 * AUDIT-2 C23): the delight §51.20 licenses belongs to the CARD, and a secondary button beside a
 * row is not a plug.
 */
function CopyAct({ text, testid, bare = false }: { text: string; testid: string; bare?: boolean }) {
  const [, theme] = useStyletron();
  const [done, setDone] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  /* A PRESS ON THE WAY OUT MUST NOT WRITE TO A GONE COMPONENT — the seat unmounts on a house
     switch while the two seconds are still running. */
  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const act = (
    <Button
      kind={KIND.secondary}
      size={SIZE.mini}
      data-testid={testid}
      data-copied={done ? 'yes' : 'no'}
      onClick={async () => {
        if (await putOnClipboard(text)) {
          setDone(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setDone(false), 2000);
        }
      }}
    >
      {done ? 'Copied' : 'Copy'}
    </Button>
  );

  /* `bare` is for an act that is already sitting in a trailing seat somebody else built — the
     method rows inside the email door. One wrapper, wherever the seat came from. */
  if (bare) return act;
  return (
    <span style={{ paddingRight: theme.sizing.scale500, flex: '0 0 auto' }}>{act}</span>
  );
}


/** THE THREE MONEY ACCOUNTS, EACH FROM ITS OWN PROVIDER ANSWER (FEED-IA §247.2), mounted only where
 *  Money is on (§247.9). These cards once read the local flags `setup.payments` and
 *  `setup.invoicing`, so a workspace read ✓Connected here while the Money balance fell back to a
 *  projection and the invoice said «Invoicing activation pending»; wallets shared the bank's flag
 *  outright, which one flag can never honestly answer. The hooks live here with the cards, so a
 *  Money-off workspace makes no money-provider read from Connections. */
function MoneyConnections({ scope, onOpen }: { scope: string; onOpen: (kind: MoneySetupKind) => void }) {
  const { state: moneyState } = useMoney(scope);
  const bank = useBankCapability(scope);
  const wallets = useWalletCapability(scope);
  const invoicing = useInvoicingCapability(scope);
  return <>
    <ConnectionGroup name="Banking">
      {/* THE ONE SHORT CARD, MARKED AS ONE. Banking holds a single card, so it is drawn 172 px
          rather than 220; `compact` states that here, where the group's shape is known, rather
          than inside `ConnectionCard` where it was a guess about this testid. */}
      <ConnectionCard name="Bank account" description={bank.accountLabel || moneyState.setup.bankAccountLabel || 'Balances and incoming transfers'}
        logos={['/connection-brands/prometeo.png', `/connection-brands/${bank.bank || moneyState.setup.bank || 'bbva'}.png`]}
        status={bankStatusWord(bank.posture)} connected={bank.posture === 'ready'} compact
        onOpen={() => onOpen('payments')} testId="payment-connection" />
    </ConnectionGroup>
    <ConnectionGroup name="Payments">
      <ConnectionCard name="Yape & Plin" description="Collect into your bank account" logos={['/connection-brands/yape.png', '/connection-brands/plin.png']}
        status={walletStatusWord(wallets.posture)} connected={wallets.posture === 'ready'}
        onOpen={() => onOpen('payments')} testId="wallet-connection" />
      <ConnectionCard name="Electronic invoices" description="Powered by NubeFact" logos={['/connection-brands/nubefact.png']}
        status={invoicingStatusWord(invoicing.posture)} connected={invoicing.posture === 'ready'}
        onOpen={() => onOpen('invoicing')} testId="invoicing-connection" />
    </ConnectionGroup>
  </>;
}

export default function Connections() {
  const [, theme] = useStyletron();
  const { config, derived, set } = useConfig();
  const company = useCompany();
  /* ONE SOURCE FOR WHATSAPP'S STANDING (§246 · §247.2). The card asked `Boolean(state.connection)`
     — the provider's snapshot WITHOUT the workspace check onboarding and the intake both apply —
     so after a house switch it printed ✓Connected while the tile beside it read unconnected, and
     it collapsed five postures into two words: between page load and the first `/state` answer it
     asserted `Connect WhatsApp` about an account that may well be connected, and a half-finished
     Meta walk got the same word as no account at all. */
  const whatsapp = useWhatsAppCapability(derived.cast.sector);
  const grants = useGrants();
  const cast = derived.cast;
  /* SPAIN HIDES MONEY (FEED-IA §247.9). The three money cards, their group headings, their tails
     and their provider reads mount together in `MoneyConnections`, only where Money is on — the
     same shape as `BankMilestone` in setup-progress.tsx and `DeliveryNoteMoney` in
     money-document.tsx, so a Money-off workspace asks the money API nothing from this page. */
  const { money: moneyEnabled } = useWorkspaceCapabilities(config.cast);
  const [moneySetup, setMoneySetup] = React.useState<MoneySetupKind | null>(null);
  /** WHICH DOOR IS STANDING. `email` is the ONE email door (§109.1) — the two mailboxes stopped
   *  being cards of their own and became methods inside it, so there is nothing left to key on a
   *  `MailboxId` here. `inbox` is the suppliers' address, which is paperwork rather than a channel. */
  const [card, setCard] = React.useState<'erp' | 'inbox' | 'number' | null>(null);
  const [draft, setDraft] = React.useState('');
  const [mailSaveError, setMailSaveError] = React.useState('');
  /** WHICH NUMBER IS BEING HANDED TO SOMEBODY. The number itself is the key, because that is what
   *  `setNumberOwner` writes against and a row has no id of its own. */
  const [ownerFor, setOwnerFor] = React.useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = React.useState(false);
  /* ONE SOURCE FOR THE PHONE'S STANDING (§246). This card used to mix the provider's evidence with
     a BROWSER DRAFT — `phoneConfig.prepared` and its drafted `sourceNumber` — so a local flag left
     behind by an abandoned walk could say «Finish activation» about an account with no line, and
     print a number the provider never issued. The live connection is the only witness now. */
  const phone = usePhoneCapability();
  const supplierIntakeAvailable = capabilityAvailable('supplierIntake');

  const erpConfigured = config.erp.target !== 'file';
  /* ONE SOURCE FOR THE MAILBOX'S STANDING (§247.2), exactly as the Phone card above it. This card
     used to mix the provider's evidence with two BROWSER DRAFTS — `config.mailbox.gmail|m365`, the
     house's own switches, and `company.email`, a typed address — so a workspace that had armed a
     switch and never authorized anything read Connected and printed an address the provider never
     saw. The live connection is the only witness now, and its description is the mailbox the
     provider reports. */
  const email = useEmailCapability();

  /* ── THE TAILS THIS SEAT ANSWERS TO ──────────────────────────────────────────────────────
     `erp` is the setup anchor (`anchorFor('erp')`). `email` and `inbox` exist so another surface
     can send a person to a door on THIS seat instead of drawing the offer a second time — which is
     what retires the fifth wash on Stock's incoming log. */
  const tail = useSetupTail('connections');
  React.useEffect(() => {
    if (tail === 'erp') setCard('erp');
    else if (tail === 'email') { setCard(null); setMoneySetup('email'); }
    else if (tail === 'inbox') setCard('inbox');
    else if (tail === 'whatsapp') { setCard(null); setMoneySetup(null); openWhatsAppConnection({ presentation: 'dialog', onClose: () => { window.location.hash = '/admin/connections'; } }); }
    else if (moneyEnabled && (tail === 'payments' || tail === 'invoicing')) { setCard(null); setMoneySetup(tail); }
    else if (moneyEnabled && tail === 'setup') { setCard(null); setMoneySetup('overview'); }
    else if (!moneyEnabled && ['payments', 'invoicing', 'setup'].includes(tail ?? '')) window.location.replace('#/admin/connections');
  }, [tail, moneyEnabled]);

  const openMoneySetup = (kind: MoneySetupKind) => {
    setCard(null);
    setMoneySetup(kind);
    window.location.hash = `/admin/connections/${kind === 'overview' ? 'setup' : kind}`;
  };
  const closeMoneySetup = () => {
    setMoneySetup(null);
    if (['payments', 'invoicing', 'setup', 'email', 'whatsapp'].includes(tail)) window.location.hash = '/admin/connections';
  };

  React.useEffect(() => { if (card === 'inbox') { setDraft(config.emailFeed.address); setMailSaveError(''); } }, [card, config.emailFeed.address]);

  return (
    <div
      data-testid="seat-connections"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      {moneyEnabled && <MoneyConnections scope={config.cast} onOpen={openMoneySetup} />}
      <ConnectionGroup name="Communications">
        {/* ⚠ THE NUMBER UNDER THE NAME IS THE PROVIDER'S, NEVER THE TEAM LIST'S. It used to fall
            back to `company.whatsapp[0]?.number`, so an unconnected card displayed a number a
            person had typed into Team numbers as though Meta had issued it. */}
        {/* ── AND `partial` HAS TWO CAUSES WITH ONE ACT BETWEEN THEM (review finding 7) ──────
            An interrupted Meta walk resumes at «Finish setup» through this card's own door. An
            account an operator bound to ANOTHER workspace reads the same posture with no such
            step behind it — the binding is `CEDAR_PROOF_WORKSPACE_BINDINGS`, and
            `Store.bind_workspace` keeps an existing one where it is — so the door led back to
            the same answer. That one says where the account IS set up, and stands still. */}
        {whatsappActs(whatsapp)
          ? <ConnectionCard name="WhatsApp Business" description={whatsapp.number || 'Messages, orders and history'}
            logos={[whatsappBusinessLogo]} status={whatsappWordFor(whatsapp)} connected={whatsapp.posture === 'ready'}
            onOpen={() => openMoneySetup('whatsapp')} testId="whatsapp-connection-setup" />
          : <ConnectionState name="WhatsApp Business" logos={[whatsappBusinessLogo]}
            says={whatsappWordFor(whatsapp)} testId="whatsapp-connection-setup" />}
        <ConnectionCard name="Email" description={emailCardWords(email)}
          logos={['/connection-brands/gmail.png', '/connection-brands/microsoft.png']} status={emailStatusWord(email.posture)} connected={email.posture === 'ready'}
          onOpen={() => openMoneySetup('email')} testId="connect-email" />
        <ConnectionCard name="Phone" description={phone.callerId || company.phone} logos={['/connection-brands/twilio.png']}
          status={phoneStatusWord(phone.posture)} connected={phone.posture === 'ready'}
          onOpen={() => setPhoneOpen(true)} testId="phone-rail" />
      </ConnectionGroup>
      <details data-testid="connection-more-settings">
        <summary style={{ ...theme.typography.LabelMedium, cursor: 'pointer', minHeight: 48, display: 'flex', alignItems: 'center' }}>More connections</summary>
        <div style={{ display: 'grid', gap: theme.sizing.scale700, paddingTop: theme.sizing.scale600 }}>
          {/* ── TEAM NUMBERS SIT BEHIND THE WHATSAPP POSTURE (§247.2) ────────────────────────
              «not fget people igo confusing menus when they shouldnt see them» — a workspace with
              no WhatsApp connection could add WhatsApp lines and assign owners to them: a whole
              configuration surface for a channel that does not exist. Connected, the section
              stands as it always has; otherwise its place is taken by the one act that leads
              somewhere, which is the same act the card, the inbox and the composer offer. */}
          <Section title="Team numbers" actions={whatsapp.posture === 'ready'
            ? <Button kind={KIND.secondary} size={SIZE.compact} data-testid="add-number" onClick={() => { setDraft(''); setCard('number'); }}>Add number</Button>
            : undefined}>
            {whatsapp.posture === 'ready'
              ? <List testid="team-number-rows">{company.whatsapp.map((w, i) => <Row key={w.number} testid={i === 0 ? 'whatsapp' : `whatsapp-${i}`} mark="chat" label={w.number}
                sub={w.owner ? memberOf(company, w.owner)?.name : 'Assign a team member'} onOpen={() => setOwnerFor(w.number)} />)}</List>
              : <div data-testid="team-numbers-setup" data-whatsapp-posture={whatsapp.posture}
                data-acts={whatsappActs(whatsapp) ? 'yes' : 'no'}
                style={{ display: 'grid', gap: theme.sizing.scale400, justifyItems: 'start' }}>
                {/* The guard says the same thing the card beside it says, in the same words: an
                    account bound to another workspace states where it is set up, and the act
                    that opens Meta's walk stands only where that walk is the step that is left. */}
                <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>
                  {whatsappActs(whatsapp) ? 'Team numbers open once WhatsApp Business is connected.' : WHATSAPP_OTHER_WORKSPACE}</p>
                {whatsappActs(whatsapp) && <Button kind={KIND.secondary} size={SIZE.compact} data-testid="team-numbers-connect" onClick={() => openMoneySetup('whatsapp')}>{whatsappStatusWord(whatsapp.posture)}</Button>}
              </div>}
          </Section>
          <Section title="Documents and accounting">
            <List testid="accounting-rows">
              <Row testid="email-address" mark="at" label="Supplier inbox" value={config.emailFeed.address || 'Add address'} onOpen={() => setCard('inbox')} />
              <Row id={anchorId('erp')} testid="erp-target" mark="erp" label="Accounting system" value={ERP_NAME[config.erp.target]} onOpen={() => setCard('erp')} />
              <Row testid="gestoria" mark="export" label="Accountant exports" value={derived.erp.fileLabel} onOpen={() => { window.location.hash = anchorFor('erp'); }} />
            </List>
          </Section>
        </div>
      </details>

      <OverlayCard
        isOpen={card !== null}
        onClose={() => setCard(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Connection"
      >
        {card === 'erp' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Choose your ERP</h2>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
                Prepare the system and its mapping. Files remain the only active export until a provider connection is verified.
              </p>
            </div>
            <div style={{ display: 'flex', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              {ERP_TARGETS.map((t) => (
                <span key={t.value} data-erp={t.value} data-selected={config.erp.target === t.value ? 'yes' : 'no'}>
                  <Button
                    kind={config.erp.target === t.value ? KIND.primary : KIND.secondary}
                    size={SIZE.compact}
                    onClick={() => set({ erp: { target: t.value } })}
                    data-testid={`erp-${t.value}`}
                  >
                    {t.label}
                  </Button>
                </span>
              ))}
            </div>
            <div>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setCard(null)} data-testid="erp-done">
                Done
              </Button>
            </div>
          </div>
        ) : card === 'number' ? (
          /* ── ANOTHER LINE ON THE SAME HOUSE (§22.5) ──────────────────────────────────────
             One field, because a number is one fact. Who answers it is asked NEXT, on the row it
             lands as — which is the app's own rhythm everywhere else: the thing is made, then it
             is given to somebody. */
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Add a number</h2>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
                Save the number, then choose who answers.
              </p>
            </div>
            <Input
              value={draft}
              onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
              placeholder="+34 600 00 00 00"
              aria-label="The number"
              overrides={{ Input: { props: { 'data-testid': 'number-input' } } }}
            />
            <div>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                disabled={draft.replace(/\D/g, '').length < 9}
                data-testid="number-save"
                onClick={() => {
                  const number = draft.trim();
                  setCompany((c) => ({ whatsapp: [...c.whatsapp, { number }] }));
                  setCard(null);
                  /* THE NEXT QUESTION, ASKED WHERE IT ARISES (§76: one clear task at a time). */
                  setOwnerFor(number);
                }}
              >
                Add it
              </Button>
            </div>
          </div>
        ) : card === 'inbox' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>The suppliers’ address</h2>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
                Prepare the supplier address. Mail arrives once provider activation is verified.
              </p>
            </div>
            <Input
              value={draft}
              onChange={(e) => setDraft((e.target as HTMLInputElement).value)}
              placeholder="pedidos@tucasa.es"
              aria-label="Address"
              overrides={{ Input: { props: { 'data-testid': 'email-address-input' } } }}
            />
            {mailSaveError && <span role="alert" data-testid="supplier-address-save-error" style={{ ...theme.typography.ParagraphSmall, color: theme.colors.negative }}>{mailSaveError}</span>}
            <div>
              <Button
                kind={KIND.primary}
                size={SIZE.compact}
                data-testid="email-address-save"
                onClick={() => {
                  if (set({ emailFeed: { ...config.emailFeed, address: draft.trim(), connected: false } })) {
                    setMailSaveError('');
                    setCard(null);
                  } else {
                    setMailSaveError('Saving this address stalled. Keep this window open and try again.');
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>

      {/* ── WHO ANSWERS A NUMBER — the roster, as a choice (§22.6 · §3's last clause) ─────────
          IT IS THE ESCALATION MAP'S OWN PICKER, drawn the same way: a pill per person, the one
          holding it in the primary kind. A second picker for the same roster is the place two
          surfaces would start disagreeing about who is on the team.

          «EVERYBODY» IS A REAL ANSWER AND NOT A CLEARING. A house's main line usually is
          everybody's — which is why `WhatsAppLine.owner` is absent rather than false — so the
          option says what is true of that line instead of asking somebody to un-pick a person. */}
      <OverlayCard
        isOpen={ownerFor !== null}
        onClose={() => setOwnerFor(null)}
        scrim={SCRIM.dim}
        size={520}
        ariaLabel="Who answers this number"
      >
        {ownerFor !== null ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
            <div>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>Who answers {ownerFor}</h2>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '52ch' }}>
                What {company.agent.name} hands over on this line reaches them first.
              </p>
            </div>
            <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
              {(() => {
                const held = company.whatsapp.find((w) => w.number === ownerFor)?.owner;
                return (
                  <>
                    <span data-selected={held ? 'no' : 'yes'}>
                      <Button
                        kind={held ? KIND.secondary : KIND.primary}
                        shape={SHAPE.pill}
                        size={SIZE.compact}
                        data-testid="number-owner-everybody"
                        onClick={() => setNumberOwner(ownerFor, undefined)}
                      >
                        Everybody
                      </Button>
                    </span>
                    {company.members.map((m) => (
                      <span key={m.id} data-selected={held === m.id ? 'yes' : 'no'}>
                        <Button
                          kind={held === m.id ? KIND.primary : KIND.secondary}
                          shape={SHAPE.pill}
                          size={SIZE.compact}
                          data-testid={`number-to-${m.id}`}
                          onClick={() => setNumberOwner(ownerFor, m.id)}
                        >
                          {m.name}
                        </Button>
                      </span>
                    ))}
                  </>
                );
              })()}
            </div>
            <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setOwnerFor(null)} data-testid="number-owner-done">
                Done
              </Button>
              {/* TAKING A LINE OFF. The house's OWN number is the first one and it stays — it is
                  the number on the company card, and the honest way to stop using it is to change
                  it there rather than to delete a row that is really a field. */}
              {company.whatsapp.length > 1 && company.whatsapp[0]?.number !== ownerFor && (
                <Button
                  kind={KIND.tertiary}
                  size={SIZE.mini}
                  shape={SHAPE.pill}
                  data-testid="number-remove"
                  onClick={() => {
                    setCompany((c) => ({ whatsapp: c.whatsapp.filter((w) => w.number !== ownerFor) }));
                    setOwnerFor(null);
                  }}
                >
                  Take this line off
                </Button>
              )}
            </div>
          </div>
        ) : (
          <span />
        )}
      </OverlayCard>

      <PhoneConnectionDialog
        isOpen={phoneOpen}
        onClose={() => setPhoneOpen(false)}
        tenant={cast.sector}
        sourceNumber={company.phone}
        members={company.members}
        officeHours={company.hours.office}
      />
      {moneySetup === 'email' && <React.Suspense fallback={<p>Opening email setup…</p>}><EmailConnection scope={cast.sector} presentation="dialog" onClose={closeMoneySetup} /></React.Suspense>}
      {moneySetup && moneySetup !== 'email' && moneySetup !== 'whatsapp' && <MoneySetup key={`${config.cast}:${moneySetup}`} kind={moneySetup} presentation="dialog" onClose={closeMoneySetup} />}
    </div>
  );
}
