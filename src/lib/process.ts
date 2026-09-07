import { PDFDocument } from "pdf-lib";
import type { PagePlan } from "./types";
import { OUT_H, OUT_W } from "./types";

export interface ProcessProgress {
  done: number;
  total: number;
}

/**
 * Build the 4×6 output PDF.
 *
 * Unlike a CropBox shift, every output page is a genuinely new 288×432 pt page
 * containing only the embedded label region — the invoice content never makes
 * it into the file (Finding 1). Embedding keeps the page as a vector Form
 * XObject, so barcodes/QR stay perfectly crisp (FR6). Scale is uniform on both
 * axes (FR5); page order is preserved (FR7).
 */
export async function build4x6Pdf(
  bytes: Uint8Array,
  plans: PagePlan[],
  onProgress?: (p: ProcessProgress) => void
): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { updateMetadata: false });
  const out = await PDFDocument.create();
  out.setTitle("LabelTrim — 4x6 shipping labels");
  out.setProducer("LabelTrim");
  out.setCreator("LabelTrim");

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const { left, right, top, bottom } = plan.crop;
    try {
      const srcPage = src.getPage(plan.pageIndex);
      const embedded = await out.embedPage(srcPage, { left, bottom, right, top });
      const w = embedded.width;
      const h = embedded.height;
      const s = Math.min(OUT_H / h, OUT_W / w);
      const page = out.addPage([OUT_W, OUT_H]);
      page.drawPage(embedded, {
        x: (OUT_W - w * s) / 2,
        y: (OUT_H - h * s) / 2,
        xScale: s,
        yScale: s,
      });
    } catch (err) {
      throw new Error(
        `Failed embedding page ${i + 1}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    onProgress?.({ done: i + 1, total: plans.length });
    // Yield to the event loop every few pages so the progress bar can paint.
    if (i % 6 === 5) await new Promise((r) => setTimeout(r, 0));
  }

  return out.save({ useObjectStreams: true });
}
