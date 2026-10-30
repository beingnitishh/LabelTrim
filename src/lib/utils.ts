export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function safeBaseName(name: string): string {
  return (
    name
      .replace(/\.pdf$/i, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "batch"
  );
}

/**
 * Blob URLs still referenced by a download that the browser has not finished
 * writing. Revoking one of these mid-flight aborts the download, so a URL is
 * only released after a long backstop (or never — the document itself frees
 * every object URL when it unloads).
 */
const liveDownloads = new Set<string>();
const DOWNLOAD_URL_TTL_MS = 5 * 60 * 1000;
/** Safety valve: repeated “Download again” clicks must not pile up blobs. */
const MAX_LIVE_DOWNLOADS = 4;

function releaseUrl(url: string): void {
  liveDownloads.delete(url);
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* the document is gone; the browser already cleaned up */
  }
}

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();

  liveDownloads.add(url);
  while (liveDownloads.size > MAX_LIVE_DOWNLOADS) {
    const oldest = liveDownloads.values().next().value;
    if (oldest === undefined) break;
    releaseUrl(oldest);
  }

  // A big batch can take far longer than a few seconds to reach disk (slow
  // drive, antivirus scan). Revoking too early kills the transfer, so keep the
  // URL alive well past any realistic download and only then recycle it.
  setTimeout(() => {
    if (liveDownloads.has(url)) releaseUrl(url);
  }, DOWNLOAD_URL_TTL_MS);
}

/** "just now", "4 minutes ago", … — used by the reload-recovery notice. */
export function formatSavedAt(savedAt: number, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - savedAt) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function friendlyError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  const msg = err instanceof Error ? err.message : String(err);
  if (name === "PasswordException") {
    return "This PDF is password-protected. Remove the password before uploading.";
  }
  if (name === "InvalidPDFException" || /Invalid PDF/i.test(msg)) {
    return "That file doesn't look like a readable PDF. Double-check the download from Flipkart Seller Hub.";
  }
  if (/no such file|cannot read/i.test(msg)) return msg;
  return `Couldn't process this PDF: ${msg || "unknown error"}`;
}
