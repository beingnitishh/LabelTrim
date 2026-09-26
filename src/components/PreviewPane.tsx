import { useEffect, useRef, useState } from "react";
import { getDocument } from "../lib/pdfjsCompat";
import type { PDFDocumentProxy } from "../lib/pdfjsCompat";
import { ensureWorker } from "../lib/pdfjsSetup";
import type { PagePlan } from "../lib/types";
import { OUT_H, OUT_W } from "../lib/types";
import {
  IconAlert,
  IconChevronLeft,
  IconChevronRight,
  IconScan,
  IconSpinner,
} from "./Icons";

interface PreviewPaneProps {
  pdfBytes: Uint8Array;
  pageIndex: number;
  plans: PagePlan[];
  overlayOn: boolean;
  onToggleOverlay: () => void;
  onPageChange: (i: number) => void;
}

interface ViewState {
  width: number;
  height: number;
  ready: boolean;
}

function CropOverlay({ plan }: { plan: PagePlan }) {
  const { width: pw, height: ph, crop: c } = plan;
  const sy = (y: number) => ph - y; // PDF Y-up → SVG Y-down
  const mask = `M0,0 H${pw} V${ph} H0 Z M${c.left},${sy(c.top)} V${sy(c.bottom)} H${c.right} V${sy(c.top)} Z`;
  const textStyle = {
    fontFamily: "Inter, system-ui, sans-serif",
    paintOrder: "stroke" as const,
    stroke: "#020617",
    strokeWidth: 4,
  };

  return (
    <svg
      viewBox={`0 0 ${pw} ${ph}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      {/* dim everything outside the kept region */}
      <path d={mask} fillRule="evenodd" fill="rgba(2,6,23,0.52)" />
      {/* kept region border */}
      <rect
        x={c.left}
        y={sy(c.top)}
        width={c.right - c.left}
        height={c.top - c.bottom}
        fill="none"
        stroke="#fbbf24"
        strokeWidth={2.2}
        strokeDasharray="9 6"
        vectorEffect="non-scaling-stroke"
      />

      <text x={c.left + 9} y={sy(c.top) + 19} fontSize={14} fontWeight={700} fill="#fbbf24" {...textStyle}>
        KEPT → 4×6 in
      </text>

      {plan.anchorY != null && (
        <>
          <circle cx={c.left + 11} cy={sy(plan.anchorY)} r={4} fill="#f87171" stroke="#020617" strokeWidth={1.5} />
          <text x={c.left + 22} y={sy(plan.anchorY) + 4.5} fontSize={12} fontWeight={600} fill="#fca5a5" {...textStyle}>
            “{plan.anchorText ?? "Tax Invoice"}” anchor — y={Math.round(plan.anchorY)} pt
          </text>
        </>
      )}

      <text x={c.right - 66} y={sy(c.bottom) - 8} fontSize={11.5} fontWeight={600} fill="#cbd5e1" {...textStyle}>
        split line
      </text>
    </svg>
  );
}

export default function PreviewPane({
  pdfBytes,
  pageIndex,
  plans,
  overlayOn,
  onToggleOverlay,
  onPageChange,
}: PreviewPaneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<{ bytes: Uint8Array; doc: PDFDocumentProxy } | null>(null);
  const [view, setView] = useState<ViewState>({ width: 0, height: 0, ready: false });
  const [renderError, setRenderError] = useState<string | null>(null);

  const plan = plans[pageIndex] ?? plans[0];
  const total = plans.length;

  useEffect(() => {
    let cancelled = false;
    setView((v) => ({ ...v, ready: false }));
    setRenderError(null);

    (async () => {
      try {
        // Cache the parsed document across page switches — only re-parse when
        // a different file arrives.
        if (docRef.current?.bytes !== pdfBytes) {
          if (docRef.current) docRef.current.doc.destroy().catch(() => {});
          docRef.current = null;
          ensureWorker();
          const doc = await getDocument({
            data: new Uint8Array(pdfBytes),
            isEvalSupported: false,
            verbosity: 0,
          }).promise;
          if (cancelled) {
            doc.destroy().catch(() => {});
            return;
          }
          docRef.current = { bytes: pdfBytes, doc };
        }
        const doc = docRef.current.doc;
        const page = await doc.getPage(Math.min(pageIndex + 1, doc.numPages));
        if (cancelled) {
          page.cleanup();
          return;
        }
        const vp1 = page.getViewport({ scale: 1 });
        const availW = Math.max(260, Math.min(containerRef.current?.clientWidth ?? 520, 560));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const vp = page.getViewport({ scale: (availW / vp1.width) * dpr });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          page.cleanup();
          return;
        }
        canvas.width = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
        canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
        await page.render({ canvas, viewport: vp }).promise;
        page.cleanup();
        if (!cancelled) {
          setView({ width: Math.floor(vp.width / dpr), height: Math.floor(vp.height / dpr), ready: true });
        }
      } catch (err) {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBytes, pageIndex]);

  // Destroy the cached document when the pane unmounts.
  useEffect(
    () => () => {
      if (docRef.current) docRef.current.doc.destroy().catch(() => {});
      docRef.current = null;
    },
    []
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Step 2 · Verify the crop
        </h2>
        <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-medium text-slate-300">
          <input
            type="checkbox"
            checked={overlayOn}
            onChange={onToggleOverlay}
            className="h-3.5 w-3.5 cursor-pointer accent-fk"
          />
          Crop overlay
        </label>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-3 shadow-xl shadow-black/20 sm:p-4">
        <div ref={containerRef} className="mx-auto w-full" style={{ aspectRatio: "595 / 842", maxWidth: 560 }}>
          <div
            className="relative mx-auto"
            style={view.ready ? { width: view.width, height: view.height } : { height: "100%" }}
          >
            {!view.ready && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
                <IconSpinner className="h-6 w-6 text-fk" />
                <span className="text-xs">Rendering page…</span>
              </div>
            )}
            <canvas ref={canvasRef} className="block" />
            {view.ready && plan && overlayOn && <CropOverlay plan={plan} />}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-30"
              aria-label="Previous page"
            >
              <IconChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-20 text-center text-xs font-medium tabular-nums text-slate-300">
              Page {pageIndex + 1} / {total}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(Math.min(total - 1, pageIndex + 1))}
              disabled={pageIndex >= total - 1}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-30"
              aria-label="Next page"
            >
              <IconChevronRight className="h-4 w-4" />
            </button>
          </div>

          {plan && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-fk/30 bg-fk/10 px-3 py-1 text-[11px] font-semibold tabular-nums text-fk-soft">
              <IconScan className="h-3.5 w-3.5" />
              {plan.cropW.toFixed(0)} × {plan.cropH.toFixed(0)} pt → ×{plan.scale.toFixed(2)} → {OUT_W} × {OUT_H} pt
            </span>
          )}
        </div>
      </div>

      {renderError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          Preview failed: {renderError}
        </div>
      )}

      {plan && plan.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-300">
            <IconAlert className="h-4 w-4 shrink-0" />
            Page {plan.pageIndex + 1} needs attention
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6 text-xs leading-relaxed text-amber-200/80">
            {plan.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-slate-500">
        Rendered preview only — the final PDF embeds the original vector content, never this raster.
        Labels are scaled uniformly, so barcode bar ratios stay intact.
      </p>
    </section>
  );
}
