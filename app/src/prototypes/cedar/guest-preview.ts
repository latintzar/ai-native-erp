/** An explicitly configured, same-origin guest mount; ordinary builds remain unchanged. */
declare const __ATELIER_GUEST_PREFIX__: string | undefined;
export function guestPrefix(): string {
  const prefix = (typeof __ATELIER_GUEST_PREFIX__ === 'string' ? __ATELIER_GUEST_PREFIX__ : '').trim();
  if (!prefix) return '';
  if (!/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]+$/.test(prefix)) throw new Error('Invalid guest preview prefix');
  return prefix;
}
