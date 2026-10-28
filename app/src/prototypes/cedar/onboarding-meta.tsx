import { Avatar } from 'baseui/avatar';
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Modal, SIZE } from 'baseui/modal';
import { Button, KIND } from 'baseui/button';
import { Input } from 'baseui/input';
import { Check, ChevronDown, Ellipsis, Phone, Share2, ShoppingBag } from 'lucide-react';
import { useWorkflowViewport } from './workflow-dialog';

/* ── THIS SCREEN IMITATES META'S OWN CHROME, AND IT SAYS SO ONCE (FEED-IA §246) ────────────────
 * «The flow of connecting should be a single question, a single form prompt … single steps, so it
 *  doesn't even give the extra info.»                                          — Peter, 2026-09-10
 *
 * `phone-setup.tsx` met that rule by cutting the explanatory paragraph under every field: that is
 * CEDAR'S setup voice, and Cedar owns those words. This walk is a different object — a preview of
 * Meta's Embedded Signup, drawn from a captured Meta reference: its step list, its order, its
 * review screens and its blue are Meta's, and rewriting them would make the preview a worse
 * likeness of the thing a person will actually meet. So the frame states what it is, once, at the
 * top, and the steps stay as Meta wrote them. Cedar's own steps ask one question each.
 *
 * ⚠ THAT LAST SENTENCE BELONGS HERE AND NOWHERE ELSE. It shipped as the note's second sentence —
 * a rule about OTHER screens, told to a person standing in front of a five-step provider wizard,
 * at the moment the screen in front of them is the busiest one in Cedar. The note names the thing
 * it is on, and stops. */
const FRAME_NOTE = 'Meta’s own setup, drawn from its reference.';
const STEPS = ['Phone number', 'WhatsApp Business Profile', 'Business assets', 'Share chats', 'WhatsApp Business account'];
const metaBlue = '#0866ff'; // theme-gate-allow: Meta's captured provider brand, independent of Rocoto's theme.
const storageKey = (scope: string) => `rocoto-cedar-meta-preview-v1:${scope}`;
type Draft = { step: number; phone: string; business: string; share: boolean };
function restore(scope: string, phone: string, business: string): Draft {
  const initial = { step:0,phone,business,share:false };
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey(scope)) || 'null') as Partial<Draft> | null;
    if (raw && Number.isInteger(raw.step) && Number(raw.step) >= 0 && Number(raw.step) < STEPS.length
      && typeof raw.phone === 'string' && raw.phone.length <= 40 && typeof raw.business === 'string' && raw.business.length <= 160
      && typeof raw.share === 'boolean') return raw as Draft;
  } catch { /* Begin with the supplied sample profile when an earlier preview is unreadable. */ }
  return initial;
}

export function MetaOnboardingPreview({ scope, phone, businessName, onClose, onComplete, restart = false }: {
  scope: string; phone: string; businessName: string; onClose: () => void; onComplete: (phone: string) => void;
  restart?: boolean;
}) {
  const [css, theme] = useStyletron();
  const viewport = useWorkflowViewport(true);
  const [draft, setDraft] = React.useState(() => restart ? { step:0, phone, business:businessName, share:false } : restore(scope, phone, businessName));
  const [error, setError] = React.useState('');
  const heading = React.useId();
  const save = (next: Draft) => {
    try { localStorage.setItem(storageKey(scope), JSON.stringify(next)); }
    catch { setError('Allow browser storage, then continue this setup preview.'); return false; }
    setDraft(next); setError(''); return true;
  };
  const next = () => {
    if (draft.step === 0 && draft.phone.replace(/\D/g, '').length < 7) { setError('Enter the business phone number with its country code.'); return; }
    if (draft.step === 2 && !draft.business.trim()) { setError('Enter the business portfolio name.'); return; }
    if (draft.step < STEPS.length - 1) save({ ...draft, step:draft.step + 1 });
    else if (save(draft)) onComplete(draft.phone);
  };
  const small = { ...theme.typography.ParagraphSmall, color:theme.colors.contentSecondary, margin:0 };
  return <Modal isOpen onClose={onClose} size={SIZE.auto} autoFocus returnFocus animate={false} overrides={{
    Dialog: { props: { 'aria-labelledby':heading, 'data-testid':'meta-onboarding-dialog' }, style: {
      width:'920px', maxWidth:'calc(100vw - 24px)', maxHeight:`calc(${viewport || window.innerHeight}px - 24px)`,
      overflowY:'auto', marginTop:'12px', marginBottom:'12px', borderRadius:theme.borders.radius400,
    } }, DialogContainer: { style: { alignItems:'center' } }, Close: { props: { 'aria-label':'Close Meta setup preview' }, style: { minWidth:'44px',minHeight:'44px' } },
  }}>
    <div data-meta-step={draft.step} style={{ minWidth:0 }}>
      <header style={{ display:'flex', alignItems:'center', gap:theme.sizing.scale300, padding:`${theme.sizing.scale600} ${theme.sizing.scale700}`,
        borderBottom:`1px solid ${theme.colors.borderOpaque}`, paddingRight:theme.sizing.scale1600 }}>
        <img src="/connection-brands/meta-reference/facebook.svg" alt="Facebook" width={22} height={22} />
        <span style={theme.typography.LabelMedium}>Facebook Login for Business</span><ChevronDown size={16} aria-hidden />
      </header>
      <p data-testid="meta-frame-note" style={{ ...small, margin:0, padding:`${theme.sizing.scale400} ${theme.sizing.scale700}`,
        borderBottom:`1px solid ${theme.colors.borderOpaque}` }}>{FRAME_NOTE}</p>
      <div className={css({ display:'grid', gridTemplateColumns:'220px minmax(0, 1fr)', minHeight:'450px',
        '@media (max-width: 650px)': { gridTemplateColumns:'minmax(0, 1fr)', gridTemplateRows:'auto minmax(0, 1fr)', minHeight:'360px' } })}>
        <nav aria-label="WhatsApp setup steps" className={css({ padding:theme.sizing.scale700, borderRight:`1px solid ${theme.colors.borderOpaque}`,
          '@media (max-width: 650px)': { padding:theme.sizing.scale500, borderRight:0, borderBottom:`1px solid ${theme.colors.borderOpaque}` } })}>
          <ol className={css({ listStyle:'none', margin:0, padding:0, display:'grid', gap:theme.sizing.scale700,
            '@media (max-width: 650px)': { display:'flex', gap:theme.sizing.scale400, overflowX:'auto' } })}>
            {STEPS.map((step,index) => <li key={step} aria-current={index === draft.step ? 'step' : undefined}
              className={css({ display:'flex', alignItems:'flex-start', gap:theme.sizing.scale400,
                '@media (max-width: 650px)': { flex:'0 0 auto', alignItems:'center', maxWidth:index === draft.step ? '240px' : '22px', overflow:'hidden' } })}>
              <span style={{ width:20,height:20,display:'grid',placeItems:'center',borderRadius:'50%', flexShrink:0,
                border:`1px solid ${index <= draft.step ? metaBlue : theme.colors.borderOpaque}`,
                backgroundColor:index < draft.step ? metaBlue : theme.colors.backgroundPrimary,
                color:index < draft.step ? theme.colors.contentOnColor : metaBlue, ...theme.typography.LabelXSmall }}>{index < draft.step ? <Check size={13} aria-hidden /> : index + 1}</span>
              <span style={{ ...theme.typography.LabelSmall, color:index === draft.step ? metaBlue : theme.colors.contentSecondary }}>{step}</span>
            </li>)}
          </ol>
        </nav>
        <main style={{ padding:'clamp(24px, 5vw, 48px)', display:'grid', alignContent:'start', gap:theme.sizing.scale700, minWidth:0 }}>
          <h2 id={heading} style={{ ...theme.typography.HeadingSmall, margin:0 }}>{draft.step === 0 ? 'Add your phone number' : draft.step === 1 ? 'Verify your account details'
            : draft.step === 2 ? 'Choose your business assets' : draft.step === 3 ? 'Share chats with Rocoto' : 'Review your WhatsApp Business account'}</h2>
          {draft.step === 0 && <><p style={small}>The number your customers use for WhatsApp orders.</p><Input value={draft.phone} type="tel" autoComplete="tel"
            aria-label="WhatsApp phone number" maxLength={40} onChange={event => save({ ...draft,phone:event.currentTarget.value })}
            overrides={{ Input:{ props:{ 'data-testid':'meta-phone' } } }} /></>}
          {draft.step === 1 && <>
            <p style={small}>Review the profile linked to this phone number.</p>
            <div style={{ display:'grid', justifyItems:'center', gap:theme.sizing.scale400, padding:theme.sizing.scale600 }}>
              <Avatar name={draft.business} size="88px" />
              <strong style={theme.typography.HeadingXSmall}>{draft.business}</strong><span style={small}>{draft.phone}</span>
              <div style={{ display:'flex',justifyContent:'center',gap:theme.sizing.scale700,paddingTop:theme.sizing.scale400 }}>
                {([{name:'Call',Icon:Phone},{name:'Catalog',Icon:ShoppingBag},{name:'Share',Icon:Share2},{name:'Other',Icon:Ellipsis}]).map(({name,Icon}) => <span key={name}
                  style={{ display:'grid',justifyItems:'center',gap:theme.sizing.scale200,...theme.typography.ParagraphXSmall }}><Icon size={20} aria-hidden />{name}</span>)}
              </div>
            </div>
          </>}
          {draft.step === 2 && <><p style={small}>Choose the business portfolio for this WhatsApp account.</p><Input value={draft.business} maxLength={160}
            aria-label="Business portfolio" onChange={event => save({ ...draft,business:event.currentTarget.value })}
            overrides={{ Input:{props:{'data-testid':'meta-business'}} }} /></>}
          {draft.step === 3 && <><p style={small}>Your approved chats will appear beside the orders they create.</p>
            <label style={{ display:'flex',gap:theme.sizing.scale400,alignItems:'flex-start',...theme.typography.ParagraphMedium }}>
              <input type="checkbox" checked={draft.share} onChange={event => save({ ...draft,share:event.currentTarget.checked })}
                data-testid="meta-share-chats" style={{ width:20,height:20,flexShrink:0,marginTop:3 }} /><span>Share chats with Rocoto</span>
            </label></>}
          {draft.step === 4 && <div style={{ display:'grid',gap:theme.sizing.scale500,padding:theme.sizing.scale600,border:`1px solid ${theme.colors.borderOpaque}`,borderRadius:theme.borders.radius300 }}>
            <strong style={theme.typography.LabelLarge}>{draft.business}</strong><span style={small}>{draft.phone}</span>
            <span style={{ ...theme.typography.LabelSmall,display:'flex',gap:theme.sizing.scale300,alignItems:'center' }}><Check size={16} aria-hidden />Setup complete</span>
          </div>}
          {error && <p role="alert" style={{ ...small,color:theme.colors.negative }}>{error}</p>}
        </main>
      </div>
      <footer className={css({ display:'flex',gap:theme.sizing.scale400,alignItems:'center',justifyContent:'flex-end',flexWrap:'wrap',
        padding:`${theme.sizing.scale500} ${theme.sizing.scale700}`,borderTop:`1px solid ${theme.colors.borderOpaque}`,
        '@media (max-width: 650px)': { display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',padding:theme.sizing.scale500 } })}>
        <span data-testid="meta-test-mode" className={css({ ...small, margin:'0', marginRight:'auto', '@media (max-width: 650px)': { gridColumn:'1 / -1' } })}>Test data</span>
        <Button kind={KIND.secondary} data-testid="meta-back" onClick={() => draft.step > 0 ? save({ ...draft,step:draft.step - 1 }) : onClose()}>Back</Button>
        <Button data-testid={draft.step === 4 ? 'meta-complete' : 'meta-next'} onClick={next} disabled={draft.step === 3 && !draft.share}
          overrides={{ BaseButton:{style:{backgroundColor:metaBlue,':hover':{backgroundColor:metaBlue}}} }}>{draft.step === 4 ? 'Continue' : 'Next'}</Button>
      </footer>
    </div>
  </Modal>;
}
