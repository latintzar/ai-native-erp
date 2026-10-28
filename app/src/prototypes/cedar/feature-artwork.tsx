import * as React from 'react';
import { useStyletron } from 'baseui';

/** THE FEATURE OBJECTS — one 3D set in Uber's register (FEED-IA §247.5).
 *
 * Each kind names one file under public/cedar-artwork, generated as a remix of the wallet anchor
 * using the anchor's own verbatim description with only its subject changed, so a wallet on the
 * Money card and a fish crate on the workspace entrance read as one hand. They are drawn small —
 * 88 to 184 px — and every candidate is reviewed at that size before installation. The README
 * beside the files carries every prompt and the reviewed provenance.
 *
 * Feature imagery is decorative; account and provider status comes from adjacent text. */
export type FeatureArtworkKind = 'delivery' | 'money' | 'phone' | 'email';

const FILE: Record<FeatureArtworkKind, string> = {
  delivery: 'delivery-batch',
  money: 'working-capital',
  phone: 'phone-connection',
  email: 'email-connection',
};

export function FeatureArtwork({ kind, size = 120 }: { kind: FeatureArtworkKind; size?: number }) {
  return <img src={`/cedar-artwork/${FILE[kind]}.png`} alt="" data-artwork={kind}
    width={size} height={size} decoding="async" style={{ display:'block', width:size, height:'auto', aspectRatio:'1 / 1', objectFit:'contain', maxWidth:'100%', flexShrink:0 }} />;
}

/* ── THE HERO REGISTER · A FULL-BLEED PICTURE AT THE TOP OF A MODAL (FEED-IA §247.6–§247.8) ────
 *
 * «also uber base system uyses a syle offull illustraiotns for some modals and stuff, maybe like
 *  the working capital loan popup can have some stuff»                            — Peter, 11 Sept
 * «image is for like feature stuff and disclaimers or like for the start of some flow»
 *                                                                                 — Peter, 13 Sept
 *
 * The third register, and the one with the largest job. A feature OBJECT is one thing on a white
 * ground, drawn at 88–184 px beside a label; a HERO is a whole scene that runs the full width of a
 * dialog, above its title, exactly as Uber's own modals do — image, title, body, one action.
 *
 * WHERE ONE BELONGS (§247.12, Peter's rule): on a feature the person has yet to try, at the moment
 * it offers itself, once, and rare on purpose — «it's features they might not have tried. we cant
 * send too many though». In Cedar today that is one seat, the Pay over time dialog. Lists, sheets,
 * steps, confirmations and the entrance carry none; setup and empty states keep their 3D objects,
 * and a line icon labels a control beside a word. THE SUBJECT IS THE MODAL'S OWN — what its body sentence names —
 * drawn in a Spanish-speaking place with no lettering anywhere, so the Castellano build ships the
 * same file. The style words come from the anchor's own `describe`; the anchor's scene never does
 * (the anchor is Uber's, kept privately in `library/illustrations/references/`).
 *
 * THE ALT TEXT IS EMPTY ON PURPOSE. The hero carries no fact the title below it lacks, so a screen
 * reader that announced it would read the picture twice. The title and the body are the content.
 *
 * ONE SCENE, TWO FRAMES. The scene is generated at 16:9 and reframed to 21:9 by outpainting (the
 * widest frame the generator offers), so the subject is whole at both widths: a phone sheet
 * (≤ 559 px, `PHONE_MAX`) draws the 16:9 as a full-width band (219 px at 390); a desk dialog
 * (800 px wide, 600 px tall at most) draws the 21:9 frame in a 3:1 band of 267 px — the eleventh
 * it crops top and bottom is sky and floor, the scene is composed in the middle — and keeps the
 * title, the choices and the action in view. `<picture>` picks the frame; the same file name with
 * `-wide` is the desk frame.
 *
 * A HERO THAT HAS YET TO BE GENERATED TAKES NO ROOM. The slot stays in the document with the file
 * it expects, so a drive can read what this popup is wired to; the moment the file is installed,
 * the picture appears at the top of the dialog with nothing else to change. */
export type HeroArtworkKind = 'working-capital';

const HERO_FILE: Record<HeroArtworkKind, string> = { 'working-capital': 'hero-working-capital' };

/** The desk frame is the 3:1 reframe; below this width the phone sheet draws the 16:9 whole. */
const HERO_DESK_MIN_WIDTH = 560;

export function HeroArtwork({ kind }: { kind: HeroArtworkKind }) {
  const [css, theme] = useStyletron();
  /* The band claims its room only once the picture has decoded: a slot that opened at full height
     and collapsed on a 404 moved the whole dialog on every open (hero review, 11 September). */
  const [drawn, setDrawn] = React.useState(false);
  const source = `/cedar-artwork/${HERO_FILE[kind]}.png`;
  const wide = `/cedar-artwork/${HERO_FILE[kind]}-wide.png`;
  const band = css({
    margin: 0, width: '100%', minWidth: 0, flexShrink: 0, overflow: 'hidden',
    backgroundColor: theme.colors.backgroundSecondary,
    ...(drawn
      ? { aspectRatio: '3 / 1', [`@media (max-width: ${HERO_DESK_MIN_WIDTH - 1}px)`]: { aspectRatio: '16 / 9' } }
      : { height: 0 }),
  });
  return <figure data-testid={`hero-${kind}`} data-hero={kind} data-hero-source={source} data-hero-wide={wide}
    data-hero-state={drawn ? 'drawn' : 'pending'} className={band}>
    <picture>
      <source media={`(min-width: ${HERO_DESK_MIN_WIDTH}px)`} srcSet={wide} />
      <img src={source} alt="" width={1024} height={576} decoding="async"
        onLoad={() => setDrawn(true)}
        onError={() => setDrawn(false)}
        style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
    </picture>
  </figure>;
}
