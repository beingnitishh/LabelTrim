import { useEffect, useMemo, useRef, useState } from "react";
import GuideScreen from "./components/GuideScreen";
import PreviewPane from "./components/PreviewPane";
import ReportPanel from "./components/ReportPanel";
import Sidebar from "./components/Sidebar";
import type { View } from "./components/Sidebar";
import Stepper from "./components/Stepper";
import UploadScreen from "./components/UploadScreen";
import TopBar from "./components/TopBar";
import { Alert } from "./components/Ui";
import { IconAlert, IconCrop, IconLayers } from "./components/Icons";
import { analyzePdf } from "./lib/analyze";
import { computePlan, DEFAULT_CALIBRATION } from "./lib/calibration";
import { buildDemoPdf } from "./lib/demo";
import { build4x6Pdf } from "./lib/process";
import type { Calibration, OutputInfo, RawPage } from "./lib/types";
import { downloadBytes, friendlyError, safeBaseName } from "./lib/utils";

type Phase = "idle" | "analyzing" | "ready" | "processing" | "done";

export default function App() {
  const [view, setView] = useState<View>("cropper");
  const [navOpen, setNavOpen] = useState(false);
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
  const inFlow = phase === "ready" || phase === "processing" || phase === "done";
  const step = phase === "idle" || phase === "analyzing" ? 1 : phase === "ready" ? 2 : 3;

  /* ------------------------------------------------ mobile drawer behaviour */
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navOpen]);

  function handleViewChange(next: View) {
    setView(next);
    setNavOpen(false);
  }

  /* ------------------------------------------------------------ pdf pipeline */
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

  const showTopBanner = Boolean(error) && !inFlow;

  return (
    <div className="app">
      <a className="skip-link" href="#lt-main">
        Skip to main content
      </a>

      <Sidebar view={view} onViewChange={handleViewChange} open={navOpen} />

      <div className="app__body">
        <TopBar
          current={view === "guide" ? "Print guide" : "Label cropper"}
          navOpen={navOpen}
          onToggleNav={() => setNavOpen((v) => !v)}
        />

        <main className="main" id="lt-main">
          {view === "guide" ? (
            <GuideScreen onBack={() => handleViewChange("cropper")} />
          ) : (
            <>
              {/* --------------------------------------------------- page head */}
              {inFlow ? (
                <div className="page-head">
                  <div className="page-head__badges">
                    <span className="badge">
                      <IconCrop width={14} height={14} />
                      {plans.length} {plans.length === 1 ? "order" : "orders"} scanned
                    </span>
                    <span className="badge badge--neutral">4 × 6 inches output</span>
                  </div>
                  <h1 className="page-head__title">
                    {phase === "done" ? "Batch ready to print." : "Review your crop plan."}
                  </h1>
                  <p className="page-head__lede">
                    {phase === "done"
                      ? "Your thermal-ready PDF has been downloaded. Print one test label first, then run the rest of the batch."
                      : "Check the crop overlay on every page, then convert the whole batch into one 4 × 6 PDF. Nothing is sent anywhere — the file stays on your device."}
                  </p>
                </div>
              ) : (
                <div className="page-head">
                  <div className="page-head__badges">
                    <span className="badge">
                      <IconLayers width={14} height={14} />
                      4 × 6 inches output format
                    </span>
                    <span className="badge badge--neutral">For Flipkart Seller Hub batches</span>
                  </div>
                  <h1 className="page-head__title">
                    Goodbye A4. Hello, <em>4 × 6.</em>
                  </h1>
                  <p className="page-head__lede">
                    Turn your label and invoice PDFs into clean, thermal-ready shipping labels. LabelTrim
                    crops every page down to the shipping label and rebuilds it as a true 4 × 6 inch
                    vector page.
                  </p>
                </div>
              )}

              <Stepper current={step} />

              {showTopBanner ? (
                <div style={{ marginBottom: 18 }}>
                  <Alert
                    tone="danger"
                    role="alert"
                    icon={<IconAlert width={16} height={16} />}
                    title="That file didn't load"
                    onDismiss={() => setError(null)}
                  >
                    {error}
                  </Alert>
                </div>
              ) : null}

              {/* ------------------------------------------------------- upload */}
              {phase === "idle" ? (
                <UploadScreen onFile={handleFile} onDemo={handleDemo} />
              ) : null}

              {/* ---------------------------------------------------- analyzing */}
              {phase === "analyzing" ? (
                <section className="card" aria-labelledby="lt-analyzing-title">
                  <div className="card__body" style={{ textAlign: "center", padding: "36px 24px" }}>
                    <span className="spinner spinner--lg" style={{ margin: "0 auto" }} aria-hidden="true" />
                    <h2 className="card__title" id="lt-analyzing-title" style={{ marginTop: 16 }}>
                      Scanning the text layer…
                    </h2>
                    <p className="hint" aria-live="polite" style={{ marginTop: 6 }}>
                      Looking for the “Tax Invoice” split anchor on page {progress.done} of{" "}
                      {progress.total}.
                    </p>
                    <div
                      className="progress"
                      style={{ maxWidth: 360, margin: "18px auto 0" }}
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={progress.total || 1}
                      aria-valuenow={progress.done}
                      aria-label="Analysing pages"
                    >
                      <div
                        className="progress__bar"
                        style={{
                          width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <p className="hint" style={{ marginTop: 14 }}>
                      The first run loads the PDF engine (~2 MB). Afterwards a 100-page batch takes
                      seconds.
                    </p>
                  </div>
                </section>
              ) : null}

              {/* -------------------------------------------- review + download */}
              {inFlow ? (
                <div className="review-layout">
                  <div className="panel-column">
                    <PreviewPane
                      pdfBytes={bytes!}
                      pageIndex={safePage}
                      plans={plans}
                      overlayOn={overlayOn}
                      onToggleOverlay={() => setOverlayOn((v) => !v)}
                      onPageChange={setPageIndex}
                    />
                    <div className="btn-row btn-row--end">
                      <p className="hint" style={{ marginRight: "auto" }}>
                        Preview rendered locally from your own file — no server round-trip.
                      </p>
                      <button type="button" className="btn btn--quiet" onClick={handleReset}>
                        Start a new batch
                      </button>
                    </div>
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
                    error={phase === "ready" ? error : null}
                    onProcess={handleProcess}
                    onDownload={handleDownload}
                    onReset={handleReset}
                    onJumpToPage={setPageIndex}
                    onOpenGuide={() => handleViewChange("guide")}
                    activePage={safePage}
                  />
                </div>
              ) : null}
            </>
          )}
        </main>

        <footer className="footer">
          <div className="footer__inner">
            <p>
              <strong>LabelTrim</strong> · parses PDFs entirely in your browser — no upload, no server,
              no database, no retention.
            </p>
            <p className="footer__legal">
              Flipkart is a trademark of Flipkart Internet Pvt. Ltd. LabelTrim is an independent tool,
              not affiliated with Flipkart.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
