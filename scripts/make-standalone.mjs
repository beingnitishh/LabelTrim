/**
 * Packages the production build into the committed standalone artifact.
 *
 * `vite build` writes the single-file bundle to dist/ (git-ignored); this copies
 * it to standalone/labeltrim.html, which ships with the repo so the tool can be
 * opened straight from disk — no dev server, no build step, no network.
 */
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "dist", "index.html");
const targetDir = path.join(root, "standalone");
const target = path.join(targetDir, "labeltrim.html");

const html = readFileSync(source, "utf8");

// Refuse to ship a bundle that is not actually self-contained.
const offenders = [];
if (/<script[^>]+\ssrc=/.test(html)) offenders.push("external <script src>");
if (/<link[^>]+rel=["']?stylesheet/.test(html)) offenders.push("external stylesheet");
if (/fonts\.(googleapis|gstatic)\.com/.test(html)) offenders.push("external font host");
if (offenders.length > 0) {
  console.error(`Refusing to package: not a single file (${offenders.join(", ")}).`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
writeFileSync(
  path.join(targetDir, "README.txt"),
  [
    "LabelTrim — standalone build",
    "",
    "Open labeltrim.html directly in Chrome (works offline, no server needed).",
    "Everything — PDF analysis, cropping and export — runs inside the browser;",
    "no file ever leaves the device.",
    "",
    "Supported browser floor: Chrome 109 (the final Chrome release for",
    "Windows 7 / 8.1). See the repository README for testing details.",
    "",
    "Regenerate with: npm run build:standalone",
    "",
  ].join("\n"),
);

const kb = statSync(target).size / 1024;
console.log(`packaged standalone/labeltrim.html (${kb.toFixed(0)} KB, self-contained)`);
