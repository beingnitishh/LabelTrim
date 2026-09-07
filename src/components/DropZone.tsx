import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { IconFileText, IconUpload, IconZap } from "./Icons";

interface DropZoneProps {
  onFile: (file: File) => void;
  onDemo: () => void;
  busy: boolean;
}

export default function DropZone({ onFile, onDemo, busy }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`group relative cursor-pointer rounded-3xl border-2 border-dashed p-10 text-center outline-none transition-all duration-200 sm:p-14 ${
        dragging
          ? "border-fk bg-fk/10 shadow-[0_0_60px_-12px_rgba(40,116,240,0.55)]"
          : "border-white/15 bg-white/[0.03] hover:border-fk/60 hover:bg-white/[0.05]"
      } ${busy ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-fk to-blue-700 shadow-lg shadow-fk/30 transition-transform duration-200 group-hover:scale-105">
        <IconUpload className="h-8 w-8 text-white" />
      </div>

      <p className="text-lg font-semibold text-white">
        Drop Flipkart&apos;s combined A4 label + invoice PDF
      </p>
      <p className="mt-1.5 text-sm text-slate-400">
        or <span className="font-medium text-fk-soft underline underline-offset-4">click to browse</span> —
        one merged batch, any number of orders
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-2 text-[11px] font-medium text-slate-300">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <IconFileText className="h-3.5 w-3.5 text-slate-400" /> PDF only · .pdf
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1">
          <IconZap className="h-3.5 w-3.5 text-amber-400" /> 100+ pages in seconds
        </span>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDemo();
        }}
        disabled={busy}
        className="mt-7 text-xs font-medium text-slate-400 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-fk-soft disabled:opacity-50"
      >
        No file handy? Try the 3-page demo batch →
      </button>
    </div>
  );
}
