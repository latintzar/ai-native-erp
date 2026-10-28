/* WHERE IT GOES — THE ROUND, ON REAL GROUND (FEED-IA §21.1, §22.3 · THE CHECKPOINT §19.2, §19.3)
 *
 * ═══ IT IS MOUNTED, AND THIS IS THE QUESTION IT ANSWERS ════════════════════════════════════════
 * It stood here unmounted for four days, under a PARKED note, because §25 ruled that a DROP is a
 * pin on a real map — «the location has to be a PIN. Real map. Not some custom made map» — and a
 * hand-drawn territory cannot answer «where is this delivery». That ruling stands and `pin-map.tsx`
 * still owns it.
 *
 * THE CHECKPOINT ASKS THE OTHER QUESTION. §19.2: «map / choropleth-like selection», §19.3:
 * «hover/direct selection». That is not «where is this drop», it is «WHICH GROUND DO WE COVER, and
 * which piece of it am I looking at» — the case §25's ruling left open, and the one case a
 * choropleth is the right instrument for. So this draws the house's six runs, paints the one being
 * read, and hands a press back to whoever mounted it. It is mounted at the head of a zone's card in
 * `areas/admin/geography.tsx`, and the drop's pin is untouched.
 *
 * «The map gotta be an actual map bro. I don't want any half-assed things.» The polygons this
 * replaces were invented: six irregular shapes above an invented sea. Nobody who lives here could
 * read them, which means they were decoration wearing a map's clothes.
 *
 * So the geometry is REAL and it is not written here — `tools/build-round-map.mjs` merges the
 * official 2025 Catalan administrative geometry into the house's own six runs and checks the result
 * in as `round-map-geo.ts`. This file is only the drawing: the picture, its paint, and the words
 * beside it. NO TILES ARE FETCHED and none are needed: this is vector geometry checked into the
 * repo, so §86.7's «the runtime app never calls a metered API» holds here by construction.
 *
 * ═══ WHAT A PERSON HAS TO GET FROM IT, IN ONE LOOK ═════════════════════════════════════════════
 *   1 · THIS IS MY COAST.    The Mediterranean runs corner to corner, Barcelona sits on it with the
 *                            port's own breakwaters drawn, and the Maresme climbs away to Mataró.
 *                            A local recognises it before reading a single word.
 *   2 · THAT IS OUR ROUND.   The six runs are one continuous darker patch of ground — the house's
 *                            territory — parted by paper-thin lines rather than boxed.
 *   3 · THIS ONE GOES THERE. One run is ink. Nothing else on the picture is.
 *
 * ═══ THE PAINT, WHICH IS FOUR STEPS OF ONE INK ════════════════════════════════════════════════
 * The sea is the paper, the land a wash on it, the round a step darker, this run ink — so weight
 * rises exactly with how much the reader is meant to care, and the coast is one ink line, which is
 * what linework means in this house. The accent appears NOWHERE: a delivery zone is a fact about
 * the house, never something the software did.
 *
 * HOVER IS A FIFTH STEP ON THE SAME RAMP AND NOTHING ELSE (§37.3: hover paints ground and moves
 * nothing). A run under the pointer steps from the round's wash toward the ink without reaching it,
 * so the selected run stays the only ink on the picture and the geometry never moves by a pixel —
 * no stroke growing, no lift, no scale. The selection is what the picture is FOR; the hover is only
 * the promise that a press will land.
 *
 * ═══ OVERLAP IS ALLOWED, AND NOTHING RESOLVES IT (§19.6 · §28) ════════════════════════════════
 * «Overlapping zones allowed» is the checkpoint's; «delivery-zone overlap algorithm» is on its own
 * list of things nobody closes but Peter. So the runs are painted in the order the house holds
 * them and a shape that overlaps another simply paints over it. There is no z-rule here, no
 * winner, and no arithmetic about who serves the shared ground — a picture that resolved an
 * overlap would be shipping the algorithm §28 keeps open, disguised as paint.
 *
 * ═══ AND NO TRUCK CAPACITY (§27.8) ════════════════════════════════════════════════════════════
 * The map draws ground and says which vans run it. It knows nothing about weight, volume, pallets
 * or overflow, and it must not learn.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { LAND, MAP_HEIGHT, MAP_WIDTH, VIEW_BOX, ZONES } from './round-map-geo';

export { ZONES as ROUND_ZONES } from './round-map-geo';

/** what the house calls the run a customer sits in */
export const zoneNameOf = (id?: string): string | undefined =>
  ZONES.find((z) => z.id === id)?.name;

export default function RoundMap({
  zoneId,
  truck,
  /* ── WHAT THE HOUSE CALLS A RUN, WHERE THE HOUSE HAS RENAMED ONE (§122) ────────────────────
   * The map's own `ZONES` seed the names, and after §122 a house can write its own word on a
   * band (`ZoneBand.name`). This map may not read that fold itself — `company.ts` already imports
   * THIS module, and a cycle between a store and the geography it names is how both stop being
   * loadable — so the CALLER hands the reader down. Absent, the seed answers, which is what every
   * other caller of this map already gets. Without it the caption disagreed with the card above
   * it: «Costa Norte» on the heading and «Gràcia» under the picture, on one screen. */
  nameOf,
  /** the one line of context under the run's name: who, and which day */
  note,
  /** the line each run carries on its own hover label — the house's words, never the map's */
  notes,
  /** hand a press back and the six shapes become a selection device (§19.3). Withheld, the picture
   *  is a reading and takes no pointer at all — an affordance is a promise (§43). */
  onPick,
  testid = 'round-map',
}: {
  zoneId?: string;
  truck?: number;
  note?: React.ReactNode;
  notes?: Record<string, string>;
  /** the house's own word for a run, where the caller can read one (§122). */
  nameOf?: (id: string) => string | undefined;
  onPick?: (id: string) => void;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  const [over, setOver] = React.useState<string | null>(null);
  const zone = ZONES.find((z) => z.id === zoneId);

  /* THE PICTURE STANDS WITHOUT A SELECTION. It used to return `null` without one, which was right
     for a caption about ONE run and wrong for a map of six: the ground the house covers is a true
     thing to draw before anybody has picked a piece of it. */
  const shown = zone ?? (over ? ZONES.find((z) => z.id === over) : undefined);

  const paintOf = (id: string): string => {
    if (id === zone?.id) return theme.colors.contentPrimary;
    if (id === over) return theme.colors.mono600;
    return theme.colors.mono500;
  };

  return (
    <figure
      data-testid={testid}
      data-zone={zone?.id ?? ''}
      data-picks={onPick ? 'yes' : 'no'}
      style={{
        margin: 0,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        borderRadius: theme.borders.radius300,
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
      }}
    >
      {/* THE PICTURE. It keeps its own proportion at every width — a map that stretches is a map
          that lies about the shape of the coast, which is the one thing it is here to tell. */}
      <svg
        viewBox={VIEW_BOX}
        role={onPick ? 'group' : 'img'}
        aria-label={
          zone
            ? `${zone.name}, the run through ${zone.parts.join(', ')}`
            : `The ground this house covers, in ${ZONES.length} runs`
        }
        style={{
          display: 'block',
          width: '100%',
          height: 'auto',
          aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}`,
          background: theme.colors.backgroundPrimary,
        }}
        onMouseLeave={() => setOver(null)}
      >
        {/* THE LAND, AND THEREFORE THE COAST. One silhouette, one ink line: where the wash stops,
            the water starts. `evenodd` so a lake or an enclave reads as a hole rather than as more
            land drawn over itself. */}
        <path
          d={LAND}
          fill={theme.colors.mono300}
          stroke={theme.colors.contentPrimary}
          strokeWidth="2.2"
          strokeLinejoin="round"
          fillRule="evenodd"
        />
        {/* THE ROUND. Each run is already merged, so the towns inside a run have no line between
            them and the run reads as ONE area — which is what a run is. The hairline between runs
            is the paper itself, the way a printed choropleth has always parted its areas.
            AND EACH SHAPE IS THE CONTROL (§19.3). A press on the ground is how a person picks a
            zone here; the list beside it does the same job for a keyboard that walks rows, and the
            shape takes a focus ring of its own so the ground is reachable without a pointer. */}
        {ZONES.map((z) => {
          const on = z.id === zone?.id;
          const words = notes?.[z.id] ? `${z.name} — ${notes[z.id]}` : z.name;
          return (
            <path
              key={z.id}
              d={z.d}
              data-map-zone={z.id}
              data-on={on ? 'yes' : 'no'}
              data-over={z.id === over ? 'yes' : 'no'}
              fill={paintOf(z.id)}
              stroke={theme.colors.backgroundPrimary}
              strokeWidth="1.5"
              strokeLinejoin="round"
              fillRule="evenodd"
              {...(onPick
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-pressed': on,
                    'aria-label': words,
                    style: { cursor: 'pointer', outline: 'none' },
                    onMouseEnter: () => setOver(z.id),
                    onFocus: () => setOver(z.id),
                    onBlur: () => setOver((was) => (was === z.id ? null : was)),
                    onClick: () => onPick(z.id),
                    onKeyDown: (e: React.KeyboardEvent<SVGPathElement>) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      onPick(z.id);
                    },
                  }
                : null)}
            >
              {/* THE NAME RIDES THE SHAPE ITSELF, never a layer (§30, and the search seat's own
                  finding): a hover label mounted on a layer takes the Escape key away from the
                  work. `<title>` costs no layer and reaches a pointer and a screen reader both. */}
              <title>{words}</title>
            </path>
          );
        })}
      </svg>

      {/* THE WORDS, BESIDE THE PICTURE AND NEVER ON IT. A name set inside a polygon overflows it
          the moment the polygon is a small one, and a word hanging off the edge of a map is a map
          that has stopped being trusted. The drawing says WHERE; this strip says what and who.
          UNDER THE POINTER IT SAYS WHAT THE POINTER IS ON, which is what makes a choropleth
          readable at this size: the districts of Barcelona are thirty pixels across, and a person
          hovering one gets its name in a fixed place rather than hunting for a label. */}
      <figcaption
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale500,
          flexWrap: 'wrap',
          padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
          borderTop: `1px solid ${theme.colors.borderOpaque}`,
          minWidth: 0,
        }}
      >
        <span data-testid="round-zone" style={theme.typography.LabelMedium}>
          {shown ? (nameOf?.(shown.id) ?? shown.name) : `${ZONES.length} runs`}
        </span>
        <span
          data-testid="round-truck"
          style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}
        >
          {shown && notes?.[shown.id]
            ? notes[shown.id]
            : shown
              ? `Truck ${truck ?? 1} runs it`
              : 'The ground this house covers'}
        </span>
        {note !== undefined && (
          <span
            style={{
              ...theme.typography.ParagraphXSmall,
              color: theme.colors.contentTertiary,
              marginLeft: 'auto',
              minWidth: 0,
            }}
          >
            {note}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
