import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/700.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Client as Styletron } from 'styletron-engine-monolithic';
import { Provider as StyletronProvider } from 'styletron-react';
import { BaseProvider, useStyletron } from 'baseui';
import { Button } from 'baseui/button';
import { Input } from 'baseui/input';
import { FormControl } from 'baseui/form-control';
import { HeadingLarge, HeadingSmall, ParagraphMedium, LabelMedium } from 'baseui/typography';
import { RocotoTheme } from '../rocoto-theme';

type Session = { email: string; environment: string; csrf: string };
type Account = { slug: string; name: string; status: string; seeded: boolean; updated_at: string;
  address?: string; city?: string; region?: string; country?: string; plan?: string };
type Member = { id: string; name: string; email: string; role: string };
type Connection = { id: number; kind: string; provider: string; status: string; updated_at: string };
type Run = { run_id: string; scenario_id: string; phase: string; effects: string };
type Audit = { id: number; created_at: string; actor_email: string; action: string; outcome: string };
type Detail = { account: Account; capabilities: string[]; members: Member[];
  connections: Connection[]; synthetic_runs: Run[] };

class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api/operator' + path, { credentials: 'same-origin', ...init });
  const body = await response.json();
  if (!response.ok) throw new ApiError(response.status, body.error || body.detail || 'request_failed');
  return body;
}
function message(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Sign in with your assigned Google account.';
    if (error.status === 403) return 'This account requires an active support grant. Refresh after access is updated.';
    if (error.code === 'revision_conflict') return 'This account has changed. Refresh to review its latest details.';
    if (error.status === 429) return 'Please retry in a minute.';
  }
  return 'The request needs another attempt. Refresh the account to check its current state.';
}

function Console() {
  const [css, theme] = useStyletron();
  const [session, setSession] = useState<Session | null>(null);
  const [loginReady, setLoginReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [confirmMember, setConfirmMember] = useState<Member | null>(null);
  const block = css({ padding: theme.sizing.scale600, borderBottom: `1px solid ${theme.colors.borderOpaque}` });
  const table = css({ width: '100%', borderCollapse: 'collapse', textAlign: 'left' });
  const cell = css({ padding: theme.sizing.scale400, borderBottom: `1px solid ${theme.colors.borderOpaque}` });
  const panel = css({ padding: theme.sizing.scale600, backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borders.radius200 });

  async function load(after = '') {
    setBusy(true); setError('');
    try {
      const login = await api<{ configured: boolean }>('/auth/config'); setLoginReady(login.configured);
      const identity = await api<Session>('/session'); setSession(identity);
      const page = await api<{ accounts: Account[]; next: string | null }>('/accounts?after=' + encodeURIComponent(after));
      setAccounts(page.accounts); setNext(page.next);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function select(slug: string) {
    setBusy(true); setError(''); setNotice(''); setDetail(null); setAudit([]); setConfirmMember(null); setReason('');
    try {
      const row = await api<Detail>('/accounts/' + encodeURIComponent(slug));
      setDetail(row); setName(row.account.name);
      setAccounts(current => current.map(account => account.slug === slug ? row.account : account));
      if (row.capabilities.includes('audit.read')) {
        const events = await api<{ audit: Audit[] }>('/accounts/' + encodeURIComponent(slug) + '/audit');
        setAudit(events.audit);
      }
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  async function write(action: 'edit' | 'revoke') {
    if (!detail || !session) return;
    const slug = detail.account.slug;
    setBusy(true); setError(''); setNotice('');
    try {
      const path = '/accounts/' + encodeURIComponent(slug) + (action === 'revoke' ? '/sessions/revoke' : '');
      const body = action === 'edit' ? { changes: { name }, revision: detail.account.updated_at, reason }
        : { operator_id: confirmMember?.id, reason };
      await api(path, { method: action === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Sup-CSRF': session.csrf, 'Idempotency-Key': crypto.randomUUID() },
        body: JSON.stringify(body) });
      await select(slug); setNotice(action === 'edit' ? 'Account details saved.' : 'Selected account sessions revoked.');
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  return <main className={css({ maxWidth: '1120px', margin: '0 auto', padding: theme.sizing.scale600,
    color: theme.colors.contentPrimary, backgroundColor: theme.colors.backgroundPrimary,
    fontFamily: theme.typography.ParagraphMedium.fontFamily })}>
    <HeadingLarge>Operator Console</HeadingLarge>
    <ParagraphMedium>{session ? `${session.environment} · ${session.email}` : 'Product account support'}</ParagraphMedium>
    {!session && (loginReady ? <Button onClick={() => { window.location.href = '/api/operator/auth/login'; }}>Sign in with Google</Button>
      : <ParagraphMedium>Google sign-in becomes available after this environment’s identity configuration is completed.</ParagraphMedium>)}
    <Button onClick={() => { setDetail(null); void load(); }} disabled={busy} kind="secondary">Refresh accounts</Button>
    {error && <ParagraphMedium role="alert">{error}</ParagraphMedium>}
    {notice && <ParagraphMedium role="status">{notice}</ParagraphMedium>}
    {session && <section className={block} aria-label="Accounts">
      <HeadingSmall>Accounts</HeadingSmall>
      {accounts.length === 0 && <ParagraphMedium>Assigned accounts appear here when an active support grant is recorded.</ParagraphMedium>}
      <div className={css({ overflowX: 'auto' })}><table className={table}><thead><tr>
        <th className={cell}>Account</th><th className={cell}>State</th><th className={cell}>Data</th><th className={cell}>Details</th>
      </tr></thead><tbody>{accounts.map(account => <tr key={account.slug}>
        <td className={cell}>{account.name}<br /><LabelMedium>{account.slug}</LabelMedium></td>
        <td className={cell}>{account.status}</td><td className={cell}>{account.seeded ? 'Seeded' : 'Account data'}</td>
        <td className={cell}><Button size="compact" kind="secondary" disabled={busy} onClick={() => void select(account.slug)}>Open {account.name}</Button></td>
      </tr>)}</tbody></table></div>
      {next && <Button disabled={busy} onClick={() => void load(next)}>Next accounts</Button>}
    </section>}
    {detail && <>
      <section className={block} aria-label="Account details">
        <HeadingSmall>{detail.account.name}</HeadingSmall>
        <ParagraphMedium>{detail.account.slug} · {detail.account.status} · {detail.account.plan || 'Plan pending'}</ParagraphMedium>
        <ParagraphMedium>{[detail.account.address, detail.account.city, detail.account.country].filter(Boolean).join(', ')}</ParagraphMedium>
        {detail.capabilities.includes('accounts.edit') && <form className={panel} onSubmit={e => { e.preventDefault(); void write('edit'); }}>
          <FormControl label="Account name"><Input value={name} onChange={e => setName(e.currentTarget.value)} maxLength={300} required /></FormControl>
          <FormControl label="Reason for this support action"><Input value={reason} onChange={e => setReason(e.currentTarget.value)} maxLength={500} required /></FormControl>
          <Button type="submit" disabled={busy || reason.trim().length < 3}>Save account name</Button>
        </form>}
      </section>
      <section className={block} aria-label="Team members"><HeadingSmall>Team members</HeadingSmall>
        {detail.members.map(member => <div key={member.id} className={block}>
          <ParagraphMedium>{member.name} · {member.email} · {member.role}</ParagraphMedium>
          {detail.capabilities.includes('sessions.revoke') && <Button kind="secondary" disabled={busy}
            onClick={() => { setConfirmMember(member); setReason(''); }}>Revoke {member.name || member.email}'s sessions</Button>}
        </div>)}
        {confirmMember && <form className={panel} onSubmit={e => { e.preventDefault(); void write('revoke'); }}>
          <ParagraphMedium>Revoke {confirmMember.email}'s sessions for {detail.account.name}.</ParagraphMedium>
          <FormControl label="Reason for revoking sessions"><Input value={reason} onChange={e => setReason(e.currentTarget.value)} maxLength={500} required /></FormControl>
          <Button type="submit" disabled={busy || reason.trim().length < 3}>Confirm session revocation</Button>{' '}
          <Button kind="secondary" type="button" onClick={() => setConfirmMember(null)}>Cancel</Button>
        </form>}
      </section>
      <section className={block} aria-label="Connections"><HeadingSmall>Connections</HeadingSmall>
        {detail.connections.length ? detail.connections.map(connection => <ParagraphMedium key={connection.id}>
          {connection.kind} · {connection.provider} · {connection.status} · {new Date(connection.updated_at).toLocaleString()}
        </ParagraphMedium>) : <ParagraphMedium>Connections appear after the account completes provider setup.</ParagraphMedium>}
      </section>
      <section className={block} aria-label="Synthetic scenarios"><HeadingSmall>Synthetic scenarios</HeadingSmall>
        <ParagraphMedium>Scenario setup, processing and cleanup use the company test-data lifecycle. Registered receipts appear below.</ParagraphMedium>
        {detail.synthetic_runs.map(run => <ParagraphMedium key={run.run_id}>{run.scenario_id} · {run.phase} · {run.effects}<br />{run.run_id}</ParagraphMedium>)}
      </section>
      {detail.capabilities.includes('audit.read') && <section className={block} aria-label="Audit"><HeadingSmall>Audit</HeadingSmall>
        {audit.map(event => <ParagraphMedium key={event.id}>{new Date(event.created_at).toLocaleString()} · {event.actor_email}<br />{event.action} · {event.outcome}</ParagraphMedium>)}
      </section>}
    </>}
  </main>;
}
const engine = new Styletron();
createRoot(document.getElementById('root')!).render(<StyletronProvider value={engine}><BaseProvider theme={RocotoTheme}><Console /></BaseProvider></StyletronProvider>);
