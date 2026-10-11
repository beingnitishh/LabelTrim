import { IconMenu, IconShield } from "./Icons";

interface TopBarProps {
  /** Breadcrumb leaf, e.g. "Label cropper" or "Print guide". */
  current: string;
  /** Mobile drawer state. Desktop ignores both (CSS hides the trigger). */
  navOpen: boolean;
  onToggleNav: () => void;
}

export default function TopBar({ current, navOpen, onToggleNav }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button
          type="button"
          className="btn btn--quiet btn--icon topbar__menu"
          aria-expanded={navOpen}
          aria-controls="lt-sidebar"
          onClick={onToggleNav}
        >
          <IconMenu width={18} height={18} />
          <span className="visually-hidden">Toggle navigation</span>
        </button>

        <nav className="breadcrumb" aria-label="Breadcrumb">
          <span>Workspace</span>
          <span className="breadcrumb__sep" aria-hidden="true">
            /
          </span>
          <span className="breadcrumb__current" aria-current="page">
            {current}
          </span>
        </nav>

        <span className="topbar__spacer" />

        <span className="pill-private" title="All processing happens inside this browser tab.">
          <IconShield width={14} height={14} />
          Private by design
        </span>
      </div>
    </header>
  );
}
