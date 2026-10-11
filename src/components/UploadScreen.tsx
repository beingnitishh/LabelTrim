import DropZone from "./DropZone";
import Illustration from "./Illustration";
import { IconCrop, IconLayers, IconScan, IconTarget } from "./Icons";

interface UploadScreenProps {
  onFile: (file: File) => void;
  onDemo: () => void;
}

const BENEFITS = [
  {
    icon: IconTarget,
    title: "Precise cropping",
    body: "Each page's “Tax Invoice” heading anchors the split line, so long addresses and multi-SKU orders are cropped exactly — the invoice never reaches your printer.",
  },
  {
    icon: IconScan,
    title: "Sharp labels",
    body: "Labels are re-embedded as vectors into true 288 × 432 pt pages — never rasterised, never stretched — so barcode bar ratios stay scanner-friendly.",
  },
  {
    icon: IconLayers,
    title: "Batch processing",
    body: "Drop a whole batch of orders at once. Every page is analysed, cropped and merged into a single 4 × 6 PDF in seconds.",
  },
];

export default function UploadScreen({ onFile, onDemo }: UploadScreenProps) {
  return (
    <div>
      <div className="upload-layout">
        <div className="upload-layout__side">
          <DropZone onFile={onFile} onDemo={onDemo} />

          <div className="upload-note">
            <IconCrop className="upload-note__icon" width={18} height={18} />
            <p>
              <strong>Where to find the file:</strong> Flipkart Seller Hub → Orders → select your
              orders → <strong>Print Label</strong>. That single PDF stacks the shipping label and the
              tax invoice on one A4 page per order — exactly what LabelTrim expects.
            </p>
          </div>
        </div>

        <div className="upload-layout__side">
          <section className="card illustration-card" aria-labelledby="lt-illu-heading">
            <h2 className="card__title" id="lt-illu-heading">
              A4 page in, 4 × 6 label out
            </h2>
            <div style={{ marginTop: 10 }}>
              <Illustration />
            </div>
            <p className="illustration-card__caption">
              LabelTrim reads the label block out of every A4 page, then rebuilds it at exactly 4 × 6
              inches. Page order is preserved, and the output is one file you can send straight to a
              thermal printer.
            </p>
          </section>
        </div>
      </div>

      <h2 className="visually-hidden">Why sellers use LabelTrim</h2>
      <div className="benefits">
        {BENEFITS.map(({ icon: Icon, title, body }) => (
          <section className="card" key={title}>
            <div className="card__body card__body--tight">
              <span className="benefit__icon" aria-hidden="true">
                <Icon width={19} height={19} />
              </span>
              <h3 className="benefit__title">{title}</h3>
              <p className="benefit__body">{body}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
