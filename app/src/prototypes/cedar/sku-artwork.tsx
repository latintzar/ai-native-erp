import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE } from 'baseui/button';
import { WorkflowDialog } from './workflow-dialog';
import { exactPaintingFor } from './painting-map';
import { useHistoryLayer } from './anchors';
import { skuRecord, useSKURecords } from './sku-record';
import { Glyph, STEP } from './glyphs';
import { usePhone } from './shell/viewport';

/** Design store only: generation requests are captured, never represented as provider jobs. */
type Artwork = {
  status: 'requested' | 'review' | 'approved';
  description: string;
  image?: string;
  approvedImage?: string;
  at: string;
};
const key = 'rocoto-sku-artwork-v1';
function read(): Record<string, Artwork> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}
let book = read();
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
function put(id: string, value: Artwork) {
  const next = { ...book, [id]: value };
  localStorage.setItem(key, JSON.stringify(next));
  book = next;
  listeners.forEach((fn) => fn());
}

export function requestSKUArtwork(sector: string, sku: string, description: string) {
  const id = `${sector}:${sku}`;
  const current = book[id];
  put(id, {
    status: 'requested',
    description,
    at: new Date().toISOString(),
    approvedImage: current?.status === 'approved' ? current.image : current?.approvedImage,
  });
}

/** Creation retries do not replace an existing request or a reviewed asset. */
export function ensureSKUArtworkRequest(sector: string, sku: string, description: string) {
  if (!book[`${sector}:${sku}`]) requestSKUArtwork(sector, sku, description);
}

export function useApprovedSKUArtwork(sector?: string, sku?: string): string | undefined {
  const state = React.useSyncExternalStore(
    subscribe,
    () => book,
    () => book,
  );
  const value = sector && sku ? state[`${sector}:${sku}`] : undefined;
  return value?.status === 'approved' ? value.image : value?.approvedImage;
}

export function SKUArtwork({
  product,
  sector,
  size,
  readOnly = false,
}: {
  product: { id: string; name: string };
  sector: string;
  size: number;
  readOnly?: boolean;
}) {
  const [, theme] = useStyletron();
  const phone = usePhone();
  const state = React.useSyncExternalStore(subscribe, () => book, () => book);
  const id = `${sector}:${product.id}`;
  const current = state[id];
  const identities = useSKURecords();
  const library = exactPaintingFor(skuRecord(sector, product.id, identities)?.original.name ?? product.name);
  const approvedImage = current?.status === 'approved' ? current.image : current?.approvedImage;
  const image = approvedImage ?? library;
  const [open, setOpen] = React.useState(false);
  const [over, setOver] = React.useState(false);
  const [focusWithin, setFocusWithin] = React.useState(false);
  const [error, setError] = React.useState('');
  const uploadInput = React.useRef<HTMLInputElement>(null);
  useHistoryLayer({ id: `sku-art:${id}`, active: open, onRestore: (snapshot) => setOpen(snapshot !== null) });
  React.useEffect(() => { setOpen(false); setError(''); }, [id]);
  const upload = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1500000) {
      setError('Choose a PNG, JPEG or WebP under 1.5 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        put(id, { status: 'approved', description: product.name, image: String(reader.result), at: new Date().toISOString() });
        setError('');
      } catch {
        setError('Saving the photo stalled in this browser. Try a smaller image.');
      }
    };
    reader.onerror = () => setError('Reading this file stalled. Choose another image.');
    reader.readAsDataURL(file);
  };
  const removePhoto = () => {
    put(id, { status: 'requested', description: product.name, at: new Date().toISOString() });
    setError('');
  };
  const editVisible = !readOnly && (phone || over || focusWithin || !image);
  return (
    <>
      <span
        data-testid="sku-artwork"
        data-sku={product.id}
        data-art-status={approvedImage ? 'photo' : library ? 'library' : 'missing'}
        onMouseEnter={() => setOver(true)}
        onMouseLeave={() => setOver(false)}
        onFocus={() => setFocusWithin(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusWithin(false); }}
        style={{
          position: 'relative', display: 'grid', placeItems: 'center', width: size, height: size,
          boxSizing: 'border-box', padding: image ? theme.sizing.scale100 : theme.sizing.scale200,
          background: theme.colors.backgroundSecondary, border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300, overflow: 'visible',
        }}
      >
        {image ? <img src={image} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: theme.borders.radius200 }} /> : <span aria-hidden="true" style={{ ...theme.typography.HeadingMedium, color: theme.colors.contentSecondary }}>＋</span>}
        {!readOnly && <Button
          kind={KIND.secondary}
          size={SIZE.mini}
          data-testid="sku-artwork-edit"
          aria-label={`Edit product image for ${product.name}`}
          onClick={() => setOpen(true)}
          overrides={{ BaseButton: { style: {
            position: 'absolute', right: '-8px', bottom: '-8px', width: '44px', height: '44px', minWidth: '44px', minHeight: '44px', padding: 0,
            borderRadius: '50%', backgroundColor: theme.colors.backgroundPrimary, border: `1px solid ${theme.colors.borderOpaque}`,
            boxShadow: theme.lighting.shadow600, color: theme.colors.contentPrimary, opacity: editVisible ? 1 : 0,
            pointerEvents: editVisible ? 'auto' : 'none', transitionProperty: 'opacity', transitionDuration: theme.animation.timing400,
            '@media (hover: none), (pointer: coarse)': { opacity: 1, pointerEvents: 'auto' },
            ':focus-visible': { opacity: 1, outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' },
          } } }}
        ><Glyph id="edit" size={STEP.small} /></Button>}
      </span>
      <WorkflowDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Product image"
        ariaLabel={`Product image for ${product.name}`}
        step={product.name}
        testId="sku-artwork-editor"
        actions={<Button kind={KIND.tertiary} size={SIZE.compact} onClick={() => setOpen(false)}>Done</Button>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
          <div style={{ display: 'grid', placeItems: 'center', minHeight: 220, padding: theme.sizing.scale500, background: theme.colors.backgroundSecondary, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300 }}>
            {image ? <img src={image} alt={product.name} style={{ width: '100%', maxHeight: 260, objectFit: 'contain' }} /> : <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>Product photo shows here.</span>}
          </div>
          <input ref={uploadInput} type="file" accept="image/png,image/jpeg,image/webp" aria-label="Upload product image" tabIndex={-1} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) upload(file); event.currentTarget.value = ''; }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, flexWrap: 'wrap' }}>
            <Button kind={KIND.secondary} size={SIZE.compact} data-testid="sku-artwork-upload" onClick={() => uploadInput.current?.click()}>{approvedImage ? 'Replace photo' : 'Upload photo'}</Button>
            {approvedImage && <Button kind={KIND.tertiary} size={SIZE.compact} data-testid="sku-artwork-remove" onClick={removePhoto}>Remove photo</Button>}
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>PNG, JPEG or WebP · up to 1.5 MB</span>
          </div>
          {error && <span role="alert">{error}</span>}
        </div>
      </WorkflowDialog>
    </>
  );
}
