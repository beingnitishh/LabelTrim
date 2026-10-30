# LabelTrim

Turn Flipkart Seller Hub's combined **A4 label + invoice PDF** into clean, thermal-ready
**4 × 6 in (288 × 432 pt)** shipping labels — entirely in the browser. Customer names, full
addresses and order IDs are parsed locally; nothing is uploaded to a server. The batch you are
working on is cached in this browser only, so an unexpected reload cannot lose it, and it is
wiped when you start a new batch.

Windows 7 + Chrome 109 (the last Chrome release for Windows 7 / 8.1) is the supported floor.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/index.html` (single file, git-ignored) |
| `npm run build:standalone` | Build + package the committed artifact `standalone/labeltrim.html` |
| `npm run preview` | Serve the built bundle (port 4173) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:compat` | PDF pipeline under simulated Chrome 109 |
| `npm run test:ui` | server-rendered UI structure smoke test |
| `npm run test:session` | reload-recovery storage (IndexedDB + localStorage) |
| `npm run test:reload` | the whole app in jsdom, reload simulated |
| `npm run test:compat:css` | Chrome-109 CSS / single-file guard on the built bundle |
| `npm test` | typecheck → standalone build → all five test suites |

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
- **Reload recovery notice** — appears above the review screen when the page was
  reloaded underneath the user (green “Batch restored”) or on the upload screen
  when an earlier batch is still cached in this browser (Resume / Discard).
- **Review & export** — PDF preview with page navigation, crop overlay, per-page warning
  indicators and the geometry readout on the left; batch summary, **Convert to 4 × 6 PDF**,
  per-page status grid, *Advanced crop adjustments* (collapsible) and the *Print guide*
  (collapsible) on the right; processing progress, errors and a download-success state with
  **Download again** / **Start a new batch**.
- **Print guide screen** — the four-point checklist: review flagged pages and barcode
  boundaries, select 4 × 6-inch paper, print at 100% / actual size, print one test label first.

## Reload recovery (the “it jumps back to the upload screen” bug)

React state dies with the document. If the page was replaced underneath the
user — Chrome discarding a tab under memory pressure, a renderer crash needing a
reload, a dev-server full reload, a stray F5 — LabelTrim used to come back on
the *upload* screen with the finished crop plan and the converted 4 × 6 PDF
gone, which reads as “the tool reset itself a few seconds after the download”.

`src/lib/session.ts` now keeps the current batch on the device and puts it back:

- **What is stored** — the source PDF bytes, the per-page analysis (`RawPage[]`),
  the advanced crop adjustments, the current page, and the converted 4 × 6 PDF.
  Three records (`source`, `meta`, `output`) so changing page/calibration never
  re-encodes the PDFs.
- **Where** — this origin's **IndexedDB**, falling back to **localStorage**
  (base64, ~5 MB) because Chrome denies IndexedDB to `file://` documents, which
  is exactly how `standalone/labeltrim.html` is opened. Larger batches simply
  are not cached in that mode. Nothing is uploaded; there is still no server.
- **When it comes back** — silently when the page load is a reload
  (`PerformanceNavigationTiming.type === "reload"`) or when the tab has run the
  app before (`sessionStorage` marker). A plain new visit only *offers* the batch
  (“Unfinished batch in this browser” → Resume / Discard) instead of hijacking
  the upload screen.
- **When it goes away** — “Start a new batch”/Discard delete it, a new upload
  replaces it, records older than 12 h are ignored and deleted, and anything
  written by another schema version or left half-written is ignored. A restored
  batch never re-triggers a download; it shows “Download again”.

Downloads themselves are also no longer tied to a 15-second timer: a blob URL
is kept alive for five minutes because revoking it while the browser is still
writing the file aborts the download.

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

Five suites, all runnable with `npm test`:

1. **`npm run test:compat` — PDF pipeline under simulated Chrome 109** (`test/pipeline.test.ts`).
   Deletes `ReadableStream[Symbol.asyncIterator]` from Node's globals to reproduce the
   Windows 7 / Chrome 109 gap 1:1, then runs the real pipeline end to end and asserts crop
   boundaries, page order, 288 × 432 pt output, vector Form XObject embedding, the
   fixed-coordinate fallback and single-page PDFs.
2. **`npm run test:ui` — UI structure smoke test** (`test/uiRender.test.tsx`). Server-renders
   the upload, review/export, success, error and print-guide screens, checks that the emitted
   markup is well-formed (every tag balanced) and asserts the required copy, controls,
   accessible labels and collapsible sections.
3. **`npm run test:session` — reload-recovery storage** (`test/session.test.ts`, fake-indexeddb).
   Runs every storage path: no storage at all, a throwing `indexedDB` getter
   (Chrome's `file://` denial), the localStorage/base64 backend, a full
   save → reload → restore round-trip of source + crop plan + converted PDF,
   invalidation on a new upload, `clearSession()`, the 12 h TTL, foreign/partial
   records, and the reload / same-tab heuristics.
4. **`npm run test:reload` — the bug itself, end to end** (`test/reload.test.tsx`,
   jsdom). Mounts the real `App`, simulates document loads, and asserts that a
   reload restores the finished batch (preview bytes, page, “Download again”),
   that a fresh visit only *offers* it, that Resume works, and that “Start a new
   batch” really wipes it.
5. **`npm run test:compat:css` — static Chrome-109 CSS / single-file guard**
   (`test/cssCompat.test.mjs`). Parses the built `dist/index.html`: rejects modern colour
   functions and other too-new syntax, checks every `var(--lt-*)` is defined, verifies the
   responsive breakpoints exist in the CSS, and confirms the bundle has no external
   script/style/font reference.

> **Simulated ≠ tested on the machine.** Suite 1 reproduces the *JavaScript* gap of Chrome 109
> in Node; suites 2 and 4 render the app in Node/jsdom and suite 5 inspects the built artifact —
> none of them runs a real Chrome 109 on Windows 7. Before shipping, open
> `standalone/labeltrim.html` on that machine and check: upload a real Seller Hub batch, page
> through the preview, convert, download, and print one test label.
