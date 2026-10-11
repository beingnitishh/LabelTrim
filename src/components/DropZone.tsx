import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { IconFileText, IconUpload, IconZap } from "./Icons";

interface DropZoneProps {
  onFile: (file: File) => void;
  /** Existing demo-batch generator (src/lib/demo.ts) — unchanged. */
  onDemo: () => void;
}

/**
 * The drop card is a plain drop target — the interactive elements inside it are
 * real <button>s, so keyboard and screen-reader users get exactly two labelled
 * actions ("Choose PDF" and "Try a sample PDF") instead of a fake button role.
 */
export default function DropZone({ onFile, onDemo }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      className={`dropzone${dragging ? " dropzone--dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      aria-describedby="lt-drop-help"
    >
      <span className="dropzone__icon" aria-hidden="true">
        <IconUpload width={28} height={28} />
      </span>

      <h2 className="dropzone__title">Drop your label PDF here</h2>
      <p className="dropzone__text" id="lt-drop-help">
        Upload the <strong>combined A4 label + invoice PDF</strong> you download from Flipkart Seller
        Hub (<strong>Orders → Print Label</strong>). Every order page is cropped to its shipping label
        and merged into one 4 × 6 PDF.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="visually-hidden"
        id="lt-file-input"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="dropzone__actions">
        <button
          type="button"
          className="btn btn--primary btn--lg"
          onClick={() => inputRef.current?.click()}
        >
          <IconFileText width={17} height={17} />
          Choose PDF
        </button>
        <button type="button" className="btn btn--soft btn--lg" onClick={onDemo}>
          <IconZap width={16} height={16} />
          Try a sample PDF
        </button>
      </div>

      <div className="dropzone__meta">
        <span className="badge badge--neutral">PDF only · .pdf</span>
        <span className="badge badge--neutral">Any number of orders</span>
      </div>

      <p className="dropzone__tip">
        Drag and drop works anywhere on this card. Files are read locally — nothing is uploaded.
      </p>
    </div>
  );
}
