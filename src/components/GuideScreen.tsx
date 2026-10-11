import PrintGuide, { GuideChecklist, PrintReminder } from "./PrintGuide";
import { IconArrowRight, IconBook, IconPrinter, IconScan } from "./Icons";

interface GuideScreenProps {
  onBack: () => void;
}

export default function GuideScreen({ onBack }: GuideScreenProps) {
  return (
    <div>
      <div className="page-head">
        <div className="page-head__badges">
          <span className="badge">
            <IconBook width={14} height={14} />
            Printing checklist
          </span>
        </div>
        <h1 className="page-head__title">Print guide</h1>
        <p className="page-head__lede">
          The exported PDF already contains true 4 × 6 in pages, so printing is mostly about stopping
          your printer driver from rescaling them. Follow these four steps for every batch.
        </p>
      </div>

      <div className="guide-layout">
        <section className="card" aria-labelledby="lt-guide-steps">
          <div className="card__head">
            <h2 className="card__title" id="lt-guide-steps">
              Printing a LabelTrim batch
            </h2>
          </div>
          <div className="card__body">
            <PrintGuide />
          </div>
        </section>

        <div className="panel-column">
          <section className="card" aria-labelledby="lt-guide-checklist">
            <div className="card__head">
              <h2 className="card__title" id="lt-guide-checklist">
                <IconPrinter
                  width={16}
                  height={16}
                  style={{ display: "inline", verticalAlign: "-2px", marginRight: 7 }}
                />
                Before you hit print
              </h2>
            </div>
            <div className="card__body">
              <GuideChecklist />
            </div>
          </section>

          <PrintReminder />

          <section className="card" aria-labelledby="lt-guide-scan">
            <div className="card__head">
              <h2 className="card__title" id="lt-guide-scan">
                <IconScan
                  width={16}
                  height={16}
                  style={{ display: "inline", verticalAlign: "-2px", marginRight: 7 }}
                />
                Keep barcodes scannable
              </h2>
            </div>
            <div className="card__body">
              <p className="hint" style={{ lineHeight: 1.7 }}>
                LabelTrim embeds the original vector label into each output page, so QR and barcode bars
                keep their exact proportions. Rescaling at print time is the only thing that can undo
                that — hence the 100% rule. If a page is flagged in the review list, check its barcode
                boundary in the preview before exporting.
              </p>
            </div>
            <div className="card__foot">
              <button type="button" className="btn btn--primary" onClick={onBack}>
                Back to label cropper
                <IconArrowRight width={16} height={16} />
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
