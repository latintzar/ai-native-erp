import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Modal, SIZE as MODAL_SIZE } from 'baseui/modal';
import { Spinner, SIZE as SPINNER_SIZE } from 'baseui/spinner';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, MessageCircle, RefreshCw } from 'lucide-react';
import { Message } from '../../../rocoto/message';
import { disconnectWhatsApp, ProofApiError, errorText, proofApi } from './api';
import { beginSignup, loadMetaSdk, type DiagnosticDelivery, type MetaSdk, type SignupStatus } from './meta';
import { useProofPolling, useProofSession } from './hooks';
import businessAppIcon from './assets/whatsapp-business.webp';
import whatsappGlyph from './assets/whatsapp-glyph.png';
import { mergeMessages, type Conversation, type MessagePage, type ProofMessage, type ProofState } from './types';

const WHATSAPP_HELP = 'https://faq.whatsapp.com/3059780464322392/?cms_platform=android&locale=en_US';
const BUSINESS_APP_IOS = 'https://apps.apple.com/app/whatsapp-business/id1386412985';
const BUSINESS_APP_ANDROID = 'https://play.google.com/store/apps/details?id=com.whatsapp.w4b';
const WHATSAPP_APP_IOS = 'https://apps.apple.com/app/whatsapp-messenger/id310633997';
const WHATSAPP_APP_ANDROID = 'https://play.google.com/store/apps/details?id=com.whatsapp';
const BUSINESS_DOWNLOAD_URL = 'https://cedar-demo.soyrocoto.com/download/whatsapp-business';
const META_DETAILS = 'https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users?locale=en_US';

/* ── the Spanish twin, screen by screen (bodega sign-up screen 2, FEED-IA §268) ───────────────────
 * `WhatsAppSetup`'s `lang` prop defaults to 'en', so Cedar's own callers — `ConnectionsApp` among
 * them — paint byte-for-byte what they painted before this table existed. `useSay()` answers a
 * literal's Spanish twin from the one dictionary below; a string with no entry (a brand name, an
 * arbitrary API error) passes through unchanged, in whichever language it arrived in. */
type Lang = 'en' | 'es';

const LangContext = React.createContext<Lang>('en');

function useLang(): Lang {
  return React.useContext(LangContext);
}

const SPANISH: Record<string, string> = {
  'View in app store': 'Ver en la tienda de apps',
  'Download WhatsApp Business': 'Descarga WhatsApp Business',
  'Connecting your chats uses WhatsApp Business. Your existing number and chats move with you.':
    'Para conectar tus chats se usa WhatsApp Business. Tu número y tus chats de siempre se van contigo.',
  'Open WhatsApp Business downloads on your phone': 'Abre las descargas de WhatsApp Business en tu celular',
  'Scan this code with your phone’s camera to open WhatsApp Business in your app store.':
    'Escanea este código con la cámara de tu celular para abrir WhatsApp Business en tu tienda de apps.',
  'Continue': 'Continuar',
  'Choose your app store': 'Elige tu tienda de apps',
  'Download for iPhone': 'Descarga para iPhone',
  'Download for Android': 'Descarga para Android',
  'Back to connection': 'Volver a la conexión',
  'Privacy and chat sharing': 'Privacidad y tus chats',
  'Meta verifies the WhatsApp account you connect. Your browser session opens that account’s conversations. Messages stay in protected storage, and Meta manages the access you approve.':
    'Meta verifica la cuenta de WhatsApp que conectas. Tu sesión del navegador abre las conversaciones de esa cuenta. Los mensajes se guardan en almacenamiento protegido, y Meta administra el acceso que tú apruebas.',
  'Meta asks you to approve sharing up to 180 days of eligible one-to-one conversations. Keep WhatsApp Business open on your phone as messages arrive.':
    'Meta te pide aprobar compartir hasta 180 días de conversaciones uno a uno elegibles. Mantén WhatsApp Business abierto en tu celular mientras llegan los mensajes.',
  'Group chats stay in WhatsApp. Meta supports media history from the last 14 days; older attachments remain in your phone app.':
    'Los chats de grupo se quedan en WhatsApp. Meta trae el historial de multimedia de los últimos 14 días; los archivos más antiguos se quedan en la app de tu celular.',
  'The import starts during the first 24 hours after connecting and runs once per setup. Availability depends on your account and Meta’s sharing options.':
    'La importación empieza en las primeras 24 horas después de conectar, y corre una vez por configuración. La disponibilidad depende de tu cuenta y de las opciones de Meta para compartir.',
  'Voice and video calls stay in WhatsApp Business. Meta’s setup explains changes to broadcasts, disappearing messages, view-once media, live location and linked devices.':
    'Las llamadas de voz y video se quedan en WhatsApp Business. La configuración de Meta explica los cambios en difusiones, mensajes temporales, contenido de una vista, ubicación en vivo y dispositivos vinculados.',
  'Read Meta’s connection details': 'Lee los detalles de conexión de Meta',
  'Opening WhatsApp setup': 'Abriendo la configuración de WhatsApp',
  'Continue in the WhatsApp window': 'Continúa en la ventana de WhatsApp',
  'Checking your account': 'Revisando tu cuenta',
  'Waiting for your WhatsApp account details': 'Esperando los datos de tu cuenta de WhatsApp',
  'Connecting your WhatsApp Business account': 'Conectando tu cuenta de WhatsApp Business',
  'Meta is taking longer to load. Try loading the connection again.':
    'A Meta le está tomando más tiempo de lo normal. Carga la conexión otra vez.',
  'WhatsApp setup in progress': 'Configuración de WhatsApp en curso',
  'Complete Meta’s steps in the WhatsApp window. Let that window close when setup finishes.':
    'Completa los pasos de Meta en la ventana de WhatsApp. Deja que esa ventana se cierre cuando termine la configuración.',
  'Keep this page open while your account connects. Your conversations will appear here.':
    'Deja esta página abierta mientras se conecta tu cuenta. Tus conversaciones van a aparecer aquí.',
  'Setup paused. Close the WhatsApp window before starting again.':
    'Configuración pausada. Cierra la ventana de WhatsApp antes de volver a empezar.',
  'Pause setup': 'Pausar',
  'Transfer your chats': 'Pasa tus chats',
  'Do you use the WhatsApp Business app?': '¿Usas la app WhatsApp Business?',
  'Move your number and chats in WhatsApp Business, then check that your chats are visible.':
    'Pasa tu número y tus chats a WhatsApp Business, y revisa que tus chats se vean.',
  'Choose the app you use on your phone.': 'Elige la app que usas en tu celular.',
  'Back up your chats in WhatsApp.': 'Haz una copia de tus chats en WhatsApp.',
  'Open WhatsApp Business and select your existing number.': 'Abre WhatsApp Business y elige tu número de siempre.',
  'Follow WhatsApp’s transfer steps, restore your chats and complete your business profile.':
    'Sigue los pasos de WhatsApp para pasar tus chats, restaura tus chats y completa tu perfil de negocio.',
  'Read the official transfer steps': 'Lee los pasos oficiales para pasar tus chats',
  'Meta signup is awaiting account configuration.': 'La cuenta de Meta espera su configuración.',
  'Check again': 'Revisar otra vez',
  'Setup details': 'Detalles de la configuración',
  'Load again': 'Cargar otra vez',
  'Report received by Rocoto.': 'Rocoto recibió el reporte.',
  'Sending the error report to Rocoto…': 'Mandando el reporte de error a Rocoto…',
  'Error report delivery needs another attempt.': 'El envío del reporte de error necesita otro intento.',
  'Loading WhatsApp setup': 'Cargando la configuración de WhatsApp',
  'Connect your customer chats': 'Conecta los chats de tus clientes',
  'Move your chats to WhatsApp Business': 'Pasa tus chats a WhatsApp Business',
  'My chats are in WhatsApp Business': 'Mis chats están en WhatsApp Business',
  'Next, sign in with Facebook to connect your WhatsApp.': 'Ahora entra con Facebook para conectar tu WhatsApp.',
  'Connecting WhatsApp Business opens Facebook setup.': 'Al conectar WhatsApp Business se abre la configuración de Facebook.',
  'Back': 'Volver',
};

/** THE ONE TRANSLATOR every visible string in `WhatsAppSetup` reads through: a literal with a
 *  Spanish twin above answers it when `lang` is 'es', and every other string — a brand name, an
 *  arbitrary error — passes through as it arrived. */
export function useSay(): (english: string) => string {
  const lang = useLang();
  return React.useCallback((english: string) => (lang === 'es' ? SPANISH[english] ?? english : english), [lang]);
}

function dateText(value: string | null, includeTime = false): string {
  if (!value || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en-GB', includeTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function Body({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary, margin: 0, textWrap: 'pretty' }}>{children}</p>;
}

function Note({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <div role="status" style={{ ...theme.typography.ParagraphSmall, padding: theme.sizing.scale500,
    backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borders.radius300,
    display: 'flex', gap: theme.sizing.scale400, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
    <span style={{ flex: '1 1 200px', overflowWrap: 'anywhere' }}>{children}</span>{action}
  </div>;
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.contentPrimary,
    textUnderlineOffset: '3px' }}>{children}</a>;
}

function Title({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <h1 id="connections-title" tabIndex={-1} style={{ ...theme.typography.HeadingLarge, fontSize: 'clamp(28px, 4vw, 36px)',
    lineHeight: 1.2, letterSpacing: '-0.025em', margin: 0, outline: 'none' }}>{children}</h1>;
}

function AppChoice({ business, onSelect, disabled, status }: {
  business: boolean; onSelect: () => void; disabled: boolean; status?: string;
}) {
  const [css, theme] = useStyletron();
  const say = useSay();
  const lang = useLang();
  const apple = /iPhone|iPad|iPod|Macintosh|Mac OS/i.test(navigator.userAgent)
    || navigator.platform === 'MacIntel';
  const store = business ? apple ? BUSINESS_APP_IOS : BUSINESS_APP_ANDROID
    : apple ? WHATSAPP_APP_IOS : WHATSAPP_APP_ANDROID;
  const name = business ? 'WhatsApp Business' : 'WhatsApp';
  const action = css({ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500,
    width: '100%', minWidth: 0, border: 0, padding: theme.sizing.scale500,
    textAlign: 'left', backgroundColor: 'transparent', color: theme.colors.contentPrimary,
    cursor: 'pointer', ':hover': { backgroundColor: theme.colors.backgroundSecondary },
    ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-3px' },
    ':disabled': { cursor: 'default', opacity: 0.55 } });
  return <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
    overflow: 'hidden', minWidth: 0 }}>
    <button type="button" className={action} onClick={onSelect} disabled={disabled}
      aria-label={name} aria-busy={Boolean(status)} data-testid={business ? 'connect-meta' : 'open-transfer'}>
      {business ? <img src={businessAppIcon} alt="" width={48} height={48}
        style={{ borderRadius: theme.borders.radius300, flexShrink: 0 }} />
        : <span aria-hidden="true" style={{ width: 48, height: 48, padding: 8, boxSizing: 'border-box', flexShrink: 0, borderRadius: theme.borders.radius300,
          backgroundColor: '#27d365', display: 'grid' /* theme-gate-allow: Peter's exact WhatsApp provider icon green, independent of Rocoto theme. */ }}>
          <img src={whatsappGlyph} alt="" width={32} height={32} style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
        </span>}
      <span style={{ display: 'grid', gap: theme.sizing.scale200, flex: 1, minWidth: 0 }}>
        <span style={theme.typography.LabelLarge}>{name}</span>
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          {status ? say(status) : say(business ? 'Connect your customer chats' : 'Move your chats to WhatsApp Business')}
        </span>
      </span>
      <ArrowRight size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
    </button>
    <a href={store} target="_blank" rel="noopener noreferrer"
      aria-label={lang === 'es' ? `Ver ${name} en la tienda de apps` : `View ${name} in app store`}
      data-testid={business ? 'business-store-link' : 'whatsapp-store-link'}
      style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary,
        display: 'flex', alignItems: 'center', minHeight: 44, marginLeft: 80, marginRight: theme.sizing.scale500,
        paddingBottom: theme.sizing.scale300, textUnderlineOffset: '3px' }}>{say('View in app store')}</a>
  </div>;
}

function WhatsAppDownload({ onBack, onContinue }: { onBack: () => void; onContinue: () => void }) {
  const [css, theme] = useStyletron();
  const say = useSay();
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const qrLayout = css({ display: 'grid', gridTemplateColumns: '176px minmax(0, 1fr)',
    alignItems: 'center', gap: theme.sizing.scale600,
    '@media (max-width: 767px)': { gridTemplateColumns: '1fr', justifyItems: 'center' } });
  return <section id="whatsapp-business" aria-labelledby="connections-title" style={{ display: 'grid', gap: theme.sizing.scale800 }}>
    <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      <Title>{say('Download WhatsApp Business')}</Title>
      <Body>{say('Connecting your chats uses WhatsApp Business. Your existing number and chats move with you.')}</Body>
    </div>
    {mobile ? <Button href={BUSINESS_DOWNLOAD_URL} target="_blank" onClick={onContinue}
      endEnhancer={() => <ArrowRight size={18} aria-hidden="true" />}
      overrides={{ BaseButton: { props: { 'data-testid': 'download-business', rel: 'noopener noreferrer' } } }}>{say('Download WhatsApp Business')}</Button>
      : <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
      <div className={qrLayout}>
        <QRCodeSVG value={BUSINESS_DOWNLOAD_URL} size={176} level="M" marginSize={4}
          bgColor={theme.colors.backgroundPrimary} fgColor={theme.colors.contentPrimary}
          role="img" title={say('Open WhatsApp Business downloads on your phone')} data-testid="whatsapp-transfer-qr" style={{ flexShrink: 0 }} />
        <Body>{say('Scan this code with your phone’s camera to open WhatsApp Business in your app store.')}</Body>
      </div>
      <Button onClick={onContinue} endEnhancer={() => <ArrowRight size={18} aria-hidden="true" />}
        overrides={{ BaseButton: { props: { 'data-testid': 'transfer-continue' } } }}>{say('Continue')}</Button>
    </div>}
    <details style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
      <summary style={{ cursor: 'pointer' }}>{say('Choose your app store')}</summary>
      <div style={{ display: 'grid', gap: theme.sizing.scale500, paddingTop: theme.sizing.scale400 }}>
        <a href={BUSINESS_APP_IOS} target="_blank" rel="noopener noreferrer" onClick={onContinue}
          style={{ color: theme.colors.contentPrimary, textUnderlineOffset: '3px', minHeight: 44, display: 'flex', alignItems: 'center' }}>{say('Download for iPhone')}</a>
        <a href={BUSINESS_APP_ANDROID} target="_blank" rel="noopener noreferrer" onClick={onContinue}
          style={{ color: theme.colors.contentPrimary, textUnderlineOffset: '3px', minHeight: 44, display: 'flex', alignItems: 'center' }}>{say('Download for Android')}</a>
      </div>
    </details>
    <Button kind={KIND.tertiary} onClick={onBack}
      startEnhancer={() => <ArrowLeft size={18} aria-hidden="true" />}
      overrides={{ BaseButton: { props: { 'data-testid': 'return-setup' } } }}>{say('Back to connection')}</Button>
  </section>;
}

function PrivacySharingDetails() {
  const [, theme] = useStyletron();
  const say = useSay();
  return <details style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: 560 }}>
      <summary style={{ cursor: 'pointer' }}>{say('Privacy and chat sharing')}</summary>
      <div style={{ display: 'grid', gap: theme.sizing.scale400, paddingTop: theme.sizing.scale300 }}>
        <p style={{ margin: 0 }}>{say('Meta verifies the WhatsApp account you connect. Your browser session opens that account’s conversations. Messages stay in protected storage, and Meta manages the access you approve.')}</p>
        <p style={{ margin: 0 }}>{say('Meta asks you to approve sharing up to 180 days of eligible one-to-one conversations. Keep WhatsApp Business open on your phone as messages arrive.')}</p>
        <p style={{ margin: 0 }}>{say('Group chats stay in WhatsApp. Meta supports media history from the last 14 days; older attachments remain in your phone app.')}</p>
        <p style={{ margin: 0 }}>{say('The import starts during the first 24 hours after connecting and runs once per setup. Availability depends on your account and Meta’s sharing options.')}</p>
        <p style={{ margin: 0 }}>{say('Voice and video calls stay in WhatsApp Business. Meta’s setup explains changes to broadcasts, disappearing messages, view-once media, live location and linked devices.')}</p>
        <Link href={META_DETAILS}>{say('Read Meta’s connection details')}</Link>
      </div>
    </details>;
}

const SIGNUP_TEXT: Record<SignupStatus, string> = {
  opening: 'Opening WhatsApp setup',
  authorizing: 'Continue in the WhatsApp window',
  exchanging: 'Checking your account',
  awaiting_details: 'Waiting for your WhatsApp account details',
  connecting: 'Connecting your WhatsApp Business account',
};

type WhatsAppSetupProps = {
  state: ProofState; onConnected: (state: ProofState) => void; onLocked: () => void; onRefresh: () => void;
  onActivityChange: (active: boolean) => void; addingAccount?: boolean;
  /** The native onboarding already asked which WhatsApp app the person uses. */
  businessConfirmed?: boolean;
  /** Bodega's Android Auth Tab has one automatic return path and compact progress. */
  handoffMode?: boolean;
};

/** THE OPTIONAL `lang`, DEFAULTING TO 'en' — every existing caller (Cedar's `ConnectionsApp` among
 *  them) passes none, so it paints exactly what it painted before this prop existed. The bodega
 *  sign-up (`bodega-pay-later/whatsapp-connection.tsx`) is the one caller that passes `'es'`. */
export function WhatsAppSetup({ lang = 'en', ...props }: WhatsAppSetupProps & { lang?: Lang }) {
  return <LangContext.Provider value={lang}><WhatsAppSetupBody {...props} /></LangContext.Provider>;
}

function WhatsAppSetupBody({ state, onConnected, onLocked, onRefresh, onActivityChange,
  addingAccount = false, businessConfirmed = false, handoffMode = false }: WhatsAppSetupProps) {
  const [, theme] = useStyletron();
  const say = useSay();
  const lang = useLang();
  const [step, setStep] = React.useState<'connect' | 'download' | 'transfer'>(() => {
    const transfer = new URLSearchParams(window.location.search).get('transfer');
    return transfer === '2' ? 'transfer' : transfer === '1' ? 'download' : 'connect';
  });
  const [sdk, setSdk] = React.useState<MetaSdk | null>(null);
  const [sdkRevision, setSdkRevision] = React.useState(0);
  const [sdkError, setSdkError] = React.useState('');
  const [status, setStatus] = React.useState<SignupStatus | null>(null);
  const [error, setError] = React.useState('');
  const [diagnostic, setDiagnostic] = React.useState<DiagnosticDelivery | null>(null);
  const stop = React.useRef<(() => void) | undefined>(undefined);
  const busy = status !== null;
  React.useEffect(() => {
    const url = new URL(window.location.href);
    if (step === 'connect') url.searchParams.delete('transfer');
    else url.searchParams.set('transfer', step === 'download' ? '1' : '2');
    if (step !== 'download' && url.hash === '#whatsapp-business') url.hash = '';
    window.history.replaceState(window.history.state, '', url);
    const frame = window.requestAnimationFrame(() => document.getElementById('connections-title')?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step]);
  React.useEffect(() => () => { stop.current?.(); onActivityChange(false); }, [onActivityChange]);
  React.useEffect(() => {
    if ((state.connection && !addingAccount) || !state.ready || !state.meta.appId || !state.meta.configId) return;
    let alive = true;
    setSdkError('');
    void loadMetaSdk().then((next) => {
      if (!alive) return;
      next.init({ appId: state.meta.appId, version: state.meta.graphVersion,
        cookie: true, xfbml: false, autoLogAppEvents: false });
      setSdk(next);
    }).catch(() => { if (alive) setSdkError('Meta is taking longer to load. Try loading the connection again.'); });
    return () => { alive = false; };
  }, [Boolean(state.connection), addingAccount, state.ready, state.meta.appId, state.meta.configId, state.meta.graphVersion, sdkRevision]);
  const connect = () => {
    if (!sdk || busy || !state.ready) return;
    setError('');
    stop.current?.();
    setDiagnostic(null);
    onActivityChange(true);
    stop.current = beginSignup({
      sdk, configId: state.meta.configId, historyRequested: true,
      onStatus: setStatus,
      onDiagnostic: setDiagnostic,
      onConnected(next) { setStatus(null); stop.current = undefined; onConnected(next); onActivityChange(false); },
      onError(caught) {
        // Keep the disposer: a late Meta report may follow this failed authorization.
        setStatus(null); onActivityChange(false);
        if (caught instanceof ProofApiError && caught.status === 401) { onLocked(); return; }
        setError(caught instanceof Error ? caught.message : errorText(caught));
        onRefresh();
      },
    });
  };
  // Keep this controller mounted when a saved connection first appears: webhook storage starts
  // before the provider setup request finishes, and polling must not abort that request.
  if (state.connection && !addingAccount) return <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
    {error && <Note>{error}</Note>}
    <ConnectedWorkspace state={state} onLocked={onLocked} onRefresh={onRefresh} />
  </div>;
  if (status && handoffMode) return <section aria-labelledby="connections-title" data-testid="meta-handoff-progress"
    style={{ minHeight: 'min(48vh, 360px)', display: 'grid', placeContent: 'center', justifyItems: 'center',
      gap: theme.sizing.scale500, textAlign: 'center' }}>
    <Spinner $size={SPINNER_SIZE.medium} $color={theme.colors.contentPrimary}
      aria-label={lang === 'es' ? 'Conectando WhatsApp' : 'Connecting WhatsApp'} />
    <div role="status" aria-live="polite" aria-atomic="true"><Title>{lang === 'es' ? 'Conectando' : 'Connecting'}</Title></div>
  </section>;
  if (status) return <section aria-labelledby="connections-title" data-testid="meta-setup-progress"
    style={{ display: 'grid', gap: theme.sizing.scale800 }}>
    <Spinner $size={SPINNER_SIZE.large} $color={theme.colors.contentPrimary}
      aria-label={say('WhatsApp setup in progress')} data-testid="meta-setup-spinner" />
    <div role="status" aria-live="polite" aria-atomic="true" style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      <Title>{say(SIGNUP_TEXT[status])}</Title>
      <Body>{status === 'opening' || status === 'authorizing'
        ? say('Complete Meta’s steps in the WhatsApp window. Let that window close when setup finishes.')
        : say('Keep this page open while your account connects. Your conversations will appear here.')}</Body>
    </div>
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <Button type="button" kind={KIND.tertiary} size={SIZE.compact} onClick={() => {
        stop.current?.(); stop.current = undefined; setStatus(null); onActivityChange(false);
        setError('Setup paused. Close the WhatsApp window before starting again.'); onRefresh();
      }}>{say('Pause setup')}</Button>
    </div>
  </section>;
  if (step === 'download') return <WhatsAppDownload onBack={() => setStep('connect')} onContinue={() => setStep('transfer')} />;
  return <section aria-labelledby="connections-title" style={{ display: 'grid', gap: theme.sizing.scale800 }}>
    <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      <MessageCircle size={30} strokeWidth={1.5} aria-hidden="true" />
      <Title>{businessConfirmed ? (lang === 'es' ? 'Conecta WhatsApp Business' : 'Connect WhatsApp Business') : step === 'transfer' ? say('Transfer your chats') : say('Do you use the WhatsApp Business app?')}</Title>
      {!handoffMode && <Body>{businessConfirmed ? (lang === 'es' ? 'Autoriza la conexión en Meta.' : 'Approve the connection in Meta.') : step === 'transfer' ? say('Move your number and chats in WhatsApp Business, then check that your chats are visible.')
        : say('Choose the app you use on your phone.')}</Body>}
    </div>
    {step === 'transfer' && <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
      <ol style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary,
        paddingLeft: theme.sizing.scale600, margin: 0, display: 'grid', gap: theme.sizing.scale500 }}>
        <li>{say('Back up your chats in WhatsApp.')}</li>
        <li>{say('Open WhatsApp Business and select your existing number.')}</li>
        <li>{say('Follow WhatsApp’s transfer steps, restore your chats and complete your business profile.')}</li>
      </ol>
      <p style={{ ...theme.typography.ParagraphSmall, margin: 0 }}><Link href={WHATSAPP_HELP}>{say('Read the official transfer steps')}</Link></p>
    </div>}
      {!state.ready && <Note action={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={onRefresh}>{say('Check again')}</Button>}>
        {say('Meta signup is awaiting account configuration.')}
        {state.blockers.length > 0 && <details style={{ marginTop: theme.sizing.scale300 }}><summary>{say('Setup details')}</summary>
          <ul style={{ marginBottom: 0, paddingLeft: theme.sizing.scale500 }}>{state.blockers.map((item) => <li key={item}>{item}</li>)}</ul>
        </details>}
      </Note>}
      {sdkError && <Note action={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setSdkRevision((value) => value + 1)}>{say('Load again')}</Button>}>{say(sdkError)}</Note>}
      {error && <div role="alert" style={theme.typography.ParagraphSmall}>{say(error)}</div>}
      {diagnostic && <div role="status" data-testid="meta-report-status" style={theme.typography.ParagraphSmall}>
        {diagnostic.errorCode && (lang === 'es' ? `Error de Meta ${diagnostic.errorCode}. ` : `Meta error ${diagnostic.errorCode}. `)}
        {diagnostic.state === 'saved' ? say('Report received by Rocoto.')
          : diagnostic.state === 'sending' ? say('Sending the error report to Rocoto…')
            : say('Error report delivery needs another attempt.')}
      </div>}
      <div style={{ display: 'grid', gap: theme.sizing.scale500 }}>
        {businessConfirmed ? <Button onClick={connect} disabled={!state.ready || !sdk}
          overrides={{ BaseButton: { props: { 'data-testid': 'connect-meta' }, style: { whiteSpace: 'normal' } } }}>
          {state.ready && !sdk && !sdkError ? say('Loading WhatsApp setup') : lang === 'es' ? 'Continuar con Meta' : 'Continue with Meta'}
        </Button> : step === 'connect' ? <>
          <AppChoice business onSelect={connect} disabled={!state.ready || !sdk}
            status={state.ready && !sdk && !sdkError ? 'Loading WhatsApp setup' : undefined} />
          <AppChoice business={false} onSelect={() => setStep('download')} disabled={false} />
        </> : <>
          <Button onClick={connect} disabled={!state.ready || !sdk}
            endEnhancer={() => <ArrowRight size={18} aria-hidden="true" />}
            overrides={{ BaseButton: { props: { 'data-testid': 'connect-meta' }, style: { whiteSpace: 'normal' } } }}>
            {state.ready && !sdk && !sdkError ? say('Loading WhatsApp setup') : say('My chats are in WhatsApp Business')}
          </Button>
        </>}
        {!businessConfirmed && <span aria-live="polite" style={{ ...theme.typography.ParagraphXSmall, textAlign: 'center', color: theme.colors.contentSecondary }}>
          {step === 'transfer'
            ? say('Next, sign in with Facebook to connect your WhatsApp.')
            : say('Connecting WhatsApp Business opens Facebook setup.')}
        </span>}
      </div>
    {step === 'transfer' && <Button kind={KIND.tertiary} onClick={() => setStep('download')}
      startEnhancer={() => <ArrowLeft size={18} aria-hidden="true" />}
      overrides={{ BaseButton: { props: { 'data-testid': 'transfer-back' } } }}>{say('Back')}</Button>}

  </section>;
}

export function HistoryStatus({ state }: { state: ProofState }) {
  const [, theme] = useStyletron();
  const { history } = state;
  const setupSteps: Record<string, string> = {
    verifying: 'Verifying your WhatsApp Business account', subscription: 'Connecting your account updates',
    'phone-callback': 'Connecting your phone number', 'callback-verification': 'Verifying message updates',
    contacts: 'Requesting your contacts', history: 'Requesting your approved history', complete: 'Connection ready',
  };
  const labels: Record<ProofState['history']['status'], string> = {
    idle: 'Setup saved for new messages', waiting: 'Waiting for WhatsApp history', syncing: 'Importing conversations',
    complete: 'WhatsApp history received', declined: 'Earlier chats stay in WhatsApp', interrupted: 'History import paused',
  };
  const range = history.oldestAt && history.newestAt ? `${dateText(history.oldestAt)} – ${dateText(history.newestAt)}` : '';
  return <section aria-label="Connection and history status" style={{ display: 'grid', gap: theme.sizing.scale300,
    padding: theme.sizing.scale600, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300 }}>
    <div style={{ display: 'flex', gap: theme.sizing.scale400, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
      <span style={{ ...theme.typography.LabelMedium, display: 'flex', gap: theme.sizing.scale300, alignItems: 'center' }}>
        <Check size={18} aria-hidden="true" /> {state.connection?.number || state.connection?.name || 'WhatsApp connected'}
      </span>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
        {state.setup?.status === 'pending' ? 'Finishing connection' : state.setup?.status === 'interrupted' ? 'Connection setup paused' : 'WhatsApp account linked'}
      </span>
    </div>
    {state.setup?.status === 'pending' && <span role="status" style={theme.typography.ParagraphSmall}>{setupSteps[state.setup.step] || 'Finishing your connection setup'}</span>}
    {state.setup?.status === 'interrupted' && <span role="status" style={theme.typography.ParagraphSmall}>{state.setup.error || 'The connection setup needs a review. Received conversations remain available.'}</span>}
    <span aria-live="polite" style={theme.typography.LabelSmall}>
      {labels[history.status]}{history.progress !== null && history.status === 'syncing' ? ` · ${Math.min(100, Math.max(0, history.progress))}%` : ''}
    </span>
    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, fontVariantNumeric: 'tabular-nums' }}>
      {history.messages.toLocaleString('en-GB')} {history.messages === 1 ? 'message' : 'messages'} · {history.conversations.toLocaleString('en-GB')} {history.conversations === 1 ? 'conversation' : 'conversations'}{range ? ` · ${range}` : ''}
    </span>
    {(history.status === 'waiting' || history.status === 'syncing') && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
      Keep WhatsApp Business open on your phone. Conversations appear as Meta shares them.
    </span>}
    {history.status === 'declined' && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Your sharing choice keeps earlier chats in WhatsApp.</span>}
    {history.status === 'interrupted' && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Received conversations remain available. Review the saved request outcome to continue.</span>}
  </section>;
}

export function ConversationMessages({ conversation, onBack, onLocked }: {
  conversation: Conversation; onBack: () => void; onLocked: () => void;
}) {
  const [, theme] = useStyletron();
  const [rows, setRows] = React.useState<ProofMessage[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [failedCursor, setFailedCursor] = React.useState<string | undefined>(undefined);
  const controller = React.useRef<AbortController | undefined>(undefined);
  const list = React.useRef<HTMLDivElement | null>(null);
  const heldRows = React.useRef<ProofMessage[]>([]);
  const running = React.useRef(false);
  const failures = React.useRef(0);
  const alive = React.useRef(true);
  const scroll = React.useRef<{ bottom: boolean; anchor?: string; offset: number } | undefined>(undefined);
  const captureScroll = () => {
    const element = list.current;
    if (!element) return;
    const top = element.getBoundingClientRect().top;
    const anchor = [...element.querySelectorAll<HTMLElement>('[data-message-id]')].find((row) => row.getBoundingClientRect().bottom >= top);
    scroll.current = { bottom: heldRows.current.length === 0 || element.scrollHeight - element.scrollTop - element.clientHeight < 48,
      anchor: anchor?.dataset.messageId, offset: (anchor?.getBoundingClientRect().top ?? top) - top };
  };
  const load = React.useCallback(async (before?: string) => {
    if (running.current || !alive.current) return;
    running.current = true;
    const active = new AbortController(); controller.current = active;
    setBusy(true); setError('');
    try {
      const getPage = (at?: string) => proofApi<MessagePage>(`/conversations/${encodeURIComponent(conversation.id)}/messages?limit=100${at ? `&before=${encodeURIComponent(at)}` : ''}`, { signal: active.signal });
      let result = await getPage(before);
      let incoming = result.messages;
      // Re-read the already visible time range from its newest edge. New history chunks can
      // insert messages between earlier pages; stitching only the latest page would leave gaps.
      const oldest = heldRows.current[0];
      const remaining = new Set(heldRows.current.map((message) => message.id));
      for (const message of result.messages) remaining.delete(message.id);
      const seen = new Set<string>();
      while (!before && oldest && remaining.size > 0 && result.nextCursor && result.messages.length > 0) {
        const earliest = mergeMessages(result.messages)[0];
        // The private API's tie-breaker is opaque. Original provider IDs cannot determine its
        // cursor order, so cover every previously visible identity at a shared timestamp.
        if (Date.parse(earliest.timestamp) < Date.parse(oldest.timestamp)) break;
        if (seen.has(result.nextCursor)) throw new ProofApiError(502, 'The message list needs another refresh. Try again.');
        seen.add(result.nextCursor);
        result = await getPage(result.nextCursor);
        for (const message of result.messages) remaining.delete(message.id);
        incoming = [...incoming, ...result.messages];
      }
      if (active.signal.aborted) return;
      captureScroll();
      if (before && scroll.current) scroll.current.bottom = false;
      const next = mergeMessages(heldRows.current, incoming);
      heldRows.current = next;
      setRows(next);
      setCursor(result.nextCursor); setLoaded(true);
      failures.current = 0;
    } catch (caught) {
      if (active.signal.aborted) return;
      if (caught instanceof ProofApiError && caught.status === 401) { onLocked(); return; }
      setError(errorText(caught));
      setFailedCursor(before);
      failures.current += 1;
    } finally { running.current = false; if (!active.signal.aborted) setBusy(false); }
  }, [conversation.id, onLocked]);
  React.useEffect(() => {
    alive.current = true;
    let timer: number;
    const tick = async () => {
      await load();
      if (alive.current) timer = window.setTimeout(tick, Math.max(document.hidden ? 20000 : 8000, Math.min(60000, 8000 * 2 ** failures.current)));
    };
    void tick();
    return () => { alive.current = false; window.clearTimeout(timer); controller.current?.abort(); };
  }, [load]);
  React.useEffect(() => { if (loaded) void load(); }, [conversation.count, conversation.lastAt]);
  React.useLayoutEffect(() => {
    const element = list.current;
    const prior = scroll.current;
    if (!element || !prior) return;
    if (prior.bottom) element.scrollTop = element.scrollHeight;
    else if (prior.anchor) {
      const anchor = [...element.querySelectorAll<HTMLElement>('[data-message-id]')].find((row) => row.dataset.messageId === prior.anchor);
      if (anchor) element.scrollTop += anchor.getBoundingClientRect().top - element.getBoundingClientRect().top - prior.offset;
    }
    scroll.current = undefined;
  }, [rows]);
  return <section aria-label={`Conversation with ${conversation.name || conversation.number}`} style={{ display: 'grid',
    gridTemplateRows: 'auto minmax(240px, 1fr) auto', minWidth: 0, minHeight: 0 }}>
    <header style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, padding: theme.sizing.scale400,
      borderBottom: `1px solid ${theme.colors.borderOpaque}`, minWidth: 0 }}>
      <Button kind={KIND.tertiary} size={SIZE.compact} aria-label="Back to conversations" onClick={onBack}><ArrowLeft size={18} /></Button>
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <h2 style={{ ...theme.typography.LabelLarge, margin: 0, overflowWrap: 'anywhere' }}>{conversation.name || conversation.number}</h2>
        {conversation.name && <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{conversation.number}</span>}
      </div>
      <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => void load()} disabled={busy} aria-label="Refresh messages"><RefreshCw size={17} /></Button>
    </header>
    <div ref={list} style={{ overflowY: 'auto', padding: theme.sizing.scale500, minWidth: 0, height: 'min(52dvh, 560px)', overscrollBehavior: 'contain' }}>
      {cursor && <div style={{ textAlign: 'center', marginBottom: theme.sizing.scale500 }}>
        <Button kind={KIND.secondary} size={SIZE.compact} disabled={busy} isLoading={busy} onClick={() => void load(cursor)}>Load earlier messages</Button>
      </div>}
      {error && <Note action={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => void load(failedCursor)}>Try again</Button>}>{error}</Note>}
      {!loaded && busy && <Body>Loading your conversation…</Body>}
      {loaded && rows.length === 0 && <Body>Messages will appear here as they arrive.</Body>}
      {rows.map((message, index) => {
        const prior = rows[index - 1];
        const day = dateText(message.timestamp);
        const sameDay = prior && dateText(prior.timestamp) === day;
        const time = new Date(message.timestamp);
        return <React.Fragment key={message.id}>
          {!sameDay && <p style={{ ...theme.typography.LabelXSmall, textAlign: 'center', margin: `${theme.sizing.scale600} 0`, color: theme.colors.contentSecondary }}>{day}</p>}
          <div title={dateText(message.timestamp, true)} data-testid="provider-message" data-message-id={message.id}>
            <Message author={message.direction === 'outbound' ? 'sent' : 'received'}
              grouped={Boolean(sameDay && prior.direction === message.direction)}
              time={Number.isNaN(time.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(time)}
              document={message.kind !== 'text' ? { name: message.kind === 'document' ? 'Document' : message.kind.charAt(0).toUpperCase() + message.kind.slice(1),
                detail: message.mediaAvailable ? 'Media received · open in WhatsApp' : 'Media placeholder · check WhatsApp' } : undefined}>
              {message.text || (message.kind === 'text' ? 'Message received' : undefined)}
            </Message>
          </div>
        </React.Fragment>;
      })}
    </div>
    <p style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, padding: theme.sizing.scale400,
      borderTop: `1px solid ${theme.colors.borderOpaque}`, margin: 0, textAlign: 'center' }}>Reply from WhatsApp Business on your phone.</p>
  </section>;
}

function ConversationList({ state, onLocked }: { state: ProofState; onLocked: () => void }) {
  const [css, theme] = useStyletron();
  const conversations = useProofPolling<{ conversations: Conversation[] }>('/conversations', true, onLocked, 7000);
  const [selected, setSelected] = React.useState<Conversation | null>(null);
  const [query, setQuery] = React.useState('');
  const all = conversations.data?.conversations ?? [];
  const filtered = all.filter((item) => `${item.name} ${item.number}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const active = all.find((item) => item.id === selected?.id) ?? selected;
  const row = css({ display: 'flex', width: '100%', alignItems: 'center', gap: theme.sizing.scale400, padding: theme.sizing.scale500,
    borderTop: 0, borderLeft: 0, borderRight: 0, borderBottom: `1px solid ${theme.colors.borderOpaque}`, cursor: 'pointer',
    backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, textAlign: 'left', minWidth: 0,
    ':hover': { backgroundColor: theme.colors.backgroundSecondary },
    ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '-2px' } });
  const dateClass = css({ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, flexShrink: 0,
    '@media (max-width: 480px)': { display: 'none' } });
  return <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden', minWidth: 0 }}>
    {active ? <ConversationMessages key={active.id} conversation={active} onBack={() => setSelected(null)} onLocked={onLocked} /> : <>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400, padding: theme.sizing.scale500 }}>
        <h2 style={{ ...theme.typography.LabelLarge, margin: 0 }}>Conversations</h2>
        <Button kind={KIND.tertiary} size={SIZE.compact} onClick={conversations.refresh} disabled={conversations.busy} aria-label="Refresh conversations"><RefreshCw size={17} /></Button>
        {all.length > 0 && <Input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search names or numbers"
          aria-label="Search conversations" clearOnEscape overrides={{ Root: { style: { flexBasis: '100%' } } }} />}
      </div>
      {conversations.error && <div style={{ padding: theme.sizing.scale500 }}><Note>{conversations.error}</Note></div>}
      <div style={{ maxHeight: 'min(52dvh, 560px)', overflowY: 'auto', minHeight: 160 }}>
        {filtered.map((item) => <button key={item.id} type="button" className={row} onClick={() => setSelected(item)}>
          <MessageCircle size={22} strokeWidth={1.5} aria-hidden="true" style={{ flexShrink: 0 }} />
          <span style={{ display: 'grid', gap: theme.sizing.scale200, minWidth: 0, flex: 1 }}>
            <span style={{ ...theme.typography.LabelMedium, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name || item.number}</span>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.lastMessage || `${item.count.toLocaleString('en-GB')} messages`}</span>
          </span>
          <span className={dateClass}>{dateText(item.lastAt)}</span>
          <ChevronRight size={17} aria-hidden="true" style={{ flexShrink: 0 }} />
        </button>)}
        {filtered.length === 0 && <div style={{ padding: theme.sizing.scale600 }}>
          <Body>{query ? 'Try another name or phone number.' : conversations.busy && !conversations.data ? 'Loading conversations…'
            : state.history.status === 'waiting' || state.history.status === 'syncing' ? 'Your conversations appear here as WhatsApp shares them.'
              : 'New conversations appear here when messages arrive.'}</Body>
        </div>}
      </div>
    </>}
  </div>;
}

export function ConnectedWorkspace({ state, onLocked, onRefresh }: { state: ProofState; onLocked: () => void; onRefresh: () => void }) {
  const [, theme] = useStyletron();
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [disconnectError, setDisconnectError] = React.useState('');
  const disconnect = async () => {
    if (disconnecting) return;
    setDisconnecting(true); setDisconnectError('');
    try {
      await disconnectWhatsApp();
      window.dispatchEvent(new CustomEvent('cedar-whatsapp-refresh', {
        detail: { renew: true, disconnected: true },
      }));
      onLocked();
    } catch (error) {
      setDisconnectError(errorText(error));
      setDisconnecting(false);
    }
  };
  return <section style={{ display: 'grid', gap: theme.sizing.scale600 }}>
    <div style={{ display: 'grid', gap: theme.sizing.scale400 }}>
      <Title>Your WhatsApp conversations</Title>
      <Body>{state.connection?.name ? `${state.connection.name} · ` : ''}Read the messages shared by your WhatsApp Business account.</Body>
    </div>
    <HistoryStatus state={state} />
    <ConversationList state={state} onLocked={onLocked} />
    {disconnectError && <div role="alert"><Body>{disconnectError}</Body></div>}
    <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>This view uses the messages received from Meta.</span>
      <div style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
        <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onRefresh}>Refresh status</Button>
        <Button kind={KIND.tertiary} size={SIZE.compact} onClick={disconnect} isLoading={disconnecting}
          data-testid="disconnect-whatsapp">Disconnect</Button>
      </div>
    </div>
  </section>;
}

export function ConnectionsApp() {
  const [, theme] = useStyletron();
  const [dialogOpen, setDialogOpen] = React.useState(true);
  const [sessionRecovery, setSessionRecovery] = React.useState('');
  const signupAttempted = React.useRef(false);
  const session = useProofSession();
  const onLocked = React.useCallback(() => {
    if (signupAttempted.current) {
      setSessionRecovery('Your setup session needs a fresh connection. Continue with WhatsApp Business.');
    }
    session.restart();
  }, [session.restart]);
  const params = new URLSearchParams(window.location.search);
  const state = useProofPolling<ProofState>('/state', session.ready, onLocked);
  const onActivityChange = React.useCallback((active: boolean) => {
    if (active) {
      signupAttempted.current = true;
      setSessionRecovery('');
      state.pause();
    } else state.resume();
  }, [state.pause, state.resume]);
  React.useEffect(() => {
    if (state.data) session.confirm();
    if (state.data?.connection) {
      signupAttempted.current = false;
      setSessionRecovery('');
    }
  }, [state.data, session.confirm]);
  const dialog = params.get('presentation') === 'dialog';
  const connected = Boolean(session.ready && state.data?.connection);
  const body = <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
    {sessionRecovery && <div role="alert" data-testid="meta-session-recovery"
      style={theme.typography.ParagraphSmall}>{sessionRecovery}</div>}
    {session.ready && state.data ? <>
        {state.error && <Note action={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={state.refresh}>Try again</Button>}>{state.error}</Note>}
        <WhatsAppSetup state={state.data} onLocked={onLocked} onConnected={state.adopt} onRefresh={state.refresh} onActivityChange={onActivityChange} />
      </>
      : <div style={{ display: 'grid', gap: theme.sizing.scale600 }}>
        <Title>Do you use the WhatsApp Business app?</Title>
        <Body>{session.error || state.error || 'Opening your WhatsApp setup…'}</Body>
        {(session.error || state.error) && <Button onClick={session.error ? session.retry : state.refresh}>Try again</Button>}
      </div>}
  </div>;
  return <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.backgroundPrimary }}>
    <style>{`button{min-height:44px;min-width:44px}summary{min-height:44px;padding-top:12px;padding-bottom:12px}[data-baseweb="checkbox"]{min-height:44px}button:focus-visible,input:focus-visible,summary:focus-visible,a:focus-visible{outline-color:${theme.colors.contentPrimary}}`}</style>
    <header style={{ padding: 'clamp(20px, 4vw, 48px)', display: 'flex', alignItems: 'center', gap: theme.sizing.scale400 }}>
      <span role="img" aria-label="Rocoto" style={{ display: 'block', width: 40, height: 40, flexShrink: 0,
        backgroundColor: theme.colors.contentPrimary, maskImage: 'url(/brand/rocoto-mark.svg)', WebkitMaskImage: 'url(/brand/rocoto-mark.svg)',
        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center',
        maskSize: 'contain', WebkitMaskSize: 'contain' }} />
      <span aria-hidden="true" style={theme.typography.LabelLarge}>Rocoto</span>
    </header>
    <main style={{ flex: 1, display: 'grid', placeItems: 'center', width: '100%', padding: 'clamp(24px, 5vw, 64px) clamp(20px, 4vw, 48px)' }}>
      {dialog ? <>
        <Button onClick={() => setDialogOpen(true)}>Open connection setup</Button>
        <Modal isOpen={dialogOpen} onClose={() => setDialogOpen(false)} size={MODAL_SIZE.auto} animate={false}
          overrides={{ Dialog: { style: { width: connected ? '800px' : '640px', maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', marginTop: '16px', marginBottom: '16px',
            backgroundColor: theme.colors.backgroundPrimary } },
          DialogContainer: { style: { alignItems: 'center' } },
          Close: { props: { 'aria-label': 'Close connection setup' }, style: { ':focus': { outline: `2px solid ${theme.colors.contentPrimary}` } } } }}>
          <div style={{ padding: 'clamp(24px, 5vw, 48px)', paddingTop: '64px' }}>{body}
            <footer style={{ paddingTop: theme.sizing.scale800 }}><PrivacySharingDetails /></footer>
          </div>
        </Modal>
      </> : <div style={{ width: '100%', maxWidth: connected ? 800 : 560 }}>{body}</div>}
    </main>
    {(!dialog || !dialogOpen) && <footer style={{ display: 'flex', justifyContent: 'flex-end',
      padding: 'clamp(20px, 4vw, 48px)' }}><PrivacySharingDetails /></footer>}
  </div>;
}
