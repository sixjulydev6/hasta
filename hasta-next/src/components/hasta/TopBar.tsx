/** Logo and the glass pill navigation; under 1000px the nav becomes a drop panel behind the menu button. */
export const TopBar = () => (
  <header className="top" id="topbar">
    <a className="logo glass" href="#top" aria-label="Hasta, back to top">Hasta</a>
    <nav className="nav glass" id="nav" aria-label="Primary">
      <a href="#top" data-g="top intro"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M2.5 7.2 8 2.6l5.5 4.6v5.3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z M6.4 13.5V9.6h3.2v3.9" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>Home</a>
      <a href="#hands" data-g="hands vision grip touch handover">Hands</a>
      <a href="#rounds" data-g="rounds">Rounds</a>
      <a href="#places" data-g="places">Where it works</a>
      <a href="#shift" data-g="shift">A shift</a>
      <a href="#specs" data-g="specs finale about">In brief</a>
    </nav>
    <div className="tools">
      <button className="sq glass menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Menu"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M2.5 5h11M2.5 8h11M2.5 11h11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></button>
    </div>
  </header>
);
