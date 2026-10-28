import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { ConnectionSetupFrame } from './setup-frame';
import { channelApi, channelDownload, channelUpload } from './cedar-channel-api';
import { useEmailSourceEpoch } from './email-source-session';
import { DocumentLineTable } from './document-line-table';

export type InvoiceUpload = {
  source_ref: string; source_kind: 'operator_upload'; name: string; content_type: string;
  created_at: number; expires_at: number; status: 'uploaded' | 'review';
  result: { columns: string[]; rows: Record<string, unknown>[]; confidence: number } | null;
  provenance: { source_ref: string; source_revision: number; method: string; actor: string; policy: string; consent_at: number };
};
export const readInvoiceUploads = () => channelApi<{ documents: InvoiceUpload[] }>('/documents');

type InvoiceHistoryUploadProps = {
  presentation: 'page' | 'dialog'; onClose: () => void; onBack?: () => void;
  onResults?: (documents: InvoiceUpload[]) => void;
};

export function InvoiceHistoryUpload(props: InvoiceHistoryUploadProps) {
  const epoch = useEmailSourceEpoch();
  return <InvoiceHistoryUploadContent key={epoch} {...props} />;
}

function InvoiceHistoryUploadContent({ presentation, onClose, onBack, onResults }: InvoiceHistoryUploadProps) {
  const [, theme] = useStyletron();
  const [documents, setDocuments] = React.useState<InvoiceUpload[]>([]);
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selected, setSelected] = React.useState<InvoiceUpload | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const active = React.useRef(true);
  React.useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const update = React.useCallback(async () => {
    const result = await readInvoiceUploads(); setDocuments(result.documents); return result.documents;
  }, []);
  React.useEffect(() => { void update().catch(error => setError(error instanceof Error ? error.message : 'Open your document workspace again.')); }, [update]);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'Choose the document again.'); }
    finally { setBusy(false); }
  }
  async function upload(file: File) {
    await perform(async () => {
      if (!consent) throw new Error('Confirm private document storage first.');
      if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type) || file.size > 12 * 1024 * 1024)
        throw new Error('Choose a PDF, JPG or PNG smaller than 12 MB.');
      const form = new FormData(); form.append('file', file); form.append('retention_consent', 'private-30-days');
      const uploaded = await channelUpload<InvoiceUpload>('/documents', form);
      await update();
      const parsed = await channelApi<InvoiceUpload>(`/documents/${uploaded.source_ref}/parse`, { body: {}, timeoutMs: 620000 });
      setSelected(parsed); await update();
    });
  }
  return <ConnectionSetupFrame title={selected ? 'Review document lines' : 'Earlier invoices'} presentation={presentation}
    onClose={onClose} onBack={selected ? () => setSelected(null) : onBack} testId="invoice-history-upload">
    <div style={{ ...theme.typography.ParagraphMedium, display: 'grid', gap: theme.sizing.scale500, minWidth: 0 }}>
      {error && <p role="alert" style={{ color: theme.colors.contentNegative, margin: 0 }}>{error}</p>}
      {busy && <p role="status">Reading document lines…</p>}
      {selected ? <article data-testid="invoice-upload-review" style={{ minWidth: 0, display: 'grid', gap: theme.sizing.scale500 }}>
        <h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>{selected.name}</h2>
        {selected.result && <DocumentLineTable result={selected.result} />}
        <details style={theme.typography.ParagraphSmall}><summary>Source details</summary>
          <p>{selected.source_ref} · {selected.provenance.method}</p></details>
        <Button disabled={busy} data-testid="invoice-upload-review-done" onClick={() => { onResults?.(documents); setSelected(null); }}>Continue</Button>
      </article> : <>
        <Checkbox checked={consent} onChange={event => setConsent(event.currentTarget.checked)} data-testid="invoice-upload-consent">
          Keep these files privately for 30 days
        </Checkbox>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png" data-testid="invoice-upload-file"
          aria-label="Choose an invoice document" disabled={!consent || busy} onChange={event => {
            const file = event.currentTarget.files?.[0]; if (file) void upload(file); event.currentTarget.value = '';
          }} style={{ display: 'none' }} />
        <Button disabled={!consent || busy} onClick={() => input.current?.click()} data-testid="invoice-upload-choose">Choose document</Button>
        <p style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, margin: 0 }}>PDF, JPG or PNG · Up to 12 MB</p>
        {documents.map(document => <article key={document.source_ref} data-testid="invoice-upload-card"
          style={{ display: 'grid', gap: theme.sizing.scale300, padding: theme.sizing.scale500,
            border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, overflowWrap: 'anywhere' }}>
          <strong>{document.name}</strong><span>{document.status === 'review' ? 'Lines ready to review' : 'Ready to read'}</span>
          <Button disabled={busy} kind={KIND.secondary} data-testid="invoice-upload-open" onClick={() => void perform(async () => {
            const result = document.result ? document : await channelApi<InvoiceUpload>(`/documents/${document.source_ref}/parse`, { body: {}, timeoutMs: 620000 });
            setSelected(result); await update();
          })}>{document.result ? 'Review lines' : 'Read document'}</Button>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
            <Button disabled={busy} kind={KIND.tertiary} onClick={() => void perform(async () => {
              const blob = await channelDownload(`/documents/${document.source_ref}/file`);
              if (!active.current) return;
              const url = URL.createObjectURL(blob); const link = window.document.createElement('a');
              link.href = url; link.download = document.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
            })}>Download</Button>
            <Button disabled={busy} kind={KIND.tertiary} data-testid="invoice-upload-remove" onClick={() => void perform(async () => {
              await channelApi(`/documents/${document.source_ref}`, { method: 'DELETE' }); await update();
            })}>Remove file</Button>
          </div>
        </article>)}
        {documents.some(document => document.status === 'review') && <Button kind={KIND.secondary} data-testid="invoice-upload-continue"
          onClick={() => { onResults?.(documents); onClose(); }}>Continue with these documents</Button>}
      </>}
    </div>
  </ConnectionSetupFrame>;
}
