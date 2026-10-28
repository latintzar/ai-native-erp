/* The panel's marks. Linework, never filled shapes, and every stroke `currentColor` — so a glyph
 * takes the colour of whatever it sits in and there is no paint to re-theme.
 *
 * Base ships an icon set (`baseui/icon`) and it is used wherever it has the mark: the chevron on
 * the row is Base's. These four are the ones Base does not have.
 */
import * as React from 'react';

type GlyphProps = { size?: number; title?: string };

const frame = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
  focusable: 'false' as const,
});

/** The camera. It sits under the entry on the add tab, and only there. */
export const CameraGlyph = ({ size = 18 }: GlyphProps) => (
  <svg {...frame(size)}>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.1-2h8.4l1.1 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

/** A document — a photographed one on the chip, a filed one on the row. */
export const DocumentGlyph = ({ size = 18 }: GlyphProps) => (
  <svg {...frame(size)}>
    <path d="M6 3h7.5L19 8.5V21H6z" />
    <path d="M13.5 3v5.5H19" />
    <path d="M9 13h7M9 16.5h4.5" />
  </svg>
);

/** A hand. The working reality is what a person says, so the person's own mark stands on it. */
export const HandGlyph = ({ size = 18 }: GlyphProps) => (
  <svg {...frame(size)}>
    <path d="M9 11V5.6a1.6 1.6 0 0 1 3.2 0V11" />
    <path d="M12.2 11V4.6a1.6 1.6 0 0 1 3.2 0V11" />
    <path d="M15.4 11.5V7.4a1.6 1.6 0 0 1 3.2 0v7.1A6.5 6.5 0 0 1 12.1 21h-.6a5 5 0 0 1-3.9-1.9L4.8 15a1.6 1.6 0 0 1 2.4-2.1L9 14.6" />
  </svg>
);

/** The trash on the chip: the way to throw a picture away and take it again. */
export const TrashGlyph = ({ size = 16 }: GlyphProps) => (
  <svg {...frame(size)}>
    <path d="M4.5 7h15" />
    <path d="M9.5 7V4.8h5V7" />
    <path d="M6.5 7l.9 12.2A1.8 1.8 0 0 0 9.2 21h5.6a1.8 1.8 0 0 0 1.8-1.8L17.5 7" />
    <path d="M10.3 10.5v6.8M13.7 10.5v6.8" />
  </svg>
);

/** The feed: a document that arrives on its own. An envelope with the trail running into it. */
export const FeedGlyph = ({ size = 18 }: GlyphProps) => (
  <svg {...frame(size)}>
    <rect x="3" y="6" width="18" height="12" rx="1.6" />
    <path d="M3.6 7.2 12 13l8.4-5.8" />
  </svg>
);
