import { IconCheck, IconRefresh, IconShield, IconX } from "./Icons";
import { Alert } from "./Ui";
import { formatSavedAt } from "../lib/utils";

/**
 * Reload-recovery banner.
 *
 * `restored`  — the page reloaded underneath the user (tab discarded under
 *               memory pressure, crashed renderer, dev-server reload, stray
 *               refresh) and their batch was put back automatically.
 * `resumable` — a saved batch exists but this is a fresh visit, so we ask
 *               instead of hijacking the upload screen.
 *
 * Both never claim more than is true: the bytes live in this browser's
 * IndexedDB, nothing was uploaded.
 */
export default function RestoreNotice({
  variant,
  fileName,
  savedAt,
  hasOutput,
  onResume,
  onDiscard,
  onDismiss,
}: {
  variant: "restored" | "resumable";
  fileName: string;
  savedAt: number;
  hasOutput: boolean;
  onResume?: () => void;
  onDiscard?: () => void;
  onDismiss?: () => void;
}) {
  const when = formatSavedAt(savedAt);

  if (variant === "restored") {
    return (
      <Alert
        tone="ok"
        role="status"
        icon={<IconCheck width={16} height={16} />}
        title="Batch restored — the page reloaded"
        onDismiss={onDismiss}
      >
        <p>
          LabelTrim found <strong>{fileName}</strong> saved in this browser ({when}) and put your crop
          plan back exactly where you left it. Nothing was uploaded or sent anywhere.
        </p>
        {hasOutput ? (
          <p style={{ marginTop: 6 }}>
            Your converted 4 × 6 PDF is still ready — use “Download again” if the file never reached
            your downloads folder.
          </p>
        ) : (
          <p style={{ marginTop: 6 }}>
            The scan is intact, so you can convert straight to 4 × 6 without uploading again.
          </p>
        )}
      </Alert>
    );
  }

  return (
    <Alert
      tone="info"
      role="status"
      icon={<IconShield width={16} height={16} />}
      title="Unfinished batch in this browser"
      onDismiss={onDismiss}
    >
      <p>
        <strong>{fileName}</strong> was saved on this device {when} and never finished. It stays in
        this browser only — resume it, or discard it and start fresh.
      </p>
      <div className="btn-row" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn--primary" onClick={onResume}>
          <IconRefresh width={16} height={16} />
          Resume batch
        </button>
        <button type="button" className="btn btn--quiet" onClick={onDiscard}>
          <IconX width={16} height={16} />
          Discard
        </button>
      </div>
    </Alert>
  );
}
