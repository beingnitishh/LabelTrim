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

export function downloadBytes(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15_000);
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
