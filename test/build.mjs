/**
 * Bundles the Node test entries with esbuild (ships with Vite):
 *   - test/pipeline.test.ts   → the PDF pipeline / Chrome-109 harness
 *   - test/uiRender.test.tsx  → the redesigned-UI structure smoke test
 *
 * All npm packages stay external (imported natively at runtime); only the
 * repo's src/ TypeScript is compiled in. The Vite-specific `?raw` worker
 * import inside src/lib/pdfjsSetup.ts is replaced by test/nodeWorkerShim.mjs.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ENTRIES = [
  ["pipeline.test.ts", "pipeline.test.mjs"],
  ["uiRender.test.tsx", "uiRender.test.mjs"],
];

for (const [src, out] of ENTRIES) {
  await esbuild.build({
    entryPoints: [path.join(__dirname, src)],
    outfile: path.join(__dirname, "dist", out),
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    jsx: "automatic",
    packages: "external",
    plugins: [
      {
        name: "stub-pdfjs-setup",
        setup(build) {
          build.onResolve({ filter: /(^|\/)\/?pdfjsSetup$/ }, () => ({
            path: path.join(__dirname, "nodeWorkerShim.mjs"),
          }));
        },
      },
    ],
  });
}
console.log("built test/dist/pipeline.test.mjs and test/dist/uiRender.test.mjs");
