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

/** Crop overlay — unchanged geometry, restyled labels for the light UI. */
function CropOverlay({ plan }: { plan: PagePlan }) {
  const { width: pw, height: ph, crop: c } = plan;
  const sy = (y: number) => ph - y; // PDF Y-up → SVG Y-down
  const mask = `M0,0 H${pw} V${ph} H0 Z M${c.left},${sy(c.top)} V${sy(c.bottom)} H${c.right} V${sy(c.top)} Z`;
  const textStyle = {
    fontFamily: "inherit",
    paintOrder: "stroke" as const,
    stroke: "#ffffff",
    strokeWidth: 4,
  };

  return (
    <svg
      viewBox={`0 0 ${pw} ${ph}`}
      preserveAspectRatio="none"
      className="preview__overlay"
      aria-hidden="true"
    >
      {/* dim everything outside the kept region */}
      <path d={mask} fillRule="evenodd" fill="rgba(15,32,26,0.5)" />
      {/* kept region border */}
      <rect
        x={c.left}
        y={sy(c.top)}
        width={c.right - c.left}
        height={c.top - c.bottom}
        fill="none"
        stroke="#19765B"
        strokeWidth={2.4}
        strokeDasharray="9 6"
        vectorEffect="non-scaling-stroke"
      />

      <text x={c.left + 9} y={sy(c.top) + 17} fontSize={14} fontWeight={700} fill="#0e4a39" {...textStyle}>
        KEPT → 4×6 in
      </text>

      {plan.anchorY != null && (
        <>
          <circle cx={c.left + 11} cy={sy(plan.anchorY)} r={4} fill="#cf4034" stroke="#ffffff" strokeWidth={1.5} />
          <text x={c.left + 22} y={sy(plan.anchorY) + 4.5} fontSize={12} fontWeight={600} fill="#a3312a" {...textStyle}>
            “{plan.anchorText ?? "Tax Invoice"}” anchor — y={Math.round(plan.anchorY)} pt
          </text>
        </>
      )}

      <text x={c.right - 66} y={sy(c.bottom) - 8} fontSize={11.5} fontWeight={600} fill="#3f4f48" {...textStyle}>
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
        const availW = Math.max(260, Math.min(containerRef.current?.clientWidth ?? 520, 620));
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
    <section className="card card--flush" aria-labelledby="lt-preview-title">
      <div className="card__head">
        <h2 className="card__title" id="lt-preview-title">
          PDF preview
        </h2>
        <span className="card__subtitle">
          Page {Math.min(pageIndex + 1, total)} of {total}
        </span>
        <span className="card__spacer" />
        <label className="checkbox">
          <input type="checkbox" checked={overlayOn} onChange={onToggleOverlay} />
          Show crop overlay
        </label>
      </div>

      <div className="preview__stage">
        <div ref={containerRef} className="preview__frame">
          <div
            className="preview__page"
            style={view.ready ? { width: view.width } : { width: "100%", maxWidth: 520 }}
          >
            {!view.ready && (
              <div className="preview__loading">
                <span className="spinner" aria-hidden="true" />
                <span>Rendering page…</span>
              </div>
            )}
            <canvas ref={canvasRef} className="preview__canvas" hidden={!view.ready} />
            {view.ready && plan && overlayOn && <CropOverlay plan={plan} />}
          </div>
        </div>
      </div>

      <div className="preview__bar">
        <div className="preview__pager">
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
            disabled={pageIndex === 0}
            aria-label="Previous page"
          >
            <IconChevronLeft width={17} height={17} />
          </button>
          <span className="preview__counter" aria-live="polite">
            Page {Math.min(pageIndex + 1, total)} / {total}
          </span>
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            onClick={() => onPageChange(Math.min(total - 1, pageIndex + 1))}
            disabled={pageIndex >= total - 1}
            aria-label="Next page"
          >
            <IconChevronRight width={17} height={17} />
          </button>
        </div>

        {plan && (
          <span className="preview__geometry" title="Crop size → uniform scale → output page size">
            <IconScan
              width={13}
              height={13}
              style={{ display: "inline", verticalAlign: "-2px", marginRight: 5 }}
            />
            {plan.cropW.toFixed(0)} × {plan.cropH.toFixed(0)} pt → ×{plan.scale.toFixed(2)} → {OUT_W} × {OUT_H} pt
          </span>
        )}
      </div>

      <div className="card__body card__body--tight">
        {renderError ? (
          <div className="alert alert--danger" role="alert" style={{ marginBottom: 12 }}>
            <IconAlert className="alert__icon" width={16} height={16} />
            <div>
              <p className="alert__title">Preview failed</p>
              <p>{renderError}. The export still uses the original vector pages, so you can keep going.</p>
            </div>
          </div>
        ) : null}

        {plan && plan.warnings.length > 0 ? (
          <div className="alert alert--warn" style={{ marginBottom: 12 }}>
            <IconAlert className="alert__icon" width={16} height={16} />
            <div>
              <p className="alert__title">Page {plan.pageIndex + 1} needs attention</p>
              <ul className="alert__list">
                {plan.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <p className="preview__note">
          This is a rendered preview only — the exported PDF embeds the original vector content, never
          this raster. Labels are scaled uniformly, so barcode bar ratios stay intact.
        </p>
      </div>
    </section>
  );
}
