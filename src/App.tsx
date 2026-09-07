import { Fragment, useMemo, useRef, useState } from "react";
import DropZone from "./components/DropZone";
import PreviewPane from "./components/PreviewPane";
import ReportPanel from "./components/ReportPanel";
import {
  IconAlert,
  IconCheck,
  IconCrop,
  IconScan,
  IconShield,
  IconSpinner,
  IconX,
  IconZap,
  Logo,
} from "./components/Icons";
import { analyzePdf } from "./lib/analyze";
import { computePlan, DEFAULT_CALIBRATION } from "./lib/calibration";
import { buildDemoPdf } from "./lib/demo";
import { build4x6Pdf } from "./lib/process";
import type { Calibration, OutputInfo, RawPage } from "./lib/types";
import { OUT_H, OUT_W, SOURCE_A4 } from "./lib/types";
import { downloadBytes, friendlyError, safeBaseName } from "./lib/utils";

type Phase = "idle" | "analyzing" | "ready" | "processing" | "done";

function Steps({ phase }: { phase: Phase }) {
  const step = phase === "idle" || phase === "analyzing" ? 1 : phase === "ready" ? 2 : 3;
  return (
    <div className="hidden items-center gap-2 text-[11px] font-medium sm:flex">
      {["Upload", "Verify crop", "Download"].map((label, i) => {
        const n = i + 1;
        const done = n < step;
        const active = n === step;
        return (
          <Fragment key={label}>
            {i > 0 && <span className="h-px w-4 bg-white/15" />}
            <span
              className={`inline-flex items-center gap-1.5 ${
                done ? "text-emerald-400" : active ? "text-white" : "text-slate-500"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                  done
                    ? "bg-emerald-500/20 text-emerald-300"
                    : active
                      ? "bg-fk text-white"
                      : "bg-white/5 text-slate-500"
                }`}
              >
                {done ? <IconCheck className="h-3 w-3" /> : n}
              </span>
              {label}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

const PIPELINE = [
  { title: "A4 source", sub: `${SOURCE_A4.w}×${SOURCE_A4.h} pt` },
  { title: "Text-anchor split", sub: "“Tax Invoice” per page" },
  { title: "Uniform scale", sub: "×~1.18, both axes" },
  { title: "4×6 output", sub: `${OUT_W}×${OUT_H} pt` },
];

const HOW_IT_WORKS = [
  {
    icon: IconCrop,
    title: "Anchors the split line",
    body: "Each page's “Tax Invoice” heading fixes the crop boundary, so long addresses and multi-SKU orders never break it. No text layer? It falls back to calibrated coordinates and flags the page.",
  },
  {
    icon: IconScan,
    title: "Rebuilds true 4×6 pages",
    body: "Every label is embedded into a brand-new 288×432 pt vector page — not a CropBox shift. No rasterization anywhere, so barcode bar ratios stay pixel-perfect for E-Kart scanners.",
  },
  {
    icon: IconShield,
    title: "Nothing leaves the browser",
    body: "Customer names, full addresses, your GSTIN — parsed locally, zero uploads, zero retention. Close the tab and the file is gone. That's the bar for tools like this, and LabelTrim meets it.",
  },
];

export default function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [rawPages, setRawPages] = useState<RawPage[]>([]);
  const [cal, setCal] = useState<Calibration>(DEFAULT_CALIBRATION);
  const [pageIndex, setPageIndex] = useState(0);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [output, setOutput] = useState<OutputInfo | null>(null);
  const [outputBytes, setOutputBytes] = useState<Uint8Array | null>(null);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [overlayOn, setOverlayOn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const plans = useMemo(() => rawPages.map((p) => computePlan(p, cal)), [rawPages, cal]);
  const safePage = Math.min(pageIndex, Math.max(0, plans.length - 1));

  async function handleFile(file: File) {
    const runId = ++runIdRef.current;
    setError(null);
    setOutput(null);
    setOutputBytes(null);
    setAutoDownloaded(false);
    setPageIndex(0);
    setFileName(file.name);

    if (!/\.pdf$/i.test(file.name)) {
      setError("Please upload a PDF — Flipkart Seller Hub's bulk “Print Label” download.");
      return;
    }

    try {
      setPhase("analyzing");
      setProgress({ done: 0, total: 1 });
      const buf = new Uint8Array(await file.arrayBuffer());
      const pages = await analyzePdf(buf, (p) => {
        if (runIdRef.current === runId) setProgress(p);
      });
      if (runIdRef.current !== runId) return;
      setBytes(buf);
      setRawPages(pages);
      setPhase("ready");
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setPhase("idle");
      setBytes(null);
      setRawPages([]);
      setError(friendlyError(err));
    }
  }

  async function handleDemo() {
    const runId = ++runIdRef.current;
    setError(null);
    setOutput(null);
    setOutputBytes(null);
    setAutoDownloaded(false);
    setPageIndex(0);
    try {
      setPhase("analyzing");
      setProgress({ done: 0, total: 3 });
      const buf = await buildDemoPdf();
      const pages = await analyzePdf(buf, (p) => {
        if (runIdRef.current === runId) setProgress(p);
      });
      if (runIdRef.current !== runId) return;
      setBytes(buf);
      setFileName("demo-flipkart-batch.pdf");
      setRawPages(pages);
      setPhase("ready");
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setPhase("idle");
      setError(friendlyError(err));
    }
  }

  async function handleProcess() {
    if (!bytes || plans.length === 0) return;
    const runId = ++runIdRef.current;
    setError(null);
    setProgress({ done: 0, total: plans.length });
    try {
      setPhase("processing");
      const out = await build4x6Pdf(bytes, plans, (p) => {
        if (runIdRef.current === runId) setProgress(p);
      });
      if (runIdRef.current !== runId) return;
      const filename = `labeltrim-4x6-${safeBaseName(fileName)}-${plans.length}pages.pdf`;
      setOutputBytes(out);
      setOutput({ filename, sizeBytes: out.byteLength, pageCount: plans.length });
      downloadBytes(out, filename);
      setAutoDownloaded(true);
      setPhase("done");
    } catch (err) {
      if (runIdRef.current !== runId) return;
      setPhase("ready");
      setError(friendlyError(err));
    }
  }

  function handleReset() {
    runIdRef.current++;
    setPhase("idle");
    setBytes(null);
    setFileName("");
    setRawPages([]);
    setPageIndex(0);
    setOutput(null);
    setOutputBytes(null);
    setAutoDownloaded(false);
    setError(null);
    setCal(DEFAULT_CALIBRATION);
  }

  function handleDownload() {
    if (outputBytes && output) downloadBytes(outputBytes, output.filename);
  }

  const inFlow = phase === "ready" || phase === "processing" || phase === "done";

  return (
    <div className="relative min-h-screen overflow-x-clip">
      {/* background decor */}
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-slate-950" />
        <div className="absolute -top-44 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-fk/15 blur-[140px]" />
        <div className="absolute bottom-0 right-0 h-[320px] w-[520px] rounded-full bg-sky-500/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_72%_48%_at_50%_0%,black,transparent)]" />
      </div>

      {/* header */}
      <header className="sticky top-0 z-20 border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-2.5">
            <Logo className="h-8 w-8" />
            <div className="leading-tight">
              <p className="text-sm font-extrabold tracking-tight text-white">
                Label<span className="text-fk-soft">Trim</span>
              </p>
              <p className="text-[10px] font-medium text-slate-500">Flipkart label → 4×6 thermal</p>
            </div>
            <span className="ml-1 hidden rounded-full border border-fk/30 bg-fk/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fk-soft sm:inline">
              v1 · MVP
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Steps phase={phase} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
              <IconShield className="h-3 w-3" /> 100% in-browser
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10">
        {/* error banner */}
        {error && (
          <div className="fade-up mb-6 flex items-start justify-between gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3.5">
            <p className="flex items-start gap-2.5 text-sm text-red-200">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              {error}
            </p>
            <button
              type="button"
              onClick={() => setError(null)}
              className="rounded-lg p-1 text-red-300/70 transition-colors hover:bg-red-500/10 hover:text-red-200"
              aria-label="Dismiss"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* ---------- idle: hero + upload ---------- */}
        {phase === "idle" && (
          <div className="fade-up">
            <div className="mx-auto max-w-3xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[11px] font-semibold text-slate-300">
                <IconZap className="h-3.5 w-3.5 text-amber-400" />
                Built for Flipkart Seller Hub bulk “Print Label” downloads
              </span>
              <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                Flipkart A4 labels →{" "}
                <span className="bg-gradient-to-r from-fk-soft via-sky-300 to-fk-soft bg-clip-text text-transparent">
                  ready-to-print 4×6 PDF
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
                Bulk-crop every page down to the shipping label, rebuild it as a true 288×432 pt
                page, and merge the whole batch into one thermal-ready file. Customer data never
                leaves this tab.
              </p>
            </div>

            {/* pipeline */}
            <div className="mx-auto mt-9 flex max-w-3xl flex-wrap items-center justify-center gap-2">
              {PIPELINE.map((item, i) => (
                <Fragment key={item.title}>
                  {i > 0 && <span className="text-slate-600">→</span>}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-center">
                    <p className="text-xs font-bold text-white">{item.title}</p>
                    <p className="text-[10px] tabular-nums text-slate-500">{item.sub}</p>
                  </div>
                </Fragment>
              ))}
            </div>

            <div className="mx-auto mt-8 max-w-2xl">
              <DropZone onFile={handleFile} onDemo={handleDemo} busy={false} />
            </div>

            {/* how it works */}
            <div className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:bg-white/[0.05]"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-fk/15">
                    <Icon className="h-4.5 w-4.5 text-fk-soft" />
                  </div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- analyzing ---------- */}
        {phase === "analyzing" && (
          <div className="fade-up mx-auto max-w-xl">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
              <IconSpinner className="mx-auto h-8 w-8 text-fk" />
              <p className="mt-4 text-sm font-semibold text-white">Scanning the text layer…</p>
              <p className="mt-1 text-xs text-slate-400">
                Locating the “Tax Invoice” split anchor on page {progress.done} of {progress.total}
              </p>
              <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-fk to-sky-400 transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="mt-3 text-[11px] text-slate-500">
                First run loads the PDF engine (~2 MB) — afterwards a 100-page batch takes seconds.
              </p>
            </div>
          </div>
        )}

        {/* ---------- ready / processing / done ---------- */}
        {inFlow && (
          <div className="fade-up">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {phase === "done" ? "Batch ready for the thermal printer" : "Batch scanned"}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {plans.length} {plans.length === 1 ? "order" : "orders"} · crop plan computed for
                  every page · output locked to {OUT_W}×{OUT_H} pt (4×6 in)
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
              >
                <IconX className="h-3.5 w-3.5" /> New file
              </button>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,540px)_1fr]">
              <div className="lg:sticky lg:top-20">
                <PreviewPane
                  pdfBytes={bytes!}
                  pageIndex={safePage}
                  plans={plans}
                  overlayOn={overlayOn}
                  onToggleOverlay={() => setOverlayOn((v) => !v)}
                  onPageChange={(i) => setPageIndex(i)}
                />
              </div>
              <ReportPanel
                fileName={fileName}
                plans={plans}
                calibration={cal}
                onCalibrationChange={setCal}
                phase={phase === "processing" ? "processing" : phase === "done" ? "done" : "ready"}
                progress={progress}
                output={output}
                autoDownloaded={autoDownloaded}
                onProcess={handleProcess}
                onDownload={handleDownload}
                onReset={handleReset}
                onJumpToPage={(i) => setPageIndex(i)}
                activePage={safePage}
              />
            </div>
          </div>
        )}
      </main>

      {/* footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 text-center">
          <p className="text-[11px] leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-400">LabelTrim</span> · v1 MVP · parses PDFs
            entirely in your browser — no upload, no server, no database, no retention.
          </p>
          <p className="text-[10px] text-slate-600">
            Flipkart is a trademark of Flipkart Internet Pvt. Ltd. LabelTrim is an independent
            internal tool, not affiliated with Flipkart.
          </p>
        </div>
      </footer>
    </div>
  );
}
