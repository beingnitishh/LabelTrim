/**
 * Stand-in for src/components/PreviewPane.tsx, substituted via esbuild alias
 * for the reload-recovery test only.
 *
 * The real pane renders the PDF with pdf.js onto a canvas; jsdom has neither a
 * PDF engine nor a canvas. What the reload test cares about is *state*: the
 * restored batch's bytes reaching the review screen. So the shim exposes the
 * props it was handed as data attributes.
 */
export default function PreviewPane(props: {
  pdfBytes: Uint8Array;
  pageIndex: number;
  plans: unknown[];
  overlayOn: boolean;
}) {
  return (
    <div
      data-preview
      data-bytes={props.pdfBytes ? props.pdfBytes.byteLength : 0}
      data-page={props.pageIndex}
      data-plans={props.plans.length}
      data-overlay={props.overlayOn ? "on" : "off"}
    />
  );
}
