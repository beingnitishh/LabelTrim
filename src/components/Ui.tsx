import type { ReactNode } from "react";
import { IconChevronDown } from "./Icons";

/**
 * Small presentational primitives shared by every screen. Plain-CSS classes
 * only (see src/index.css) so nothing here depends on CSS the oldest supported
 * browser — Chrome 109 on Windows 7 — cannot parse.
 */

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card${className ? ` ${className}` : ""}`}>{children}</section>;
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  tone?: "ok" | "warn" | "danger";
}) {
  return (
    <div className="stat">
      <p className="stat__label">{label}</p>
      <p className={`stat__value${tone ? ` stat__value--${tone}` : ""}`}>{value}</p>
      {sub ? <p className="stat__sub">{sub}</p> : null}
    </div>
  );
}

export function Alert({
  tone = "info",
  icon,
  title,
  children,
  onDismiss,
  role,
}: {
  tone?: "info" | "warn" | "danger" | "ok";
  icon?: ReactNode;
  title?: string;
  children: ReactNode;
  onDismiss?: () => void;
  role?: "alert" | "status";
}) {
  return (
    <div className={`alert alert--${tone}`} role={role}>
      {icon ? <span className="alert__icon">{icon}</span> : null}
      <div>
        {title ? <p className="alert__title">{title}</p> : null}
        <div>{children}</div>
      </div>
      {onDismiss ? (
        <button type="button" className="alert__dismiss" onClick={onDismiss} aria-label="Dismiss message">
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 5l14 14M19 5 5 19" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

/** Native <details> disclosure — the collapsible sections used for the
 *  advanced crop adjustments and the print guide. */
export function Disclosure({
  title,
  icon,
  children,
  defaultOpen = false,
  bodyClassName = "",
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
}) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary className="disclosure__summary">
        {icon ? <span className="disclosure__summary-icon">{icon}</span> : null}
        {title}
        <IconChevronDown className="disclosure__chevron" width={16} height={16} />
      </summary>
      <div className={`disclosure__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>{children}</div>
    </details>
  );
}
