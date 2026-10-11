# LabelTrim

Turn Flipkart Seller Hub's combined **A4 label + invoice PDF** into clean, thermal-ready
**4 × 6 in (288 × 432 pt)** shipping labels — entirely in the browser. Customer names, full
addresses and order IDs are parsed locally; nothing is uploaded, stored or retained.

Windows 7 + Chrome 109 (the last Chrome release for Windows 7 / 8.1) is the supported floor.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/index.html` (single file, git-ignored) |
| `npm run build:standalone` | Build + package the committed artifact `standalone/labeltrim.html` |
| `npm run preview` | Serve the built bundle (port 4173) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | typecheck → standalone build → all three test suites |

`standalone/labeltrim.html` is the shippable single file: double-click it, no server required.

## Layout

```
Left sidebar          Top bar (breadcrumb + "Private by design")
  LabelTrim logo      ─────────────────────────────────────────────
  Label cropper  ●    Page heading  "Goodbye A4. Hello, 4 × 6."
  Print guide         3-step indicator: Upload PDF → Review crop → Download labels
  Privacy card        Upload screen → Review & export screen
```

- **Upload screen** — drag-and-drop card, green **Choose PDF** button, **Try a sample PDF**
  (the generated 3-order demo batch), an A4 → 4 × 6 illustration, and three benefits.
- **Review & export** — PDF preview with page navigation, crop overlay, per-page warning
  indicators and the geometry readout on the left; batch summary, **Convert to 4 × 6 PDF**,
  per-page status grid, *Advanced crop adjustments* (collapsible) and the *Print guide*
  (collapsible) on the right; processing progress, errors and a download-success state with
  **Download again** / **Start a new batch**.
- **Print guide screen** — the four-point checklist: review flagged pages and barcode
  boundaries, select 4 × 6-inch paper, print at 100% / actual size, print one test label first.

## PDF pipeline (unchanged by the redesign)

1. `src/lib/analyze.ts` — reads each page's text layer through
   `streamTextContent().getReader()` (not `getTextContent()`, whose internal `for await` over a
   `ReadableStream` throws `… is not async iterable` on Chrome 109) and locates the
   `"Tax Invoice"` heading.
2. `src/lib/calibration.ts` — turns that anchor into a crop rectangle plus a **uniform** scale
   (never stretched on one axis, so barcode bar ratios survive).
3. `src/lib/process.ts` — rebuilds each label as a genuine 288 × 432 pt page with the original
   vector content embedded as a Form XObject (never rasterised), preserving page order.

Crop geometry, output dimensions, page order and vector quality are untouched by this change.

## Styling: plain CSS, Chrome 109 floor

`src/index.css` is hand-written CSS with custom properties. Tailwind was removed: Tailwind 4
emits `oklch()` custom properties and `color-mix()` values, which Chrome 109 cannot resolve —
an unresolvable colour function in a custom property falls back to `inherit`, so the old build
lost its text colours on Windows 7.

The stylesheet avoids everything newer than Chrome 109: modern colour functions, native
nesting, `:has()`, container queries, `text-wrap: balance/pretty`, `dvh/svh/lvh`, `@layer`,
`@property`. There is no external font or stylesheet request — the system font stack is used.

Design tokens: white cards on `#f1f5f3` (very light grey-green), deep-green primary `#19765b`,
charcoal text `#1f2a26`, subtle borders and soft shadows, rounded corners, generous spacing.

## Testing — and what is *not* covered

Three suites, all runnable with `npm test`:

1. **`npm run test:compat` — PDF pipeline under simulated Chrome 109** (`test/pipeline.test.ts`).
   Deletes `ReadableStream[Symbol.asyncIterator]` from Node's globals to reproduce the
   Windows 7 / Chrome 109 gap 1:1, then runs the real pipeline end to end and asserts crop
   boundaries, page order, 288 × 432 pt output, vector Form XObject embedding, the
   fixed-coordinate fallback and single-page PDFs.
2. **`npm run test:ui` — UI structure smoke test** (`test/uiRender.test.tsx`). Server-renders
   the upload, review/export, success, error and print-guide screens, checks that the emitted
   markup is well-formed (every tag balanced) and asserts the required copy, controls,
   accessible labels and collapsible sections.
3. **`npm run test:compat:css` — static Chrome-109 CSS / single-file guard**
   (`test/cssCompat.test.mjs`). Parses the built `dist/index.html`: rejects modern colour
   functions and other too-new syntax, checks every `var(--lt-*)` is defined, verifies the
   responsive breakpoints exist in the CSS, and confirms the bundle has no external
   script/style/font reference.

> **Simulated ≠ tested on the machine.** Suite 1 reproduces the *JavaScript* gap of Chrome 109
> in Node; suites 2–3 inspect rendered markup and the built artifact without a browser. None of
> them runs a real Chrome 109 on Windows 7. Before shipping, open
> `standalone/labeltrim.html` on that machine and check: upload a real Seller Hub batch, page
> through the preview, convert, download, and print one test label.
