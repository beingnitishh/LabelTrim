/**
 * Node stand-in for src/lib/pdfjsSetup.ts (substituted via esbuild alias in
 * test/build.mjs).
 *
 * In the browser the app inlines the pdf.js worker as raw text and hands it to
 * pdf.js through a Blob URL (module worker). In Node, pdf.js never spawns a
 * real worker: it runs its "fake worker" on the main thread by doing
 * `await import(GlobalWorkerOptions.workerSrc)`. So the shim simply points
 * workerSrc at the installed legacy worker module — the exact same file that
 * ships inlined in the single-file HTML.
 */
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

const require = createRequire(import.meta.url);

GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
).href;

export function ensureWorker() {
  /* no-op — workerSrc was set at module load */
}
