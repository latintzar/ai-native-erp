/**
 * Source text and attachments for a conversation. Provider HTML is never rendered directly.
 * Production provider attachments are opaque references opened through an authorized same-origin
 * endpoint; only synthetic kit fixtures may create a short-lived object URL from source text.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Glyph } from './glyphs';
import { usePhoneFloorHeight } from './shell';
import type { ThreadRow } from './sale';

export function safeSourceUrl(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch { return undefined; }
}

/** Provider bytes must be streamed after server authorization, never supplied as a provider URL. */
export function safeProviderAttachmentPath(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      && /^\/api\/source-email\/attachments\/[A-Za-z0-9._~-]+$/.test(url.pathname)
      ? url.pathname
      : undefined;
  } catch { return undefined; }
}

export function SourceText({ text }: { text: string }) {
  const [, theme] = useStyletron();
  return <>{text.split(/(https?:\/\/[^\s<>]+)/g).map((part, i) => {
    const url = /^https?:\/\//.test(part) ? safeSourceUrl(part) : undefined;
    return url ? <a key={i} href={url} target="_blank" rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      style={{ color: theme.colors.contentPrimary, overflowWrap: 'anywhere', textDecoration: 'underline' }}>{part}</a> : part;
  })}</>;
}

export function SourceAttachment({ file }: { file: NonNullable<ThreadRow['attachments']>[number] }) {
  const [, theme] = useStyletron();
  /* the attachment chip IS the door to the file, so on a phone it takes INTX-12's 44px floor —
     height only, because its width is the file's own name (E193.14) */
  const floor = usePhoneFloorHeight();
  const [fixtureUrl, setFixtureUrl] = React.useState<string>();
  React.useEffect(() => {
    if (file.source !== 'fixture') {
      setFixtureUrl(undefined);
      return;
    }
    const url = URL.createObjectURL(new Blob([file.text], { type: 'text/plain;charset=utf-8' }));
    setFixtureUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const href = file.source === 'fixture' ? fixtureUrl : safeProviderAttachmentPath(file.openPath);
  const style: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: theme.sizing.scale200,
    color: theme.colors.contentPrimary, ...theme.typography.LabelXSmall,
    border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius200,
    padding: theme.sizing.scale300, overflowWrap: 'anywhere', textDecoration: href ? 'underline' : 'none',
    ...floor,
  };
  if (!href) return <span data-testid={`source-file-${file.id}`} data-source-unavailable="yes" aria-disabled="true" style={style}>
    <Glyph id="doc" size={16} />{file.name} · Open in the original mailbox
  </span>;
  return <a data-testid={`source-file-${file.id}`} href={href} download={file.source === 'fixture' ? file.name : undefined}
    target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" style={style}>
    <Glyph id="doc" size={16} />{file.name}
  </a>;
}
