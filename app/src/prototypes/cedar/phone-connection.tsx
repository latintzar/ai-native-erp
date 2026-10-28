/* PHONE — one Kit surface for the human calling rail.
 *
 * ⚠ §196.6 TURNED THIS SURFACE REAL (E193.07 · «now we're doing it all for real, every part of the
 * process, nothing half assed»). What E191 built here was a labelled preview that made no provider
 * request; what stands here now is the OPERATOR FLOW against the kit runtime — Google Places
 * identity from a number, Twilio in and out, Deepgram's diarised Spanish transcript — with the
 * preview kept, unchanged and still labelled, as the posture a browser takes when the runtime is
 * out of reach. Both readings are true at once and the surface says which one it is in words:
 * «Connected» or «Prepared · awaiting connection» / «Runtime offline».
 *
 * Every provider read comes through `voice.ts`; every voice object is drawn once, in
 * `voice-objects.tsx`, and mounted here and on the customer sheet. THE-VOICE-CONNECTION-SPEC owns
 * the transport, the custody and the release gates.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Avatar } from 'baseui/avatar';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Checkbox, STYLE_TYPE } from 'baseui/checkbox';
import { Input } from 'baseui/input';
import type { Customer } from '../../scenarios/data/cast';
import type { SectorId } from '../../scenarios/meta';
import { Glyph, STEP } from './glyphs';
import { WorkflowDialog } from './workflow-dialog';
import { usePhone } from './shell/viewport';
import {
  savePhoneConnectionConfig,
  usePhoneConnectionConfig,
  type PhoneConnectionConfig,
  type PhoneNumberPath,
  type PhoneRecordingPosture,
  type PhoneRoutingMode,
  type PhoneSchedule,
} from './phone-connection-config';
/* §196.6 · THE HERMES PORT — one seam, one drawing of each object (E193.07) */
import { useCompany } from './company';
import {
  VOICE_COPY,
  callWhen,
  directionWord,
  forgetCalls,
  retentionClock,
  useCalls,
  useDial,
  useInboundTest,
  useReadiness,
  useRuntimePosture,
  type CallObject,
} from './voice';
import { CallDetail, CallList, RuntimeStanding } from './voice-objects';
import { accountNumber } from './customer-profile';
import { PhoneSetup } from './phone-setup';
import { PhoneDialDialog } from './phone-controller';
export { PhoneSetup } from './phone-setup';

export type PhoneMember = { id: string; name: string; phone?: string };
type CallPhase = 'pick' | 'ready' | 'connecting' | 'ringing' | 'fallback' | 'live' | 'ended';

const compactPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  return `+${digits.slice(0, 2)} ·· ${digits.slice(-2)}`;
};

function ChoiceCard({
  active,
  title,
  detail,
  status,
  onClick,
  testid,
}: {
  active: boolean;
  title: string;
  detail: string;
  status?: string;
  onClick: () => void;
  testid: string;
}) {
  const [css, theme] = useStyletron();
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testid}
      data-selected={active ? 'yes' : 'no'}
      className={css({
        appearance: 'none',
        width: '100%',
        boxSizing: 'border-box',
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        border: `1px solid ${active ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        backgroundColor: active ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
        padding: theme.sizing.scale600,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: theme.sizing.scale400,
        cursor: 'default',
        ':hover': { backgroundColor: theme.colors.backgroundSecondary },
        ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' },
      })}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ ...theme.typography.LabelMedium, display: 'block' }}>{title}</span>
        <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: theme.sizing.scale200 }}>
          {detail}
        </span>
      </span>
      {status && <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{status}</span>}
    </button>
  );
}

function RouteDiagram({ source, target, owner }: { source: string; target: string; owner: string }) {
  const [css, theme] = useStyletron();
  const node = css({
    minWidth: 0,
    border: `1px solid ${theme.colors.borderOpaque}`,
    backgroundColor: theme.colors.backgroundSecondary,
    borderRadius: theme.borders.radius300,
    padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
  });
  return (
    <div
      data-testid="phone-route-diagram"
      className={css({
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 24px minmax(0, 1fr) 24px minmax(0, 1fr)',
        alignItems: 'center',
        gap: theme.sizing.scale200,
        '@media (max-width: 600px)': {
          gridTemplateColumns: 'minmax(0, 1fr)',
        },
      })}
    >
      <div className={node}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Customers call</span>
        <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>{source}</span>
      </div>
      <span aria-hidden="true" className={css({ textAlign: 'center', color: theme.colors.contentTertiary, pointerEvents: 'none', '@media (max-width: 600px)': { transform: 'rotate(90deg)' } })}>→</span>
      <div className={node}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Rocoto line</span>
        <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2 }}>{target}</span>
      </div>
      <span aria-hidden="true" className={css({ textAlign: 'center', color: theme.colors.contentTertiary, pointerEvents: 'none', '@media (max-width: 600px)': { transform: 'rotate(90deg)' } })}>→</span>
      <div className={node}>
        <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Rings first</span>
        <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2 }}>{owner}</span>
      </div>
    </div>
  );
}

function StatusFact({ label, value, testid }: { label: string; value: string; testid?: string }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        minWidth: 0,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        padding: theme.sizing.scale500,
        background: theme.colors.backgroundPrimary,
      }}
    >
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, display: 'block' }}>{label}</span>
      <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 3, overflowWrap: 'anywhere' }}>{value}</span>
    </div>
  );
}

/* VOICE-21 · THE TENANT NOTICE (E195.41). The clock the product keeps, stated where the tenant
 * sets the recording posture — a retention period is one of the things VOICE-09A requires BEFORE
 * recording can be turned on, so it belongs beside the posture and nowhere else. `retention.py` on
 * the runtime is the worker that keeps it; `retentionClock()` in voice.ts is the one drawing of the
 * numbers. Each line says what IS kept and for how long. */
function RetentionNotice() {
  const [, theme] = useStyletron();
  /* §103's ladder, one scale down: the object and its period share a line while the line has room
   * for both, and at a true phone width the period stands under its object at the same left edge.
   * A two-column plan squeezed onto a 360px handset gives every row three ragged lines. */
  const phone = usePhone();
  /* THE HOUSE'S OWN DIAL, not a constant (E195.41 · §195). «Your data» → «How long conversations
   * are kept» is where a tenant sets the transcript's period, and this notice states the clock
   * that dial produces — so the two surfaces answer the same question with the same words. */
  const company = useCompany();
  const clock = retentionClock(company.retention);
  return (
    <div
      data-testid="phone-retention-notice"
      style={{
        minWidth: 0,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
      }}
    >
      <h4
        data-testid="phone-retention-heading"
        style={{ margin: 0, padding: theme.sizing.scale500, ...theme.typography.LabelMedium }}
      >
        {VOICE_COPY.retentionHeading}
      </h4>
      <dl data-testid="phone-retention-clock" style={{ margin: 0 }}>
        {clock.map(({ object, kept }) => (
          <div
            key={object}
            data-testid="phone-retention-row"
            data-object={object}
            data-plan={phone ? 'stacked' : 'two-column'}
            style={{
              display: 'grid',
              gridTemplateColumns: phone ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) auto',
              gap: phone ? theme.sizing.scale100 : theme.sizing.scale400,
              alignItems: 'baseline',
              padding: `${theme.sizing.scale300} ${theme.sizing.scale500}`,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
            }}
          >
            <dt style={{ ...theme.typography.ParagraphXSmall, minWidth: 0, overflowWrap: 'anywhere' }}>{object}</dt>
            <dd
              data-testid="phone-retention-kept"
              style={{
                margin: 0,
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentSecondary,
                textAlign: phone ? 'left' : 'right',
                minWidth: 0,
                overflowWrap: 'anywhere',
              }}
            >
              {kept}
            </dd>
          </div>
        ))}
      </dl>
      <p
        data-testid="phone-retention-spoken"
        style={{
          margin: 0,
          padding: theme.sizing.scale500,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          ...theme.typography.ParagraphXSmall,
          color: theme.colors.contentSecondary,
        }}
      >
        {VOICE_COPY.retentionSpoken} {VOICE_COPY.retentionDial}
      </p>
    </div>
  );
}

const scheduleLabel = (schedule: PhoneSchedule, officeHours?: string): string =>
  schedule === 'always' ? 'Always' : `Office hours${officeHours ? ` · ${officeHours}` : ''}`;

const selectedMembers = (
  members: PhoneMember[],
  ownerId: string,
  mode: PhoneRoutingMode,
  groupIds: string[],
): PhoneMember[] => {
  if (mode === 'owner') return members.filter((member) => member.id === ownerId).slice(0, 1);
  const selected = new Set([ownerId, ...groupIds]);
  return members.filter((member) => selected.has(member.id));
};

const routeLabel = (
  members: PhoneMember[],
  ownerId: string,
  mode: PhoneRoutingMode,
  groupIds: string[],
): string => {
  const chosen = selectedMembers(members, ownerId, mode, groupIds);
  if (chosen.length === 0) return 'Your team';
  if (chosen.length === 1) return chosen[0].name;
  return `${chosen[0].name} + ${chosen.length - 1}`;
};

/* ── THE ACTIVATION TEST, FOR REAL (FEED-IA §196.6 · VOICE-01A step 8 · VOICE-19) ────────────
 * «every part of the process, nothing half assed» — so the two calls that prove a line are placed
 * and watched here rather than promised in a checklist.
 *
 *   INBOUND  · the operator rings the house number from their own phone; this block re-reads the
 *              runtime's calls until one the runtime did NOT have a moment ago appears. The call's
 *              own sid, direction, origin and duration are printed as the evidence.
 *   OUTBOUND · the kit asks the runtime to ring a number the operator is holding. Twilio's sid is
 *              the proof the account accepted it; the RING is the proof the operator confirms with
 *              their own ear, and the confirmation is stored nowhere — it is re-earned each time,
 *              because a browser may not remember a provider fact about itself (VOICE-01A.1).
 *
 * A leg that finds nothing stays «Waiting». It never times out into a pass, and «Ready to run» is the
 * word before either has been asked for. */
function ActivationTest({
  houseNumber,
  fallbackNumber,
  ready,
}: {
  houseNumber: string;
  fallbackNumber: string;
  ready: boolean;
}) {
  const [, theme] = useStyletron();
  const { leg, start, stop } = useInboundTest(houseNumber);
  const { state: dial, dial: place, reset } = useDial();
  const [target, setTarget] = React.useState(fallbackNumber);
  const [heard, setHeard] = React.useState(false);

  React.useEffect(() => { setTarget(fallbackNumber); }, [fallbackNumber]);

  const inboundWord = leg.state === 'passed' ? 'Passed'
    : leg.state === 'waiting' ? 'Waiting for your call'
      : leg.state === 'unreachable' || leg.state === 'unavailable' ? VOICE_COPY.unreachable
        : 'Ready to run';
  const outboundWord = heard && dial.state === 'placed' ? 'Passed'
    : dial.state === 'placed' ? 'Ringing · confirm you heard it'
      : dial.state === 'placing' ? VOICE_COPY.placing
        : dial.state === 'unreachable' ? VOICE_COPY.unreachable
          : dial.state === 'refused' ? 'Refused'
            : 'Ready to run';

  const row = {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) auto',
    gap: theme.sizing.scale400,
    padding: theme.sizing.scale500,
    alignItems: 'start',
    minWidth: 0,
  } as const;

  return (
    <div data-testid="phone-activation-test" style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
      <div data-testid="phone-test-inbound" data-leg-state={leg.state} style={{ ...row, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
        <span style={{ minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Inbound route</span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', overflowWrap: 'anywhere' }}>
            {leg.state === 'passed'
              ? leg.evidence
              : leg.state === 'waiting'
                ? `Ring ${houseNumber || 'the business number'} from your own phone. This watches the line.`
                : 'Call the business number. Prove app ringing, original caller ID and two-way audio.'}
          </span>
          <span style={{ display: 'flex', gap: theme.sizing.scale300, marginTop: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <Button
              kind={KIND.secondary}
              size={SIZE.compact}
              disabled={!ready || !houseNumber.trim()}
              onClick={() => { forgetCalls(houseNumber); start(); }}
              data-testid="phone-test-inbound-start"
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
            >
              {leg.state === 'waiting' ? 'Watching the line' : 'Watch for my call'}
            </Button>
            {leg.state === 'waiting' && (
              <Button kind={KIND.tertiary} size={SIZE.compact} onClick={stop} data-testid="phone-test-inbound-stop"
                overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
                Stop watching
              </Button>
            )}
          </span>
        </span>
        <span data-testid="phone-test-inbound-state" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{inboundWord}</span>
      </div>

      <div data-testid="phone-test-outbound" data-leg-state={dial.state} style={row}>
        <span style={{ minWidth: 0 }}>
          <span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Outbound route</span>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', overflowWrap: 'anywhere' }}>
            {dial.state === 'placed'
              ? `The runtime placed the call. Answer it and confirm the business caller ID.`
              : dial.state === 'refused'
                ? dial.because
                : 'Call a controlled number. Prove the approved business caller ID and two-way audio.'}
          </span>
          <span style={{ display: 'flex', gap: theme.sizing.scale300, marginTop: theme.sizing.scale300, flexWrap: 'wrap', alignItems: 'center' }}>
            <Input
              value={target}
              onChange={(event) => setTarget((event.target as HTMLInputElement).value)}
              placeholder="+34 600 00 00 00"
              aria-label="Number to ring for the outbound test"
              overrides={{ Input: { props: { inputMode: 'tel', 'data-testid': 'phone-test-outbound-number' } }, Root: { style: { flex: '1 1 180px', minWidth: 0 } } }}
            />
            <Button
              kind={KIND.secondary}
              size={SIZE.compact}
              disabled={!ready || target.replace(/\D/g, '').length < 9}
              onClick={() => { setHeard(false); reset(); place(target); }}
              data-testid="phone-test-outbound-start"
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
            >
              Ring this number
            </Button>
            {dial.state === 'placed' && !heard && (
              <Button kind={KIND.primary} size={SIZE.compact} onClick={() => setHeard(true)} data-testid="phone-test-outbound-heard"
                overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
                It rang
              </Button>
            )}
          </span>
        </span>
        <span data-testid="phone-test-outbound-state" style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{outboundWord}</span>
      </div>
    </div>
  );
}

/** Onboarding and Settings mount the same provider-backed setup body. */
export function PhoneConnectionDialog(props: React.ComponentProps<typeof PhoneConnectionPreviewDialog> & { onComplete?: React.ComponentProps<typeof PhoneSetup>['onComplete'] }) {
  if (!props.isOpen) return null;
  return <PhoneSetup {...props} presentation="dialog" />;
}

export function PhoneConnectionPreviewDialog({
  isOpen,
  onClose,
  tenant,
  sourceNumber,
  members,
  officeHours,
  onPrepared,
}: {
  isOpen: boolean;
  onClose: () => void;
  tenant: SectorId;
  sourceNumber: string;
  members: PhoneMember[];
  officeHours?: string;
  onPrepared?: (config: PhoneConnectionConfig) => void;
}) {
  const [, theme] = useStyletron();
  const stored = usePhoneConnectionConfig(tenant);
  const [step, setStep] = React.useState(0);
  const [number, setNumber] = React.useState(sourceNumber);
  const [path, setPath] = React.useState<PhoneNumberPath>('existing');
  const [owner, setOwner] = React.useState(members[0]?.id ?? '');
  const [routingMode, setRoutingMode] = React.useState<PhoneRoutingMode>('owner');
  const [ringGroup, setRingGroup] = React.useState<string[]>([]);
  const [schedule, setSchedule] = React.useState<PhoneSchedule>('office-hours');
  const [fallback, setFallback] = React.useState(members[0]?.phone ?? '');
  const [recording] = React.useState<PhoneRecordingPosture>('metadata-only');
  const [forwarding, setForwarding] = React.useState(false);
  const [saveError, setSaveError] = React.useState('');
  /* §196.6 · E195.21 — what the RUNTIME holds, what the Twilio ACCOUNT answers when it is asked
     about itself, and the number this setup is about. The three together are the only thing that
     can read «Connected»; none of them alone is a line. */
  const { readiness, recheck } = useReadiness(number);

  React.useEffect(() => {
    if (!isOpen) return;
    const validOwner = members.some((member) => member.id === stored.ownerId)
      ? stored.ownerId
      : members[0]?.id ?? '';
    const validGroup = stored.ringGroupIds.filter((id) => members.some((member) => member.id === id));
    setNumber(stored.sourceNumber || sourceNumber);
    setPath(stored.numberPath);
    setOwner(validOwner);
    setRoutingMode(stored.routingMode);
    setRingGroup(validGroup.length ? validGroup : validOwner ? [validOwner] : []);
    setSchedule(stored.schedule);
    setFallback(stored.fallbackNumber || members.find((member) => member.id === validOwner)?.phone || '');
    setForwarding(stored.forwardingAcknowledged);
    setSaveError('');
    setStep(0);
  }, [isOpen, members, sourceNumber, stored]);

  const ownerMember = members.find((member) => member.id === owner) ?? members[0];
  const route = routeLabel(members, owner, routingMode, ringGroup);
  const heading = [
    'Business identity',
    'Number eligibility',
    'Routing and privacy',
    'Forwarding and activation',
    'Review',
  ][step] ?? 'Connect phone';
  const back = step > 0 ? () => setStep((was) => Math.max(0, was - 1)) : undefined;
  const validNumber = number.replace(/\D/g, '').length >= 9;
  const validFallback = fallback.replace(/\D/g, '').length >= 9;
  const validRoute = Boolean(owner) && (routingMode === 'owner' || ringGroup.length > 0);
  const blocked = (step === 0 && !validNumber)
    || (step === 2 && (!validRoute || !validFallback))
    || (step === 3 && !forwarding);

  const next = () => {
    if (step < 4) {
      setStep((was) => was + 1);
      return;
    }
    const saved = savePhoneConnectionConfig(tenant, {
      sourceNumber: number,
      numberPath: path,
      ownerId: owner,
      routingMode,
      ringGroupIds: routingMode === 'group' ? ringGroup : [owner],
      schedule,
      fallbackNumber: fallback,
      recordingPosture: recording,
      forwardingAcknowledged: forwarding,
      prepared: true,
    });
    if (!saved) {
      setSaveError('Saving this setup stalled in this browser. Keep this window open and try again.');
      return;
    }
    setSaveError('');
    onPrepared?.(saved);
    onClose();
  };

  return (
    <WorkflowDialog
      isOpen={isOpen}
      title="Connect phone"
      step={`${step + 1} of 5 · ${heading}`}
      onClose={onClose}
      onBack={back}
      testId="phone-connection-dialog"
      actions={(
        <>
          {step === 4 && (
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
              Cancel
            </Button>
          )}
          <Button
            kind={KIND.primary}
            size={SIZE.compact}
            onClick={next}
            data-testid="phone-connection-next"
            disabled={blocked}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
          >
            {step === 4 ? 'Save prepared setup' : 'Continue'}
          </Button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, maxWidth: 660, margin: '0 auto' }}>
        {saveError && (
          <div role="alert" data-testid="phone-connection-save-error" style={{ border: `1px solid ${theme.colors.negative}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, color: theme.colors.negative }}>
            {saveError}
          </div>
        )}
        {step === 0 && (
          <>
            <div>
              <h3 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Which number do customers call now?</h3>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Keep the business identity customers already know.
              </p>
            </div>
            <Input
              value={number}
              onChange={(event) => setNumber((event.target as HTMLInputElement).value)}
              placeholder="+34 600 00 00 00"
              aria-label="Business phone number"
              autoFocus
              overrides={{ Input: { props: { 'data-testid': 'phone-source-number', inputMode: 'tel' } } }}
            />
            <div
              data-testid="phone-history-boundary"
              style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, background: theme.colors.backgroundSecondary }}
            >
              <span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Call history starts at activation</span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: 3 }}>
                Only calls handled after activation appear in Messages. Earlier calls stay with the current carrier.
              </span>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <h3 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Choose the route to review</h3>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Country eligibility, documents and inventory are checked before a number is reserved.
              </p>
            </div>
            <ChoiceCard
              active={path === 'existing'}
              title={`Keep ${number}`}
              detail="Port it where supported, or forward it to an approved Rocoto line."
              status="Recommended"
              onClick={() => setPath('existing')}
              testid="phone-path-existing"
            />
            <ChoiceCard
              active={path === 'france'}
              title="Request a French number"
              detail="Use this route only after the registered-address and number-purpose review."
              status="Review required"
              onClick={() => setPath('france')}
              testid="phone-path-france"
            />
            <div
              data-testid="phone-number-readiness"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale300 }}
            >
              <StatusFact label="Country" value={path === 'france' ? 'France' : 'Spain · current number'} />
              <StatusFact label="Eligibility" value="Pending provider review" />
              <StatusFact label="Regulatory documents" value="Still to start" />
              <StatusFact label="Number inventory" value="Still to reserve" />
            </div>
            <div
              role="status"
              data-testid="phone-france-eligibility"
              style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, background: theme.colors.backgroundSecondary }}
            >
              <span style={{ ...theme.typography.LabelSmall }}>
                {path === 'france' ? 'French eligibility review required' : 'Existing-number route requires provider review'}
              </span>
              <span style={{ ...theme.typography.ParagraphXSmall, display: 'block', marginTop: 4, color: theme.colors.contentSecondary }}>
                Purchasing, porting and reserving a number stay with the provider.
              </span>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h3 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Choose who answers and when</h3>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                One routing owner remains accountable even when a ring group answers.
              </p>
            </div>

            <div>
              <span style={{ ...theme.typography.LabelSmall, display: 'block', marginBottom: theme.sizing.scale300 }}>Routing owner</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
                {members.map((member) => (
                  <Button
                    key={member.id}
                    kind={owner === member.id ? KIND.primary : KIND.secondary}
                    shape={SHAPE.pill}
                    size={SIZE.compact}
                    onClick={() => {
                      setOwner(member.id);
                      setRingGroup((was) => Array.from(new Set([member.id, ...was])));
                      if (!fallback && member.phone) setFallback(member.phone);
                    }}
                    data-testid={`phone-owner-${member.id}`}
                    data-selected={owner === member.id ? 'yes' : 'no'}
                    overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
                  >
                    {member.name}
                  </Button>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale300 }}>
              <ChoiceCard
                active={routingMode === 'owner'}
                title="Owner only"
                detail={ownerMember?.name ?? 'Choose an owner'}
                onClick={() => setRoutingMode('owner')}
                testid="phone-routing-owner"
              />
              <ChoiceCard
                active={routingMode === 'group'}
                title="Ring group"
                detail="Ring selected teammates together."
                onClick={() => setRoutingMode('group')}
                testid="phone-routing-group"
              />
            </div>

            {routingMode === 'group' && (
              <div data-testid="phone-ring-group">
                <span style={{ ...theme.typography.LabelSmall, display: 'block', marginBottom: theme.sizing.scale300 }}>People who ring</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale300 }}>
                  {members.map((member) => {
                    const active = ringGroup.includes(member.id);
                    return (
                      <Button
                        key={member.id}
                        kind={active ? KIND.secondary : KIND.tertiary}
                        shape={SHAPE.pill}
                        size={SIZE.compact}
                        onClick={() => setRingGroup((was) => active ? was.filter((id) => id !== member.id) : [...was, member.id])}
                        data-testid={`phone-ring-member-${member.id}`}
                        data-selected={active ? 'yes' : 'no'}
                        overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
                      >
                        {active ? '✓ ' : ''}{member.name}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale300 }}>
              <ChoiceCard
                active={schedule === 'office-hours'}
                title="Office hours"
                detail={officeHours || 'Use the company schedule.'}
                onClick={() => setSchedule('office-hours')}
                testid="phone-schedule-office"
              />
              <ChoiceCard
                active={schedule === 'always'}
                title="Always"
                detail="Ring the route at any time."
                onClick={() => setSchedule('always')}
                testid="phone-schedule-always"
              />
            </div>

            <div>
              <label htmlFor="phone-fallback" style={{ ...theme.typography.LabelSmall, display: 'block', marginBottom: theme.sizing.scale300 }}>
                Alternative number
              </label>
              <Input
                id="phone-fallback"
                value={fallback}
                onChange={(event) => setFallback((event.target as HTMLInputElement).value)}
                placeholder="+34 600 00 00 00"
                aria-label="Alternative number"
                overrides={{ Input: { props: { 'data-testid': 'phone-fallback-number', inputMode: 'tel' } } }}
              />
              <span data-testid="phone-fallback-verification" style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: theme.sizing.scale200 }}>
                Saved for fallback · verification pending. It takes calls once the provider verifies it.
              </span>
            </div>

            <ChoiceCard
              active
              title="Metadata only"
              detail="Keep time, direction, participants, outcome and transcript status. Audio begins when the house turns recording on, and it stays with the provider."
              status="Recording default"
              onClick={() => undefined}
              testid="phone-recording-metadata"
            />
            <RetentionNotice />
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h3 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Forward, then prove both routes</h3>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                The setup is prepared only. Activation requires real inbound and outbound calls.
              </p>
            </div>
            <RouteDiagram
              source={number}
              target={path === 'france' ? '+33 line · after approval' : 'Rocoto line · after approval'}
              owner={route}
            />
            <div data-testid="phone-activation-checklist" style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
              <div style={{ padding: theme.sizing.scale500, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
                <Checkbox
                  checked={forwarding}
                  onChange={(event) => setForwarding((event.target as HTMLInputElement).checked)}
                  checkmarkType={STYLE_TYPE.toggle_round}
                  overrides={{ Input: { props: { 'data-testid': 'phone-forwarding-understood' } } }}
                >
                  Carrier forwarding checklist completed
                </Checkbox>
                <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: theme.sizing.scale200 }}>
                  Forward {number} to the approved destination, preserve caller ID and keep the carrier confirmation.
                </span>
              </div>
            </div>
            {/* §196.6 · THE TWO CALLS ARE PLACED AND WATCHED, not promised. The rail's standing
                sits above them because a test can only run through a runtime that holds Twilio. */}
            <RuntimeStanding readiness={readiness} testid="phone-runtime-standing" onRecheck={recheck} />
            <ActivationTest houseNumber={number} fallbackNumber={fallback} ready={readiness.ready} />
            {/* §196.6 — the sentence says what «Connected» MEANS here, beside two legs that can now
                really pass. The tenant's own release keeps the same two calls on the server's
                record, which is where VOICE-14's gate lives. */}
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              “Connected” means the runtime holds Twilio and this browser proved both routes. The tenant’s release keeps the same two calls on the server’s own record.
            </span>
          </>
        )}

        {step === 4 && (
          <>
            <div>
              <h3 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Prepared · awaiting connection</h3>
              <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                Save these decisions for provider review. Buying a number and placing calls start after activation.
              </p>
            </div>
            <div
              data-testid="phone-prepared-summary"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: theme.sizing.scale300 }}
            >
              <StatusFact label="Business number" value={number} />
              <StatusFact label="Number path" value={path === 'france' ? 'French number · review required' : 'Keep existing number'} />
              <StatusFact label="Routing owner" value={ownerMember?.name ?? 'Still to choose'} />
              <StatusFact label="Who rings" value={route} />
              <StatusFact label="Schedule" value={scheduleLabel(schedule, officeHours)} />
              <StatusFact label="Fallback" value={`${compactPhone(fallback)} · verification pending`} />
              <StatusFact label="Recording" value="Metadata only · audio off" />
              {/* §196.6 — the provider line now READS the runtime instead of asserting a state.
                  A runtime holding Twilio says so; anything else keeps E191's exact words. */}
              <StatusFact
                label="Provider"
                value={readiness.ready ? 'Twilio · held by the runtime' : 'Pending · awaiting connection'}
                testid="phone-provider-pending"
              />
            </div>
            <RuntimeStanding readiness={readiness} testid="phone-runtime-standing-review" onRecheck={recheck} />
            <div data-testid="phone-release-gates" style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
              {[
                ['Eligibility and documents', 'Pending'],
                ['Number inventory', 'Still to reserve'],
                ['Fallback verification', 'Pending'],
                ['Inbound activation call', 'Ready to run'],
                ['Outbound activation call', 'Ready to run'],
              ].map(([label, value], index) => (
                <div key={label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: theme.sizing.scale400, padding: theme.sizing.scale400, borderBottom: index < 4 ? `1px solid ${theme.colors.borderOpaque}` : undefined }}>
                  <span style={{ ...theme.typography.ParagraphXSmall }}>{label}</span>
                  <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>{value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </WorkflowDialog>
  );
}

export function PhoneSetupRequiredDialog({
  isOpen,
  onClose,
  onOpenSettings,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <WorkflowDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Set up phone first"
      step="Setup only · calls start after activation"
      testId="phone-setup-required-dialog"
      actions={(
        <>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
            Cancel
          </Button>
          <Button kind={KIND.primary} size={SIZE.compact} onClick={onOpenSettings}
            data-testid="phone-setup-open-settings"
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
            Open Connections
          </Button>
        </>
      )}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
        <h3 style={{ margin: 0, ...theme.typography.HeadingSmall }}>Prepare the business number and route</h3>
        <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
          Choose the number path, who answers, the schedule and a fallback number. Calling becomes available after activation.
        </p>
        <StatusFact label="Calling" value="Setup pending · awaiting provider" testid="phone-setup-required-status" />
      </div>
    </WorkflowDialog>
  );
}

function CallControl({
  glyph,
  label,
  active = false,
  danger = false,
  primary = false,
  onClick,
  testid,
}: {
  glyph: 'call' | 'mic' | 'micOff' | 'speaker' | 'keypad' | 'callEnd';
  label: string;
  active?: boolean;
  danger?: boolean;
  primary?: boolean;
  onClick: () => void;
  testid: string;
}) {
  const [, theme] = useStyletron();
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: theme.sizing.scale200 }}>
      <Button
        kind={danger || primary ? KIND.primary : active ? KIND.secondary : KIND.tertiary}
        size={SIZE.default}
        shape={SHAPE.circle}
        onClick={onClick}
        aria-label={label}
        data-testid={testid}
        overrides={{
          BaseButton: {
            style: {
              width: '56px',
              height: '56px',
              minWidth: '56px',
              color: danger || primary ? theme.colors.contentOnColor : undefined,
              backgroundColor: danger ? theme.colors.negative : primary ? theme.colors.contentPrimary : active ? theme.colors.backgroundTertiary : theme.colors.backgroundSecondary,
              ':hover': { backgroundColor: danger ? theme.colors.negative600 : primary ? theme.colors.contentSecondary : theme.colors.backgroundTertiary },
            },
          },
        }}
      >
        <Glyph id={glyph} size={STEP.large} />
      </Button>
      <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{label}</span>
    </span>
  );
}

function Keypad({ onClose }: { onClose: () => void }) {
  const [, theme] = useStyletron();
  return (
    <div data-testid="call-keypad" style={{ width: 'min(280px, 100%)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: theme.sizing.scale300 }}>
      {'123456789*0#'.split('').map((key) => (
        <Button key={key} kind={KIND.tertiary} shape={SHAPE.circle} size={SIZE.default} aria-label={`Key ${key}`}
          overrides={{ BaseButton: { style: { width: '56px', height: '56px', justifySelf: 'center', backgroundColor: theme.colors.backgroundSecondary } } }}>
          {key}
        </Button>
      ))}
      <Button kind={KIND.tertiary} size={SIZE.mini} onClick={onClose} overrides={{ BaseButton: { style: { gridColumn: '1 / -1', minHeight: '44px' } } }}>Done</Button>
    </div>
  );
}

export function CallPreviewDialog(props: React.ComponentProps<typeof PhoneCallPreview>) {
  return <PhoneDialDialog {...props} />;
}

export function PhoneCallPreview({
  isOpen,
  onClose,
  initialCustomer,
  customers,
  connection,
  members,
  officeHours,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialCustomer?: Customer | null;
  customers: Customer[];
  connection: PhoneConnectionConfig;
  members: PhoneMember[];
  officeHours?: string;
}) {
  const [, theme] = useStyletron();
  const [selected, setSelected] = React.useState<Customer | null>(initialCustomer ?? null);
  const [phase, setPhase] = React.useState<CallPhase>(initialCustomer ? 'ready' : 'pick');
  const [query, setQuery] = React.useState('');
  const [dialNumber, setDialNumber] = React.useState(initialCustomer?.phone ?? '');
  const [fallback, setFallback] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [speaker, setSpeaker] = React.useState(false);
  const [keypad, setKeypad] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const callOwner = members.find((member) => member.id === connection.ownerId);
  const callRoute = routeLabel(
    members,
    connection.ownerId,
    connection.routingMode,
    connection.ringGroupIds,
  );
  const callSource = connection.sourceNumber || 'Business number pending';
  const callFallback = connection.fallbackNumber;
  const callSchedule = scheduleLabel(connection.schedule, officeHours);
  /* ── §196.6 · THE CALL IS PLACED FOR REAL WHEN THE RAIL IS READY ───────────────────────────
   * One dialog, two truths, and the surface never mixes them: with the runtime holding Twilio and
   * the house number saved, pressing the primary asks `POST /api/calls` and the words on screen
   * are the provider's. Without it, E191's labelled preview machine runs exactly as it did — same
   * phases, same «no phone call is placed» step line — because a design that cannot call is still
   * worth walking. */
  const { readiness, recheck } = useReadiness(connection.sourceNumber);
  // This retained walkthrough is entered through an explicit sample-preview action.
  const live = false;
  const { state: dialState, dial: placeCall, reset: resetDial } = useDial();

  React.useEffect(() => {
    if (!isOpen) return;
    setSelected(initialCustomer ?? null);
    setPhase(initialCustomer ? 'ready' : 'pick');
    setQuery('');
    setDialNumber(initialCustomer?.phone ?? '');
    setFallback(false);
    setMuted(false);
    setSpeaker(false);
    setKeypad(false);
    setElapsed(0);
    resetDial();
  }, [isOpen, initialCustomer, resetDial]);

  React.useEffect(() => {
    /* THE PREVIEW'S CLOCK RUNS ONLY IN THE PREVIEW. A live call's phases belong to the provider,
       and a timer that walked them anyway would be the fabricated result this whole rail bans. */
    if (!isOpen || live) return undefined;
    let timer: number | undefined;
    if (phase === 'connecting') timer = window.setTimeout(() => setPhase('ringing'), 700);
    else if (phase === 'ringing') timer = window.setTimeout(() => setPhase(fallback ? 'fallback' : 'live'), 1400);
    else if (phase === 'fallback') timer = window.setTimeout(() => setPhase('live'), 1400);
    return () => window.clearTimeout(timer);
  }, [isOpen, phase, fallback]);

  React.useEffect(() => {
    if (phase !== 'live') return undefined;
    const timer = window.setInterval(() => setElapsed((was) => was + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);

  const shown = customers.filter((customer) => {
    const hay = `${customer.name} ${customer.phone ?? ''}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  }).slice(0, 6);

  const end = () => {
    if (phase === 'ready' || phase === 'pick') onClose();
    else setPhase('ended');
  };

  const title = phase === 'pick' ? 'Call someone' : phase === 'ended' ? 'Call ended' : 'Call';
  /* THE LIVE STATUS IS THE PROVIDER'S OWN ANSWER, and nothing beyond it is claimed: the runtime
     took the request (a sid), refused it by name, or could not be reached. The kit does not draw a
     ringing timer for a leg it cannot hear (§196.6 · VOICE-08B). */
  const liveStatus = dialState.state === 'placing' ? VOICE_COPY.placing
    : dialState.state === 'placed' ? `Calling ${dialState.to} from ${callSource}`
      : dialState.state === 'refused' ? dialState.because
        : dialState.state === 'unreachable' ? VOICE_COPY.unreachable
          : 'Ready to call';
  const status = live ? liveStatus
    : phase === 'ready' ? 'Ready to call'
      : phase === 'connecting' ? 'Connecting'
        : phase === 'ringing' ? 'Ringing in Rocoto'
          : phase === 'fallback' ? `Routing to ${compactPhone(callFallback)}`
            : phase === 'live' ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
              : phase === 'ended' ? `Call ended · ${Math.floor(elapsed / 60)} min ${elapsed % 60} sec`
                : '';

  return (
    <WorkflowDialog
      isOpen={isOpen}
      title={title}
      step={phase === 'pick' ? 'Choose a customer' : `${readiness.standing} · ${callSource}`}
      onClose={onClose}
      onBack={phase === 'ready' && !initialCustomer ? () => setPhase('pick') : undefined}
      testId="call-preview-dialog"
      flush={phase !== 'pick'}
      actions={phase === 'pick' ? undefined : phase === 'ready' ? (
        <>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Cancel</Button>
          <Button
            kind={KIND.primary}
            size={SIZE.compact}
            onClick={() => { if (live) placeCall(dialNumber); else setPhase('connecting'); }}
            data-testid="call-preview-start"
            disabled={dialNumber.replace(/\D/g, '').length < 7 || dialState.state === 'placing'}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
          >
            Call
          </Button>
        </>
      ) : phase === 'ended' ? (
        <>
          <Button kind={KIND.tertiary} size={SIZE.compact} onClick={onClose} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Close</Button>
          <Button kind={KIND.primary} size={SIZE.compact} onClick={() => { setElapsed(0); setPhase('connecting'); }} overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Call again</Button>
        </>
      ) : undefined}
    >
      {phase === 'pick' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500 }}>
          <Input
            value={query}
            onChange={(event) => setQuery((event.target as HTMLInputElement).value)}
            placeholder="Search customers or phone"
            aria-label="Search customers or phone"
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200 }}>
            {shown.map((customer) => (
              <ChoiceCard
                key={customer.id}
                active={selected?.id === customer.id}
                title={customer.name}
                detail={customer.phone ?? (customer.channel === 'phone' ? 'Phone number needed' : customer.channel)}
                onClick={() => { setSelected(customer); setDialNumber(customer.phone ?? ''); setPhase('ready'); }}
                testid={`call-customer-${customer.id}`}
              />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%', background: theme.colors.backgroundPrimary }}>
          <div style={{ flex: '1 1 auto', minHeight: 0, display: 'grid', placeItems: 'center', padding: theme.sizing.scale700, overflowY: 'auto' }}>
            <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: theme.sizing.scale500 }}>
              <Avatar name={selected?.name ?? 'Customer'} size="scale1600" />
              <div>
                <h3 style={{ margin: 0, ...theme.typography.HeadingMedium }}>{selected?.name ?? 'Customer'}</h3>
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: theme.sizing.scale200 }}>
                  {dialNumber || 'Number needed'}
                </span>
                <span data-testid="call-preview-status" aria-live="polite" style={{ ...theme.typography.LabelMedium, display: 'block', marginTop: theme.sizing.scale400 }}>{status}</span>
              </div>

              {phase === 'ready' && (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, textAlign: 'left' }}>
                  {!selected?.phone && (
                    <div>
                      <label htmlFor="call-dial-number" style={{ ...theme.typography.LabelSmall, display: 'block', marginBottom: theme.sizing.scale300 }}>
                        Number to call
                      </label>
                      <Input
                        id="call-dial-number"
                        value={dialNumber}
                        onChange={(event) => setDialNumber((event.target as HTMLInputElement).value)}
                        placeholder="+34 600 00 00 00"
                        aria-label="Number to call"
                        overrides={{ Input: { props: { inputMode: 'tel', 'data-testid': 'call-dial-number' } } }}
                      />
                      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', marginTop: theme.sizing.scale200 }}>
                        This customer’s phone number is still to add.
                      </span>
                    </div>
                  )}
                  <div data-testid="call-preview-route" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: theme.sizing.scale400, padding: theme.sizing.scale500, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300 }}>
                    <span>
                      <span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Calling from</span>
                      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block' }}>{callSource}</span>
                      <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block' }}>{callRoute} · {callSchedule}</span>
                    </span>
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, textAlign: 'right' }}>
                      {VOICE_COPY.metadataOnly}<br />{live ? 'Provider held' : 'Provider pending'}
                    </span>
                  </div>
                  {/* §196.6 — the rail's own standing, above the control that would use it */}
                  <RuntimeStanding readiness={readiness} testid="call-runtime-standing" onRecheck={recheck} />
                  {callFallback ? (
                    <Checkbox
                      checked={fallback}
                      onChange={(event) => setFallback((event.target as HTMLInputElement).checked)}
                      checkmarkType={STYLE_TYPE.toggle_round}
                    >
                      Route unanswered calls to {callOwner?.name ?? callRoute} · {compactPhone(callFallback)} · verification pending
                    </Checkbox>
                  ) : (
                    <StatusFact label="Fallback" value="Still to add" />
                  )}
                </div>
              )}

              {phase === 'fallback' && (
                <div style={{ width: '100%', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, textAlign: 'left' }}>
                  <span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Call routing</span>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                    Rocoto app · no answer → {callOwner?.name ?? callRoute} · {compactPhone(callFallback)} · verification pending
                  </span>
                </div>
              )}

              {phase === 'live' && keypad && <Keypad onClose={() => setKeypad(false)} />}

              {phase === 'ended' && (
                <div style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.sizing.scale300 }}>
                  <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, textAlign: 'left' }}>
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Result</span>
                    <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2 }}>Call ended</span>
                  </div>
                  <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, textAlign: 'left' }}>
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>Recording</span>
                    <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2 }}>Metadata only</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {phase !== 'ready' && phase !== 'ended' && (
            <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'center', gap: theme.sizing.scale700, padding: `${theme.sizing.scale600} ${theme.sizing.scale600} max(${theme.sizing.scale700}, env(safe-area-inset-bottom))`, borderTop: `1px solid ${theme.colors.borderOpaque}` }}>
              <CallControl glyph={muted ? 'micOff' : 'mic'} label={muted ? 'Unmute' : 'Mute'} active={muted} onClick={() => setMuted((was) => !was)} testid="call-mute" />
              {phase === 'live' && <CallControl glyph="keypad" label="Keypad" active={keypad} onClick={() => setKeypad((was) => !was)} testid="call-keypad" />}
              <CallControl glyph="speaker" label="Speaker" active={speaker} onClick={() => setSpeaker((was) => !was)} testid="call-speaker" />
              <CallControl glyph="callEnd" label="End" danger onClick={end} testid="call-end" />
            </div>
          )}
        </div>
      )}
    </WorkflowDialog>
  );
}

/* ── THE UNMATCHED-CALLER PREVIEW IS RETIRED (13 September 2026) ──────────────────────────────
 * `PhoneInboundPreview` drew a prepared, local inbound surface — the unmatched queue
 * (`phone-unmatched-entry`, `phone-unmatched-open`, `phone-unmatched-dialog`), the unknown-caller
 * dialog over it, and the link/create walk behind that — and its tenant record lived in
 * the retired preview state module (deleted with it). Nothing in `app/src` mounted it, on this branch or on the
 * `origin/main` it was retired from, so the surface reached no browser.
 *
 * WHERE EACH FACT IT DREW LIVES NOW. The call list, the missed-call word, the duration, the
 * custody line and the diarised transcript are the customer sheet's rail and the conversation's
 * rail, both drawn by `voice-objects.tsx` from the runtime's own `CallObject`s. The Google Places
 * identity — the number a house does not own, asked about once — is `IdentityCard` on the
 * customer sheet (`areas/customers.tsx`, `sheet-caller-identity`). The dial and its postures are
 * `phone-controller.tsx`. The proof is `drives/drive-199-voice-real.py`, which drives those live
 * surfaces; `drives/drive-191-voice.py` still names the retired testids.
 */

const SAMPLE_TRANSCRIPT = [
  { side: 'customer', text: 'Can you add four kilos of hake for tomorrow?' },
  { side: 'operator', text: 'Yes. I’ll add it to tomorrow’s delivery and confirm the final weight.' },
  { side: 'customer', text: 'Perfect, thank you.' },
];

/**
 * THE CUSTOMER'S CALLS, IN THE CONVERSATION (FEED-IA §196.6 · VOICE-07A).
 *
 * ⚠ WHAT §196.6 CHANGED HERE. E191 drew one seeded card so the design could be walked; the rail
 * now READS the runtime for this counterpart's real calls and draws them as communication objects
 * beside WhatsApp and email — direction, duration, recording custody and the diarised Spanish
 * transcript. The seeded card survives, marked «Sample», as the posture a browser takes when the
 * runtime is out of reach: a design that cannot call is still worth walking, and a sample that
 * says it is one has never claimed anything.
 */
export function SeededCallCard({
  customer,
  connection,
  members,
  officeHours,
}: {
  customer: Customer;
  connection: PhoneConnectionConfig;
  members: PhoneMember[];
  officeHours?: string;
}) {
  const [css, theme] = useStyletron();
  const [detail, setDetail] = React.useState(false);
  const [callback, setCallback] = React.useState(false);
  const [setupRequired, setSetupRequired] = React.useState(false);
  const operator = members.find((member) => member.id === connection.ownerId)?.name ?? 'Routing owner';
  const fallbackLine = connection.fallbackNumber ? compactPhone(connection.fallbackNumber) : 'saved route';
  /* §196.6 — the counterpart's own number is what the runtime holds calls under. A customer with
     no saved phone still has the account number the sheet prints, so both surfaces ask about the
     same line rather than two. */
  const number = customer.phone?.trim() || accountNumber(customer);
  const { posture } = useRuntimePosture();
  const { read, refresh } = useCalls(number, posture.state === 'ready');
  const [openCall, setOpenCall] = React.useState<CallObject | null>(null);
  const railLive = posture.state === 'ready';

  if (!railLive) {
    return (
      <>
        <button type="button" onClick={() => setCallback(true)} data-testid="customer-call-rail" style={{ appearance: 'none', width: '100%', minHeight: 64, boxSizing: 'border-box', border: 'none', borderRadius: theme.borders.radius400, backgroundColor: 'transparent', color: 'inherit', font: 'inherit', textAlign: 'left', padding: theme.sizing.scale500, display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr)', alignItems: 'center', gap: theme.sizing.scale400, cursor: 'pointer' }}>
          <span aria-hidden="true" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary }}><Glyph id="call" size={STEP.medium} /></span>
          <span style={{ minWidth: 0 }}><span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Phone calls</span><span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block' }}>Call {customer.name} or finish phone setup.</span></span>
        </button>
        <CallPreviewDialog isOpen={callback} onClose={() => setCallback(false)} initialCustomer={customer} customers={[customer]} connection={connection} members={members} officeHours={officeHours} />
      </>
    );
  }

  return (
    <>
      {railLive ? (
        <section data-testid="customer-call-rail" data-call-number={number} style={{ padding: `${theme.sizing.scale300} 0`, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
            <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>Calls on {number}</span>
            <Button kind={KIND.tertiary} size={SIZE.mini} onClick={refresh} data-testid="customer-calls-refresh"
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
              Read again
            </Button>
          </div>
          <CallList read={read} onOpen={setOpenCall} testid="customer-calls" empty={`Calls on ${number} land here.`} />
        </section>
      ) : (
      <div data-testid="seeded-call-row" style={{ padding: `${theme.sizing.scale200} 0` }}>
        <button
          type="button"
          onClick={() => setDetail(true)}
          data-testid="seeded-call-card"
          className={css({
            appearance: 'none',
            width: '100%',
            boxSizing: 'border-box',
            font: 'inherit',
            color: 'inherit',
            textAlign: 'left',
            border: 'none',
            borderRadius: theme.borders.radius400,
            backgroundColor: 'transparent',
            padding: theme.sizing.scale500,
            display: 'grid',
            gridTemplateColumns: '40px minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: theme.sizing.scale400,
            cursor: 'default',
            ':hover': { backgroundColor: theme.colors.backgroundSecondary },
            ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' },
          })}
        >
          <span aria-hidden="true" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: theme.borders.radius300, background: theme.colors.backgroundSecondary }}>
            <Glyph id="call" size={STEP.medium} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ ...theme.typography.LabelSmall, display: 'block' }}>Incoming call</span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              2 min 18 sec · {operator} answered on {fallbackLine}
            </span>
          </span>
          <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>Saved call</span>
        </button>
      </div>
      )}

      {/* §196.6 — a real call, opened: its facts, its diarised Spanish words, and the way back to
          the person who made it. Provider identifiers and media URLs never reach this sheet. */}
      <WorkflowDialog
        isOpen={openCall !== null}
        onClose={() => setOpenCall(null)}
        title={openCall ? directionWord(openCall) : 'Call'}
        step={openCall ? `${customer.name} · ${callWhen(openCall)}` : ''}
        testId="customer-call-detail"
        actions={(
          <>
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setOpenCall(null)}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>Close</Button>
            <Button
              kind={KIND.primary}
              size={SIZE.compact}
              data-testid="customer-call-back"
              onClick={() => {
                setOpenCall(null);
                if (connection.prepared) setCallback(true);
                else setSetupRequired(true);
              }}
              overrides={{ BaseButton: { style: { minHeight: '44px' } } }}
            >
              Call back
            </Button>
          </>
        )}
      >
        {openCall && (
          <CallDetail call={openCall} houseName={operator} themName={customer.name} testid="customer-call-sheet" />
        )}
      </WorkflowDialog>

      <WorkflowDialog
        isOpen={detail}
        onClose={() => setDetail(false)}
        title="Incoming call"
        step={`${customer.name} · 08:42`}
        testId="call-detail-dialog"
        actions={(
          <>
            <Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setDetail(false)}>Close</Button>
            <Button kind={KIND.primary} size={SIZE.compact} onClick={() => {
              setDetail(false);
              if (connection.prepared) setCallback(true);
              else setSetupRequired(true);
            }}>Call back</Button>
          </>
        )}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale300 }}>
            {[
              ['Result', 'Completed'],
              ['Duration', '2 min 18 sec'],
              ['Audio', 'Deleted'],
            ].map(([label, value]) => (
              <div key={label} style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, padding: theme.sizing.scale500, minWidth: 0 }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{label}</span>
                <span style={{ ...theme.typography.LabelSmall, display: 'block', marginTop: 2, overflowWrap: 'anywhere' }}>{value}</span>
              </div>
            ))}
          </div>

          <section>
            <h3 style={{ margin: `0 0 ${theme.sizing.scale400}`, ...theme.typography.LabelMedium }}>Transcript</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300 }}>
              {SAMPLE_TRANSCRIPT.map((line, index) => {
                const mine = line.side === 'operator';
                return (
                  <div key={index} style={{ maxWidth: '82%', alignSelf: mine ? 'flex-end' : 'flex-start', border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400, padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`, background: mine ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary }}>
                    <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary, display: 'block', marginBottom: 4 }}>{mine ? operator : customer.name}</span>
                    <span style={{ ...theme.typography.ParagraphSmall }}>{line.text}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <h3 style={{ margin: `0 0 ${theme.sizing.scale400}`, ...theme.typography.LabelMedium }}>Activity</h3>
            {[
              ['08:42', 'The Rocoto app passed it on.'],
              ['08:42', `Rang ${operator} on ${fallbackLine}.`],
              ['08:43', `${operator} answered.`],
              ['08:45', 'Transcript ready · audio deleted.'],
            ].map(([time, text]) => (
              <div key={`${time}-${text}`} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)', gap: theme.sizing.scale300, padding: `${theme.sizing.scale300} 0`, borderBottom: `1px solid ${theme.colors.borderOpaque}` }}>
                <span style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{time}</span>
                <span style={{ ...theme.typography.ParagraphXSmall }}>{text}</span>
              </div>
            ))}
          </section>
        </div>
      </WorkflowDialog>

      <PhoneSetupRequiredDialog
        isOpen={setupRequired}
        onClose={() => setSetupRequired(false)}
        onOpenSettings={() => {
          setSetupRequired(false);
          window.location.hash = '#/admin/connections';
        }}
      />
      <CallPreviewDialog
        isOpen={callback}
        onClose={() => setCallback(false)}
        initialCustomer={customer}
        customers={[customer]}
        connection={connection}
        members={members}
        officeHours={officeHours}
      />
    </>
  );
}
