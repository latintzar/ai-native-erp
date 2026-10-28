/* GALLERY — the kit page.
 *
 * The pictures are GENERATED, inline, as data URIs. Two reasons, both learned the hard way in this
 * repo: the reference page has to render with no network at all (Uber's own aspect-ratio example
 * pointed at an avatar service that stopped answering, and the tile went blank), and a themed
 * photograph on a control quietly decides which control serves which moment of the product — the
 * mapping the situations catalogue exists to make deliberately, later. So the stand-ins are flat
 * shapes drawn from the theme's own ink and paper, in the assorted shapes real photographs come in.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Section, Tile, Grid } from '../chrome';
import { Gallery } from '../../rocoto/gallery';
import type { GalleryPhoto } from '../../rocoto/gallery';

/** the compositions the stand-ins are drawn from — flat, geometric, and none of them a picture of
 *  anything in particular */
type Composition = 'bars' | 'orb' | 'wedge' | 'stack' | 'arc';

const round = (n: number) => Math.round(n * 10) / 10;

/** ONE STAND-IN PICTURE, as an inline SVG data URI. Ink at assorted opacities on the theme's own
 *  secondary ground, with one quiet band across the foot — so the whole plate retints with the
 *  brand and a frame reads as a picture rather than as a hole in the tile.
 *
 *  They are drawn at PHOTOGRAPH size, not at thumbnail size. `max-width/height: 100%` fits a large
 *  picture down to the stage and `width/height: auto` refuses to blow a small one up, so a plate of
 *  200px stand-ins would have demonstrated a viewer that never fills — which is a property of the
 *  stand-ins rather than of the component. */
function drawPhoto(
  composition: Composition,
  w: number,
  h: number,
  ink: string,
  ground: string,
  band: string
): string {
  const fill = (opacity: number) => `fill="${ink}" fill-opacity="${opacity}"`;
  const parts: string[] = [
    `<rect width="${w}" height="${h}" fill="${ground}"/>`,
    `<rect x="0" y="${round(h * 0.68)}" width="${w}" height="${round(h * 0.32)}" fill="${band}"/>`,
  ];

  if (composition === 'bars') {
    parts.push(`<rect x="${round(w * 0.12)}" y="${round(h * 0.3)}" width="${round(w * 0.16)}" height="${round(h * 0.38)}" ${fill(0.5)}/>`);
    parts.push(`<rect x="${round(w * 0.36)}" y="${round(h * 0.16)}" width="${round(w * 0.16)}" height="${round(h * 0.52)}" ${fill(0.26)}/>`);
    parts.push(`<rect x="${round(w * 0.6)}" y="${round(h * 0.42)}" width="${round(w * 0.16)}" height="${round(h * 0.26)}" ${fill(0.66)}/>`);
  } else if (composition === 'orb') {
    parts.push(`<circle cx="${round(w * 0.5)}" cy="${round(h * 0.44)}" r="${round(Math.min(w, h) * 0.24)}" ${fill(0.55)}/>`);
    parts.push(`<rect x="${round(w * 0.08)}" y="${round(h * 0.62)}" width="${round(w * 0.84)}" height="${round(h * 0.06)}" ${fill(0.22)}/>`);
  } else if (composition === 'wedge') {
    parts.push(`<polygon points="0,${round(h * 0.68)} ${round(w * 0.4)},${round(h * 0.2)} ${round(w * 0.7)},${round(h * 0.68)}" ${fill(0.5)}/>`);
    parts.push(`<polygon points="${round(w * 0.48)},${round(h * 0.68)} ${round(w * 0.8)},${round(h * 0.4)} ${w},${round(h * 0.68)}" ${fill(0.26)}/>`);
    parts.push(`<circle cx="${round(w * 0.78)}" cy="${round(h * 0.2)}" r="${round(Math.min(w, h) * 0.09)}" ${fill(0.62)}/>`);
  } else if (composition === 'stack') {
    for (let i = 0; i < 4; i += 1) {
      parts.push(`<rect x="${round(w * 0.16)}" y="${round(h * (0.14 + i * 0.14))}" width="${round(w * 0.68)}" height="${round(h * 0.08)}" ${fill(0.18 + i * 0.14)}/>`);
    }
  } else {
    parts.push(`<path d="M0,${round(h * 0.68)} A${round(w * 0.5)},${round(h * 0.46)} 0 0 1 ${w},${round(h * 0.68)} Z" ${fill(0.36)}/>`);
    parts.push(`<path d="M${round(w * 0.22)},${round(h * 0.68)} A${round(w * 0.28)},${round(h * 0.28)} 0 0 1 ${round(w * 0.78)},${round(h * 0.68)} Z" ${fill(0.68)}/>`);
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${parts.join('')}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** the eight stand-ins, in the assorted shapes photographs arrive in */
const PLATE: Array<{ composition: Composition; w: number; h: number; alt: string; caption: string }> = [
  { composition: 'bars', w: 1600, h: 1200, alt: 'Three upright bars on a pale ground', caption: 'Landscape, 4:3' },
  { composition: 'orb', w: 1400, h: 1400, alt: 'A filled circle above a thin rule', caption: 'Square, 1:1' },
  { composition: 'wedge', w: 1200, h: 1600, alt: 'Two overlapping triangles and a small disc', caption: 'Portrait, 3:4' },
  { composition: 'stack', w: 1920, h: 1080, alt: 'Four stacked rules, each one darker', caption: 'Wide, 16:9' },
  { composition: 'arc', w: 1800, h: 1200, alt: 'Two nested arches on a pale ground', caption: 'Landscape, 3:2' },
  { composition: 'orb', w: 1200, h: 1800, alt: 'A filled circle set high in a tall frame', caption: 'Tall, 2:3' },
  { composition: 'bars', w: 1500, h: 1500, alt: 'Three bars of uneven height, squared off', caption: 'Square, 1:1' },
  { composition: 'wedge', w: 1800, h: 1200, alt: 'A wide pair of triangles under a small disc', caption: 'Landscape, 3:2' },
];

/** A `parent` lightbox is exactly as tall as the gallery's own box, and a box holding six small
 *  frames is short — so the three tiles that show the viewer in place give their box a floor,
 *  through the component's own overrides. It is also what the prop's own note asks a caller to do. */
const FLOOR = { Root: { style: { minHeight: '300px' } } };

export default function GallerySection() {
  const [, theme] = useStyletron();

  const photos: GalleryPhoto[] = React.useMemo(
    () =>
      PLATE.map((plate) => ({
        src: drawPhoto(
          plate.composition,
          plate.w,
          plate.h,
          theme.colors.contentPrimary,
          theme.colors.backgroundSecondary,
          theme.colors.backgroundTertiary
        ),
        alt: plate.alt,
        caption: plate.caption,
      })),
    [theme.colors.contentPrimary, theme.colors.backgroundSecondary, theme.colors.backgroundTertiary]
  );

  const six = React.useMemo(() => photos.slice(0, 6), [photos]);
  const one = React.useMemo(() => photos.slice(1, 2), [photos]);

  /* Both lightbox tiles are LIVE and merely START in the state they demonstrate: close one and the
   * grid is underneath, press a frame and it opens again. A pinned state would have been a dead
   * control, and a dead control in a reference page teaches the wrong thing about the component. */
  const [openAt, setOpenAt] = React.useState<number | null>(2);
  const [zoomAt, setZoomAt] = React.useState<number | null>(0);
  const [zoom, setZoom] = React.useState(2.5);

  const full = { width: '100%' } as const;

  return (
    <Section
      t="Gallery"
      n="photographs: a grid of frames that hold their space, opening a full-bleed viewer — swipe or arrow to page, pinch or double-tap to magnify, drag down to leave"
    >
      <Grid>
        <Tile
          span={6}
          name="Grid"
          rule="Every frame reserves its picture's space before the picture arrives, so a gallery loads without shuffling the rows under the reader's eye. Press one: this tile opens the real viewer, over the whole page."
        >
          <div style={full}>
            <Gallery photos={photos} columns={4} aria-label="Photos" />
          </div>
        </Tile>

        <Tile
          span={6}
          name="Lightbox"
          rule="The picture is presented raw — no radius, no stroke, no shadow — on the warm ink the app composites. Chrome sits around it and never on it: close at the top-left, arrows in the side bands, caption and dots below."
        >
          <div style={full}>
            <Gallery
              photos={six}
              columns={3}
              container="parent"
              activeIndex={openAt}
              onActiveIndexChange={({ activeIndex }) => setOpenAt(activeIndex)}
              overrides={FLOOR}
              aria-label="Photos"
            />
          </div>
        </Tile>

        <Tile
          span={6}
          name="Zoomed"
          rule="Pinch, or double-tap, and the picture magnifies to 2.5× — the app's own figure, with the same ceiling of 5×. Past life size a drag holds the picture instead of paging, and it may only be held as far as it actually overflows."
        >
          <div style={full}>
            <Gallery
              photos={six}
              columns={3}
              container="parent"
              activeIndex={zoomAt}
              onActiveIndexChange={({ activeIndex }) => setZoomAt(activeIndex)}
              zoom={zoom}
              onZoomChange={(next) => setZoom(next.zoom)}
              overrides={FLOOR}
              aria-label="Photos"
            />
          </div>
        </Tile>

        <Tile
          span={6}
          name="One photo"
          rule="One photo has no pages, so it is given no page control and no arrows. Everything else stands: the ground still dismisses, Escape still leaves, and the picture still magnifies."
        >
          <div style={full}>
            <Gallery
              photos={one}
              columns={3}
              container="parent"
              initialActiveIndex={0}
              overrides={FLOOR}
              aria-label="Photo"
            />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Loading"
          rule="The grid the photos will land in, standing before they do — same count, same shape, same radius, with Base's own Skeleton shimmering inside each frame."
        >
          <div style={full}>
            <Gallery photos={[]} loading placeholderCount={8} columns={4} aria-label="Photos" />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Disabled"
          rule="The gallery stands and reads, and opens nothing. The frames keep their pictures, so the reader still knows what is there."
        >
          <div style={full}>
            <Gallery photos={photos} columns={4} disabled aria-label="Photos" />
          </div>
        </Tile>

        <Tile
          span={4}
          name="Frame shape"
          rule="One aspect ratio makes the grid a rhythm; the lightbox is where each photo is shown whole. Four across at 1:1, three across at 4:3."
        >
          <div style={{ ...full, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Gallery photos={photos.slice(0, 4)} columns={4} aspectRatio={1} aria-label="Photos" />
            <Gallery photos={six.slice(0, 3)} columns={3} aspectRatio={4 / 3} aria-label="Photos" />
          </div>
        </Tile>
      </Grid>
    </Section>
  );
}
