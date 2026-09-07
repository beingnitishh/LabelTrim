import { useState } from "react";
import type { ReactNode } from "react";
import type { Calibration, OutputInfo, PagePlan, PageStatus } from "../lib/types";
import { OUT_H, OUT_W } from "../lib/types";
import { DEFAULT_CALIBRATION } from "../lib/calibration";
import { formatBytes } from "../lib/utils";
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconInfo,
  IconPrinter,
  IconRefresh,
  IconScan,
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
  onProcess: () => void;
  onDownload: () => void;
  onReset: () => void;
  onJumpToPage: (i: number) => void;
  activePage: number;
}

const STATUS_META: Record<PageStatus, { label: string; dot: string; chip: string }> = {
  anchor: { label: "Anchor found", dot: "bg-emerald-400", chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  fallback: { label: "Fallback crop", dot: "bg-amber-400", chip: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  warning: { label: "Needs review", dot: "bg-red-400", chip: "border-red-500/30 bg-red-500/10 text-red-300" },
};

function StatCard({ label, value, sub, tone = "text-white" }: { label: string; value: ReactNode; sub?: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Disclosure({ title, icon, children, defaultOpen = false }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-xl border border-white/10 bg-white/[0.03]" open={defaultOpen}>
      <summary className="flex cursor-pointer select-none items-center gap-2.5 px-4 py-3 text-sm font-medium text-slate-200 [&::-webkit-details-marker]:hidden">
        <span className="text-slate-400">{icon}</span>
        {title}
        <span className="ml-auto text-slate-600 transition-transform duration-200 group-open:rotate-180">▾</span>
      </summary>
      <div className="border-t border-white/5 px-4 py-4 text-xs leading-relaxed text-slate-400">{children}</div>
    </details>
  );
}

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
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-[10px] text-slate-600">{hint}</span>
      </span>
      <input
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
        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm tabular-nums text-white outline-none transition-colors focus:border-fk/70"
      />
    </label>
  );
}

export default function ReportPanel(props: ReportPanelProps) {
  const {
    fileName, plans, calibration, onCalibrationChange, phase, progress, output,
    autoDownloaded, onProcess, onDownload, onReset, onJumpToPage, activePage,
  } = props;

  const total = plans.length;
  const anchors = plans.filter((p) => p.status === "anchor").length;
  const fallbacks = plans.filter((p) => p.status === "fallback").length;
  const flagged = plans.filter((p) => p.status === "warning").length;
  const scales = plans.map((p) => p.scale);
  const minScale = total ? Math.min(...scales) : 0;
  const maxScale = total ? Math.max(...scales) : 0;
  const page1 = plans[0];
  const scaleText = total ? (minScale === maxScale ? `${minScale.toFixed(2)}×` : `${minScale.toFixed(2)}–${maxScale.toFixed(2)}×`) : "—";

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Step 3 · Process batch</h2>
        <span className="max-w-56 truncate rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-400" title={fileName}>
          {fileName}
        </span>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Orders" value={total} sub="source pages" />
        <StatCard
          label="Text anchors"
          value={anchors}
          sub={`${total ? Math.round((anchors / total) * 100) : 0}% dynamic split`}
          tone="text-emerald-300"
        />
        <StatCard
          label="Fallback crops"
          value={fallbacks}
          sub="fixed coordinates"
          tone={fallbacks ? "text-amber-300" : "text-white"}
        />
        <StatCard label="Flagged" value={flagged} sub="check the preview" tone={flagged ? "text-red-300" : "text-white"} />
      </div>

      {/* calibration */}
      <Disclosure title="Crop calibration (defaults from your sample)" icon={<IconScan className="h-4 w-4" />}>
        <div className="grid grid-cols-2 gap-3">
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
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="tabular-nums text-slate-500">
            Page 1: crop{" "}
            <span className="text-slate-300">
              {page1 ? `${page1.cropW.toFixed(0)} × ${page1.cropH.toFixed(0)} pt` : "—"}
            </span>{" "}
            · scale <span className="text-slate-300">{scaleText}</span> · output{" "}
            <span className="text-slate-300">{OUT_W} × {OUT_H} pt</span>
          </p>
          <button
            type="button"
            onClick={() => onCalibrationChange({ ...DEFAULT_CALIBRATION })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/10"
          >
            <IconRefresh className="h-3 w-3" /> Reset to calibrated defaults
          </button>
        </div>
      </Disclosure>

      {/* CTA */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-4">
        {phase !== "done" ? (
          <>
            <button
              type="button"
              onClick={onProcess}
              disabled={phase === "processing" || total === 0}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-fk px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-fk/30 transition-all hover:bg-fk-strong hover:shadow-fk/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {phase === "processing" ? (
                <>
                  <IconSpinner className="h-4 w-4" /> Embedding page {progress.done}/{progress.total}…
                </>
              ) : (
                <>
                  <IconDownload className="h-4 w-4" /> Convert {total} {total === 1 ? "page" : "pages"} → 4×6 PDF
                </>
              )}
            </button>
            {phase === "processing" && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fk to-sky-400 transition-all duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
              Real 288×432 pt pages · vector-embedded (never rasterized) · uniform scale only ·
              page order preserved · single merged file
            </p>
          </>
        ) : (
          <div className="fade-up">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <IconCheck className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">{output?.pageCount ?? total} thermal labels ready</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400" title={output?.filename}>
                  {output?.filename} · {output ? formatBytes(output.sizeBytes) : ""}
                </p>
              </div>
            </div>
            <div className="mt-3.5 flex gap-2">
              <button
                type="button"
                onClick={onDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-emerald-950 transition-colors hover:bg-emerald-400"
              >
                <IconDownload className="h-4 w-4" /> Download again
              </button>
              <button
                type="button"
                onClick={onReset}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
              >
                <IconRefresh className="h-4 w-4" /> New file
              </button>
            </div>
            {autoDownloaded && (
              <p className="mt-2.5 text-center text-[11px] text-slate-500">
                Download started automatically — if your browser blocked it, use the button above.
              </p>
            )}
            <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-white/5 px-3 py-2.5 text-[11px] leading-relaxed text-slate-400">
              <IconPrinter className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
              On your thermal printer: set paper to 4×6 in and scale to <span className="font-semibold text-slate-300">100% / actual size</span> — never “fit to page”.
            </p>
          </div>
        )}
      </div>

      {/* notes */}
      <Disclosure title="What this tool does (and what it doesn't)" icon={<IconInfo className="h-4 w-4" />}>
        <ul className="space-y-2.5">
          <li>
            <span className="font-semibold text-slate-300">True page rebuild, not a CropBox shift.</span> Some thermal
            print drivers ignore CropBox and print off MediaBox — so instead of shifting a viewing window, every output
            page is a brand-new 288×432 pt page containing only the label region. The invoice never makes it into the file.
          </li>
          <li>
            <span className="font-semibold text-slate-300">Uniform scale only.</span> The label block (238×365 pt) is
            scaled ×~1.18 on <em>both</em> axes to fill 4×6 height, leaving ~3 pt side margins. Never stretched on one
            axis — that would distort barcode bar ratios and cause E-Kart scan failures.
          </li>
          <li>
            <span className="font-semibold text-slate-300">Text-anchor split per page.</span> Each page's “Tax Invoice”
            heading sets the split line, so longer addresses and multi-SKU orders stay cropped correctly. Pages without
            a text layer fall back to the calibrated coordinates and get flagged.
          </li>
          <li>
            <span className="font-semibold text-slate-300">Clipped 6th address lines are Flipkart's bug.</span> Their
            own template truncates addresses beyond its fixed box height — text that was never rendered can't be
            recovered by any tool.
          </li>
        </ul>
      </Disclosure>

      {/* page grid */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
          <span className="font-semibold uppercase tracking-wider text-slate-500">Per-page status</span>
          {(Object.keys(STATUS_META) as PageStatus[]).map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
            </span>
          ))}
        </div>
        <div className="slim-scroll flex max-h-44 flex-wrap gap-1.5 overflow-y-auto pr-1">
          {plans.map((p) => (
            <button
              key={p.pageIndex}
              type="button"
              onClick={() => onJumpToPage(p.pageIndex)}
              title={`Page ${p.pageIndex + 1} — ${
                p.anchorY != null
                  ? `anchor “Tax Invoice” @ y=${Math.round(p.anchorY)} pt`
                  : p.hasTextLayer
                    ? "anchor not found"
                    : "no text layer"
              } · crop ${p.cropW.toFixed(0)}×${p.cropH.toFixed(0)} pt · scale ${p.scale.toFixed(2)}×`}
              className={`w-9 rounded-md border py-1 text-[11px] font-semibold tabular-nums transition-all ${STATUS_META[p.status].chip} ${
                p.pageIndex === activePage ? "ring-2 ring-white/60" : "hover:brightness-125"
              }`}
            >
              {p.pageIndex + 1}
            </button>
          ))}
        </div>
        {flagged > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-300/90">
            <IconAlert className="h-3.5 w-3.5 shrink-0" />
            {flagged} {flagged === 1 ? "page" : "pages"} flagged — review before printing.
          </p>
        )}
      </div>
    </section>
  );
}
