/* READING THE PACKING MARK BACK (FEED-IA §196.5 — E193.05 · E200.09)
 *
 * Peter, 2026-09-04: «the qr code generation and reading is a spec in its own, but i expect us to
 * handle it all alongside everything else.» THE-QR-SPEC.md is that spec. This file is its READING
 * half; `packing-output.ts` holds the generation half and the locator's own grammar.
 *
 * WHY A PERSON SCANS. §191.1: «A later paper photo may use that locator to align reviewed final
 * weights/prices.» The bay prints a packing list, the goods get weighed, somebody photographs the
 * marked-up paper — and the mark says WHICH document and WHICH revision that paper is, so the
 * weights land on the right lines instead of on a guess.
 *
 * THE ROAD LADDER, stated on the surface as `data-road`, because a camera is not a given:
 *   native  · the browser's own `BarcodeDetector` (Chrome on Android and macOS). This is the road
 *             the phone in the cold room actually takes, and it is the fast one.
 *   library · the decoder the bundle carries — `qr-library.ts`, jsQR behind a lazy chunk, fetched
 *             the first time a browser with no detector opens the reader. E200.09 filled this
 *             slot; it is what makes iOS Safari read a mark rather than type one.
 *   typed   · the person reads the short code printed under the mark and types it. ALWAYS
 *             available, on every browser, with no camera at all — which is why the mark is
 *             printed with its token beside it.
 *
 * AND TWO WAYS IN ON EITHER READING ROAD: the live camera, and a photo already taken. The photo
 * matters most exactly where the camera is hardest — a phone that was told to keep its camera to
 * itself still has a camera roll, and the sheet was photographed on the way out of the bay.
 *
 * Nothing here invents a document: a code that names no packing run of this house says so.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { Input } from 'baseui/input';
import { Glyph, STEP } from './glyphs';
import { PACKING_QR, parsePackingLocator, packingLocatorToken } from './packing-output';
import { decodePhoto, imageFromFile, loadQrLibrary, qrLibraryOffered } from './qr-library';

/** The browser's own detector, where it exists. Typed narrowly here because it is not in lib.dom. */
type DetectedCode = { rawValue: string };
type Detector = { detect: (source: CanvasImageSource) => Promise<DetectedCode[]> };
type DetectorClass = new (options?: { formats?: string[] }) => Detector;
/** The bundle's decoder slot. `qr-library.ts` fills it; a caller may replace it (a drive pins it). */
export type QrLibrary = { decode: (data: ImageData) => string | undefined };
let library: QrLibrary | undefined;
export const provideQrLibrary = (next: QrLibrary | undefined): void => { library = next; };

const detectorClass = (): DetectorClass | undefined =>
  (globalThis as { BarcodeDetector?: DetectorClass }).BarcodeDetector;

export type ReaderRoad = 'native' | 'library' | 'typed';
export const readerRoad = (): ReaderRoad =>
  detectorClass() ? 'native' : library || qrLibraryOffered() ? 'library' : 'typed';

/** ONE SENTENCE PER STATE, and every one of them says what IS. */
export const QR_COPY = {
  door: 'Scan the packing code',
  watching: 'Point the camera at the code on the packing list.',
  opening: 'Opening the camera…',
  /* The two roads where the camera is out of reach say what the person CAN do, in the same breath. */
  typed: 'Type the code printed under the mark on the packing list.',
  denied: 'Camera access sits with the browser. Use a photo of the sheet, or type the code printed under the mark.',
  unknown: 'That code is still unmatched in this house. Check the code under the mark.',
  hint: 'The code is the short word under the mark, like «k3f9a1b2c».',
  use: 'Use this code',
  photo: 'Use a photo',
  reading: 'Reading the photo…',
  unread: 'That photo came back unread. Type the code under the mark instead.',
  close: 'Close',
} as const;

/** THE DOOR AND THE PANEL, in one object a surface can seat anywhere. `onRead` receives a
 *  normalised locator; a string that is not one never reaches it. */
export function QrScanner({
  onRead,
  onClose,
  testid = 'qr-read',
  unknown,
}: {
  onRead: (locator: string) => void;
  onClose?: () => void;
  testid?: string;
  /** the caller's word when the locator resolved to nothing of theirs */
  unknown?: string;
}) {
  const [, theme] = useStyletron();
  /* The road is STATE, not a memo, because the library road can only be claimed while the chunk
     is reachable: a fetch that fails hands the person the typed road, and `data-road` says so. */
  const [road, setRoad] = React.useState<ReaderRoad>(readerRoad);
  const [state, setState] = React.useState<'opening' | 'watching' | 'typed' | 'denied' | 'reading' | 'unread'>(
    readerRoad() === 'typed' ? 'typed' : 'opening');
  const [said, setSaid] = React.useState('');
  const [invalid, setInvalid] = React.useState(false);
  const video = React.useRef<HTMLVideoElement | null>(null);
  const canvas = React.useRef<HTMLCanvasElement | null>(null);
  /** IS A STREAM STANDING RIGHT NOW. The camera's own effect owns this; every reader of it is
   *  asking «is there a live picture behind this panel», which no value derived from `state` can
   *  answer once a photo has moved the state somewhere else. */
  const watching = React.useRef(false);
  const photo = React.useRef<HTMLInputElement | null>(null);
  /* One landing for every road, so the camera, the photo and the typed field arrive at the same
     place — and a locator that has already landed cannot land twice while the panel closes. */
  const landed = React.useRef(false);
  const land = React.useCallback((raw: string | undefined) => {
    const locator = parsePackingLocator(raw ?? '');
    if (!locator || landed.current) return false;
    landed.current = true;
    onRead(locator);
    return true;
  }, [onRead]);

  /* ── THE BUNDLE'S DECODER, FETCHED ONCE ─────────────────────────────────────────────────────
   * Only on the library road, and only when the panel is open: a browser that brought its own
   * detector never pays for this chunk, and neither does the app's first paint. */
  React.useEffect(() => {
    if (road !== 'library' || library) return () => {};
    let live = true;
    void loadQrLibrary().then((loaded) => {
      if (!live) return;
      if (loaded) { provideQrLibrary(loaded); return; }
      setRoad('typed');
      setState('typed');
    });
    return () => { live = false; };
  }, [road]);

  /* ── THE CAMERA, AND THE WATCH ON IT ────────────────────────────────────────────────────────
   * One stream, one interval, both released on the way out. The loop asks the detector (or the
   * bundle's decoder) about the current frame; the first thing that parses as one of OUR locators
   * ends the watch. A frame is looked at and dropped — nothing is kept, nothing is uploaded.
   *
   * ONE PASS PER FRAME on the library road, deliberately: frames arrive three times a second, so
   * the ladder here is TIME. The rungs in `qr-library.ts` belong to a still photo, where there is
   * one frame and a person waiting on it. */
  React.useEffect(() => {
    if (road === 'typed') return () => {};
    let live = true;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const detector = (() => { const D = detectorClass(); return D ? new D({ formats: ['qr_code'] }) : undefined; })();
    const frame = (): string | undefined => {
      const node = video.current;
      const sheet = canvas.current;
      if (!node || !sheet || !node.videoWidth) return undefined;
      sheet.width = node.videoWidth;
      sheet.height = node.videoHeight;
      const ink = sheet.getContext('2d', { willReadFrequently: true });
      if (!ink) return undefined;
      ink.drawImage(node, 0, 0, sheet.width, sheet.height);
      return library?.decode(ink.getImageData(0, 0, sheet.width, sheet.height));
    };
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } }).then(
      (opened) => {
        if (!live) { opened.getTracks().forEach((track) => track.stop()); return; }
        stream = opened;
        watching.current = true;
        if (video.current) { video.current.srcObject = opened; void video.current.play().catch(() => {}); }
        setState((standing) => (standing === 'opening' ? 'watching' : standing));
        timer = setInterval(() => {
          if (detector) {
            const node = video.current;
            if (!node || !node.videoWidth) return;
            void detector.detect(node).then((codes) => { if (live) land(codes[0]?.rawValue); }).catch(() => {});
            return;
          }
          if (live) land(frame());
        }, 320);
      },
      () => { if (live) setState((standing) => (standing === 'opening' ? 'denied' : standing)); },
    );
    return () => {
      live = false;
      watching.current = false;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [road, land]);

  /* ── THE PHOTO ROAD ─────────────────────────────────────────────────────────────────────────
   * A still the person already has. The native detector reads a bitmap directly; the bundle's
   * decoder gets the scale ladder `qr-library.ts` measured, because a still is one chance.
   * The chunk is AWAITED here rather than read off the module: pressing the door in the first
   * moments of the panel would otherwise meet a decoder still in flight and call the photo
   * unread — the one bug in this road that would look like the decoder being bad at its job. */
  const readPhoto = async (file: File) => {
    setState('reading');
    const image = await imageFromFile(file);
    if (!image) { setState('unread'); return; }
    try {
      const D = detectorClass();
      const decoder = D ? undefined : library ?? await loadQrLibrary();
      const seen = D
        ? (await new D({ formats: ['qr_code'] }).detect(image).catch(() => []))[0]?.rawValue
        : decoder && await decodePhoto(image, (data) => decoder.decode(data));
      /* ⚠ AN UNREAD PHOTO MAY NOT END LIVE SCANNING. The preview is derived from the open
         STREAM below rather than from `state`, so `<video>` survives this pass — and the state
         goes back to where the stream left it, so the loop the person is still standing in keeps
         its own sentence instead of «That photo came back unread» over a dead viewfinder. */
      if (!land(seen)) setState(watching.current ? 'watching' : 'unread');
    } catch {
      setState(watching.current ? 'watching' : 'unread');
    } finally {
      if ('close' in image && typeof image.close === 'function') image.close();
    }
  };

  const submit = () => {
    const locator = parsePackingLocator(said);
    if (!locator) { setInvalid(true); return; }
    setInvalid(false);
    land(locator);
  };

  /* THE PREVIEW BELONGS TO THE STREAM, NOT TO THE SENTENCE. Deriving it from `state` unmounted
     the `<video>` and its `<canvas>` the moment a photo was read, `video.current` went null, and
     `frame()` answered `undefined` forever after — the camera light on, the loop running, and
     nothing on the glass. */
  const camera = watching.current || state === 'opening' || state === 'watching';
  const sentence = state === 'opening' ? QR_COPY.opening
    : state === 'watching' ? QR_COPY.watching
      : state === 'denied' ? QR_COPY.denied
        : state === 'reading' ? QR_COPY.reading
          : state === 'unread' ? QR_COPY.unread
            : QR_COPY.typed;
  return (
    <section
      data-testid={testid}
      data-road={road}
      data-state={state}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: theme.sizing.scale400,
        padding: theme.sizing.scale500,
        border: '1px solid ' + theme.colors.borderOpaque,
        borderRadius: theme.borders.radius400,
        background: theme.colors.backgroundPrimary,
        minWidth: 0,
      }}
    >
      <header style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
        <Glyph id="camera" size={STEP.small} />
        <span style={{ ...theme.typography.LabelMedium, flex: 1, minWidth: 0 }}>{QR_COPY.door}</span>
        {onClose && (
          <Button kind={KIND.tertiary} size={SIZE.mini} data-testid={testid + '-close'} onClick={onClose}
            overrides={{ BaseButton: { style: { minHeight: '44px', minWidth: '44px' } } }}>
            {QR_COPY.close}
          </Button>
        )}
      </header>

      {camera && (
        <div style={{ position: 'relative', borderRadius: theme.borders.radius300, overflow: 'hidden', background: theme.colors.backgroundSecondary }}>
          <video
            ref={video}
            data-testid={testid + '-video'}
            muted
            playsInline
            style={{ display: 'block', width: '100%', maxHeight: 260, objectFit: 'cover' }}
          />
          <canvas ref={canvas} aria-hidden style={{ display: 'none' }} />
        </div>
      )}

      <span data-testid={testid + '-state'} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
        {unknown || sentence}
      </span>

      {/* A PHOTO IS A READING ROAD, so it stands with the camera rather than under the typing.
          It shows wherever something in the browser can decode — the detector or the bundle's own
          library — and it is the road a refused camera leaves standing beside the typed one. */}
      {road !== 'typed' && (
        <>
          <input
            ref={photo}
            type="file"
            accept="image/*"
            data-testid={testid + '-photo-input'}
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              if (file) void readPhoto(file);
            }}
          />
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            data-testid={testid + '-photo'}
            disabled={state === 'reading'}
            onClick={() => photo.current?.click()}
            overrides={{ BaseButton: { style: { minHeight: '44px', width: '100%' } } }}
          >
            {QR_COPY.photo}
          </Button>
        </>
      )}

      {/* THE TYPED ROAD STANDS ON EVERY BROWSER, beside the camera rather than behind a failure.
          §196.5's fallback is a road, not an apology. */}
      <label style={{ ...theme.typography.LabelSmall, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, minWidth: 0 }}>
        {QR_COPY.hint}
        <span style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', minWidth: 0 }}>
          <Input
            value={said}
            onChange={(event) => { setSaid(event.currentTarget.value); setInvalid(false); }}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
            placeholder={packingLocatorToken(PACKING_QR.scheme + 'k3f9a1b2c')}
            error={invalid}
            aria-label="Packing code"
            overrides={{
              Root: { style: { minHeight: '44px', minWidth: 0, flex: 1 } },
              Input: { props: { 'data-testid': testid + '-typed-field', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false }, style: { minHeight: '44px' } },
            }}
          />
          <Button kind={KIND.secondary} size={SIZE.compact} data-testid={testid + '-use'} disabled={!said.trim()} onClick={submit}
            overrides={{ BaseButton: { style: { minHeight: '44px' } } }}>
            {QR_COPY.use}
          </Button>
        </span>
      </label>
    </section>
  );
}
