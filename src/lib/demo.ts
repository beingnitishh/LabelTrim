import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFFont, PDFPage } from "pdf-lib";

/**
 * Synthetic Flipkart-style A4 label+invoice batch (3 orders) so the tool can be
 * tried without a real file. Laid out to match the real template geometry:
 * - A4 595×842 pt pages
 * - label block on top, dashed split rule at y = 458
 * - "Tax Invoice" heading baseline at y = 442 (so crop bottom = 442 + 16 = 458)
 * - barcode bars + QR block inside the label region
 * Everything below the dashed rule is invoice content that LabelTrim discards.
 */

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DemoOrder {
  orderId: string;
  awb: string;
  address: string[];
  items: string[];
  total: string;
}

const ORDERS: DemoOrder[] = [
  {
    orderId: "OD120478899384201",
    awb: "FK-9182-4410-7731",
    address: [
      "Rahul Sharma",
      "Flat 302, Sunrise Residency",
      "14th Cross, Indiranagar",
      "Bengaluru, Karnataka",
      "560038",
      "Phone: 98765 43210",
    ],
    items: ["1 × Cotton Crew T-Shirt (Navy, M)"],
    total: "₹ 599",
  },
  {
    orderId: "OD120478899384202",
    awb: "FK-9182-4410-7742",
    address: [
      "Priya Nair",
      "House No. 7/44, Anjaneya Temple Street",
      "Kacheripady Junction, Ernakulam North",
      "Kochi, Kerala",
      "682018",
      "Phone: 98101 23456",
      "Landmark: near ICICI Bank ATM", // 7th line — real files clip this in Flipkart's template
    ],
    items: ["2 × Ceramic Planters (Set of 2)"],
    total: "₹ 1,198",
  },
  {
    orderId: "OD120478899384203",
    awb: "FK-9182-4410-7753",
    address: [
      "Mohammed Ali",
      "Plot 12, Sector 45, DLF Phase 5",
      "Gurugram, Haryana",
      "122009",
      "Phone: 99887 76655",
    ],
    items: [
      "1 × Running Shoes (Blk, UK 9)",
      "1 × Anti-Skid Socks 3-Pack",
      "1 × Shoe Freshner Spray 100ml",
    ],
    total: "₹ 2,049",
  },
];

const BLUE = rgb(0.16, 0.45, 0.94);
const DARK = rgb(0.07, 0.09, 0.13);
const GRAY = rgb(0.45, 0.47, 0.52);
const MID = rgb(0.62, 0.64, 0.68);

function drawBarcode(page: PDFPage, helv: PDFFont, order: DemoOrder, seed: number) {
  const rng = mulberry32(seed);
  let x = 195;
  let bar = 0;
  while (x < 326 && bar < 60) {
    const w = 2 + Math.floor(rng() * 5);
    if (x + w <= 326) {
      page.drawRectangle({ x, y: 478, width: w, height: 62, color: DARK });
    }
    x += w + 1.5 + rng() * 2.5;
    bar++;
  }
  page.drawText(order.awb, { x: 200, y: 464, size: 9, font: helv, color: DARK });
}

function drawFakeQr(page: PDFPage, seed: number) {
  const rng = mulberry32(seed);
  const cell = 4.6;
  const cols = 14;
  const x0 = 342; // sits beside the barcode, fully inside the 186–408 crop
  const y0 = 486;
  for (let r = 0; r < cols; r++) {
    for (let c = 0; c < cols; c++) {
      if (rng() > 0.52) {
        page.drawRectangle({
          x: x0 + c * cell,
          y: y0 + (cols - 1 - r) * cell,
          width: cell,
          height: cell,
          color: DARK,
        });
      }
    }
  }
}

function drawPage(
  doc: PDFDocument,
  helv: PDFFont,
  helvB: PDFFont,
  order: DemoOrder,
  index: number
) {
  const page = doc.addPage([595, 842]);

  // ---- label header (kept below the 24 pt top margin, i.e. y < 818) ----
  page.drawText("FLIPKART", { x: 40, y: 802, size: 22, font: helvB, color: BLUE });
  page.drawText(`Packing Slip  ·  ${order.orderId}`, {
    x: 168,
    y: 806,
    size: 9,
    font: helv,
    color: GRAY,
  });
  page.drawLine({ start: { x: 40, y: 792 }, end: { x: 555, y: 792 }, thickness: 1.5, color: BLUE });

  // ---- ship-to block ----
  page.drawText("SHIP TO", { x: 40, y: 774, size: 8, font: helvB, color: GRAY });
  let ay = 753;
  for (const line of order.address) {
    page.drawText(line, { x: 40, y: ay, size: 11, font: helv, color: DARK });
    ay -= 17;
  }
  page.drawText("SELLER   UrbanNest Retail LLP, 2nd Floor, JP Nagar, Bengaluru 560078", {
    x: 300,
    y: 760,
    size: 8,
    font: helv,
    color: GRAY,
  });
  page.drawText("FULFILLED BY   Ekart Logistics", { x: 300, y: 744, size: 8, font: helv, color: GRAY });

  // ---- order summary inside the label (kept clear of 7-line addresses) ----
  page.drawText("ORDER SUMMARY", { x: 40, y: 634, size: 8, font: helvB, color: GRAY });
  let iy = 612;
  for (const item of order.items) {
    page.drawText(item, { x: 40, y: iy, size: 10.5, font: helv, color: DARK });
    iy -= 18;
  }
  page.drawText(`Total  ${order.total}`, { x: 40, y: iy - 10, size: 11, font: helvB, color: DARK });

  // ---- barcode + QR (bottom of the label region, kept by the crop) ----
  drawBarcode(page, helv, order, 42 + index * 17);
  drawFakeQr(page, 77 + index * 13);
  page.drawText("Customer  •  do not fold", { x: 195, y: 448, size: 7, font: helv, color: GRAY });

  // ---- the split: dashed rule at y = 458 ----
  page.drawLine({
    start: { x: 30, y: 458 },
    end: { x: 565, y: 458 },
    thickness: 1,
    color: MID,
    dashArray: [6, 4],
  });

  // ---- invoice section (everything below is discarded by LabelTrim) ----
  page.drawText("Tax Invoice", { x: 40, y: 442, size: 14, font: helvB, color: DARK });
  page.drawText(`Order ${order.orderId}`, { x: 470, y: 442, size: 8, font: helv, color: GRAY });
  page.drawLine({ start: { x: 40, y: 431 }, end: { x: 555, y: 431 }, thickness: 0.8, color: MID });

  page.drawText("Item", { x: 40, y: 407, size: 8, font: helvB, color: GRAY });
  page.drawText("Qty", { x: 300, y: 407, size: 8, font: helvB, color: GRAY });
  page.drawText("Gross amount", { x: 400, y: 407, size: 8, font: helvB, color: GRAY });

  let rowY = 387;
  for (let i = 0; i < order.items.length; i++) {
    page.drawText(`${order.items[i]}  ·  HSN 6109`, { x: 40, y: rowY, size: 9, font: helv, color: DARK });
    page.drawText(String(i + 1), { x: 300, y: rowY, size: 9, font: helv, color: DARK });
    page.drawText(`₹ ${order.total.replace("₹ ", "")}`, { x: 400, y: rowY, size: 9, font: helv, color: DARK });
    rowY -= 20;
  }
  page.drawLine({ start: { x: 40, y: rowY + 12 }, end: { x: 555, y: rowY + 12 }, thickness: 0.8, color: MID });
  page.drawText(`TOTAL   ${order.total}`, { x: 400, y: rowY - 12, size: 11, font: helvB, color: DARK });

  page.drawText(
    "GSTIN: 29AABCR1234F1Z5   ·   Place of supply: Karnataka   ·   Invoice copy — keep for records",
    { x: 40, y: 307, size: 8, font: helv, color: GRAY }
  );
  page.drawText("This is a system-generated tax invoice.", { x: 40, y: 64, size: 8, font: helv, color: GRAY });
}

export async function buildDemoPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvB = await doc.embedFont(StandardFonts.HelveticaBold);
  ORDERS.forEach((order, i) => drawPage(doc, helv, helvB, order, i));
  doc.setTitle("demo-flipkart-batch.pdf");
  return doc.save();
}
