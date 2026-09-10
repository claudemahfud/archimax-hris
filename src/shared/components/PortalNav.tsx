import { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LOGO_ARCHIMAX_URL } from '../constants/branding';
import { ROUTES } from '../../router/routePaths';

interface NavItem { to: string; label: string }

export function PortalNav({ title, items, onKeluar }: { title: string; items: NavItem[]; onKeluar?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="nav-bar" aria-label={title}>
      <Link to={ROUTES.LANDING} aria-label="Kembali ke Welcome Page" style={{ display: 'inline-flex', marginRight: 4 }}>
        <img
          src={LOGO_ARCHIMAX_URL}
          alt="Logo PT Archimax Architect Indonesia"
          style={{ height: 38, width: 'auto', maxWidth: 140, objectFit: 'contain' }}
        />
      </Link>
      <span className="nav-brand">{title}</span>
      <button
        type="button"
        className="nav-toggle"
        aria-expanded={open}
        aria-controls="portal-nav-links"
        aria-label={open ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
        onClick={() => setOpen((v) => !v)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <div id="portal-nav-links" className={`nav-links${open ? ' open' : ''}`}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </NavLink>
        ))}
        {onKeluar && (
          <button onClick={onKeluar} className="nav-link nav-keluar">
            Keluar
          </button>
        )}
      </div>
    </nav>
  );
}
