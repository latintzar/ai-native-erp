# Cedar ERP visuals

Six composed product shots use the actual Cedar frontend at `12d77d610c82a21c602a7706861f043e16607a74`. The source was rendered from the completed private review build, then whole components were moved into a chromeless capture stage. Capture CSS adjusts layout, typography and artwork seats; names, codes, quantities, unit prices, totals and painting URLs remain the original fixture values.

| Asset | What it shows | Native CSS size |
|---|---|---|
| `catalogue-desktop.png` | Merluza, Pulpo and Lubina de estero as three catalogue objects with their original paintings, codes and units | 896 × 368 |
| `catalogue-phone.png` | The same three catalogue objects | 390 × 428 |
| `order-desktop.png` | Cafè Pagès order 3110-2099, three original lines, total 359.54 euros | 896 × 648 |
| `order-phone.png` | The same whole order, with the native phone line layout | 390 × 780 |
| `import-desktop.png` | Native three-row paste readback, reviewed and ready to add | 896 × 631 |
| `import-phone.png` | The same catalogue review in the native phone layout | 390 × 785 |

Use the phone catalogue for narrow index tiles. Use the desktop masters at least 672 CSS pixels wide; switch to the phone master below 768 pixels and cap it at 390 CSS pixels. `preview.html` demonstrates that placement. Its actual 1600/390 screenshots were viewed; `presentation-checks.json` records loaded images and zero horizontal overflow.

## Scene and source

The seeded Spain/fish workspace has pricing and inventory enabled and money disabled. The three existing products are `PV-1001` Merluza, `PV-1003` Pulpo and `PV-1005` Lubina de estero. Their original paintings appear in the catalogue, the paste readback and the order. The import capture pastes those existing names/codes/units into the native parser and checks its review box. The Add action remains ready for the operator.

Suggested captions:

- Catalogue: “Three catalogue products with their original illustrations.”
- Order: “The same products on Cafè Pagès delivery note 3110-2099.”
- Import: “Three-row catalogue readback, ready to add.”

`ProductFace` resolves approved SKU artwork, then the exact painting-library binding. `sku-artwork.tsx` explicitly implements a local design store: it records artwork requests and uploaded/approved images. These captures demonstrate the existing library art and actual review interface. Provider generation is a separate integration boundary; the captures provide evidence for the visible frontend flow.

`capture.py`, `capture.css` and `capture-proof.json` preserve the seed, renderer, source/build hashes, source component text, component snapshot hashes, resource hashes and exact capture CSS. The three WebP files are unchanged copies of the source paintings. All source files and painting bytes used for these views were checked against the pinned Git objects. The original source and its seeds remain unchanged.

## Verification

Each main asset uses Chromium at DPR 2, with reduced motion selected and fonts awaited. All six have zero page errors and zero external request attempts. Browser requests were confined to the loopback review server; mutating requests received empty local fixture replies. The presentation check used a separate loopback static server. Provider/model/GPU calls: zero.

## Recapture the source
The stored PNGs and capture-proof.json record the original pinned reference build. The exact renderer bytes named by that proof are preserved as capture-original.py. Portable capture.py accepts the public derivative's upstream/export receipt and uses bundled Playwright Chromium; it writes a fresh proof and images into a new private temporary output directory by default.

Build Cedar with make build, install the optional browser with .venv/bin/python -m playwright install chromium, then serve app/dist-export-review on loopback port 18721. Run .venv/bin/python docs/assets/erp/capture.py in another terminal. ERP_CAPTURE_ORIGIN selects another loopback origin; ERP_CAPTURE_OUT explicitly selects an output directory. The script blocks external browser requests and supplies empty local replies to mutations. Inspect its new proof and images separately from the stored reference's provenance.

The component capture changes layout, typography and artwork seats; it preserves the fixture business records. It demonstrates source-derived interface composition and keeps provider generation separate.
