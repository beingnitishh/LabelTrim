import { IconBook, IconCrop, IconShield, Logo } from "./Icons";

export type View = "cropper" | "guide";

interface SidebarProps {
  view: View;
  onViewChange: (view: View) => void;
  /** Mobile-only: controls the collapsible drawer. Desktop ignores it (CSS). */
  open: boolean;
}

export default function Sidebar({ view, onViewChange, open }: SidebarProps) {
  return (
    <aside id="lt-sidebar" className={`sidebar${open ? " sidebar--open" : ""}`} aria-label="LabelTrim navigation">
      <div className="sidebar__brand">
        <Logo width={36} height={36} />
        <span className="sidebar__brand-text">
          <span className="sidebar__brand-name">
            Label<span>Trim</span>
          </span>
          <span className="sidebar__brand-tag">Seller tools</span>
        </span>
      </div>

      <nav className="sidebar__nav" aria-label="Workspace">
        <p className="sidebar__label" id="lt-nav-label">
          Workspace
        </p>
        <button
          type="button"
          className="nav-item"
          aria-current={view === "cropper" ? "page" : undefined}
          onClick={() => onViewChange("cropper")}
        >
          <IconCrop className="nav-item__icon" width={17} height={17} />
          Label cropper
          {view === "cropper" ? <span className="nav-item__hint">Active</span> : null}
        </button>
        <button
          type="button"
          className="nav-item"
          aria-current={view === "guide" ? "page" : undefined}
          onClick={() => onViewChange("guide")}
        >
          <IconBook className="nav-item__icon" width={17} height={17} />
          Print guide
          {view === "guide" ? <span className="nav-item__hint">Active</span> : null}
        </button>
      </nav>

      <div className="sidebar__spacer" />

      <div className="privacy-card">
        <p className="privacy-card__head">
          <IconShield width={16} height={16} />
          Private by design
        </p>
        <p className="privacy-card__body">
          Your PDFs never leave this device. Everything — analysis, cropping and export — runs inside
          your browser, so customer names, addresses and order IDs stay with you.
        </p>
      </div>

      <p className="sidebar__foot">LabelTrim v1 · no upload, no server, no retention.</p>
    </aside>
  );
}
