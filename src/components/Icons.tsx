import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg(props: IconProps & { children: React.ReactNode }) {
  const { children, ...rest } = props;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function IconUpload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 16V4m0 0 4 4m-4-4-4 4" />
      <path d="M4 16.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    </Svg>
  );
}

export function IconDownload(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4v12m0 0 4-4m-4 4-4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  );
}

export function IconFileText(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8M8 17h5" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6z" />
      <path d="m9.5 12 2 2 3.5-4" />
    </Svg>
  );
}

export function IconZap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 12.5 9.5 18 20 6.5" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </Svg>
  );
}

export function IconPrinter(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="7" rx="1" />
    </Svg>
  );
}

export function IconChevronLeft(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m14.5 6-6 6 6 6" />
    </Svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9.5 6 6 6-6 6" />
    </Svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5h.01" />
    </Svg>
  );
}

export function IconCrop(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </Svg>
  );
}

export function IconSpinner(p: IconProps) {
  return (
    <Svg {...p} className={p.className ?? "animate-spin"}>
      <path d="M21 12a9 9 0 1 1-9-9" />
    </Svg>
  );
}

export function IconX(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 5l14 14M19 5 5 19" />
    </Svg>
  );
}

export function IconScan(p: IconProps) {
  return (
    <Svg {...p} strokeWidth={1.8}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M4.5 12h2M9 12h1.5M13 12h2M18 12h1.5" />
    </Svg>
  );
}

export function IconRuler(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="2.5" y="9" width="19" height="6" rx="1" transform="rotate(-18 12 12)" />
      <path d="m7 12.5 1.5 1M10.2 11.5l1.5 1M13.4 10.4l1.5 1M16.6 9.4l1.5 1" />
    </Svg>
  );
}

/** Brand mark: Flipkart blue tile, white barcode bars, amber crop brackets. */
export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="lt-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2874f0" />
          <stop offset="100%" stopColor="#1e5fd6" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#lt-g)" />
      {[
        [9, 17, 1.8], [12, 15, 1.2], [15, 16, 2.4], [18.5, 14.5, 1.2], [21, 16.5, 1.8],
        [24, 14.5, 1.2], [27, 15, 2.4], [31, 16.5, 1.2],
      ].map(([x, y, w], i) => (
        <rect key={i} x={x} y={y} width={w} height={9} rx={0.6} fill="#fff" />
      ))}
      <path
        d="M7 27.5v3M7 25.5c0 1.1.9 2 2 2h3M31 25.5c0 1.1-.9 2-2 2h-3M7 12.5v-3M7 14.5c0-1.1.9-2 2-2h3M31 14.5c0-1.1-.9-2-2-2h-3"
        stroke="#fbbf24"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
