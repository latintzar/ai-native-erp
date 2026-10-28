/* The redline layer — specs drawn ON the living component, devtools-grade but designed.
 *
 * Toggle «Specs» on any Tile, then hover the demo: the hovered element gets its box drawn —
 * content outline, padding field, and a chip stating the real numbers (type, padding, gap,
 * radius, size) read from getComputedStyle AT THAT MOMENT. Click pins one; Esc unpins.
 *
 * Why live and not pictures: an annotation image is a claim, and claims drift. These are
 * measurements of the rendered truth — retheme the system and every redline updates itself.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';

type Pin = { el: Element; rect: DOMRect } | null;

const fmt = (v: string) => v.replace(/px/g, '').replace(/\s+/g, ' ');
const pad = (cs: CSSStyleDeclaration) => {
  const t = cs.paddingTop, r = cs.paddingRight, b = cs.paddingBottom, l = cs.paddingLeft;
  if (t === r && r === b && b === l) return fmt(t);
  if (t === b && l === r) return `${fmt(t)} ${fmt(r)}`;
  return `${fmt(t)} ${fmt(r)} ${fmt(b)} ${fmt(l)}`;
};

/** what the chip states — only what is true and useful, in spec shorthand */
function readSpec(el: Element): string[] {
  const cs = getComputedStyle(el);
  const r = (el as HTMLElement).getBoundingClientRect();
  const lines: string[] = [];
  lines.push(`${Math.round(r.width)}×${Math.round(r.height)}`);
  if (cs.padding !== '0px') lines.push(`pad ${pad(cs)}`);
  if (cs.gap && cs.gap !== 'normal' && cs.gap !== '0px') lines.push(`gap ${fmt(cs.gap)}`);
  const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
  if (hasText) lines.push(`${fmt(cs.fontSize)}/${fmt(cs.lineHeight)} w${cs.fontWeight}`);
  if (cs.borderRadius !== '0px') lines.push(`r ${fmt(cs.borderRadius)}`);
  if (cs.borderTopWidth !== '0px') lines.push(`border ${fmt(cs.borderTopWidth)}`);
  return lines;
}

const Box: React.FC<{ rect: DOMRect; host: DOMRect; ink: string; pinned?: boolean }> = ({ rect, host, ink, pinned }) => {
  const cs = { position: 'absolute' as const, pointerEvents: 'none' as const };
  return (
    <>
      {/* the element's box */}
      <div style={{ ...cs, left: rect.left - host.left, top: rect.top - host.top, width: rect.width, height: rect.height, outline: `1px ${pinned ? 'solid' : 'dashed'} ${ink}`, outlineOffset: -1 }} />
      {/* width + height rules, spec-style */}
      <span style={{ ...cs, left: rect.left - host.left, top: rect.top - host.top - 16, fontSize: 10, fontVariantNumeric: 'tabular-nums', color: ink, background: 'rgba(255,255,255,0.92)', padding: '0 3px' }}>
        {Math.round(rect.width)}
      </span>
      <span style={{ ...cs, left: rect.left - host.left + rect.width + 3, top: rect.top - host.top, fontSize: 10, fontVariantNumeric: 'tabular-nums', color: ink, background: 'rgba(255,255,255,0.92)', padding: '0 3px' }}>
        {Math.round(rect.height)}
      </span>
    </>
  );
};

export const Redline: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => {
  const [, theme] = useStyletron();
  const hostRef = React.useRef<HTMLDivElement>(null);
  const [hover, setHover] = React.useState<Pin>(null);
  const [pinned, setPinned] = React.useState<Pin>(null);
  const ink = theme.colors.contentPrimary;

  React.useEffect(() => {
    if (!on) { setHover(null); setPinned(null); return; }
    const host = hostRef.current;
    if (!host) return;
    const over = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || !host.contains(el) || el === host) { setHover(null); return; }
      setHover({ el, rect: el.getBoundingClientRect() });
    };
    const click = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && host.contains(el) && el !== host) {
        e.preventDefault(); e.stopPropagation();
        setPinned({ el, rect: el.getBoundingClientRect() });
      }
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setPinned(null); };
    host.addEventListener('mousemove', over);
    host.addEventListener('click', click, true); // capture: a pin must not press the button under it
    window.addEventListener('keydown', key);
    return () => {
      host.removeEventListener('mousemove', over);
      host.removeEventListener('click', click, true);
      window.removeEventListener('keydown', key);
    };
  }, [on]);

  const hostRect = hostRef.current?.getBoundingClientRect();
  const active = pinned ?? hover;

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%' }}>
      {children}
      {on && hostRect && active && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Box rect={active.rect} host={hostRect} ink={ink} pinned={!!pinned} />
          <div style={{
            position: 'absolute',
            left: Math.min(active.rect.left - hostRect.left, hostRect.width - 170),
            top: active.rect.bottom - hostRect.top + 6,
            background: theme.colors.backgroundPrimary,
            border: `1px solid ${ink}`,
            borderRadius: theme.borders.radius100,
            padding: '4px 8px',
            ...theme.typography.MonoLabelXSmall,
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1.5,
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}>
            <div style={{ color: theme.colors.contentTertiary }}>{active.el.tagName.toLowerCase()}{(active.el as HTMLElement).dataset?.baseweb ? ` · ${(active.el as HTMLElement).dataset.baseweb}` : ''}</div>
            {readSpec(active.el).map((l, i) => <div key={i}>{l}</div>)}
          </div>
        </div>
      )}
    </div>
  );
};
