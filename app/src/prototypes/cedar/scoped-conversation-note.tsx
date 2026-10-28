/** A short operator/AI note that belongs to one source object inside one tenant, never the stream. */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Glyph, STEP } from './glyphs';

export type ScopedConversationNote = { id: string; says: string };

const KEY = 'rocoto:scoped-conversation-notes:dismissed';
const listeners = new Set<() => void>();
let revision = 0;
const hydratedScopes = new Set<string>();
const dismissedByScope = new Map<string, Set<string>>();

const keyOf = (scope: string): string => `${KEY}:${scope || 'default'}`;
const bookOf = (scope: string): Set<string> => {
  const held = dismissedByScope.get(scope);
  if (held) return held;
  const book = new Set<string>();
  dismissedByScope.set(scope, book);
  return book;
};

function hydrate(scope: string): Set<string> {
  const book = bookOf(scope);
  if (hydratedScopes.has(scope) || typeof window === 'undefined') return book;
  hydratedScopes.add(scope);
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(keyOf(scope)) ?? '[]');
    if (Array.isArray(saved)) saved.filter((id): id is string => typeof id === 'string').forEach((id) => book.add(id));
  } catch {
    /* A blocked/corrupt session store must not hide the source note or break its message. */
  }
  return book;
}

export function scopedConversationNoteStanding(scope: string, note?: ScopedConversationNote): boolean {
  return Boolean(note && !hydrate(scope).has(note.id));
}

export function dismissScopedConversationNote(scope: string, id: string): void {
  const book = hydrate(scope);
  book.add(id);
  revision += 1;
  try { window.sessionStorage.setItem(keyOf(scope), JSON.stringify([...book])); } catch { /* session-only is enough */ }
  listeners.forEach((listener) => listener());
}

export function useScopedConversationNotes(scope: string): number {
  hydrate(scope);
  return React.useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => revision,
    () => revision,
  );
}

/** The sentence sits immediately above the object it explains. The exact card receives the ring. */
export function ScopedConversationNoteLine({ scope, note, side = 'received', testid = 'scoped-conversation-note' }: {
  scope: string;
  note: ScopedConversationNote;
  side?: 'received' | 'sent';
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return <div data-testid={testid} data-note={note.id} style={{ display: 'flex', justifyContent: side === 'sent' ? 'flex-end' : 'flex-start', padding: `${theme.sizing.scale100} ${theme.sizing.scale300}`, minWidth: 0 }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale200, width: 'fit-content', maxWidth: '78%', minWidth: 0,
      padding: `${theme.sizing.scale200} ${theme.sizing.scale200} ${theme.sizing.scale200} ${theme.sizing.scale400}`,
      border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
      backgroundColor: theme.colors.backgroundPrimary,
      boxShadow: `0 8px 20px color-mix(in srgb, ${theme.colors.contentPrimary} 8%, transparent)` }}>
      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere', minWidth: 0 }}>{note.says}</span>
      <button type="button" aria-label="Dismiss note" data-testid={`${testid}-dismiss`}
        onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); dismissScopedConversationNote(scope, note.id); }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          // Pointer input dismisses on pointerdown so an enclosing card never opens first.
          // Keyboard activation has no pointerdown and reports a zero-detail click.
          if (event.detail === 0) dismissScopedConversationNote(scope, note.id);
        }} style={{ display: 'grid', placeItems: 'center', width: 44, height: 44, minWidth: 44, minHeight: 44, flex: '0 0 auto', padding: 0,
          border: 0, borderRadius: '50%', background: 'transparent', color: 'inherit', cursor: 'default', fontFamily: 'inherit' }}>
        <Glyph id="minus" size={STEP.small} />
      </button>
    </span>
  </div>;
}
