// Shared types + fixed geometry constants for LabelTrim.

/** Output page size — 4×6 in at 72 pt/in. Fixed, never changes (FR4). */
export const OUT_W = 288;
export const OUT_H = 432;

/** Standard Flipkart source page (A4 portrait). */
export const SOURCE_A4 = { w: 595, h: 842 };

/** Fixed label block height (pt) used by the no-anchor fallback crop. */
export const LABEL_HEIGHT = 365;

export interface Calibration {
  /** Left edge of the label crop, in pt (x). */
  left: number;
  /** Right edge of the label crop, in pt (x). */
  right: number;
  /** Gap from the top of the A4 page to the top of the crop, in pt. */
  topGap: number;
  /** Distance from the "Tax Invoice" text baseline up to the label bottom edge, in pt. */
  anchorOffset: number;
}

/** Per-page facts gathered from the source PDF's text layer. */
export interface RawPage {
  pageIndex: number; // 0-based
  width: number;
  height: number;
  rotation: number;
  hasTextLayer: boolean;
  /** Baseline Y of the detected "Tax Invoice" heading, in PDF pt. */
  anchorY: number | null;
  anchorText: string | null;
}

export type PageStatus = "anchor" | "fallback" | "warning";

export interface CropRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Final per-page crop + scale plan. */
export interface PagePlan {
  pageIndex: number;
  status: PageStatus;
  width: number;
  height: number;
  rotation: number;
  hasTextLayer: boolean;
  anchorY: number | null;
  anchorText: string | null;
  crop: CropRect;
  cropW: number;
  cropH: number;
  /** Uniform scale — identical on both axes, never stretched (FR5). */
  scale: number;
  outX: number;
  outY: number;
  warnings: string[];
}

export interface OutputInfo {
  filename: string;
  sizeBytes: number;
  pageCount: number;
}
