import { guestPrefix } from '../guest-preview';
export class ProofApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Same-origin HttpOnly sessions only; responses, message bodies and codes stay in memory. */
export async function proofApi<T>(path: string, options: {
  body?: unknown; signal?: AbortSignal; timeoutMs?: number;
} = {}): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, options.timeoutMs ?? 20000);
  try {
    const response = await fetch(`${guestPrefix()}/api/proof${path}`, {
      method: options.body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : undefined;
      throw new ProofApiError(response.status, typeof detail === 'string' ? detail.slice(0, 350) : 'The connection needs another check. Try again.');
    }
    if (data === null) throw new ProofApiError(502, 'The connection response is still pending. Try again.');
    return data as T;
  } catch (error) {
    if (error instanceof ProofApiError) throw error;
    if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    throw new ProofApiError(0, 'The connection is taking longer than expected. Check your connection and try again.');
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export const errorText = (error: unknown): string => error instanceof ProofApiError
  ? error.message : 'The connection needs another check. Try again.';

export const disconnectWhatsApp = (signal?: AbortSignal) => proofApi<{
  connection: null;
}>('/whatsapp/disconnect', { body: {}, signal, timeoutMs: 65000 });
