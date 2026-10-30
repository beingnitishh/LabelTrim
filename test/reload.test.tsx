/**
 * Reload-recovery integration test — the actual reported bug.
 *
 * “After processing a labels PDF, ~10 s after the download the tool jumps back
 * to the crop-a-new-label screen.” The app never resets itself; what happens is
 * that the document is replaced underneath the user (Chrome discarding a tab
 * under memory pressure, a crashed renderer needing a reload, a dev-server full
 * reload, a stray refresh). React state dies with the document, so the tool used
 * to fall back to the upload screen and the finished crop plan / converted PDF
 * were gone.
 *
 * This test mounts the real <App/> in jsdom against a fake IndexedDB, then
 * simulates a fresh document load per scenario — exactly what a reload is: a
 * brand-new React tree on the same origin storage — and asserts what the user
 * actually sees.
 */
import assert from "node:assert/strict";

let passed = 0;
function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}
function no(cond: unknown, msg: string): void {
  assert.ok(!cond, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}
function eq(actual: unknown, expected: unknown, msg: string): void {
  assert.deepEqual(actual, expected, msg);
  passed++;
  console.log(`  ✓ ${msg}`);
}

const RAW_PAGES = [
  {
    pageIndex: 0,
    width: 595,
    height: 842,
    rotation: 0,
    hasTextLayer: true,
    anchorY: 442,
    anchorText: "Tax Invoice",
  },
  {
    pageIndex: 1,
    width: 595,
    height: 842,
    rotation: 0,
    hasTextLayer: true,
    anchorY: 438,
    anchorText: "Tax Invoice",
  },
];

const SOURCE_BYTES = new Uint8Array(2048).fill(37);
const OUTPUT_BYTES = new Uint8Array(1024).fill(42);
const OUTPUT_INFO = {
  filename: "labeltrim-4x6-flipkart-batch-2pages.pdf",
  sizeBytes: OUTPUT_BYTES.byteLength,
  pageCount: 2,
};

async function main(): Promise<void> {
  /* --------------------------------------------------------- browser globals */
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const virtualConsole = new VirtualConsole(); // swallows jsdom's "navigation not implemented"
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "https://labeltrim.test/",
    pretendToBeVisual: true,
    virtualConsole,
  });

  // Node 22 exposes some of these as read-only getters, so define, don't assign.
  const setGlobal = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });

  setGlobal("window", dom.window);
  setGlobal("document", dom.window.document);
  setGlobal("navigator", dom.window.navigator);
  setGlobal("HTMLElement", dom.window.HTMLElement);
  setGlobal("Node", dom.window.Node);
  setGlobal("Event", dom.window.Event);
  setGlobal("MouseEvent", dom.window.MouseEvent);
  setGlobal("getComputedStyle", dom.window.getComputedStyle.bind(dom.window));
  setGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0));
  setGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  setGlobal("sessionStorage", dom.window.sessionStorage);
  setGlobal("localStorage", dom.window.localStorage);
  setGlobal("IS_REACT_ACT_ENVIRONMENT", true);

  const { indexedDB } = await import("fake-indexeddb");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });

  // Neither Node nor jsdom implements object URLs; the download path only needs
  // to know that a URL was created for the PDF blob.
  const createdUrls: string[] = [];
  const createObjectURL = () => {
    const url = `blob:labeltrim/${createdUrls.length}`;
    createdUrls.push(url);
    return url;
  };
  for (const target of [URL, dom.window.URL]) {
    Object.defineProperty(target, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(target, "revokeObjectURL", { configurable: true, value: () => {} });
  }

  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { createElement: h } = await import("react");
  const App = (await import("../src/App")).default;
  const session = await import("../src/lib/session");

  /**
   * Pretend this document load was (or was not) a browser reload of the same
   * tab. Only the navigation entry is stubbed — React needs the real
   * `performance.measure`/`now` while rendering.
   */
  const realPerformance = globalThis.performance;
  function simulateReloadNavigation(reload: boolean): void {
    Object.defineProperty(realPerformance, "getEntriesByType", {
      configurable: true,
      value: () => [{ type: reload ? "reload" : "navigate" }],
    });
  }

  /**
   * Simulate one document load: a brand-new React tree on the same origin.
   * `freshTab` wipes sessionStorage first (a new tab); otherwise the tab marker
   * survives, exactly as it does across a real reload.
   */
  async function loadApp(options: { freshTab?: boolean } = {}) {
    if (options.freshTab !== false) sessionStorage.clear();
    dom.window.document.body.innerHTML = '<div id="root"></div>';
    const container = dom.window.document.getElementById("root") as unknown as HTMLElement;
    const root = createRoot(container);
    await act(async () => {
      root.render(h(App));
    });
    // Let IndexedDB open/read resolve and the restored state re-render.
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 12));
      });
    }
    return {
      text: () => container.textContent ?? "",
      html: () => container.innerHTML,
      click: async (label: string) => {
        const buttons = Array.from(container.querySelectorAll("button"));
        const target = buttons.find((b) => (b.textContent ?? "").includes(label));
        assert.ok(target, `button “${label}” is on screen`);
        await act(async () => {
          target.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
        });
        for (let i = 0; i < 6; i++) {
          await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 12));
          });
        }
      },
      unmount: () => act(() => root.unmount()),
    };
  }

  /* ---------------------------------------- scenario 0: nothing saved yet */
  console.log("Fresh visit, nothing saved");
  simulateReloadNavigation(true);
  {
    const app = await loadApp();
    ok(app.text().includes("Drop your label PDF here"), "no saved batch → normal upload screen");
    no(app.text().includes("Batch restored"), "nothing is claimed to be restored");
    app.unmount();
  }

  /* ---------------------- scenario 1: saved batch, page reloaded underneath */
  console.log("\nSaved batch + page reload");
  await session.saveSource("flipkart-batch-2-orders.pdf", SOURCE_BYTES, RAW_PAGES);
  await session.saveMeta({ left: 186, right: 408, topGap: 24, anchorOffset: 16 }, 1, "done");
  await session.saveOutput(OUTPUT_INFO, OUTPUT_BYTES);
  simulateReloadNavigation(true);
  {
    const app = await loadApp();
    ok(app.text().includes("Batch restored"), "the reload puts the finished batch back");
    ok(app.text().includes("flipkart-batch-2-orders.pdf"), "the restored batch is named");
    no(app.text().includes("Drop your label PDF here"), "the upload screen is NOT shown again");
    ok(app.text().includes("2 thermal labels ready"), "the restored converted PDF is still “ready”");
    ok(app.text().includes("Download again"), "the restored PDF can be downloaded again");
    ok(app.text().includes("nothing was uploaded") || app.text().includes("Nothing was uploaded"), "privacy promise repeated");

    const preview = /data-preview[^>]*data-bytes="(\d+)"[^>]*data-page="(\d+)"[^>]*data-plans="(\d+)"/.exec(
      app.html(),
    );
    ok(preview !== null, "the crop preview is rebuilt from the restored source bytes");
    eq(preview?.[1], String(SOURCE_BYTES.byteLength), "preview received the full source PDF");
    eq(preview?.[2], "1", "the page the user was reviewing is restored");
    eq(preview?.[3], String(RAW_PAGES.length), "preview received the restored crop plan");

    const before = createdUrls.length;
    await app.click("Download again");
    eq(createdUrls.length, before + 1, "Download again re-creates the PDF download after a reload");
    app.unmount();
  }

  /* --------------------------------- scenario 2: earlier visit, no reload */
  console.log("\nSaved batch + fresh visit (no reload)");
  simulateReloadNavigation(false);
  {
    const app = await loadApp();
    ok(app.text().includes("Unfinished batch in this browser"), "a fresh visit offers the saved batch");
    ok(app.text().includes("flipkart-batch-2-orders.pdf"), "the offered batch is named");
    ok(app.text().includes("Drop your label PDF here"), "the upload screen stays available");
    no(app.text().includes("Batch restored"), "nothing is restored without a reload");

    await app.click("Resume batch");
    ok(app.text().includes("2 thermal labels ready"), "Resume batch opens the converted batch");
    ok(app.text().includes("Download again"), "…with its download intact");
    app.unmount();
  }

  /* -------------------------------- scenario 3: returning tab, no signal */
  console.log("\nReturning tab (same sessionStorage)");
  {
    const first = await loadApp();
    first.unmount();
    const again = await loadApp({ freshTab: false });
    ok(again.text().includes("Batch restored"), "a returning tab restores instead of asking again");
    again.unmount();
  }

  /* -------------------------------- scenario 4: Start a new batch wipes it */
  console.log("\nStart a new batch");
  simulateReloadNavigation(true);
  {
    const app = await loadApp();
    ok(app.text().includes("Batch restored"), "batch is back after the reload");
    await app.click("Start a new batch");
    ok(app.text().includes("Drop your label PDF here"), "Start a new batch returns to the upload screen");
    eq(await session.loadSession(), null, "Start a new batch wipes the saved batch");

    const reloaded = await loadApp();
    ok(reloaded.text().includes("Drop your label PDF here"), "a later reload no longer restores it");
    no(reloaded.text().includes("Batch restored"), "…and claims nothing");
    reloaded.unmount();
    app.unmount();
  }

  delete (realPerformance as unknown as Record<string, unknown>).getEntriesByType;

  console.log(`\nreload recovery: ${passed} checks passed`);
  console.log("NOTE: jsdom asserts state and markup — pixel layout and pdf.js canvas output");
  console.log("      still need a real browser (see README testing notes).");
}

main().then(
  () => process.stdout.write("", () => process.exit(0)),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
