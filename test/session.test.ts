/**
 * Reload-recovery test (Node + fake-indexeddb).
 *
 * The reported bug: after a batch is converted and downloaded, the page can be
 * reloaded underneath the user (tab discarded under memory pressure, crashed
 * renderer, dev-server reload, stray F5) and the tool used to drop straight
 * back to the upload screen, losing the crop plan and the converted PDF.
 *
 * These checks exercise the real storage module:
 *   1. graceful degradation when IndexedDB is missing (Node, private modes,
 *      Chrome's `file://` denial) — nothing may throw,
 *   2. a full save → reload → restore round-trip (source, crop plan,
 *      calibration, page index, converted PDF),
 *   3. invalidation: a new upload drops the old output, `clearSession()` wipes
 *      everything, stale/foreign records are ignored,
 *   4. the reload/tab heuristics that decide between "silently restore" and
 *      "offer to resume".
 */
import assert from "node:assert/strict";

let passed = 0;
function ok(cond: unknown, msg: string): void {
  assert.ok(cond, msg);
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
    hasTextLayer: false,
    anchorY: null,
    anchorText: null,
  },
];

const SOURCE_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 1, 2, 3, 4]);
const OUTPUT_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 9, 8, 7, 6, 5]);
const OUTPUT_INFO = {
  filename: "labeltrim-4x6-batch-2pages.pdf",
  sizeBytes: OUTPUT_BYTES.byteLength,
  pageCount: 2,
};

async function main(): Promise<void> {
  // Import after the globals below are arranged — the module reads `indexedDB`
  // lazily, but keeping the order explicit makes the "no storage" case honest.
  const session = await import("../src/lib/session");
  const { formatSavedAt } = await import("../src/lib/utils");

  /* ------------------------------------------------- no IndexedDB (fallback) */
  delete (globalThis as { indexedDB?: unknown }).indexedDB;
  ok(
    typeof (globalThis as { indexedDB?: unknown }).indexedDB === "undefined",
    "start from a runtime without IndexedDB (Node default)"
  );
  eq(await session.loadSession(), null, "loadSession() resolves null instead of throwing");
  await session.saveSource("batch.pdf", SOURCE_BYTES, RAW_PAGES);
  await session.saveMeta({ left: 186, right: 408, topGap: 24, anchorOffset: 16 }, 0, "ready");
  await session.saveOutput(OUTPUT_INFO, OUTPUT_BYTES);
  await session.clearSession();
  ok(true, "saveSource/saveMeta/saveOutput/clearSession stay silent no-ops");

  /* ------------------------------------------------ storage that throws hard */
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    get() {
      throw new Error("SecurityError: IndexedDB denied in this context");
    },
  });
  eq(await session.loadSession(), null, "a throwing indexedDB getter is contained");
  await session.saveSource("batch.pdf", SOURCE_BYTES, RAW_PAGES);
  ok(true, "saving against a throwing indexedDB getter does not reject");

  /* ------------------------------------- localStorage backend (file:// pages) */
  // Chrome denies IndexedDB to file:// documents, so the standalone build has
  // to fall back to localStorage — same records, base64 payloads.
  const lsData = new Map<string, string>();
  let lsQuota = Infinity;
  const fakeLocalStorage = {
    getItem: (k: string) => (lsData.has(k) ? (lsData.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      if (v.length > lsQuota) {
        const err = new Error("QuotaExceededError");
        err.name = "QuotaExceededError";
        throw err;
      }
      lsData.set(k, v);
    },
    removeItem: (k: string) => void lsData.delete(k),
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: fakeLocalStorage });

  await session.saveSource("file-url-batch.pdf", SOURCE_BYTES, RAW_PAGES);
  let lsSnapshot = await session.loadSession();
  assert.ok(lsSnapshot, "localStorage backend: the batch is found without IndexedDB");
  eq(lsSnapshot.fileName, "file-url-batch.pdf", "localStorage backend: file name survives");
  eq(Array.from(lsSnapshot.source), Array.from(SOURCE_BYTES), "localStorage backend: PDF bytes round-trip through base64");
  eq(lsSnapshot.rawPages, RAW_PAGES, "localStorage backend: crop plan survives");
  ok(
    Array.from(lsData.keys()).every((k) => k.startsWith("labeltrim:session:")),
    "localStorage backend: keys are namespaced"
  );

  await session.saveOutput(OUTPUT_INFO, OUTPUT_BYTES);
  lsSnapshot = await session.loadSession();
  assert.ok(lsSnapshot);
  eq(lsSnapshot.phase, "done", "localStorage backend: converted PDF is restored too");
  eq(
    Array.from(lsSnapshot.outputBytes ?? []),
    Array.from(OUTPUT_BYTES),
    "localStorage backend: converted bytes survive base64"
  );

  // A quota failure must not leave a half-written session claiming a PDF.
  await session.clearSession();
  await session.saveSource("small-batch.pdf", SOURCE_BYTES, RAW_PAGES);
  const sourceRecordSize = (lsData.get("labeltrim:session:source") ?? "").length;
  ok(sourceRecordSize > 0, "localStorage backend: the source record is stored");
  // A realistic converted PDF (hundreds of KB, base64-inflated) cannot fit once
  // the quota is this low, while the small meta record still can.
  const bulkyOutput = new Uint8Array(512).fill(1);
  lsQuota = 400;
  ok(sourceRecordSize < lsQuota, "localStorage backend: the stored source fits under the quota");
  await session.saveOutput({ ...OUTPUT_INFO, sizeBytes: bulkyOutput.length }, bulkyOutput);
  await session.saveMeta({ left: 186, right: 408, topGap: 24, anchorOffset: 16 }, 0, "done");
  lsSnapshot = await session.loadSession();
  assert.ok(lsSnapshot);
  eq(lsSnapshot.output, null, "localStorage backend: a failed output write is not claimed");
  eq(lsSnapshot.phase, "ready", "localStorage backend: phase follows what is really stored");

  await session.clearSession();
  eq(lsData.size, 0, "localStorage backend: clearSession removes every record");
  lsQuota = Infinity;
  delete (globalThis as { localStorage?: unknown }).localStorage;

  /* ------------------------------------------------------ real round-trip */
  const { indexedDB } = await import("fake-indexeddb");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: indexedDB });

  await session.saveSource("flipkart-batch-42-orders.pdf", SOURCE_BYTES, RAW_PAGES);
  let snapshot = await session.loadSession();
  assert.ok(snapshot, "loadSession() finds the saved batch");
  eq(snapshot.fileName, "flipkart-batch-42-orders.pdf", "file name survives the reload");
  eq(Array.from(snapshot.source), Array.from(SOURCE_BYTES), "source PDF bytes survive byte-for-byte");
  eq(snapshot.rawPages, RAW_PAGES, "per-page analysis (the crop plan input) survives");
  eq(snapshot.phase, "ready", "a batch without a converted PDF restores as 'ready'");
  eq(snapshot.output, null, "no output record yet");
  eq(
    snapshot.calibration,
    { left: 186, right: 408, topGap: 24, anchorOffset: 16 },
    "calibration falls back to the calibrated defaults"
  );

  await session.saveMeta({ left: 190, right: 410, topGap: 20, anchorOffset: 18 }, 1, "ready");
  snapshot = await session.loadSession();
  assert.ok(snapshot);
  eq(snapshot.calibration, { left: 190, right: 410, topGap: 20, anchorOffset: 18 }, "advanced crop adjustments persist");
  eq(snapshot.pageIndex, 1, "the page the user was reviewing persists");

  await session.saveOutput(OUTPUT_INFO, OUTPUT_BYTES);
  await session.saveMeta({ left: 190, right: 410, topGap: 20, anchorOffset: 18 }, 1, "done");
  snapshot = await session.loadSession();
  assert.ok(snapshot);
  eq(snapshot.phase, "done", "a converted batch restores on the success screen");
  eq(snapshot.output, OUTPUT_INFO, "the output metadata (.pdf name/size/pages) survives");
  assert.ok(snapshot.outputBytes, "the converted PDF itself survives");
  eq(Array.from(snapshot.outputBytes), Array.from(OUTPUT_BYTES), "converted PDF bytes survive byte-for-byte");
  ok(snapshot.savedAt > 0, "the snapshot carries a saved-at timestamp for the notice copy");

  /* ---------------------------------------------------------- invalidation */
  await session.saveSource("next-batch.pdf", SOURCE_BYTES, RAW_PAGES);
  snapshot = await session.loadSession();
  assert.ok(snapshot);
  eq(snapshot.fileName, "next-batch.pdf", "a new upload replaces the old batch");
  eq(snapshot.output, null, "a new upload drops the previous batch's converted PDF");
  eq(snapshot.phase, "ready", "…and lands back on the review screen");

  await session.clearSession();
  eq(await session.loadSession(), null, "clearSession() (Start a new batch) removes everything");

  /* --------------------------------------------- stale / foreign records */
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("labeltrim", 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const put = (key: string, value: unknown) =>
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction("session", "readwrite");
      tx.objectStore("session").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

  await put("source", {
    schema: 2,
    savedAt: Date.now() - 13 * 60 * 60 * 1000, // older than SESSION_TTL_MS
    fileName: "yesterday.pdf",
    source: SOURCE_BYTES,
    rawPages: RAW_PAGES,
  });
  eq(await session.loadSession(), null, "a batch older than the 12 h TTL is not resurrected");

  await put("source", {
    schema: 999, // written by an incompatible build
    savedAt: Date.now(),
    fileName: "other-build.pdf",
    source: SOURCE_BYTES,
    rawPages: RAW_PAGES,
  });
  eq(await session.loadSession(), null, "a record from another schema version is ignored");

  await put("source", {
    schema: 2,
    savedAt: Date.now(),
    fileName: "corrupt.pdf",
    source: null,
    rawPages: RAW_PAGES,
  });
  eq(await session.loadSession(), null, "a record whose bytes are missing is ignored");

  await put("source", {
    schema: 2,
    savedAt: Date.now(),
    fileName: "half-written.pdf",
    source: SOURCE_BYTES,
    rawPages: [],
  });
  eq(await session.loadSession(), null, "a source record without analysis is ignored");
  await session.clearSession();

  // An "output" with no source (e.g. the source write failed on quota) must not
  // produce a phantom success screen.
  await put("output", { schema: 2, savedAt: Date.now(), output: OUTPUT_INFO, outputBytes: OUTPUT_BYTES });
  eq(await session.loadSession(), null, "an orphaned converted PDF is ignored");
  await session.clearSession();

  /* -------------------------------------------------------- tab heuristics */
  // Node has no sessionStorage: the helper must degrade to "fresh visit".
  eq(session.continuesTabSession(), false, "no sessionStorage → treated as a fresh visit");

  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (storage.has(k) ? (storage.get(k) as string) : null),
      setItem: (k: string, v: string) => void storage.set(k, v),
    },
  });
  eq(session.continuesTabSession(), false, "first load in a tab is a fresh visit");
  eq(session.continuesTabSession(), true, "a reload in the same tab is recognised");
  storage.clear();
  eq(session.continuesTabSession(), false, "a new tab (empty sessionStorage) is a fresh visit");
  delete (globalThis as { sessionStorage?: unknown }).sessionStorage;

  // PerformanceNavigationTiming — the primary reload signal.
  const realPerformance = globalThis.performance;
  const stubPerformance = (type: string | null, throws = false) => {
    Object.defineProperty(realPerformance, "getEntriesByType", {
      configurable: true,
      value: () => {
        if (throws) throw new Error("not supported");
        return type === null ? [] : [{ type }];
      },
    });
  };
  stubPerformance("reload");
  eq(session.looksLikeReload(), true, "a reload navigation is detected");
  stubPerformance("navigate");
  eq(session.looksLikeReload(), false, "a fresh navigation is not a reload");
  stubPerformance("back_forward");
  eq(session.looksLikeReload(), false, "back/forward is not treated as a reload");
  stubPerformance(null);
  eq(session.looksLikeReload(), false, "missing navigation entries degrade to 'not a reload'");
  stubPerformance(null, true);
  eq(session.looksLikeReload(), false, "a throwing performance API is contained");
  delete (realPerformance as unknown as Record<string, unknown>).getEntriesByType;

  /* ------------------------------------------------------------ notice copy */
  const now = Date.UTC(2026, 9, 30, 12, 0, 0);
  eq(formatSavedAt(now - 5_000, now), "just now", "saved 5 s ago reads 'just now'");
  eq(formatSavedAt(now - 4 * 60_000, now), "4 minutes ago", "saved 4 min ago reads '4 minutes ago'");
  eq(formatSavedAt(now - 2 * 60 * 60_000, now), "2 hours ago", "saved 2 h ago reads '2 hours ago'");
  eq(formatSavedAt(now - 3 * 24 * 60 * 60_000, now), "3 days ago", "saved 3 days ago reads '3 days ago'");

  console.log(`\nsession: ${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
