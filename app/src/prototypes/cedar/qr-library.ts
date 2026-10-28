/* THE LIBRARY ROAD — the decoder the bundle carries, for the browsers with no BarcodeDetector.
 * THE-QR-SPEC QR-09 (E200.09). FEED-IA §198: «i expect this to be fully working when we wire
 * everything… you can even test it by exporting and downresolutioning and even muddling or adding
 * fake dirt to the image and then running it through scanning all programmatically».
 *
 * WHOSE PROBLEM THIS IS. `BarcodeDetector` ships in Chrome on Android and macOS. iOS Safari has
 * none of it — and iOS Safari is every iPhone, including every third-party browser on one — so
 * before this file the phone in a cold room with an iPhone in it read the packing mark by TYPING
 * the nine characters under it. That road stands and always will (QR-05.3). This is the road
 * beside it.
 *
 * ═══ WHICH DECODER, AND WHY — measured, not chosen ═════════════════════════════════════════════
 *
 * The two candidates were `zxing-wasm` (the zxing-cpp C++ core compiled to WebAssembly — the same
 * engine Android's ML Kit and most scanner apps carry) and `jsQR` (Apache-2.0, pure JavaScript, no
 * dependencies). They were run over the SAME 128 frames: the kit's own mark, at the kit's own
 * `PACKING_QR` parameters, drawn with the app's own encoder, placed on an A4 sheet at its true
 * 20.11 mm of 210 mm, photographed at 1600 px and at 800 px wide — which gives the symbol 153 px
 * and 77 px, the two ends of the range QR-08 already quotes — and then damaged with `degrade.py`:
 * 25° tilt, σ1 blur, JPEG 30, 2 % sensor noise, harsh uneven light, a strong perspective skew and
 * the 05:40 combination.
 *
 *   zxing-cpp 3.1.1 · the core zxing-wasm carries    92 / 128     52/64 at 1600 · 40/64 at 800
 *   jsQR 1.4.0 · one pass                            88 / 128     57/64 at 1600 · 31/64 at 800
 *   jsQR 1.4.0 · with the SCALE LADDER below         99 / 128     59/64 at 1600 · 40/64 at 800
 *
 * So the answer is jsQR **with the ladder**, and the ladder is why: one pass loses to zxing, and
 * the pass at 2× wins it back and then some. The case it turns is exact — an 800 px photo tilted
 * 25° went 0/8 to 8/8 — and the reason is arithmetic. jsQR binarises in 8 × 8 blocks; at 800 px the
 * mark is 2.08 px per module, so one block spans four modules and a rotation's resampling smears
 * them into each other. Resampling UP first gives the binariser room per module that the photo
 * never had.
 *
 * The rest of the answer is what a decoder costs to carry. zxing-wasm is a WebAssembly binary that
 * arrives either from a CDN — and the kit fetches nothing from a network it does not serve, so a
 * cold room's signal would decide whether the mark reads — or as a megabyte committed to a repo
 * whose whole bundle is smaller. jsQR is 253 KB of readable JavaScript that minifies to a 130 KB
 * chunk this file fetches ONCE, from the kit's own origin, and only where the browser brought no
 * detector of its own. It decodes more of the same frames for a fifth of the weight.
 *
 * ═══ THE TWO ROADS UNDER ONE DECODER ═══════════════════════════════════════════════════════════
 *
 * A CAMERA FRAME gets ONE pass at the frame's own size. Frames arrive three times a second and a
 * miss costs nothing: the ladder there is TIME, and a person moving the phone half a centimetre
 * does more than a resample would. A second pass inside a 320 ms interval would only make the
 * loop late.
 *
 * A PHOTO gets the ladder, because there is one of it and a person is waiting.
 *
 * ═══ AND THE CEILING THE LADDER RUNS INTO ══════════════════════════════════════════════════════
 *
 * iOS Safari caps a canvas at 4096 px on a side and 16,777,216 px of area, and a canvas over the
 * cap comes back BLANK rather than raising — which on the one platform this road exists for would
 * turn every read into a silent miss. So every rung is clamped to that ceiling before it is drawn,
 * and the base frame is capped at 1600 px on its long edge, which is both the density the numbers
 * above are quoted at and what actually keeps every rung inside iOS Safari's canvas ceiling.
 */
import type { QrLibrary } from './qr-read';

/** The rungs, in the order they are tried. 1 first because most photos read on the first pass. */
export const QR_SCALE_LADDER = [1, 2, 0.5] as const;
/** iOS Safari's canvas ceiling. Over either of these the canvas paints nothing and says nothing.
 *  ⚠ DEFENCE IN DEPTH, NOT THE BOUND THAT BINDS. `QR_PHOTO_BASE_EDGE` runs first, so the long edge
 *  entering the ladder is at most 1600 px and the 2× rung tops out at 3200 px / 10.24 Mpx —
 *  `clampedScale` never fires on any input today. It stays because the day the base edge is raised
 *  a blank canvas on iOS is a silent miss, and this costs nothing to keep. */
export const QR_CANVAS_MAX_EDGE = 4096;
export const QR_CANVAS_MAX_AREA = 16_777_216;
/** The long edge a still photo is brought to before the ladder runs. 1600 px of an A4 sheet gives
 *  the mark 153 px, which is between QR-08's A5-at-300 and A4-at-300 readings. */
export const QR_PHOTO_BASE_EDGE = 1600;

/** The scale a rung may actually use on this frame, after the ceiling has had its say. */
export const clampedScale = (width: number, height: number, wanted: number): number => {
  const byEdge = QR_CANVAS_MAX_EDGE / Math.max(width, height);
  const byArea = Math.sqrt(QR_CANVAS_MAX_AREA / Math.max(1, width * height));
  return Math.min(wanted, byEdge, byArea);
};

/* ── LOADING IT, ONCE ───────────────────────────────────────────────────────────────────────
 * `import()` is what makes this a separate chunk: the 130 KB stays out of the app's first paint
 * and is fetched the first time somebody with no detector opens the reader. The promise is kept,
 * so a second press waits on the same fetch rather than starting another. A chunk that fails to
 * arrive resolves to nothing, and the reader falls to the road below it. */
let pending: Promise<QrLibrary | undefined> | undefined;

/** Whether the bundle HAS a decoder to load. Synchronous, because the road ladder is a fact the
 *  surface states on first paint (`data-road`) and cannot wait for a fetch to say. */
export const qrLibraryOffered = (): boolean => true;

export const loadQrLibrary = (): Promise<QrLibrary | undefined> => {
  pending ??= import('./vendor/jsqr')
    .then((module) => {
      const decode = module.default;
      if (typeof decode !== 'function') return undefined;
      const library: QrLibrary = {
        decode: (data: ImageData) => decode(data.data, data.width, data.height,
          { inversionAttempts: 'dontInvert' })?.data,
      };
      return library;
    })
    .catch(() => undefined);
  return pending;
};

/* ── THE PHOTO ROAD ─────────────────────────────────────────────────────────────────────────
 * One still, several rungs. The frame is drawn once per rung because a canvas can only hold one
 * size at a time; `willReadFrequently` tells the browser this canvas exists to be read back,
 * which is what keeps it off a GPU texture it would then have to copy down from. */
export type PhotoDecoder = (data: ImageData) => string | undefined;

export const decodePhoto = async (
  source: CanvasImageSource & { width: number; height: number },
  decode: PhotoDecoder,
): Promise<string | undefined> => {
  const natural = Math.max(source.width, source.height);
  /* A big photo comes DOWN to the base edge first and never goes up past its own pixels: 1600 px
     of an A4 sheet is the density the ladder's numbers were measured at, and it is what keeps the
     2× rung inside the ceiling on a phone-shaped still. */
  const base = Math.min(1, QR_PHOTO_BASE_EDGE / Math.max(1, natural));
  /* ONE canvas for the whole ladder. Setting `width` resizes and clears it, so each rung gets a
     clean surface; three separate canvases would leave three ten-megapixel buffers for the
     collector on the phone that can least afford them. */
  const sheet = document.createElement('canvas');
  const ink = sheet.getContext('2d', { willReadFrequently: true });
  if (!ink) return undefined;
  for (const rung of QR_SCALE_LADDER) {
    const scale = clampedScale(source.width, source.height, rung * base);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    sheet.width = width;
    sheet.height = height;
    ink.drawImage(source, 0, 0, width, height);
    const said = decode(ink.getImageData(0, 0, width, height));
    if (said) return said;
    /* Hand the frame back between rungs: a 2× pass on a phone is tens of milliseconds of main
     * thread, and three of them in a row is a stutter a person feels as the page freezing. */
    await new Promise((settle) => { setTimeout(settle, 0); });
  }
  return undefined;
};

/** A file from the camera roll or the file picker, as something a canvas can draw.
 *  `createImageBitmap` is the one that decodes off the main thread; Safari before 17 has it for
 *  Blobs, and the `<img>` road below it covers everything older. */
export const imageFromFile = async (file: Blob): Promise<(CanvasImageSource & { width: number; height: number }) | undefined> => {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fall through to the element road */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((settle, fail) => {
      const element = new Image();
      element.onload = () => settle(Object.assign(element, { width: element.naturalWidth, height: element.naturalHeight }));
      element.onerror = () => fail(new Error('image'));
      element.src = url;
    });
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
};
