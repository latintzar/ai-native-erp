/* CUENTA — the PERSON, and the scope break that is the whole point of the seat.
 *
 * ═══ WHY IT SITS AT THE RAIL'S FOOT, APART (THE-ADMIN-CANON §2, §7) ═════════════════════════
 * Nine seats above it are about the BUSINESS. This one is about the person signed into it — their
 * own name, their own phone, their own language, their own way out. The Linear/Notion scope law:
 * personal scope stays hard-separated from workspace scope, and THE SEPARATION IS THE PLACEMENT
 * ITSELF. There is no label saying «personal»; there is a hairline, a gap, and a seat below it.
 *
 * That is also why nothing on this seat writes to `company.ts`: a person is not a field of the
 * house. `config.owner` is theirs (§53: «it shouldn't be your Rocoto name, but it should be the
 * person, like their account»), and everything else here waits honestly for auth.
 *
 * ═══ THE WIREFRAME (§51.24) ═════════════════════════════════════════════════════════════════
 *
 *   ┌─ CUENTA · one column, scrolling (§87) ───────────────────────────────────────────────────┐
 *   │ CARD     (R) the person — name · what they may do in the house · their phone · their email │
 *   │ LANGUAGE the language THEY read the app in (the house's own default is one seat away)      │
 *   │ SESSION  Sign out — drawn and QUIET until there is a session to end                        │
 *   │ ───────────────────────────── hairline ────────────────────────────────────────────────── │
 *   │ HOUSE    the founder's own control (§89.2) — the three seeded houses, and the seed         │
 *   └──────────────────────────────────────────────────────────────────────────────────────────┘
 *
 * ═══ AND THE FOUNDER'S CONTROL LANDS AT ITS FOOT (FEED-IA §89.2) ════════════════════════════
 * «I would be able to access it if I go to settings and then the founder settings tab or the
 * account settings. There I just change which seeded data it has.» He named this seat, so the
 * region lives here — and it takes the SAME break the seat itself takes from the business world
 * above it: a hairline, a gap, and a region below it. One scope law, applied twice.
 *
 * `founder.tsx` exports no `meta`, so the shell's glob leaves it alone and the admin rail stays at
 * nine seats plus this one. The region is a component of this seat, drawn inside its column.
 *
 *   TYPE STEPS   HeadingSmall (their name) · HeadingXSmall (a section) · LabelMedium (a row).
 *   STATES       IT IS HONEST ABOUT BEING PRE-AUTH. Nobody has signed in — there is no accounts
 *                layer yet (Row 0 tenancy) — so the way out is drawn and DISABLED, and the row says
 *                what it is waiting for. A control that pretended to end a session there is no
 *                session to end would be the app inventing a state, which is the one thing this
 *                build refuses everywhere else.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { useConfig } from '../../config';
import { List, Row, Section } from '../../rows';
import { openUser } from '../../anchors';
import { ADMIN, type AreaMeta } from '../../shell/area';
import { LANGUAGES, ROLE_DOES, ROLE_LABEL, memberOf, setMember, useCompany } from '../../company';
/* ── §122 · EDITABLE FROM THE GET-GO ────────────────────────────────────────────────────────
   «EVERYTHING SHOULD ALWAYS BE EDITABLE FROM THE GET-GO. You shouldn't need to confirm anything.»
   Your own name and your own number are the two most authored facts in the house, and both stood
   behind a card with a Save on it. The card is gone; the values are the fields. */
import { LiveValue } from '../../live-value';
import { OWNER } from '../../../../scenarios/data/cast';

export const meta: AreaMeta = {
  id: 'account',
  title: 'Account',
  owner: 'V2-ADMIN',
  /* §87 — an administration seat is a settings surface and scrolls as one column. */
  panes: false,
};

export default function Account() {
  const [, theme] = useStyletron();
  const { config, set } = useConfig();
  const company = useCompany();

  /** the person's own row in the house's roster — the SAME object Team draws, so their standing
   *  here and their card there cannot disagree, and this seat doors into it */
  const me = memberOf(company, OWNER.id);
  const initial = config.owner.name.trim().slice(0, 1).toUpperCase();

  return (
    <div
      data-testid="seat-account"
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale900, minWidth: 0 }}
    >
      {/* ── THE PERSON ─────────────────────────────────────────────────────────────────────── */}
      <section
        data-testid="account-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.sizing.scale600,
          padding: theme.sizing.scale700,
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius400,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        {/* ONE AVATAR GRAMMAR, HOUSE-WIDE (THE-CHECKPOINT-AUDIT finding 6 · FEED-IA §127.3). The
            same person's mark in the rail, in the Team list and here is one drawing: an initial on
            the neutral ground. It was a solid accent disc, which made a red MARK out of somebody's
            face — and red in this product says «a human being is waiting on you», never «this is
            who you are». The reasoning is written once, on the rail's own avatar. */}
        <span
          data-testid="account-avatar"
          data-avatar="person"
          aria-hidden="true"
          style={{
            width: 48,
            height: 48,
            flex: '0 0 auto',
            borderRadius: '50%',
            background: theme.colors.backgroundSecondary,
            color: theme.colors.contentPrimary,
            display: 'grid',
            placeItems: 'center',
            ...theme.typography.HeadingXSmall,
          }}
        >
          {initial}
        </span>
        <div style={{ minWidth: 0 }}>
          <h2 data-testid="account-name" style={{ margin: 0, ...theme.typography.HeadingSmall }}>
            <LiveValue
              value={config.owner.name}
              label="Your name"
              placeholder={OWNER.name}
              testid="account-name-value"
              size="default"
              width={280}
              onWrite={(name) => set({ owner: { name: name || config.owner.name } })}
            />
          </h2>
          <p style={{ margin: `${theme.sizing.scale100} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {me ? ROLE_DOES[me.role] : 'The person this account belongs to.'}
          </p>
        </div>
      </section>

      <Section title="You" testid="you">
        <List testid="account-rows">
          <Row
            testid="account-name-row"
            mark="who"
            label="Your name"
            /* NO SUB (THE-CONTENT-CANON §9 item 29): the label and the value say the whole row,
               and the old sentence pointed at the screen — the layout's job, never the copy's. */
            /* THE SAME EDITOR, NOT A SECOND ONE. Two editable values over one field is fine; two
               EDITORS over one field is where two seats start disagreeing about what «open» and
               «save» mean (`business.tsx` states the law). So the row carries the head's own
               control rather than a door onto a card of its own. */
            /* THE FIELD TAKES ITS ROOM (§77.2 · AUDIT-2 C21). The value column is `nowrap` with
               `overflow: hidden`, drawn for a short trailing fact — a control put in it came out
               as «Peter Provisiona», a name clipped without even an ellipsis to say so. `token`
               is the row's own declaration for a value that may not be cut: it stops the column
               shrinking under the label and lets the field stand at its full measure. */
            token
            value={
              <LiveValue
                value={config.owner.name}
                label="Your name"
                placeholder={OWNER.name}
                testid="account-name-row-value"
                width={240}
                onWrite={(name) => set({ owner: { name: name || config.owner.name } })}
              />
            }
          />
          {me && (
            <Row
              testid="account-standing"
              mark="team"
              label="What you may do here"
              /* ONE STRING, ONE HOME (THE-CONTENT-CANON §4, substance). The card at the head of
                 this seat already carries `ROLE_DOES` under the person's name; printing it again
                 two rows down is the same sentence twice on one screen. */
              value={me.admin ? `${ROLE_LABEL[me.role]} · admin` : ROLE_LABEL[me.role]}
              wrapValue
              onOpen={() => openUser(me.id)}
            />
          )}
          {me && (
            <Row
              testid="account-phone"
              mark="chat"
              label="Your phone"
              sub="For order questions that need you."
              token
              value={
                <LiveValue
                  value={me.phone}
                  label="Your phone"
                  placeholder="Add a number"
                  testid="account-phone-value"
                  width={200}
                  onWrite={(phone) => setMember(me.id, { phone })}
                />
              }
            />
          )}
        </List>
      </Section>

      {/* ── THE LANGUAGE THEY READ IN ──────────────────────────────────────────────────────
          A PERSON's language, which is a different fact from the house's default — that one lives
          in App settings, and this row doors to it rather than holding a second copy. Until auth
          lands there is one person, so the two agree; the day there are five they will not, and the
          shape is already right. */}
      <Section title="Language" testid="language">
        <List testid="account-language-rows">
          <Row
            testid="account-language"
            mark="catalogue"
            label="How you read the app"
            sub="The default language is in App settings."
            value={LANGUAGES.find((l) => l.value === company.language)?.label ?? ''}
            onOpen={() => { window.location.hash = `#/${ADMIN}/app-settings`; }}
          />
        </List>
      </Section>

      {/* ── THE WAY OUT ────────────────────────────────────────────────────────────────────
          Drawn, disabled, and honest about why. Row 0 tenancy brings the session; this control is
          waiting for it rather than pretending. */}
      <Section title="Signing out" testid="session">
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale500, flexWrap: 'wrap', minWidth: 0 }}>
          <Button kind={KIND.secondary} size={SIZE.compact} disabled data-testid="sign-out">
            Sign out
          </Button>
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, minWidth: 0 }}>
            Sign out opens once a session is signed in.
          </span>
        </div>
      </Section>


    </div>
  );
}
