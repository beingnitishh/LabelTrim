/**
 * Inline SVG: an A4 sheet (label on top, invoice below) becoming a true 4 × 6
 * shipping label. Pure vector, no external assets, no fonts — safe on Chrome 109.
 */
export default function Illustration({ className = "illustration" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 250"
      role="img"
      aria-labelledby="lt-illu-title lt-illu-desc"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title id="lt-illu-title">From an A4 label plus invoice sheet to a 4 by 6 shipping label</title>
      <desc id="lt-illu-desc">
        Diagram: a Flipkart A4 page containing a shipping label above a tax invoice is cropped to the
        label area, then rebuilt as a 4 by 6 inch thermal label with a barcode and QR code.
      </desc>

      {/* A4 sheet */}
      <g>
        <rect x="14" y="22" width="164" height="206" rx="8" fill="#ffffff" stroke="#ccd8d3" />
        <rect x="26" y="34" width="140" height="86" rx="4" fill="#eef3f0" stroke="#ccd8d3" />
        {/* crop brackets around the label block */}
        <path
          d="M18 30v-8h8M174 22h8v8M18 220v8h8M174 236h8v-8"
          fill="none"
          stroke="#19765B"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        {/* barcode + QR inside the kept label area */}
        <g fill="#1f2a26">
          <rect x="34" y="44" width="2.4" height="20" />
          <rect x="38.6" y="44" width="1.4" height="20" />
          <rect x="42" y="44" width="3" height="20" />
          <rect x="47" y="44" width="1.4" height="20" />
          <rect x="50.4" y="44" width="2" height="20" />
          <rect x="54.4" y="44" width="1.4" height="20" />
          <rect x="57.8" y="44" width="2.8" height="20" />
          <rect x="62.6" y="44" width="1.4" height="20" />
          <rect x="66" y="44" width="2.4" height="20" />
          <rect x="70.4" y="44" width="1.4" height="20" />
        </g>
        <rect x="126" y="42" width="28" height="28" rx="3" fill="#ffffff" stroke="#1f2a26" strokeWidth="1.6" />
        <rect x="131" y="47" width="8" height="8" fill="#1f2a26" />
        <rect x="141" y="57" width="8" height="8" fill="#1f2a26" />
        {/* address lines */}
        <g fill="#b8c6c0">
          <rect x="34" y="74" width="104" height="4.5" rx="2.2" />
          <rect x="34" y="83" width="92" height="4.5" rx="2.2" />
          <rect x="34" y="92" width="112" height="4.5" rx="2.2" />
          <rect x="34" y="101" width="70" height="4.5" rx="2.2" />
        </g>
        {/* invoice area below the split line */}
        <path d="M26 130h140" stroke="#cf4034" strokeWidth="1.6" strokeDasharray="6 5" />
        <text x="26" y="145" fill="#8a5a08" fontSize="9" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif">
          TAX INVOICE
        </text>
        <g fill="#dde5e1">
          <rect x="26" y="153" width="132" height="4" rx="2" />
          <rect x="26" y="162" width="118" height="4" rx="2" />
          <rect x="26" y="171" width="128" height="4" rx="2" />
          <rect x="26" y="180" width="96" height="4" rx="2" />
          <rect x="26" y="189" width="108" height="4" rx="2" />
          <rect x="26" y="198" width="80" height="4" rx="2" />
        </g>
        <rect x="26" y="132" width="140" height="90" rx="4" fill="none" stroke="#f0d9a8" strokeDasharray="5 4" />
      </g>

      {/* arrow */}
      <g stroke="#19765B" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M196 125h44" />
        <path d="m233 117 8 8-8 8" />
      </g>
      <text
        x="218"
        y="112"
        textAnchor="middle"
        fill="#12604a"
        fontSize="10"
        fontWeight="700"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        crop
      </text>
      <text
        x="218"
        y="152"
        textAnchor="middle"
        fill="#5f6f68"
        fontSize="9"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        vector
      </text>
      <text
        x="218"
        y="164"
        textAnchor="middle"
        fill="#5f6f68"
        fontSize="9"
        fontFamily="Helvetica, Arial, sans-serif"
      >
        exact
      </text>

      {/* 4 × 6 thermal label (288 × 432 pt → 2:3 portrait) */}
      <g>
        <rect x="258" y="47" width="104" height="156" rx="8" fill="#ffffff" stroke="#19765B" strokeWidth="2" />
        <rect x="258" y="47" width="104" height="24" rx="8" fill="#e6f2ed" />
        <rect x="258" y="63" width="104" height="8" fill="#e6f2ed" />
        <text
          x="268"
          y="63"
          fill="#12604a"
          fontSize="10.5"
          fontWeight="700"
          fontFamily="Helvetica, Arial, sans-serif"
        >
          4 × 6 in
        </text>
        {/* barcode */}
        <g fill="#1f2a26">
          <rect x="268" y="78" width="2.2" height="24" />
          <rect x="272.2" y="78" width="1.3" height="24" />
          <rect x="275.5" y="78" width="2.8" height="24" />
          <rect x="280.3" y="78" width="1.3" height="24" />
          <rect x="283.6" y="78" width="1.9" height="24" />
          <rect x="287.5" y="78" width="1.3" height="24" />
          <rect x="290.8" y="78" width="2.6" height="24" />
          <rect x="295.4" y="78" width="1.3" height="24" />
          <rect x="298.7" y="78" width="2.2" height="24" />
          <rect x="302.9" y="78" width="1.3" height="24" />
          <rect x="306.2" y="78" width="1.9" height="24" />
          <rect x="310.1" y="78" width="1.3" height="24" />
          <rect x="313.4" y="78" width="2.6" height="24" />
          <rect x="318" y="78" width="1.3" height="24" />
          <rect x="321.3" y="78" width="2.2" height="24" />
        </g>
        {/* QR block */}
        <rect x="326" y="104" width="28" height="28" rx="2.5" fill="#ffffff" stroke="#1f2a26" strokeWidth="1.5" />
        <rect x="330" y="108" width="8" height="8" fill="#1f2a26" />
        <rect x="342" y="120" width="8" height="8" fill="#1f2a26" />
        <rect x="335" y="115" width="5" height="5" fill="#1f2a26" />
        {/* address block */}
        <g fill="#c3d1cb">
          <rect x="268" y="140" width="84" height="4.5" rx="2.2" />
          <rect x="268" y="149" width="70" height="4.5" rx="2.2" />
          <rect x="268" y="158" width="88" height="4.5" rx="2.2" />
          <rect x="268" y="167" width="56" height="4.5" rx="2.2" />
        </g>
        <text x="268" y="190" fill="#5f6f68" fontSize="8" fontFamily="Helvetica, Arial, sans-serif">
          288 × 432 pt · thermal-ready
        </text>
      </g>
    </svg>
  );
}
