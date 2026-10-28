import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Popover, PLACEMENT, ACCESSIBILITY_TYPE } from 'baseui/popover';
import { closeSupport, openSupport, supportSnapshot, supportSubscribe } from './support';

/** A single support door. Zendesk itself owns the conversation and its close control. */
export default function SupportWidget() {
  const [, theme] = useStyletron();
  const support = React.useSyncExternalStore(supportSubscribe, supportSnapshot, supportSnapshot);
  const busy = support.phase === 'loading';
  const active = busy || support.phase === 'open';
  return (
    <Popover
      isOpen={busy || support.phase === 'error'}
      accessibilityType={ACCESSIBILITY_TYPE.none}
      onClick={active ? closeSupport : openSupport}
      placement={PLACEMENT.bottomRight}
      focusLock={false}
      autoFocus={false}
      returnFocus={false}
      onClickOutside={() => { if (support.phase === 'error') closeSupport(); }}
      onEsc={closeSupport}
      overrides={{ Body: { style: { zIndex: 12, maxWidth: 'calc(100vw - 32px)' } } }}
      content={
        <div data-testid="support-status" role={busy ? 'status' : 'alert'} style={{ padding: theme.sizing.scale600, width: 280, maxWidth: 'calc(100vw - 64px)', boxSizing: 'border-box' }}>
          <div style={{ ...theme.typography.LabelMedium, marginBottom: theme.sizing.scale300 }}>Rocoto support</div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {busy ? 'Opening support…' : support.error}
          </div>
          <div style={{ display: 'flex', gap: theme.sizing.scale300, marginTop: theme.sizing.scale500 }}>
            {!busy && <Button size={SIZE.compact} onClick={openSupport} data-testid="support-retry">Retry</Button>}
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={closeSupport} data-testid="support-dismiss">{busy ? 'Cancel' : 'Dismiss'}</Button>
          </div>
        </div>
      }
    >
      <Button
        kind={KIND.tertiary}
        size={SIZE.compact}
        shape={SHAPE.circle}
        data-testid="support-launcher"
        data-state={support.phase}
        aria-label={active ? 'Close Rocoto support' : 'Help — chat with Rocoto'}
        aria-expanded={active}
        aria-busy={busy}
        title="Help — chat with Rocoto"
        overrides={{ BaseButton: { style: { flexShrink: 0, width: '36px', height: '36px' } } }}
      >
        <span aria-hidden="true" style={{ ...theme.typography.LabelLarge, width: 20, height: 20, lineHeight: '20px', border: '1.5px solid currentColor', borderRadius: '50%', textAlign: 'center' }}>?</span>
      </Button>
    </Popover>
  );
}
