import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
/* ── E200.07 · NEW CUSTOMER ASKS WITH THE SAME FIELDS THE SHEET READS (§196.1 · §195) ─────────
 * A person who has met the account sheet's channel field meets the same organ here: one filtering
 * combobox, the same optional grammar, the same 44 px floor. Base's `Select` opened a list that
 * showed everything and narrowed nothing, so the two registers this dialog asks for now filter. */
import { LiveField } from './live-field';
import type { Cast, Customer } from '../../scenarios/data/cast';
import { createCustomer, newCustomerRequestId } from './customers-made';
import { WorkflowDialog } from './workflow-dialog';
import { posthog, isPostHogConfigured } from '../../posthog';

export type Place = {
  label: string;
  zone?: string;
  at: { lat: number; lng: number };
};

/** Only saved customer addresses with their saved coordinates are eligible suggestions. */
export function suggest(cast: Cast, word: string): Place[] {
  const query = word.trim().toLocaleLowerCase('es-ES');
  if (query.length < 2) return [];
  const seen = new Set<string>();
  return cast.customers
    .filter((customer) => customer.address && customer.at && customer.address.toLocaleLowerCase('es-ES').includes(query))
    .flatMap((customer) => {
      const label = customer.address!;
      if (seen.has(label)) return [];
      seen.add(label);
      return [{ label, zone: customer.zone, at: customer.at! }];
    })
    .slice(0, 6);
}

const CHANNELS: Array<{ id: Customer['channel']; label: string }> = [
  { id: 'WhatsApp', label: 'WhatsApp' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'in person', label: 'In person' },
  { id: 'portal', label: 'Portal' },
];

export type NewCustomerModalProps = {
  isOpen: boolean;
  cast: Cast;
  said: string;
  onClose: () => void;
  onMade: (customer: Customer) => void;
};

export default function NewCustomerModal({ isOpen, cast, said, onClose, onMade }: NewCustomerModalProps) {
  const [, theme] = useStyletron();
  const [name, setName] = React.useState(said);
  const [phone, setPhone] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [place, setPlace] = React.useState<Place | null>(null);
  const [runId, setRunId] = React.useState<string>('');
  const [channel, setChannel] = React.useState<Customer['channel']>('WhatsApp');
  const [duplicate, setDuplicate] = React.useState<Customer | null>(null);
  const [error, setError] = React.useState('');
  const seed = React.useRef<string | null>(null);
  const requestId = React.useRef(newCustomerRequestId());

  React.useEffect(() => {
    if (!isOpen || seed.current === said) return;
    seed.current = said;
    requestId.current = newCustomerRequestId();
    setName(said); setPhone(''); setEmail(''); setAddress(''); setPlace(null); setRunId(''); setChannel('WhatsApp'); setDuplicate(null); setError('');
  }, [isOpen, said]);

  const offered = React.useMemo(() => place ? [] : suggest(cast, address), [cast, address, place]);
  const run = cast.runs.find((item) => String(item.truck) === runId);
  const emailRequired = channel === 'email';
  const phoneRequired = channel === 'phone' || channel === 'WhatsApp';
  const emailInvalid = !!email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
  const contactError = emailRequired && !email.trim()
    ? 'Add an email address or choose another main channel.'
    : phoneRequired && !phone.trim()
      ? 'Add a phone number or choose another main channel.'
      : emailInvalid
        ? 'Enter a complete email address.'
        : '';
  const requiredError = !name.trim() ? 'Enter a customer name.' : !address.trim() ? 'Enter a delivery address.' : '';
  const ready = !requiredError && !contactError;

  const resetAfterSave = () => {
    seed.current = null;
    requestId.current = newCustomerRequestId();
    setName(''); setPhone(''); setEmail(''); setAddress(''); setPlace(null); setRunId(''); setDuplicate(null); setError('');
  };
  const takePlace = (next: Place) => {
    setPlace(next); setAddress(next.label); setDuplicate(null); setError('');
    const matchingRun = cast.runs.find((item) => item.zone === next.zone);
    if (matchingRun) setRunId(String(matchingRun.truck));
  };
  const save = (allowDuplicate = false) => {
    if (!ready) return;
    const result = createCustomer({
      cast,
      name,
      requestId: requestId.current,
      allowDuplicate,
      details: {
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim(),
        at: place?.at,
        zone: run?.zone ?? place?.zone,
        truck: run?.truck,
        channel,
      },
    });
    if (result.kind === 'created') {
      if (isPostHogConfigured) {
        posthog.capture('customer_created', {
          contact_channel: channel,
          has_delivery_run: Boolean(run),
        });
      }
      resetAfterSave();
      onMade(result.customer);
    } else if (result.kind === 'duplicate') {
      setDuplicate(result.customer);
      setError('');
    } else if (result.kind === 'persistence-failed') {
      setError('Saving this customer stalled. Your details are still here. Check browser storage and try again.');
    } else {
      setError('Enter a customer name and delivery address.');
    }
  };

  return (
    <WorkflowDialog
      isOpen={isOpen}
      title="New customer"
      ariaLabel="New customer"
      onClose={onClose}
      step="Contact and delivery"
      testId="new-customer"
      actions={<><Button kind={KIND.tertiary} size={SIZE.compact} data-testid="new-customer-cancel" onClick={onClose}>Cancel</Button><Button size={SIZE.compact} disabled={!ready} data-testid="new-customer-save" onClick={() => save()}>Add customer</Button></>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
        <label style={theme.typography.LabelSmall}>Customer name<Input autoFocus value={name} aria-label="Customer name" onChange={(event) => { setName(event.currentTarget.value); setDuplicate(null); setError(''); }} overrides={{ Input: { props: { 'data-testid': 'new-customer-name', autoComplete: 'off' } } }} /></label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: theme.sizing.scale400 }}>
          <label style={theme.typography.LabelSmall}>Phone<Input value={phone} aria-label="Phone" onChange={(event) => { setPhone(event.currentTarget.value); setError(''); }} overrides={{ Input: { props: { 'data-testid': 'new-customer-phone', inputMode: 'tel', autoComplete: 'tel' } } }} /></label>
          <label style={theme.typography.LabelSmall}>Email<Input value={email} type="email" aria-label="Email" onChange={(event) => { setEmail(event.currentTarget.value); setError(''); }} overrides={{ Input: { props: { 'data-testid': 'new-customer-email', autoComplete: 'email' } } }} /></label>
        </div>
        <LiveField
          id="new-customer-channel"
          declineSays="Choose a main channel from the list."
          label="Main channel"
          value={CHANNELS.find((item) => item.id === channel)?.label ?? ''}
          suggestions={CHANNELS.map((item) => ({ value: item.label, id: String(item.id) }))}
          placeholder="Choose where their orders arrive"
          allowNew={false}
          inputTestid="new-customer-channel"
          listLabel="Channels this trade uses"
          onCommit={({ value, id }) => {
            const chosen = CHANNELS.find((item) => String(item.id) === id) ?? CHANNELS.find((item) => item.label === value);
            if (!chosen) return 'Choose a main channel from the list.';
            setChannel(chosen.id);
            setError('');
          }}
        />
        {(requiredError || contactError) && <span role="alert" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.negative }}>{requiredError || contactError}</span>}
        <label style={theme.typography.LabelSmall}>Delivery address<Input value={address} aria-label="Delivery address" onChange={(event) => { setAddress(event.currentTarget.value); setPlace(null); setDuplicate(null); setError(''); }} overrides={{ Input: { props: { 'data-testid': 'new-customer-address', autoComplete: 'street-address' } } }} /></label>
        {offered.length > 0 && <div data-testid="new-customer-places" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>{offered.map((item) => <Button key={item.label} kind={KIND.tertiary} size={SIZE.compact} data-testid="new-customer-place" data-zone={item.zone ?? ''} onClick={() => takePlace(item)} overrides={{ BaseButton: { style: { justifyContent: 'flex-start', paddingLeft: 0, textAlign: 'left' } } }}>{item.label}</Button>)}</div>}
        {/* THE RUN IS OPTIONAL, AND EMPTY SAYS WHAT IS (§21 · the copy law). An account nobody put
            on a van rides the house's own run, so the empty field states that in its placeholder
            and a van already chosen carries the one door that hands them back to it. */}
        <LiveField
          id="new-customer-run"
          declineSays="Choose a delivery run from the list."
          label="Delivery run"
          value={run ? `Truck ${run.truck} · ${run.zone}` : ''}
          suggestions={cast.runs.map((item) => ({ value: `Truck ${item.truck} · ${item.zone}`, id: String(item.truck) }))}
          placeholder="They ride the house’s own run"
          optional
          allowNew={false}
          inputTestid="new-customer-run"
          listLabel="Runs this house drives"
          aside={run ? (
            <Button kind={KIND.tertiary} size={SIZE.mini} data-testid="new-customer-run-house" onClick={() => setRunId('')}>
              Use the house’s run
            </Button>
          ) : undefined}
          onCommit={({ value, id }) => {
            const chosen = cast.runs.find((item) => String(item.truck) === id)
              ?? cast.runs.find((item) => `Truck ${item.truck} · ${item.zone}` === value);
            if (!chosen) return 'Choose a delivery run from the list.';
            setRunId(String(chosen.truck));
          }}
        />
        {place ? <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Saved address location selected.</span> : <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>Freeform addresses are saved as text.</span>}
        {duplicate && <div role="alert" data-testid="new-customer-duplicate" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, padding: theme.sizing.scale400, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300 }}><span>{duplicate.name} already exists in this business.</span><span style={{ display: 'flex', gap: theme.sizing.scale300, flexWrap: 'wrap' }}><Button kind={KIND.secondary} size={SIZE.compact} onClick={() => onMade(duplicate)}>Open existing</Button><Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => save(true)}>Create separate customer</Button></span></div>}
        {error && <span role="alert" data-testid="new-customer-error">{error}</span>}
      </div>
    </WorkflowDialog>
  );
}
