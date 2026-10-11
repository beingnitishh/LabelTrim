import { useState } from "react";
import type { Calibration, OutputInfo, PagePlan, PageStatus } from "../lib/types";
import { OUT_H, OUT_W } from "../lib/types";
import { DEFAULT_CALIBRATION } from "../lib/calibration";
import { formatBytes } from "../lib/utils";
import PrintGuide, { GuideChecklist, PrintReminder } from "./PrintGuide";
import { Alert, Card, Disclosure, Stat } from "./Ui";
import {
  IconAlert,
  IconBook,
  IconCheck,
  IconDownload,
  IconFileText,
  IconInfo,
  IconPrinter,
  IconRefresh,
  IconRuler,
  IconSpinner,
} from "./Icons";

type Phase = "ready" | "processing" | "done";

interface ReportPanelProps {
  fileName: string;
  plans: PagePlan[];
  calibration: Calibration;
  onCalibrationChange: (c: Calibration) => void;
  phase: Phase;
  progress: { done: number; total: number };
  output: OutputInfo | null;
  autoDownloaded: boolean;
  error: string | null;
  onProcess: () => void;
  onDownload: () => void;
  onReset: () => void;
  onJumpToPage: (i: number) => void;
  onOpenGuide: () => void;
  activePage: number;
}

const STATUS_META: Record<PageStatus, { label: string; dot: string; btn: string }> = {
  anchor: { label: "Anchor found", dot: "dot--ok", btn: "page-grid__btn--anchor" },
  fallback: { label: "Fallback crop", dot: "dot--warn", btn: "page-grid__btn--fallback" },
  warning: { label: "Needs review", dot: "dot--danger", btn: "page-grid__btn--warning" },
};

function NumField({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint: string;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const inputId = `lt-cal-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className="field">
      <label className="field__label" htmlFor={inputId}>
        <span className="field__name">{label}</span>
        <span className="field__hint">{hint}</span>
      </label>
      <input
        id={inputId}
        className="input"
        type="number"
        value={draft ?? String(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          setDraft(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}

export default function ReportPanel(props: ReportPanelProps) {
  const {
    fileName, plans, calibration, onCalibrationChange, phase, progress, output,
    autoDownloaded, error, onProcess, onDownload, onReset, onJumpToPage, onOpenGuide, activePage,
  } = props;

  const total = plans.length;
  const anchors = plans.filter((p) => p.status === "anchor").length;
  const fallbacks = plans.filter((p) => p.status === "fallback").length;
  const flagged = plans.filter((p) => p.status === "warning").length;
  const scales = plans.map((p) => p.scale);
  const minScale = total ? Math.min(...scales) : 0;
  const maxScale = total ? Math.max(...scales) : 0;
  const page1 = plans[0];
  const scaleText = total
    ? minScale === maxScale
      ? `${minScale.toFixed(2)}×`
      : `${minScale.toFixed(2)}–${maxScale.toFixed(2)}×`
    : "—";

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="panel-column">
      {/* ---------------------------------------------------- batch summary */}
      <Card>
        <div className="card__head">
          <h2 className="card__title">Batch summary</h2>
          <span className="card__spacer" />
          <span className="chip-file" title={fileName}>
            <IconFileText width={13} height={13} />
            <span className="chip-file__name">{fileName}</span>
          </span>
        </div>
        <div className="card__body">
          <div className="stat-grid">
            <Stat label="Orders" value={total} sub="source pages" />
            <Stat
              label="Text anchors"
              value={anchors}
              sub={`${total ? Math.round((anchors / total) * 100) : 0}% dynamic split`}
              tone="ok"
            />
            <Stat
              label="Fallback crops"
              value={fallbacks}
              sub="fixed coordinates"
              tone={fallbacks ? "warn" : undefined}
            />
            <Stat
              label="Flagged"
              value={flagged}
              sub="check the preview"
              tone={flagged ? "danger" : undefined}
            />
          </div>

          <hr className="divider" />

          <div className="kv">
            <div className="kv__row">
              <span className="kv__key">Source page</span>
              <span className="kv__val">{page1 ? `${page1.width.toFixed(0)} × ${page1.height.toFixed(0)} pt` : "—"} (A4)</span>
            </div>
            <div className="kv__row">
              <span className="kv__key">Page 1 crop</span>
              <span className="kv__val">
                {page1 ? `${page1.cropW.toFixed(0)} × ${page1.cropH.toFixed(0)} pt` : "—"}
              </span>
            </div>
            <div className="kv__row">
              <span className="kv__key">Uniform scale</span>
              <span className="kv__val">{scaleText}</span>
            </div>
            <div className="kv__row">
              <span className="kv__key">Output page</span>
              <span className="kv__val">
                {OUT_W} × {OUT_H} pt · 4 × 6 in
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* ------------------------------------------------------ export block */}
      <Card>
        <div className="card__head">
          <h2 className="card__title">Export labels</h2>
        </div>
        <div className="card__body">
          {phase !== "done" ? (
            <div>
              {error ? (
                <div style={{ marginBottom: 14 }}>
                  <Alert tone="danger" role="alert" icon={<IconAlert width={16} height={16} />} title="Export failed">
                    {error} Nothing was downloaded — try “Convert to 4 × 6 PDF” again.
                  </Alert>
                </div>
              ) : null}

              <button
                type="button"
                className="btn btn--primary btn--lg btn--full"
                onClick={onProcess}
                disabled={phase === "processing" || total === 0}
              >
                {phase === "processing" ? (
                  <>
                    <IconSpinner width={18} height={18} />
                    Converting…
                  </>
                ) : (
                  <>
                    <IconDownload width={18} height={18} />
                    Convert to 4 × 6 PDF
                  </>
                )}
              </button>

              {phase === "processing" ? (
                <div
                  style={{ marginTop: 14 }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={pct}
                  aria-label="Converting pages"
                >
                  <div className="progress">
                    <div className="progress__bar" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="progress-meta" aria-live="polite">
                    <span>
                      Embedding page {Math.min(progress.done + 1, progress.total)} of {progress.total}…
                    </span>
                    <span className="progress-meta__pct">{pct}%</span>
                  </p>
                </div>
              ) : (
                <p className="hint" style={{ marginTop: 12, textAlign: "center" }}>
                  {total} {total === 1 ? "page" : "pages"} → one merged PDF · real 288 × 432 pt pages ·
                  vector-embedded (never rasterised) · uniform scale only · page order preserved.
                </p>
              )}
            </div>
          ) : (
            <div className="export-block export-block--success" aria-live="polite">
              <div className="export-block__head">
                <span className="export-block__icon">
                  <IconCheck width={20} height={20} />
                </span>
                <div>
                  <p className="export-block__title">
                    {output?.pageCount ?? total} thermal {output?.pageCount === 1 ? "label" : "labels"} ready
                  </p>
                  <p className="export-block__meta">
                    {output?.filename} · {output ? formatBytes(output.sizeBytes) : ""}
                  </p>
                </div>
              </div>

              <div className="btn-row" style={{ marginTop: 14 }}>
                <button type="button" className="btn btn--primary" onClick={onDownload}>
                  <IconDownload width={16} height={16} />
                  Download again
                </button>
                <button type="button" className="btn btn--quiet" onClick={onReset}>
                  <IconRefresh width={16} height={16} />
                  Start a new batch
                </button>
              </div>

              <p className="hint" style={{ marginTop: 12 }}>
                {autoDownloaded
                  ? "Download started automatically — if your browser blocked it, use “Download again”."
                  : "Use “Download again” whenever you need a fresh copy of this batch."}
              </p>
            </div>
          )}
        </div>
        <div className="card__foot">
          <p className="hint">
            <IconPrinter
              width={14}
              height={14}
              style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }}
            />
            On your thermal printer: paper = 4 × 6 in, scale = <strong>100% / actual size</strong> — never
            “fit to page”.
          </p>
        </div>
      </Card>

      {/* ----------------------------------------------------- page statuses */}
      <Card>
        <div className="card__head">
          <h2 className="card__title">Per-page status</h2>
          <span className="card__spacer" />
          <span className="card__subtitle">Select a page to preview it</span>
        </div>
        <div className="card__body">
          <div className="legend">
            {(Object.keys(STATUS_META) as PageStatus[]).map((s) => (
              <span className="legend__item" key={s}>
                <span className={`dot ${STATUS_META[s].dot}`} aria-hidden="true" />
                {STATUS_META[s].label}
              </span>
            ))}
          </div>

          <div className="page-grid scroll-thin">
            {plans.map((p) => (
              <button
                key={p.pageIndex}
                type="button"
                className={`page-grid__btn ${STATUS_META[p.status].btn}`}
                aria-current={p.pageIndex === activePage ? "true" : undefined}
                onClick={() => onJumpToPage(p.pageIndex)}
                title={`Page ${p.pageIndex + 1} — ${
                  p.anchorY != null
                    ? `anchor “Tax Invoice” @ y=${Math.round(p.anchorY)} pt`
                    : p.hasTextLayer
                      ? "anchor not found"
                      : "no text layer"
                } · crop ${p.cropW.toFixed(0)}×${p.cropH.toFixed(0)} pt · scale ${p.scale.toFixed(2)}×`}
              >
                {p.pageIndex + 1}
              </button>
            ))}
          </div>

          {flagged > 0 || fallbacks > 0 ? (
            <div style={{ marginTop: 12 }}>
              <Alert
                tone={flagged > 0 ? "danger" : "warn"}
                icon={<IconAlert width={16} height={16} />}
                title={
                  flagged > 0
                    ? `${flagged} ${flagged === 1 ? "page needs" : "pages need"} review`
                    : `${fallbacks} ${fallbacks === 1 ? "page uses" : "pages use"} the fallback crop`
                }
              >
                Open each flagged page in the preview and check the crop box against the barcode and
                address before exporting. See the print guide for what to look for.
              </Alert>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ------------------------------------------- advanced crop adjustments */}
      <Disclosure
        title="Advanced crop adjustments"
        icon={<IconRuler width={16} height={16} />}
        bodyClassName="disclosure__body--sunken"
      >
        <p style={{ marginBottom: 14 }}>
          Defaults are calibrated for Flipkart's current A4 template (label crop 186 → 408 pt wide, split
          line 458 pt). Only change these if the crop box looks wrong on the flagged pages — PDF
          processing, dimensions and page order are unaffected by anything else.
        </p>

        <div className="field-grid">
          <NumField
            label="Label left edge"
            value={calibration.left}
            min={120}
            max={260}
            hint="pt, x"
            onChange={(v) => onCalibrationChange({ ...calibration, left: v })}
          />
          <NumField
            label="Label right edge"
            value={calibration.right}
            min={300}
            max={480}
            hint="pt, x"
            onChange={(v) => onCalibrationChange({ ...calibration, right: v })}
          />
          <NumField
            label="Top margin"
            value={calibration.topGap}
            min={0}
            max={60}
            hint="pt, from A4 top"
            onChange={(v) => onCalibrationChange({ ...calibration, topGap: v })}
          />
          <NumField
            label="Anchor offset"
            value={calibration.anchorOffset}
            min={0}
            max={80}
            hint="pt, baseline → label bottom"
            onChange={(v) => onCalibrationChange({ ...calibration, anchorOffset: v })}
          />
        </div>

        <div className="btn-row" style={{ marginTop: 14, alignItems: "center" }}>
          <button
            type="button"
            className="btn btn--quiet"
            onClick={() => onCalibrationChange({ ...DEFAULT_CALIBRATION })}
          >
            <IconRefresh width={15} height={15} />
            Reset to calibrated defaults
          </button>
          <span className="hint" style={{ flex: "1 1 200px" }}>
            Page 1 crop {page1 ? `${page1.cropW.toFixed(0)} × ${page1.cropH.toFixed(0)} pt` : "—"} · scale{" "}
            {scaleText} · output {OUT_W} × {OUT_H} pt
          </span>
        </div>
      </Disclosure>

      {/* -------------------------------------------------------- print guide */}
      <Disclosure title="Print guide" icon={<IconBook width={16} height={16} />}>
        <PrintGuide />
        <div style={{ marginTop: 16 }}>
          <GuideChecklist />
        </div>
        <div style={{ marginTop: 16 }}>
          <PrintReminder />
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button type="button" className="btn btn--soft" onClick={onOpenGuide}>
            Open the full print guide
          </button>
        </div>
      </Disclosure>

      {/* -------------------------------------------------------------- notes */}
      <Disclosure title="What this tool does (and what it doesn't)" icon={<IconInfo width={16} height={16} />}>
        <ul style={{ display: "grid", gap: 10 }}>
          <li>
            <strong>True page rebuild, not a CropBox shift.</strong> Some thermal print drivers ignore
            CropBox and print off MediaBox — so instead of shifting a viewing window, every output page is
            a brand-new 288 × 432 pt page containing only the label region. The invoice never makes it into
            the file.
          </li>
          <li>
            <strong>Uniform scale only.</strong> The label block (222 × 360 pt) is scaled ×1.20 on{" "}
            <em>both</em> axes to fill 4 × 6 height, leaving ~11 pt side margins. Never stretched on one
            axis — that would distort barcode bar ratios and cause E-Kart scan failures.
          </li>
          <li>
            <strong>Text-anchor split per page.</strong> Each page's “Tax Invoice” heading sets the split
            line, so longer addresses and multi-SKU orders stay cropped correctly. Pages without a text
            layer fall back to the calibrated coordinates and get flagged.
          </li>
          <li>
            <strong>Clipped 6th address lines are Flipkart's bug.</strong> Their own template truncates
            addresses beyond its fixed box height — text that was never rendered can't be recovered by any
            tool.
          </li>
        </ul>
      </Disclosure>
    </div>
  );
}
