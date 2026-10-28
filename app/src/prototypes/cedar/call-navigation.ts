import { parsePhoneRoute } from './phone-route';

let parent = '#/sales';
let hasParent = false;
/** Call URLs retain one explicit return destination. A cold link starts from Sales. */
export function rememberCallParent(hash: string): void {
  if (parsePhoneRoute(hash)) return;
  if (/^#\/(sales|money|customers|stock|admin|chats)(?:\/|$)/.test(hash)) { parent = hash; hasParent = true; }
}
export const callParentRoute = (): string => parent;

/** Close consumes the call's history entry. A cold call URL replaces itself with Sales. */
export function closeCallRoute(): void {
  if (hasParent) { window.history.back(); return; }
  window.history.replaceState(null, '', window.location.pathname + window.location.search + parent);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
