/**
 * Bundles the Node test entries with esbuild (ships with Vite):
 *   - test/pipeline.test.ts   → the PDF pipeline / Chrome-109 harness
 *   - test/uiRender.test.tsx  → the redesigned-UI structure smoke test
 *   - test/session.test.ts    → reload/crash recovery storage (fake-indexeddb)
 *   - test/reload.test.tsx    → full App mounted in jsdom, reload simulated
 *
 * All npm packages stay external (imported natively at runtime); only the
 * repo's src/ TypeScript is compiled in. Two shims replace browser-only code:
 *   - src/lib/pdfjsSetup.ts → test/nodeWorkerShim.mjs  (`?raw` worker import)
 *   - PreviewPane           → test/previewPaneShim.tsx (canvas/PDF rendering),
 *                             used by the reload test only.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const workerShim = {
  name: "stub-pdfjs-setup",
  setup(build) {
    build.onResolve({ filter: /(^|\/)\/?pdfjsSetup$/ }, () => ({
      path: path.join(__dirname, "nodeWorkerShim.mjs"),
    }));
  },
};

const previewPaneShim = {
  name: "stub-preview-pane",
  setup(build) {
    build.onResolve({ filter: /(^|\/)\/?PreviewPane$/ }, () => ({
      path: path.join(__dirname, "previewPaneShim.tsx"),
    }));
  },
};

const ENTRIES = [
  { src: "pipeline.test.ts", out: "pipeline.test.mjs", plugins: [workerShim] },
  { src: "uiRender.test.tsx", out: "uiRender.test.mjs", plugins: [workerShim] },
  { src: "session.test.ts", out: "session.test.mjs", plugins: [workerShim] },
  { src: "reload.test.tsx", out: "reload.test.mjs", plugins: [workerShim, previewPaneShim] },
];

for (const { src, out, plugins } of ENTRIES) {
  await esbuild.build({
    entryPoints: [path.join(__dirname, src)],
    outfile: path.join(__dirname, "dist", out),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    jsx: "automatic",
    packages: "external",
    plugins,
  });
}

console.log(`built ${ENTRIES.map((e) => `test/dist/${e.out}`).join(", ")}`);
