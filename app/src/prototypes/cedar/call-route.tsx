import * as React from 'react';
import { useConfig } from './config';
import { useCompany } from './company';
import { parsePhoneRoute } from './phone-route';
import { closeCallRoute } from './call-navigation';
import { PhoneDialDialog } from './phone-controller';
import { PhoneHistory } from './phone-history';
import { PhoneSetup } from './phone-setup';
import { openPhoneCall, usePhoneSession } from './phone-session';
import { WorkflowDialog } from './workflow-dialog';

/** URL-addressable call task, backed by the same session and provider used inside chats. */
export default function CallRoute() {
  const { derived } = useConfig();
  const company = useCompany();
  const session = usePhoneSession();
  const [hash, setHash] = React.useState(window.location.hash);
  const [setup, setSetup] = React.useState(false);
  React.useEffect(() => {
    const read = () => { setHash(window.location.hash); setSetup(false); };
    window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
  }, []);
  const route = parsePhoneRoute(hash);
  const close = closeCallRoute;
  const customerId = route?.kind === 'dial' ? route.customerId : undefined;
  const number = route?.kind === 'dial' ? route.number : undefined;
  /* THE NUMBER THE ENTRANCE CARRIED IS THE NUMBER THAT GETS DIALLED. The customer record answers
     for the name and the account; a telephone account's own number is derived from that account
     rather than stored on it, so resolving the customer and then reading `customer.phone` opened
     the dial with an empty field and a dead Call button. */
  const initial = React.useMemo(() => {
    const match = derived.cast.customers.find(customer => customer.id === customerId);
    if (match) return number && match.phone !== number ? { ...match, phone: number } : match;
    return number ? { id: 'dial-number', name: '', phone: number, channel: 'phone' as const, tier: '', settles: 'cash on delivery' as const } : null;
  }, [derived.cast.customers, customerId, number]);
  React.useEffect(() => { if (route?.kind === 'call' && session.active?.sid === route.sid) openPhoneCall(); }, [hash, session.active?.sid]);
  if (!route) return null;
  if (setup) return <PhoneSetup presentation="dialog" tenant={derived.cast.sector} sourceNumber={company.phone} members={company.members}
    onClose={() => setSetup(false)} onComplete={() => setSetup(false)} />;
  if (route.kind === 'call') return <WorkflowDialog title="Call history" onClose={close} testId="phone-call-route">
    <PhoneHistory initialCallSid={route.sid} />
  </WorkflowDialog>;
  return <PhoneDialDialog isOpen onClose={close} customers={derived.cast.customers} initialCustomer={initial}
    onOpenSettings={() => setSetup(true)} />;
}
