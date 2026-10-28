import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Modal, SIZE as MODAL_SIZE } from 'baseui/modal';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useWorkflowViewport } from './workflow-dialog';

export type SetupPresentation = 'page' | 'dialog';

/** Cedar's WhatsApp setup anatomy (PR #81, 693055d3), with provider state supplied by its owner. */
export function ConnectionSetupFrame({ title, description, context, presentation, onClose, onBack, children, disclosure, testId = 'connection-setup', contentTitleId }: {
  title: string;
  contentTitleId?: string;
  description?: string;
  context?: string;
  presentation: SetupPresentation;
  onClose: () => void;
  onBack?: () => void;
  children: React.ReactNode;
  disclosure?: React.ReactNode;
  testId?: string;
}) {
  const [css, theme] = useStyletron();
  const generatedTitleId = React.useId();
  const titleId = contentTitleId || generatedTitleId;
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const visualHeight = useWorkflowViewport(true);
  const viewport = visualHeight ? `${Math.floor(visualHeight)}px` : '100dvh';
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [title]);
  const content = <div key={title} data-testid={testId} data-presentation={presentation} className={css({
    display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: theme.sizing.scale700, minWidth: 0, maxWidth: '100%',
    animationName: { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
    animationDuration: '400ms', animationTimingFunction: 'ease-out',
    '@media (prefers-reduced-motion: reduce)': { animationDuration: '0ms' },
  })}>
    {onBack && <div><Button kind={KIND.tertiary} size={SIZE.compact} onClick={onBack}
      data-testid="setup-back" startEnhancer={() => <ArrowLeft size={18} aria-hidden />}>Back</Button></div>}
    {title && <div style={{ display: 'grid', gap: theme.sizing.scale400 }}>
      <h1 ref={titleRef} id={titleId} tabIndex={-1} style={{ ...theme.typography.HeadingLarge,
        fontSize: 'clamp(28px, 4vw, 36px)', lineHeight: 1.2, letterSpacing: '-0.025em',
        margin: 0, outline: 'none', overflowWrap: 'anywhere' }}>{title}</h1>
      {description && <p style={{ ...theme.typography.ParagraphMedium, color: theme.colors.contentSecondary,
        margin: 0, textWrap: 'pretty' }}>{description}</p>}
      {context && <p data-testid="setup-context" style={{ ...theme.typography.LabelSmall,
        color: theme.colors.contentSecondary, margin: 0 }}>{context}</p>}
    </div>}
    {children}
    {disclosure && <footer style={{ paddingTop: theme.sizing.scale400 }}>{disclosure}</footer>}
  </div>;
  if (presentation === 'dialog') return <Modal isOpen onClose={onClose} size={MODAL_SIZE.auto}
    autoFocus returnFocus animate overrides={{
      Root: { style: { zIndex: 16 } },
      Dialog: { props: { 'aria-labelledby': titleId, 'data-workflow-frame': 'setup' }, style: {
        width: '640px', maxWidth: 'calc(100vw - 32px)', maxHeight: `calc(${viewport} - 32px)`,
        overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', marginTop: '16px', marginBottom: '16px',
        backgroundColor: theme.colors.backgroundPrimary, transitionDuration: '400ms',
        '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
      } },
      DialogContainer: { style: { alignItems: 'center', height: viewport, minHeight: viewport } },
      Close: { props: { 'aria-label': 'Close connection setup', 'data-testid': 'setup-close' }, style: { minWidth: '44px', minHeight: '44px' } },
    }}><div style={{ boxSizing: 'border-box', minWidth: 0, padding: '64px clamp(20px, 5vw, 48px) clamp(24px, 5vw, 48px)' }}>{content}</div></Modal>;
  return <div style={{ minHeight: '100dvh', width: '100%', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', backgroundColor: theme.colors.backgroundPrimary }}>
    <header style={{ padding: 'clamp(20px, 4vw, 48px)', display: 'flex', flexWrap: 'wrap', minWidth: 0, boxSizing: 'border-box', alignItems: 'center', gap: theme.sizing.scale400 }}>
      <span role="img" aria-label="Rocoto" style={{ display: 'block', width: 40, height: 40, flexShrink: 0,
        backgroundColor: theme.colors.contentPrimary, maskImage: 'url(/brand/rocoto-mark.svg)', WebkitMaskImage: 'url(/brand/rocoto-mark.svg)',
        maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center',
        maskSize: 'contain', WebkitMaskSize: 'contain' }} />
      <span aria-hidden style={theme.typography.LabelLarge}>Rocoto</span>
    </header>
    <main style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', justifyItems: 'center', alignItems: 'start', width: '100%', minWidth: 0, boxSizing: 'border-box',
      padding: 'clamp(20px, 6vh, 64px) clamp(20px, 4vw, 48px) 64px' }}>
      <div style={{ width: '100%', maxWidth: 680, minWidth: 0, boxSizing: 'border-box' }}>{content}</div>
    </main>
  </div>;
}

export function SetupChoice({ name, description, logo, icon, onClick, testId, variant = 'row', connected = false }: {
  name: string; description?: string; logo?: string; icon?: React.ReactNode; onClick: () => void; testId: string;
  variant?: 'row' | 'tile'; connected?: boolean;
}) {
  const [css, theme] = useStyletron();
  const tile = variant === 'tile';
  return <button type="button" onClick={onClick} data-testid={testId} className={css({
    display: 'flex', flexDirection: tile ? 'column' : 'row', alignItems: tile ? 'flex-start' : 'center', gap: theme.sizing.scale500, width: '100%', minWidth: 0, boxSizing: 'border-box',
    position: 'relative', ...(tile ? { aspectRatio: '1 / 1', justifyContent: 'space-between', minHeight: '152px' } : {}),
    border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
    padding: tile ? 'clamp(16px, 2vw, 24px)' : theme.sizing.scale500, textAlign: 'left', color: theme.colors.contentPrimary,
    backgroundColor: theme.colors.backgroundPrimary, cursor: 'pointer',
    transition: 'background-color 400ms ease, border-color 400ms ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
    ':hover': { backgroundColor: theme.colors.backgroundSecondary },
  })}>
    {icon && <span style={{ display: 'grid', placeItems: 'center', width: 40, height: 40, flexShrink: 0, backgroundColor: theme.colors.backgroundSecondary, borderRadius: theme.borders.radius200 }}>{icon}</span>}
    {logo && <img src={logo} alt="" width={tile ? 48 : 64} height={tile ? 48 : 40} style={{ objectFit: 'contain', flexShrink: 0 }} />}
    <span style={{ display: 'grid', gap: theme.sizing.scale300, flex: tile ? undefined : 1, minWidth: 0 }}>
      {/* A TILE LABEL BREAKS BETWEEN ITS WORDS (§247 email pass, measured at 320): a tile gives
          the label about 70px, and `anywhere` cut «Forwarding address» into «Forwardin / g». */}
      <span style={{ ...(tile ? theme.typography.LabelMedium : theme.typography.LabelLarge), overflowWrap: tile ? 'break-word' : 'anywhere' }}>{name}</span>
      {description && <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{description}</span>}
      {connected && <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.positive, display: 'flex', alignItems: 'center', gap: theme.sizing.scale200 }}><Check size={14} aria-hidden />Connected</span>}
    </span>
    {!tile && <ArrowRight size={18} aria-hidden style={{ flexShrink: 0 }} />}
  </button>;
}

export function SetupChoices({ children, testId }: { children: React.ReactNode; testId?: string }) {
  const [css, theme] = useStyletron();
  return <div data-testid={testId} className={css({ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale500,
    '@media (max-width: 520px)': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale400 },
  })}>{children}</div>;
}

export function SetupDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <details style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
    <summary style={{ cursor: 'pointer', minHeight: 44, paddingTop: 12, paddingBottom: 12 }}>{title}</summary>
    <div style={{ display: 'grid', gap: theme.sizing.scale400, paddingTop: theme.sizing.scale300 }}>{children}</div>
  </details>;
}
