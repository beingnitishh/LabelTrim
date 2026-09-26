import { GlobalWorkerOptions, PDFWorker } from "./pdfjsCompat";
import workerRaw from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw";

/**
 * The app ships as a single inlined HTML file, so the pdf.js worker can't live
 * as a separate asset. We inline the worker source as a string and hand it to
 * pdf.js via a Blob URL (module worker).
 *
 * Two safeguards:
 * 1. Blob URLs have an opaque origin, so pdf.js's same-origin check would
 *    otherwise wrap our worker in a "CDN wrapper" module (a blob that does
 *    `await import(blobUrl)`). Both blobs are created by this same-origin page
 *    and the module worker inherits the page origin, so we skip the wrapper.
 * 2. If worker creation itself fails, pdf.js falls back to running its
 *    "fake worker" on the main thread.
 */
let workerReady = false;

export function ensureWorker(): void {
  if (workerReady) return;
  workerReady = true;
  try {
    const blob = new Blob([workerRaw], { type: "text/javascript" });
    GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    const hackable = PDFWorker as unknown as {
      _isSameOrigin: (baseUrl: string, otherUrl: string) => boolean;
    };
    hackable._isSameOrigin = () => true;
  } catch {
    // leave unset; pdf.js will fall back to the fake worker
  }
}
