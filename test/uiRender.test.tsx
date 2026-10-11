/**
 * UI smoke test (Node + react-dom/server).
 *
 * Renders the redesigned screens to static markup and asserts the structure and
 * copy the brief asks for: sidebar navigation, breadcrumb + privacy indicator,
 * the “Goodbye A4. Hello, 4 × 6.” heading, the three-step indicator, the upload
 * card with its two real buttons, the demo action, the review/export controls
 * (including the collapsible advanced crop adjustments) and the four-point
 * print guide.
 *
 * This is a rendering test, not a browser test: it proves the components mount
 * and emit the expected, accessible markup. Layout, hover/focus styling and the
 * pdf.js canvas preview still need real browser testing.
 */
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";

import App from "../src/App";
import GuideScreen from "../src/components/GuideScreen";
import PreviewPane from "../src/components/PreviewPane";
import ReportPanel from "../src/components/ReportPanel";
import { computePlan, DEFAULT_CALIBRATION } from "../src/lib/calibration";
import type { PagePlan, RawPage } from "../src/lib/types";

let passed = 0;
/** @param {unknown} cond @param {string} msg */
function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}
/** @param {unknown} cond @param {string} msg */
function no(cond: unknown, msg: string): void {
  assert.ok(!cond, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}

/** Real plan objects, straight from the production calibration code. */
const anchoredRaw: RawPage = {
  pageIndex: 0,
  width: 595,
  height: 842,
  rotation: 0,
  hasTextLayer: true,
  anchorY: 442,
  anchorText: "Tax Invoice",
};
const noTextRaw: RawPage = { ...anchoredRaw, pageIndex: 1, hasTextLayer: false, anchorY: null, anchorText: null };

const anchoredPlan: PagePlan = computePlan(anchoredRaw, DEFAULT_CALIBRATION);
const fallbackPlan: PagePlan = computePlan(noTextRaw, DEFAULT_CALIBRATION);

const noop = () => {};

console.log("Idle / upload screen (App)");
{
  const html = renderToStaticMarkup(h(App));

  ok(html.includes("Goodbye A4. Hello,"), "main heading present");
  ok(html.includes("4 × 6."), "heading keeps the 4 × 6 emphasis");
  ok(
    html.includes("Turn your label and invoice PDFs into clean, thermal-ready shipping labels."),
    "supporting heading text present verbatim",
  );
  ok(html.includes("4 × 6 inches output format"), "output-format badge present");

  // stepper
  ok(html.includes(">Upload PDF<"), "stepper step 1 = Upload PDF");
  ok(html.includes(">Review crop<"), "stepper step 2 = Review crop");
  ok(html.includes(">Download labels<"), "stepper step 3 = Download labels");
  ok(html.includes('aria-current="step"'), "current step is marked with aria-current");
  ok((html.match(/aria-current="step"/g) ?? []).length === 1, "exactly one step is current");

  // sidebar
  ok(html.includes("Label cropper"), "sidebar shows Label cropper nav item");
  ok(html.includes("aria-current=\"page\""), "active nav item marked aria-current=page");
  ok(html.includes("Print guide"), "sidebar shows Print guide link");
  ok(html.includes("never leave this device"), "sidebar privacy card explains local processing");

  // top bar
  ok(html.includes("Workspace") && html.includes("Label cropper"), "breadcrumb Workspace / Label cropper");
  ok(html.includes("Private by design"), "private-by-design indicator in the top bar");
  ok(html.includes("Toggle navigation"), "mobile sidebar toggle has an accessible label");

  // accessibility scaffolding
  ok(html.includes("Skip to main content"), "skip link present");
  ok(html.includes('id="lt-main"'), "main landmark target present");

  // upload card
  ok(html.includes(">Choose PDF<"), "green Choose PDF button is a real button");
  ok(html.includes("Try a sample PDF"), "secondary sample-PDF action present");
  ok(
    /<button[^>]*btn--primary[^>]*>[\s\S]{0,400}?Choose PDF/.test(html),
    "Choose PDF is a primary (solid green) button",
  );
  ok(html.includes("Flipkart Seller Hub"), "explains where the combined PDF comes from");
  ok(html.includes("combined A4 label + invoice PDF"), "tells the user to upload the combined PDF");
  ok(html.includes('role="img"'), "illustration is exposed as an image with a title");
  ok(html.includes("From an A4 label plus invoice sheet to a 4 by 6 shipping label"), "illustration title describes A4 → 4×6");

  // benefits
  ok(html.includes("Precise cropping") && html.includes("Sharp labels") && html.includes("Batch processing"), "three benefits present");
  no(html.includes('role="button"'), "no fake button roles — only real <button> elements");
}

console.log("\nPrint guide screen");
{
  const html = renderToStaticMarkup(h(GuideScreen, { onBack: noop }));
  ok(html.includes("Print guide"), "guide screen heading");
  ok(html.includes("Review flagged pages and barcode boundaries"), "guide point 1 present");
  ok(html.includes("Select 4 × 6-inch paper"), "guide point 2 present");
  ok(html.includes("Print at 100% / Actual size"), "guide point 3 present");
  ok(html.includes("Print one test label before the full batch"), "guide point 4 present");
  ok(html.includes("Back to label cropper"), "way back to the cropper is offered");
}

console.log("\nPreview pane");
{
  const html = renderToStaticMarkup(
    h(PreviewPane, {
      pdfBytes: new Uint8Array([1, 2, 3]),
      pageIndex: 0,
      plans: [anchoredPlan, fallbackPlan],
      overlayOn: true,
      onToggleOverlay: noop,
      onPageChange: noop,
    }),
  );
  ok(html.includes("PDF preview"), "preview card labelled");
  ok(html.includes("Show crop overlay"), "crop overlay toggle preserved");
  ok(html.includes('aria-label="Previous page"') && html.includes('aria-label="Next page"'), "page navigation preserved");
  ok(html.includes("Page 1 / 2"), "page counter preserved");
  ok(html.includes("288 × 432 pt"), "output geometry readout present");
  ok(html.includes("Rendering page…"), "loading state shown until the canvas is ready");
  ok(html.includes("crop overlay on every page") === false, "no stray copy");
}

console.log("\nReport panel — ready phase");
{
  const html = renderToStaticMarkup(
    h(ReportPanel, {
      fileName: "batch.pdf",
      plans: [anchoredPlan, fallbackPlan],
      calibration: DEFAULT_CALIBRATION,
      onCalibrationChange: noop,
      phase: "ready",
      progress: { done: 0, total: 2 },
      output: null,
      autoDownloaded: false,
      error: null,
      onProcess: noop,
      onDownload: noop,
      onReset: noop,
      onJumpToPage: noop,
      onOpenGuide: noop,
      activePage: 0,
    }),
  );
  ok(html.includes("Batch summary"), "batch summary panel present");
  ok(html.includes("Convert to 4 × 6 PDF"), "prominent convert button present");
  ok(html.includes("Advanced crop adjustments"), "advanced crop adjustments are collapsible (<details>)");
  ok(html.includes("<details"), "collapsible sections use native <details>");
  ok(!/<details[^>]*\sopen/.test(html), "advanced crop adjustments start collapsed");
  ok(html.includes("Label left edge") && html.includes("Anchor offset"), "calibration controls preserved");
  ok(html.includes("Reset to calibrated defaults"), "calibration reset preserved");
  ok(html.includes("Per-page status"), "per-page status list preserved");
  ok(html.includes("fallback crop"), "fallback-crop warning surfaced");
  ok(html.includes("Print guide"), "print guide available inline");
  ok(html.includes("Open the full print guide"), "link to the full guide");
}

console.log("\nReport panel — processing and error states");
{
  const html = renderToStaticMarkup(
    h(ReportPanel, {
      fileName: "batch.pdf",
      plans: [anchoredPlan, fallbackPlan, anchoredPlan],
      calibration: DEFAULT_CALIBRATION,
      onCalibrationChange: noop,
      phase: "processing",
      progress: { done: 1, total: 3 },
      output: null,
      autoDownloaded: false,
      error: null,
      onProcess: noop,
      onDownload: noop,
      onReset: noop,
      onJumpToPage: noop,
      onOpenGuide: noop,
      activePage: 0,
    }),
  );
  ok(html.includes("Embedding page 2 of 3"), "live processing progress with page numbers");
  ok(html.includes('role="progressbar"'), "progress bar exposed to assistive tech");
  ok(html.includes("33%"), "percentage readout");

  const errHtml = renderToStaticMarkup(
    h(ReportPanel, {
      fileName: "batch.pdf",
      plans: [anchoredPlan],
      calibration: DEFAULT_CALIBRATION,
      onCalibrationChange: noop,
      phase: "ready",
      progress: { done: 0, total: 1 },
      output: null,
      autoDownloaded: false,
      error: "Failed embedding page 1: unexpected end of file",
      onProcess: noop,
      onDownload: noop,
      onReset: noop,
      onJumpToPage: noop,
      onOpenGuide: noop,
      activePage: 0,
    }),
  );
  ok(errHtml.includes('role="alert"'), "export errors are announced as alerts");
  ok(errHtml.includes("Export failed"), "useful error heading");
  ok(errHtml.includes("unexpected end of file"), "underlying error message shown");
}

console.log("\nReport panel — download-success state");
{
  const html = renderToStaticMarkup(
    h(ReportPanel, {
      fileName: "batch.pdf",
      plans: [anchoredPlan, fallbackPlan],
      calibration: DEFAULT_CALIBRATION,
      onCalibrationChange: noop,
      phase: "done",
      progress: { done: 2, total: 2 },
      output: { filename: "labeltrim-4x6-batch-2pages.pdf", sizeBytes: 42_000, pageCount: 2 },
      autoDownloaded: true,
      error: null,
      onProcess: noop,
      onDownload: noop,
      onReset: noop,
      onJumpToPage: noop,
      onOpenGuide: noop,
      activePage: 0,
    }),
  );
  ok(html.includes("2 thermal labels ready"), "download-success state");
  ok(html.includes("labeltrim-4x6-batch-2pages.pdf"), "output filename shown");
  ok(html.includes("Download again"), "download again offered");
  ok(html.includes("Start a new batch"), "new batch offered");
  ok(html.includes("100% / actual size"), "printer reminder kept in the success state");
}

console.log(`\nAll ${passed} UI structure checks passed.`);
console.log("NOTE: static markup assertions — visual layout, hover/focus states and the pdf.js");
console.log("      canvas preview still require a real browser (see README testing notes).");
