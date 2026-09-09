import type { Calibration, PagePlan, PageStatus, RawPage } from "./types";
import { LABEL_HEIGHT, OUT_H, OUT_W, SOURCE_A4 } from "./types";

/**
 * Defaults calibrated against the reference sample (PRD §2):
 * crop x: 186 → 408, y: 458 → 818 (i.e. 222 × 360 pt), A4 595 × 842 pt.
 */
export const DEFAULT_CALIBRATION: Calibration = {
  left: 186,
  right: 408,
  topGap: 24, // 842 − 818
  anchorOffset: 16, // label bottom edge sits this far above the "Tax Invoice" baseline
};

const MIN_CROP_W = 40;
const MIN_CROP_H = 60;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Turn raw per-page facts into a concrete crop + uniform scale plan.
 * Primary: text-anchor split (dynamic per page).
 * Fallback: fixed coordinates (top-anchored 222×360 label block).
 * Warnings (FR8): split point outside expected band, odd page size, unusual scale.
 */
export function computePlan(raw: RawPage, cal: Calibration): PagePlan {
  const warnings: string[] = [];
  const { width: w, height: h } = raw;

  if (Math.abs(w - SOURCE_A4.w) > 4 || Math.abs(h - SOURCE_A4.h) > 4) {
    warnings.push(
      `Unexpected page size ${Math.round(w)}×${Math.round(h)} pt — expected A4 595×842. Crop may not fit.`
    );
  }
  if (raw.rotation !== 0) {
    warnings.push("Rotated page — the crop assumes an upright A4 page.");
  }

  const left = clamp(cal.left, 6, w - 6);
  const right = clamp(cal.right, left + MIN_CROP_W, w - 6);
  const top = clamp(h - cal.topGap, 80, h - 10);

  let bottom: number;
  let status: PageStatus = "anchor";

  if (raw.anchorY == null) {
    bottom = top - LABEL_HEIGHT;
    status = "fallback";
    warnings.push(
      raw.hasTextLayer
        ? 'No "Tax Invoice" anchor found in the text layer — used the fixed-coordinate fallback crop.'
        : "No extractable text layer on this page — used the fixed-coordinate fallback crop."
    );
  } else {
    bottom = clamp(raw.anchorY + cal.anchorOffset, 20, top - MIN_CROP_H);
  }

  // FR8 — expected split band. Outside it usually means the template changed.
  const lo = h * 0.47;
  const hi = h * 0.64;
  if (bottom < lo || bottom > hi) {
    warnings.push(
      `Split line at ${Math.round(bottom)} pt falls outside the expected band (${Math.round(lo)}–${Math.round(hi)} pt). The Flipkart template may have changed — review the preview.`
    );
  }

  const cropW = right - left;
  const cropH = top - bottom;

  // Uniform scale only (FR5). Fit to 4×6 height; cap so width never overflows.
  let scale = Math.min(OUT_H / cropH, OUT_W / cropW);
  scale = clamp(scale, 0.5, 2.5);
  if (scale < 0.95 || scale > 1.45) {
    warnings.push(`Computed uniform scale ${scale.toFixed(2)}× is unusual — double-check the crop.`);
  }

  if (warnings.length > 0) status = raw.anchorY == null ? "fallback" : "warning";

  const dw = cropW * scale;
  const dh = cropH * scale;

  return {
    pageIndex: raw.pageIndex,
    status,
    width: w,
    height: h,
    rotation: raw.rotation,
    hasTextLayer: raw.hasTextLayer,
    anchorY: raw.anchorY,
    anchorText: raw.anchorText,
    crop: { left, right, top, bottom },
    cropW,
    cropH,
    scale,
    outX: (OUT_W - dw) / 2,
    outY: (OUT_H - dh) / 2,
    warnings,
  };
}
