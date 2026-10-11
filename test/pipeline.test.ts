/**
 * Chrome-109 compatibility harness (runs under Node).
 *
 * Windows 7's final Chrome (109) lacks exactly one Web API that LabelTrim
 * needs: ReadableStream[Symbol.asyncIterator] (shipped in Chrome 110). The
 * bundled legacy builds of pdf.js polyfill everything else (Promise.try,
 * Promise.withResolvers, Uint8Array.fromBase64/…, AbortSignal.any, …).
 *
 * This harness deletes the async-iterator from Node's global ReadableStream —
 * reproducing the Chrome 109 gap 1:1 — and then:
 *   1. reproduces the original failure ("… is not async iterable") through
 *      pdf.js's own page.getTextContent(),
 *   2. runs the real app pipeline (analyzePdf → computePlan → build4x6Pdf)
 *      via the fixed streamTextContent().getReader() path,
 *   3. verifies crop boundaries, page order, 288×432 pt (4×6 in) output,
 *      vector Form-XObject embedding (sharp barcodes/QR), the fixed-coordinate
 *      fallback for pages without a text layer, and single-page PDFs.
 */
import assert from "node:assert/strict";
import { PDFDocument, PDFDict, PDFName, PDFRef, PDFStream } from "pdf-lib";

let passed = 0;
function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}

/** True when the page's resources embed at least one vector Form XObject. */
function hasFormXObject(doc: PDFDocument, pageIndex: number): boolean {
  const page = doc.getPage(pageIndex);
  const ctx = doc.context;
  const resources = page.node.Resources();
  if (!resources) return false;
  const deref = (v: unknown): unknown => (v instanceof PDFRef ? ctx.lookup(v) : v);
  const xobj = deref(resources.get(PDFName.of("XObject")));
  if (!(xobj instanceof PDFDict)) return false;
  for (const key of xobj.keys()) {
    const entry = deref(xobj.get(key));
    const subtype = entry instanceof PDFStream ? deref(entry.dict.get(PDFName.of("Subtype"))) : null;
    if (subtype instanceof PDFName && subtype.toString() === "/Form") return true;
  }
  return false;
}

async function main(): Promise<void> {
  // ---- simulate Chrome 109: ReadableStream is NOT async-iterable ----
  const proto = ReadableStream.prototype as unknown as Record<symbol | string, unknown>;
  delete proto[Symbol.asyncIterator];
  if (typeof proto.values === "function") delete proto.values;
  if (typeof proto.entries === "function") delete proto.entries;
  ok(
    typeof (ReadableStream.prototype as any)[Symbol.asyncIterator] === "undefined",
    "simulated Chrome 109: ReadableStream[Symbol.asyncIterator] removed"
  );

  // Dynamic imports so every library initializes *after* the simulation is in
  // place (mirrors a fresh Chrome 109 page load). pdfjsSetup resolves to
  // test/nodeWorkerShim.mjs via the esbuild alias.
  const { analyzePdf } = await import("../src/lib/analyze");
  const { buildDemoPdf } = await import("../src/lib/demo");
  const { computePlan, DEFAULT_CALIBRATION } = await import("../src/lib/calibration");
  const { build4x6Pdf } = await import("../src/lib/process");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // ---- 1. reproduce the original Chrome 109 failure ----
  const demo = await buildDemoPdf();
  {
    const doc = await pdfjs.getDocument({
      data: demo.slice(),
      isEvalSupported: false,
      verbosity: 0,
    }).promise;
    const page = await doc.getPage(1);
    let err: unknown = null;
    try {
      await page.getTextContent(); // the OLD call path
    } catch (e) {
      err = e;
    } finally {
      await doc.destroy();
    }
    const msg = err instanceof Error ? err.message : String(err);
    ok(err !== null, "old getTextContent() path fails under the simulation");
    ok(
      /is not async iterable/.test(msg),
      `failure reproduces the reported error (got: "${msg}")`
    );
  }

  // ---- 2. multipage analysis through the fixed path ----
  const progress: number[] = [];
  const rawPages = await analyzePdf(demo, (p) => progress.push(p.done));
  ok(rawPages.length === 3, "multipage demo: 3 pages analyzed");
  ok(progress.join(",") === "1,2,3", "progress callback fired per page");
  for (const rp of rawPages) {
    ok(rp.hasTextLayer, `page ${rp.pageIndex + 1}: text layer read via streamTextContent().getReader()`);
    ok(
      rp.anchorY !== null && Math.abs(rp.anchorY - 442) < 1,
      `page ${rp.pageIndex + 1}: "Tax Invoice" anchor at y=${rp.anchorY} (expected ≈442)`
    );
    ok(rp.width === 595 && rp.height === 842, `page ${rp.pageIndex + 1}: A4 595×842 pt`);
  }

  // ---- 3. crop plan: boundaries + order unchanged ----
  const plans = rawPages.map((p) => computePlan(p, DEFAULT_CALIBRATION));
  ok(plans.every((p) => p.status === "anchor"), "every page uses the text-anchor crop");
  ok(plans.map((p) => p.pageIndex).join(",") === "0,1,2", "page order preserved");
  for (const pl of plans) {
    const { left, right, top, bottom } = pl.crop;
    ok(
      left === 186 && right === 408 && top === 818 && bottom === 458,
      `page ${pl.pageIndex + 1}: crop 186→408 × 458→818 pt unchanged`
    );
    ok(Math.abs(pl.scale - 1.2) < 1e-9, `page ${pl.pageIndex + 1}: uniform scale ${pl.scale}`);
  }

  // ---- 4. build + verify the 4×6 output ----
  const out = await build4x6Pdf(demo, plans);
  const outDoc = await PDFDocument.load(out);
  ok(outDoc.getPageCount() === 3, "output PDF has 3 pages");
  outDoc.getPages().forEach((pg, i) => {
    ok(
      pg.getWidth() === 288 && pg.getHeight() === 432,
      `output page ${i + 1}: 288×432 pt (exactly 4×6 in)`
    );
    ok(hasFormXObject(outDoc, i), `output page ${i + 1}: label embedded as vector Form XObject (barcodes/QR stay sharp)`);
  });

  // ---- 5. single-page PDF (a non-first source page, to be thorough) ----
  {
    const single = await PDFDocument.create();
    const demoDoc = await PDFDocument.load(demo);
    const [copied] = await single.copyPages(demoDoc, [1]);
    single.addPage(copied);
    const singleBytes = await single.save();

    const rawS = await analyzePdf(singleBytes);
    ok(rawS.length === 1 && rawS[0].anchorY !== null, "single-page PDF analyzed with anchor");
    const plansS = rawS.map((p) => computePlan(p, DEFAULT_CALIBRATION));
    const outS = await build4x6Pdf(singleBytes, plansS);
    const outSDoc = await PDFDocument.load(outS);
    ok(
      outSDoc.getPageCount() === 1 &&
        outSDoc.getPage(0).getWidth() === 288 &&
        outSDoc.getPage(0).getHeight() === 432,
      "single-page output: one 288×432 pt page"
    );
    ok(hasFormXObject(outSDoc, 0), "single-page output: vector Form XObject present");
  }

  // ---- 6. no-text-layer fallback crop still intact ----
  {
    const blank = await PDFDocument.create();
    const blankPage = blank.addPage([595, 842]);
    // A vector-only mark (no text): real-world scanned/image pages always have
    // a Contents stream; a totally empty page is rejected by pdf-lib's
    // embedPage ("missing Contents") on every platform, pre-existing behavior.
    blankPage.drawLine({ start: { x: 40, y: 400 }, end: { x: 555, y: 400 }, thickness: 1 });
    const blankBytes = await blank.save();
    const rawB = await analyzePdf(blankBytes);
    ok(
      rawB.length === 1 && !rawB[0].hasTextLayer && rawB[0].anchorY === null,
      "text-less page: no anchor, hasTextLayer=false"
    );
    const planB = computePlan(rawB[0], DEFAULT_CALIBRATION);
    ok(planB.status === "fallback", "text-less page flagged as fallback");
    ok(
      planB.crop.left === 186 &&
        planB.crop.right === 408 &&
        planB.crop.top === 818 &&
        planB.crop.bottom === 458,
      "fallback crop equals calibrated 222×360 pt block"
    );
    const outB = await build4x6Pdf(blankBytes, [planB]);
    const outBDoc = await PDFDocument.load(outB);
    ok(
      outBDoc.getPageCount() === 1 &&
        outBDoc.getPage(0).getWidth() === 288 &&
        outBDoc.getPage(0).getHeight() === 432,
      "fallback output: one 288×432 pt page"
    );
  }

  console.log(`\nAll ${passed} checks passed under simulated Chrome 109 (no ReadableStream async iteration).`);
}

main().catch((err) => {
  console.error("\nFAILED:", err instanceof Error ? err.stack || err.message : err);
  process.exit(1);
});
