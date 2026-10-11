import { IconAlert, IconCheck, IconPrinter } from "./Icons";

const STEPS = [
  {
    title: "Review flagged pages and barcode boundaries",
    body: "Open the review list and check every page marked “Needs review” or “Fallback crop”. Page through the preview and confirm the dashed crop box keeps the whole barcode, QR block and address inside the label, with no invoice lines bleeding in. Fix anything that looks tight with the advanced crop adjustments before exporting.",
  },
  {
    title: "Select 4 × 6-inch paper",
    body: "In the print dialog choose the 4 × 6 in (100 × 150 mm) label stock for your thermal printer. If your driver only lists A4, add a custom paper size of 4 × 6 in and keep the orientation portrait — every page in the exported PDF is already exactly that size.",
  },
  {
    title: "Print at 100% / Actual size",
    body: "Set scaling to 100% (“Actual size”). Never use “Fit to page”, “Shrink to fit” or “Scale to fit printable area” — any scaling changes barcode bar ratios and can make labels unscannable. Leave “auto-rotate and centre” off if it rotates the sheet.",
  },
  {
    title: "Print one test label before the full batch",
    body: "Print page 1 on its own, scan it with the E-Kart / delivery-partner app, and confirm the barcode reads and the address is fully inside the label. Only then print the remaining pages of the batch.",
  },
];

/** The four-point print guide. Used both as an inline collapsible in the
 *  review panel and as the standalone "Print guide" screen. */
export default function PrintGuide() {
  return (
    <ol className="guide-steps">
      {STEPS.map((step, i) => (
        <li className="guide-step" key={step.title}>
          <span className="guide-step__index" aria-hidden="true">
            {i + 1}
          </span>
          <div>
            <p className="guide-step__title">{step.title}</p>
            <p className="guide-step__body">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const CHECKLIST = [
  "Paper size 4 × 6 in (100 × 150 mm) — portrait.",
  "Scale 100% / Actual size, never “fit to page”.",
  "Pages per sheet = 1, no multiple-up or booklet options.",
  "Label stock loaded the right way round for your printer.",
  "First label scanned successfully by the courier app.",
];

export function GuideChecklist() {
  return (
    <div className="checklist">
      {CHECKLIST.map((item) => (
        <p className="checklist__item" key={item}>
          <IconCheck className="checklist__icon" width={15} height={15} />
          <span>{item}</span>
        </p>
      ))}
    </div>
  );
}

export function PrintReminder() {
  return (
    <div className="callout">
      <p className="callout__title">
        <IconAlert width={14} height={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
        Never print at “fit to page”
      </p>
      <p>
        Thermal label stock is exactly 4 × 6 in. If the driver rescales the page to fit, barcode bars
        get thinner or thicker than spec and scanners start rejecting the label.
      </p>
    </div>
  );
}

export function GuideIntro() {
  return (
    <p className="page-head__lede">
      The exported PDF already contains true 4 × 6 in pages, so printing is mostly about talking your
      printer driver out of “helpful” rescaling. Follow these four steps for every batch.
    </p>
  );
}

export function PrinterTip() {
  return (
    <p className="card__foot" style={{ fontSize: "0.75rem", lineHeight: 1.6, color: "var(--lt-text-muted)" }}>
      <IconPrinter width={14} height={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />
      Printing tip: pick 4 × 6 in paper and print at 100% / actual size — never “fit to page”.
    </p>
  );
}
