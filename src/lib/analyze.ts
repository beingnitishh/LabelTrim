import { getDocument } from "./pdfjsCompat";
import type { PDFPageProxy } from "./pdfjsCompat";
import { ensureWorker } from "./pdfjsSetup";
import type { RawPage } from "./types";

/** Minimal structural type for pdf.js text content (v5 doesn't export it from the root). */
interface TextContentLike {
  items: unknown[];
}

/**
 * Collect a page's text items through an explicit stream reader.
 *
 * pdf.js v5's `page.getTextContent()` consumes its ReadableStream with
 * `for await ... of`, which needs `ReadableStream[Symbol.asyncIterator]` —
 * missing in Chrome 109 (the final Windows 7/8.1 release), where it throws
 * "t is not async iterable". `streamTextContent()` exposes the very same
 * stream, and `getReader()`/`read()` works in every browser with basic
 * ReadableStream support (Chrome 52+), yielding identical items in
 * identical order.
 */
async function collectTextContent(page: PDFPageProxy): Promise<TextContentLike> {
  const reader = page.streamTextContent().getReader();
  const items: unknown[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunkItems = (value as { items?: unknown[] } | null | undefined)?.items;
      if (Array.isArray(chunkItems)) {
        for (const item of chunkItems) items.push(item);
      }
    }
  } finally {
    // Always drop the lock so page.cleanup()/doc.destroy() can proceed,
    // even if a chunk read rejects mid-stream.
    reader.releaseLock();
  }
  return { items };
}

export interface AnalyzeProgress {
  done: number;
  total: number;
}

interface Line {
  y: number;
  text: string;
}

/** Group text items into lines by their baseline Y (tolerance 1.5 pt). */
function groupLines(tc: TextContentLike): Line[] {
  const lines: Line[] = [];
  let current: { y: number; parts: string[] } | null = null;
  for (const raw of tc.items) {
    if (typeof raw !== "object" || raw === null || !("str" in raw)) continue;
    const item = raw as { str: string; transform?: number[] };
    const tf = item.transform;
    if (!tf || tf.length < 6) continue;
    const y = tf[5];
    if (current && Math.abs(y - current.y) <= 1.5) {
      current.parts.push(item.str);
    } else {
      if (current) lines.push({ y: current.y, text: current.parts.join(" ").trim() });
      current = { y, parts: [item.str] };
    }
  }
  if (current) lines.push({ y: current.y, text: current.parts.join(" ").trim() });
  return lines;
}

const ANCHOR_RE = /tax\s*invoices?/i;

/**
 * Find the "Tax Invoice" heading. The invoice section sits below the label;
 * a single match inside the band is used as-is (dynamic split). If several
 * matches exist (e.g. a stray mention inside the label area), the one closest
 * to the expected heading position wins — never blindly the topmost.
 */
function findAnchor(lines: Line[], pageH: number): Line | null {
  const lo = pageH * 0.35;
  const hi = pageH * 0.72;
  const expected = pageH * 0.52; // ≈ where the heading sits on the reference template
  const matches: Line[] = [];
  for (const line of lines) {
    if (line.y < lo || line.y > hi) continue;
    if (!ANCHOR_RE.test(line.text)) continue;
    matches.push(line);
  }
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches.reduce((a, b) => (Math.abs(a.y - expected) <= Math.abs(b.y - expected) ? a : b));
}

/**
 * Scan every page of the source PDF and locate the split line.
 * Primary method: "Tax Invoice" text anchor (dynamic, survives address-length
 * and multi-SKU variation). Pages without a match get anchorY = null and will
 * use the fixed-coordinate fallback crop (flagged in the UI).
 */
export async function analyzePdf(
  bytes: Uint8Array,
  onProgress?: (p: AnalyzeProgress) => void
): Promise<RawPage[]> {
  ensureWorker();
  // pdf.js may transfer the buffer to its worker — hand it a fresh copy so the
  // caller's bytes stay intact for the pdf-lib processing step.
  const doc = await getDocument({
    data: bytes.slice(),
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const pages: RawPage[] = [];
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: 1 });
      // NOT page.getTextContent(): its internal `for await` over a
      // ReadableStream breaks Chrome 109 (see collectTextContent).
      const tc = await collectTextContent(page);
      const lines = groupLines(tc);
      const anchor = findAnchor(lines, vp.height);
      pages.push({
        pageIndex: i - 1,
        width: vp.width,
        height: vp.height,
        rotation: page.rotate,
        hasTextLayer: lines.length > 0,
        anchorY: anchor ? anchor.y : null,
        anchorText: anchor ? anchor.text : null,
      });
      page.cleanup();
      onProgress?.({ done: i, total: doc.numPages });
    }
  } finally {
    await doc.destroy();
  }
  return pages;
}
