import { guestPrefix } from './guest-preview';
/** One explicit private connection workspace; scenario choices never select account access. */
import { runtimeBase } from './runtime-client';

export type ChannelWorkspace = { workspace_id: string; access_token: string; expires_at: number };
type Options = { body?: unknown; method?: 'GET' | 'POST' | 'DELETE'; signal?: AbortSignal; timeoutMs?: number };
export class ChannelApiError extends Error {
  constructor(public status: number, public detail: string) { super(detail); }
}
let allocating: Promise<ChannelWorkspace> | null = null;
let generation = 0;
const pendingRequests = new Set<AbortController>();
const requireGeneration = (expected: number) => {
  if (generation !== expected) throw new ChannelApiError(409, 'Continue from the selected connection workspace.');
};
function invalidateWorkspace(): void {
  generation++; allocating = null;
  for (const controller of pendingRequests) controller.abort();
  pendingRequests.clear();
  window.dispatchEvent(new Event('rocoto:channel-workspace-reset'));
}
function base(): string {
  const guest = guestPrefix(); if (guest) return guest;
  const candidate = runtimeBase();
  if (!candidate) return '';
  const target = new URL(candidate, location.origin);
  const local = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
  if (target.origin === location.origin && !target.pathname.replace(/\//g, '')) return '';
  if (local(location.hostname) && local(target.hostname) && ['http:', 'https:'].includes(target.protocol)
    && !target.username && !target.password && !target.search && !target.hash && target.pathname === '/') return target.origin;
  throw new ChannelApiError(400, 'Open the connection from this workspace.');
}
const key = () => `rocoto-cedar-channel-access-v1:${base() || location.origin}`;
function valid(value: unknown): value is ChannelWorkspace {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ChannelWorkspace>;
  return typeof row.workspace_id === 'string' && /^[a-f0-9]{32}$/.test(row.workspace_id)
    && typeof row.access_token === 'string' && /^[A-Za-z0-9_-]{64}$/.test(row.access_token)
    && typeof row.expires_at === 'number' && Number.isSafeInteger(row.expires_at);
}
async function request<T>(path: string, options: Options = {}, token?: string, binary = false): Promise<T> {
  if (!/^\/[a-z][a-z0-9_/-]*(?:\?[^#]*)?$/i.test(path) || path.includes('..')) throw new ChannelApiError(400, 'Choose a connection action.');
  const controller = new AbortController();
  const expectedGeneration = generation;
  pendingRequests.add(controller);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  const timer = window.setTimeout(abort, options.timeoutMs ?? 30000);
  try {
    const multipart = options.body instanceof FormData;
    const response = await fetch(`${base()}/api/cedar${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.body === undefined || multipart ? {} : { 'Content-Type': 'application/json' }) },
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body),
    });
    requireGeneration(expectedGeneration);
    if (response.ok && binary) {
      const result = await response.blob(); requireGeneration(expectedGeneration); return result as T;
    }
    const value = await response.json().catch(() => null);
    requireGeneration(expectedGeneration);
    if (!response.ok) throw new ChannelApiError(response.status, typeof value?.detail === 'string' ? value.detail.slice(0, 400) : 'Your connection needs another check. Try again.');
    if (value === null) throw new ChannelApiError(502, 'The connection response needs another check.');
    return value as T;
  } catch (error) {
    requireGeneration(expectedGeneration);
    if (error instanceof ChannelApiError) throw error;
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new ChannelApiError(0, 'The connection is taking longer than expected. Try again.');
  } finally { pendingRequests.delete(controller); clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
export async function channelWorkspace(): Promise<ChannelWorkspace> {
  const held = localStorage.getItem(key());
  if (held) {
    let parsed: unknown;
    try { parsed = JSON.parse(held); } catch { throw new ChannelApiError(401, 'Reopen your saved connection workspace to continue.'); }
    if (!valid(parsed) || parsed.expires_at * 1000 <= Date.now()) throw new ChannelApiError(401, 'Your saved workspace needs renewed connection access.');
    return parsed;
  }
  const currentGeneration = generation;
  if (!allocating) allocating = request<ChannelWorkspace>('/access/workspaces', { body: {} }).then(result => {
    if (generation !== currentGeneration) throw new ChannelApiError(409, 'Continue from the selected connection workspace.');
    if (!valid(result)) throw new ChannelApiError(502, 'The workspace response needs another check.');
    localStorage.setItem(key(), JSON.stringify(result));
    window.dispatchEvent(new Event('rocoto:channel-workspace-ready'));
    return result;
  }).finally(() => { if (generation === currentGeneration) allocating = null; });
  return allocating;
}
export async function channelApi<T>(path: string, options: Options = {}): Promise<T> {
  const expectedGeneration = generation;
  const workspace = await channelWorkspace();
  requireGeneration(expectedGeneration);
  return request<T>(path, options, workspace.access_token);
}
/** Deliberate recovery action only; an expired response never silently abandons an account. */
export function resetChannelWorkspace(): void { localStorage.removeItem(key()); invalidateWorkspace(); }

if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  let accessKey: string;
  try { accessKey = key(); } catch { return; }
  if (event.key !== null && event.key !== accessKey && event.key !== 'rocoto-runtime-base') return;
  invalidateWorkspace();
  if (hasChannelWorkspace()) window.dispatchEvent(new Event('rocoto:channel-workspace-ready'));
});

export async function channelDownload(path: string, signal?: AbortSignal): Promise<Blob> {
  const expectedGeneration = generation;
  const workspace = await channelWorkspace();
  requireGeneration(expectedGeneration);
  return request<Blob>(path, { signal, timeoutMs: 120000 }, workspace.access_token, true);
}

export function hasChannelWorkspace(): boolean {
  try { const value: unknown = JSON.parse(localStorage.getItem(key()) || 'null'); return valid(value) && value.expires_at * 1000 > Date.now(); } catch { return false; }
}

export async function channelUpload<T>(path: string, formData: FormData, timeoutMs = 120000): Promise<T> {
  const expectedGeneration = generation;
  const workspace = await channelWorkspace();
  requireGeneration(expectedGeneration);
  return request<T>(path, { body: formData, timeoutMs }, workspace.access_token);
}
