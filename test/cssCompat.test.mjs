/**
 * Chrome-109 CSS / single-file guards for the built standalone HTML.
 *
 * Run AFTER `npm run build`:  node test/cssCompat.test.mjs
 *
 * This is a *static* compatibility check, not browser testing. It cannot
 * prove how Chrome 109 renders the page; it proves the shipped artifact
 * contains none of the syntax that Chrome 109 (the final Chrome for Windows
 * 7 / 8.1) is known to reject, and that nothing is loaded from the network.
 *
 * Checked:
 *   1. no modern colour functions (oklch/oklab/lab/lch/color-mix/light-dark)
 *      — these need Chrome 111+, and an unresolvable value in a custom
 *      property silently falls back to `inherit`, which is how the previous
 *      Tailwind 4 build lost its text colours on Windows 7;
 *   2. no native CSS nesting (`&`), no :has(), no container queries,
 *      no text-wrap: balance/pretty, no dvh/svh/lvh, no @layer/@property/@scope;
 *   3. every var(--lt-*) used in the stylesheet is actually defined (:root);
 *   4. mobile layout is present (sidebar collapses below 1024px, panels stack);
 *   5. the build stays a genuine single file: no external script/style/font.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distFile = path.join(__dirname, "..", "dist", "index.html");

let passed = 0;
/** @param {unknown} cond @param {string} msg */
function ok(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}

/** Extract <style>…</style> bodies (the app's own CSS, not pdf.js JS). */
/** @param {string} html @returns {string} */
function extractCss(html) {
  const blocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/g) ?? [];
  return blocks.map((b) => b.replace(/^<style[^>]*>/, "").replace(/<\/style>$/, "")).join("\n");
}

/** Return the body of the first at-rule whose prelude matches `sel`, braces balanced. */
/** @param {string} css @param {RegExp} preludeRe @returns {string | null} */
function atRuleBody(css, preludeRe) {
  const m = preludeRe.exec(css);
  if (!m) return null;
  let i = css.indexOf("{", m.index);
  if (i === -1) return null;
  let depth = 0;
  const start = i;
  for (; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(start + 1, i);
    }
  }
  return null;
}

if (!existsSync(distFile)) {
  console.error("dist/index.html not found — run `npm run build` first.");
  process.exit(1);
}

const html = readFileSync(distFile, "utf8");
const css = extractCss(html);

console.log(`Inspecting dist/index.html (${(html.length / 1024).toFixed(0)} KB) — CSS ${(css.length / 1024).toFixed(1)} KB\n`);
ok(css.length > 5000, "stylesheet inlined into the standalone HTML");

// ---- 1. modern colour syntax Chrome 109 cannot resolve ----------------------
const COLOUR_HAZARDS = ["oklch(", "oklab(", "color-mix(", "light-dark(", "color-contrast("];
for (const hazard of COLOUR_HAZARDS) {
  ok(!css.includes(hazard), `CSS free of ${hazard}`);
}
// lab()/lch() only as functions, never as part of another identifier
ok(!/(^|[^-\w])lab\(/.test(css), "CSS free of lab()");
ok(!/(^|[^-\w])lch\(/.test(css), "CSS free of lch()");

// ---- 2. syntax that needs a newer engine -----------------------------------
/** @type {[string, RegExp][]} */
const SYNTAX_HAZARDS = [
  ["native CSS nesting (&)", /(^|[;{}])\s*&/],
  [":has()", /:has\(/],
  ["container queries", /@container/],
  ["text-wrap: balance/pretty", /text-wrap:\s*(balance|pretty)/],
  ["dvh/svh/lvh units", /[\d.]\s*(dvh|svh|lvh)\b/],
  ["@layer", /@layer/],
  ["@property", /@property/],
  ["@scope", /@scope/],
  ["subgrid", /subgrid/],
  ["scroll-driven animation (animation-timeline)", /animation-timeline/],
];
for (const [name, re] of SYNTAX_HAZARDS) {
  ok(!re.test(css), `CSS free of ${name}`);
}

// ---- 3. design tokens: everything used is defined, palette intact -----------
const defined = new Set(Array.from(css.matchAll(/(--lt-[a-z0-9-]+)\s*:/g), (m) => m[1]));
const used = new Set(Array.from(css.matchAll(/var\(\s*(--lt-[a-z0-9-]+)/g), (m) => m[1]));
const undefinedTokens = Array.from(used).filter((t) => !defined.has(t));
ok(defined.size > 30, `design tokens defined (${defined.size})`);
ok(undefinedTokens.length === 0, `every var(--lt-*) is defined (undefined: ${undefinedTokens.join(", ") || "none"})`);
ok(css.includes("#19765b"), "deep-green primary #19765B present");
ok(css.includes("#f1f5f3"), "very light grey-green page background present");
ok(css.includes("#1f2a26"), "dark charcoal text colour present");

// ---- 4. responsive layout is really in the CSS -----------------------------
const tablet = atRuleBody(css, /@media\s*\(\s*max-width:\s*1023px\s*\)/);
ok(tablet !== null, "@media (max-width: 1023px) breakpoint exists");
ok(!!tablet && /\.sidebar\{display:none/.test(tablet.replace(/\s+/g, "")), "desktop sidebar collapses below 1024px");
ok(!!tablet && /\.sidebar--open\{display:flex/.test(tablet.replace(/\s+/g, "")), "mobile sidebar can be opened again");

const narrow = atRuleBody(css, /@media\s*\(\s*max-width:\s*(760|1080)px\s*\)/);
ok(narrow !== null, "narrow-screen breakpoints exist");
ok(/\.review-layout,.{0,40}\.guide-layout\{grid-template-columns:minmax\(0,1fr\)\}/.test(css.replace(/\s+/g, "")), "review/upload panels stack to one column on smaller screens");

for (const selector of [
  ".sidebar",
  ".nav-item[aria-current=",
  ".stepper",
  ".step--active",
  ".dropzone",
  ".dropzone--dragging",
  ".preview__overlay",
  ".page-grid__btn--warning",
  ".disclosure[open]",
  ".skip-link",
  ":focus-visible",
]) {
  ok(css.includes(selector), `CSS defines ${selector}`);
}

// ---- 5. standalone single-file build, no network dependencies ---------------
ok(!/<script[^>]+\ssrc=/.test(html), "no external <script src> — JS is inlined");
ok(!/<link[^>]+rel=["']?stylesheet/.test(html), "no external stylesheet link");
ok(!/fonts\.(googleapis|gstatic)\.com/.test(html), "no Google Fonts dependency");
ok(!/@import/.test(css), "no CSS @import (no external font/stylesheet fetch)");
ok(!/@font-face/.test(css), "no @font-face — system font stack only");
ok(html.includes('content="#19765B"'), "theme-color set to the deep green");

console.log(`\nAll ${passed} static Chrome-109 CSS/single-file checks passed.`);
console.log("NOTE: these are static checks on the built artifact — actual Windows 7 / Chrome 109");
console.log("      browser testing still has to be done by hand on that machine.");
