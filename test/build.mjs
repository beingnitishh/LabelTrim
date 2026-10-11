/**
 * Bundles test/pipeline.test.ts for Node with esbuild (ships with Vite).
 * All npm packages stay external (imported natively at runtime); only the
 * repo's src/ TypeScript is compiled in. The Vite-specific `?raw` worker
 * import inside src/lib/pdfjsSetup.ts is replaced by test/nodeWorkerShim.mjs.
 */
import * as esbuild from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, "pipeline.test.ts")],
  outfile: path.join(__dirname, "dist/pipeline.test.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node22",
  packages: "external",
  plugins: [
    {
      name: "stub-pdfjs-setup",
      setup(build) {
        build.onResolve({ filter: /(^|\/)\.?\/?pdfjsSetup$/ }, () => ({
          path: path.join(__dirname, "nodeWorkerShim.mjs"),
        }));
      },
    },
  ],
});

console.log("built test/dist/pipeline.test.mjs");
