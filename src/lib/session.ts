import type { Calibration, OutputInfo, RawPage } from "./types";
import { DEFAULT_CALIBRATION } from "./calibration";

/**
 * Reload-proof session storage.
 *
 * Every byte already stays on the device, so this module adds no network path:
 * it writes the *current* batch to this origin's local storage so an unexpected
 * page load — a browser tab discarded under memory pressure, a crashed
 * renderer, a dev-server reload, a stray F5 — can no longer throw away a
 * finished crop plan or an already-converted PDF. The user comes back to the
 * same screen and can hit “Download again”.
 *
 * Two backends, same records:
 *  - IndexedDB (preferred, effectively unlimited) for http(s) pages;
 *  - localStorage (base64, ~5 MB) because Chrome denies IndexedDB to `file://`
 *    documents — which is exactly how `standalone/labeltrim.html` is opened.
 *    Small and medium batches still survive a reload there; larger ones simply
 *    are not cached.
 *
 * Design rules:
 *  - Three small records (`source`, `meta`, `output`) so the frequently written
 *    one (page index, calibration, phase) never re-encodes the PDFs.
 *  - Every entry point swallows its own errors: private windows, `file://`
 *    denial and quota failures must leave the tool fully working, just without
 *    reload recovery.
 *  - Records carry a schema version and expire, so a stale batch from another
 *    build or another day is never resurrected silently.
 */

const DB_NAME = "labeltrim";
const DB_VERSION = 1;
const STORE = "session";
const LS_PREFIX = "labeltrim:session:";

/** Bump to invalidate records written by an incompatible build. */
const SCHEMA = 2;

/** A saved batch older than this is never restored automatically. */
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

/** Refuse to persist gigantic batches. */
const MAX_RECORD_BYTES = 96 * 1024 * 1024;

/** localStorage holds ~5 MB of characters; base64 costs 4/3 per byte. */
const MAX_LOCAL_STORAGE_BYTES = 3 * 1024 * 1024;

const KEY_SOURCE = "source";
const KEY_META = "meta";
const KEY_OUTPUT = "output";

const TAB_MARKER = "labeltrim:tab-session";

interface SourceRecord {
  schema: number;
  savedAt: number;
  fileName: string;
  source: Uint8Array;
  rawPages: RawPage[];
}

interface MetaRecord {
  schema: number;
  savedAt: number;
  calibration: Calibration;
  pageIndex: number;
  phase: "ready" | "done";
}

interface OutputRecord {
  schema: number;
  savedAt: number;
  output: OutputInfo;
  outputBytes: Uint8Array;
}

/** Everything needed to rebuild the review screen after a reload. */
export interface SessionSnapshot {
  fileName: string;
  source: Uint8Array;
  rawPages: RawPage[];
  calibration: Calibration;
  pageIndex: number;
  phase: "ready" | "done";
  output: OutputInfo | null;
  outputBytes: Uint8Array | null;
  /** Newest timestamp among the records, for the “saved 4 minutes ago” copy. */
  savedAt: number;
}

/* ------------------------------------------------------------- IndexedDB glue */

let dbPromise: Promise<IDBDatabase | null> | null = null;

function indexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    // Chrome throws a SecurityError for file:// and sandboxed documents.
    return false;
  }
}

function openDb(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    let settled = false;
    let guard: ReturnType<typeof setTimeout> | undefined;
    const finish = (db: IDBDatabase | null) => {
      if (settled) return;
      settled = true;
      if (guard !== undefined) clearTimeout(guard);
      resolve(db);
    };

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading the schema must not leave us holding a dead handle.
        db.onversionchange = () => {
          try {
            db.close();
          } catch {
            /* ignore */
          }
          dbPromise = null;
        };
        finish(db);
      };
      request.onerror = () => finish(null);
      request.onblocked = () => finish(null);
      // A browser that never fires either event must not hang the app.
      guard = setTimeout(() => finish(null), 4000);
    } catch {
      finish(null);
    }
  });

  return dbPromise;
}

function readIdb<T>(key: string): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) return resolve(null);
        try {
          const tx = db.transaction(STORE, "readonly");
          const request = tx.objectStore(STORE).get(key);
          request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
          request.onerror = () => resolve(null);
          tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

function writeIdb(key: string, value: unknown): Promise<boolean> {
  return openDb().then(
    (db) =>
      new Promise<boolean>((resolve) => {
        if (!db) return resolve(false);
        try {
          const tx = db.transaction(STORE, "readwrite");
          tx.objectStore(STORE).put(value, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
          tx.onabort = () => resolve(false);
        } catch {
          resolve(false);
        }
      })
  );
}

function deleteIdb(keys: string[]): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise<void>((resolve) => {
        if (!db) return resolve();
        try {
          const tx = db.transaction(STORE, "readwrite");
          const store = tx.objectStore(STORE);
          for (const key of keys) store.delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch {
          resolve();
        }
      })
  );
}

/* --------------------------------------------------------- localStorage glue */

function localStorageAvailable(): boolean {
  try {
    const probe = `${LS_PREFIX}probe`;
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    binary += String.fromCharCode.apply(null, Array.from(slice));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function readLs(key: string): unknown {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (key === KEY_SOURCE) parsed.source = fromBase64(String(parsed.source ?? ""));
    if (key === KEY_OUTPUT) parsed.outputBytes = fromBase64(String(parsed.outputBytes ?? ""));
    return parsed;
  } catch {
    return null;
  }
}

function writeLs(key: string, value: Record<string, unknown>): boolean {
  try {
    const record = { ...value };
    if (key === KEY_SOURCE) record.source = toBase64(value.source as Uint8Array);
    if (key === KEY_OUTPUT) record.outputBytes = toBase64(value.outputBytes as Uint8Array);
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(record));
    return true;
  } catch {
    // QuotaExceededError (or storage disabled) — caching is best-effort.
    return false;
  }
}

function deleteLs(keys: string[]): void {
  try {
    for (const key of keys) localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}

/* --------------------------------------------------------------- dispatching */

type Backend = "idb" | "local" | "none";

async function activeBackend(): Promise<Backend> {
  const db = await openDb();
  if (db) return "idb";
  return localStorageAvailable() ? "local" : "none";
}

async function readRecord<T>(key: string): Promise<T | null> {
  const backend = await activeBackend();
  if (backend === "idb") return readIdb<T>(key);
  if (backend === "local") return readLs(key) as T | null;
  return null;
}

async function writeRecord(key: string, value: unknown): Promise<boolean> {
  const backend = await activeBackend();
  if (backend === "idb") return writeIdb(key, value);
  if (backend === "local") return writeLs(key, value as Record<string, unknown>);
  return false;
}

async function deleteRecords(keys: string[]): Promise<void> {
  const backend = await activeBackend();
  if (backend === "idb") await deleteIdb(keys);
  if (backend === "local") deleteLs(keys);
}

/* ---------------------------------------------------------------- validation */

function isFresh<T extends { schema?: number; savedAt?: number }>(record: T | null): record is T {
  if (!record) return false;
  if (record.schema !== SCHEMA) return false;
  const savedAt = record.savedAt;
  if (typeof savedAt !== "number" || !Number.isFinite(savedAt)) return false;
  const age = Date.now() - savedAt;
  return age >= 0 && age <= SESSION_TTL_MS;
}

function isCalibration(value: unknown): value is Calibration {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.left === "number" &&
    typeof c.right === "number" &&
    typeof c.topGap === "number" &&
    typeof c.anchorOffset === "number"
  );
}

function isBytes(value: unknown): value is Uint8Array {
  return value instanceof Uint8Array && value.byteLength > 0;
}

/* ---------------------------------------------------------------- public API */

/**
 * Read the saved batch, or `null` when there is nothing trustworthy to restore.
 * Never throws and never rejects.
 */
export async function loadSession(): Promise<SessionSnapshot | null> {
  try {
    const [sourceRecord, metaRecord, outputRecord] = await Promise.all([
      readRecord<SourceRecord>(KEY_SOURCE),
      readRecord<MetaRecord>(KEY_META),
      readRecord<OutputRecord>(KEY_OUTPUT),
    ]);

    const hadSomething = Boolean(sourceRecord || metaRecord || outputRecord);

    const usableSource =
      isFresh(sourceRecord) &&
      isBytes(sourceRecord.source) &&
      Array.isArray(sourceRecord.rawPages) &&
      sourceRecord.rawPages.length > 0;

    if (!usableSource) {
      // Expired / half-written / foreign records are worse than nothing: they
      // would resurrect a stale batch on the next load.
      if (hadSomething) await deleteRecords([KEY_SOURCE, KEY_META, KEY_OUTPUT]);
      return null;
    }

    const meta = isFresh(metaRecord) ? metaRecord : null;
    // saveSource() deletes the output record, so a present one belongs to this
    // source. Phase is derived from what actually exists, never trusted blindly.
    const output = isFresh(outputRecord) && isBytes(outputRecord.outputBytes) ? outputRecord : null;

    return {
      fileName: typeof sourceRecord.fileName === "string" ? sourceRecord.fileName : "batch.pdf",
      source: sourceRecord.source,
      rawPages: sourceRecord.rawPages,
      calibration:
        meta && isCalibration(meta.calibration) ? meta.calibration : { ...DEFAULT_CALIBRATION },
      pageIndex:
        meta && Number.isFinite(meta.pageIndex) ? Math.max(0, Math.floor(meta.pageIndex)) : 0,
      phase: output ? "done" : "ready",
      output: output ? output.output : null,
      outputBytes: output ? output.outputBytes : null,
      savedAt: Math.max(
        sourceRecord.savedAt,
        meta ? meta.savedAt : 0,
        output ? output.savedAt : 0
      ),
    };
  } catch {
    return null;
  }
}

/** Persist the uploaded source PDF + its analysis. Replaces any older batch. */
export async function saveSource(
  fileName: string,
  source: Uint8Array,
  rawPages: RawPage[]
): Promise<void> {
  try {
    const backend = await activeBackend();
    const limit = backend === "local" ? MAX_LOCAL_STORAGE_BYTES : MAX_RECORD_BYTES;
    if (
      !isBytes(source) ||
      rawPages.length === 0 ||
      source.byteLength > limit ||
      backend === "none"
    ) {
      if (backend !== "none") await deleteRecords([KEY_SOURCE, KEY_META, KEY_OUTPUT]);
      return;
    }

    const record: SourceRecord = {
      schema: SCHEMA,
      savedAt: Date.now(),
      fileName,
      source,
      rawPages,
    };
    const ok = await writeRecord(KEY_SOURCE, record);
    if (ok) {
      await deleteRecords([KEY_OUTPUT]);
    } else {
      // Could not cache the source: leave no half-session behind.
      await deleteRecords([KEY_SOURCE, KEY_META, KEY_OUTPUT]);
    }
  } catch {
    /* storage is best-effort */
  }
}

/** Persist the cheap, frequently-changing bits (calibration, page, phase). */
export async function saveMeta(
  calibration: Calibration,
  pageIndex: number,
  phase: "ready" | "done"
): Promise<void> {
  try {
    const record: MetaRecord = {
      schema: SCHEMA,
      savedAt: Date.now(),
      calibration,
      pageIndex,
      phase,
    };
    await writeRecord(KEY_META, record);
  } catch {
    /* storage is best-effort */
  }
}

/** Persist the converted 4×6 PDF so “Download again” still works after a reload. */
export async function saveOutput(output: OutputInfo, outputBytes: Uint8Array): Promise<void> {
  try {
    const backend = await activeBackend();
    const limit = backend === "local" ? MAX_LOCAL_STORAGE_BYTES : MAX_RECORD_BYTES;
    if (!isBytes(outputBytes) || outputBytes.byteLength > limit) return;
    const record: OutputRecord = {
      schema: SCHEMA,
      savedAt: Date.now(),
      output,
      outputBytes,
    };
    await writeRecord(KEY_OUTPUT, record);
  } catch {
    /* storage is best-effort */
  }
}

/** Wipe everything (new batch, discard, or after a failure). */
export async function clearSession(): Promise<void> {
  try {
    await deleteRecords([KEY_SOURCE, KEY_META, KEY_OUTPUT]);
  } catch {
    /* storage is best-effort */
  }
}

/**
 * True when this document load is a reload of the same page: F5, a dev-server
 * full reload, or the browser re-creating a discarded/crashed tab. That is the
 * signal for “the page went away underneath the user, put their batch back”.
 * A plain first navigation is not.
 */
export function looksLikeReload(): boolean {
  try {
    const entries = performance.getEntriesByType?.("navigation") as
      | PerformanceNavigationTiming[]
      | undefined;
    if (entries && entries.length > 0) return entries[0].type === "reload";

    // Older/limited environments: deprecated but harmless fallback.
    const legacy = (performance as unknown as { navigation?: { type?: number } }).navigation;
    return legacy?.type === 1;
  } catch {
    return false;
  }
}

/**
 * True when this tab already ran LabelTrim. `sessionStorage` is per-tab and
 * survives reloads but not new tabs/windows — exactly the distinction we need
 * between “the page reloaded under me” (restore silently) and “I opened the app
 * again” (offer to resume).
 */
export function continuesTabSession(): boolean {
  try {
    const seen = sessionStorage.getItem(TAB_MARKER);
    sessionStorage.setItem(TAB_MARKER, String(Date.now()));
    return seen !== null;
  } catch {
    return false;
  }
}
