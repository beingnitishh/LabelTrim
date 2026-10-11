import path from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
//
// Styling is hand-written plain CSS (src/index.css) instead of a utility
// framework: Tailwind 4 emits oklch()/color-mix() custom properties, which
// Chrome 109 — the last Chrome for Windows 7/8.1 — cannot resolve. See the
// header of src/index.css and the guard in test/cssCompat.test.mjs.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    // Chrome 109 is the final Chrome release for Windows 7/8.1 and the oldest
    // browser LabelTrim must run on. Pin the transpile target so esbuild
    // downlevels anything newer (Vite 7's default already ≈ chrome107; this
    // keeps the guarantee explicit). Note: the pdf.js worker is inlined as raw
    // text (?raw) and is NOT processed by this target — it ships verbatim from
    // pdfjs-dist's legacy build, which supports old browsers and bundles its
    // own core-js polyfills (Promise.try, Promise.withResolvers, …).
    target: "chrome109",
  },
  server: {
    // The sandboxed live-preview proxy serves this dev server under a
    // per-session host (https://{port}-{sandbox}.e2b.app); Vite 7 blocks
    // unknown Host headers by default, so allow all hosts in dev only.
    allowedHosts: true,
  },
  preview: {
    // Same sandboxed-proxy consideration as above, for `vite preview` (serves
    // the built single-file dist/index.html).
    allowedHosts: true,
    host: true,
    port: 4173,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
