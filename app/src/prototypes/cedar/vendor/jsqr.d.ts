/* The shape of what `vendor/jsqr.js` hands back — jsqr@1.4.0's own signature, narrowed to the
 * two fields the packing mark's reading actually uses (THE-QR-SPEC QR-09 · E200.09).
 *
 * `tsconfig.app.json` compiles `src/prototypes/cedar/**\/*.ts` and leaves JavaScript alone, so this declaration
 * is what makes the vendored decoder a typed module rather than an `any`. The bundler resolves the
 * import to the `.js` beside it; the type-checker resolves it to this file. */
declare const jsQR: (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' },
) => { data: string; binaryData: number[] } | null;

export default jsQR;
