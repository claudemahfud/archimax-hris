import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { LOGO_ARCHIMAX_URL } from '../constants/branding';
import { ROUTES } from '../../router/routePaths';
import { bacaSesiAkun } from '../lib/akunSession';
import { useTema } from '../hooks/useTema';
import { IconMenu, IconClose, IconSun, IconMoon, IconLogOut } from './Icons';

export interface ShellNavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

interface AppShellProps {
  portalTitle: string;
  pageTitle: string;
  items: ShellNavItem[];
  onKeluar?: () => void;
  children: ReactNode;
}

export function AppShell({ portalTitle, pageTitle, items, onKeluar, children }: AppShellProps) {
  const [drawerTerbuka, setDrawerTerbuka] = useState(false);
  const { tema, toggleTema } = useTema();
  const sesi = bacaSesiAkun();
  const namaTampil = sesi?.username || 'Portal';
  const inisial = namaTampil.trim().charAt(0).toUpperCase() || 'P';

  return (
    <div className="shell">
      {drawerTerbuka && (
        <button
          type="button"
          className="shell-overlay"
          aria-label="Tutup menu navigasi"
          onClick={() => setDrawerTerbuka(false)}
        />
      )}

      <aside className={`shell-sidebar${drawerTerbuka ? ' open' : ''}`} aria-label={portalTitle}>
        <Link to={ROUTES.LANDING} className="shell-logo" aria-label="Kembali ke Welcome Page">
          <img src={LOGO_ARCHIMAX_URL} alt="Logo PT Archimax Architect Indonesia" />
        </Link>
        <nav className="shell-nav" aria-label={`Menu ${portalTitle}`}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `shell-nav-item${isActive ? ' active' : ''}`}
              onClick={() => setDrawerTerbuka(false)}
              title={item.label}
            >
              <span className="shell-nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="shell-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        {onKeluar && (
          <button type="button" className="shell-nav-item shell-keluar" onClick={onKeluar} title="Keluar">
            <span className="shell-nav-icon" aria-hidden="true"><IconLogOut /></span>
            <span className="shell-nav-label">Keluar</span>
          </button>
        )}
      </aside>

      <div className="shell-body">
        <header className="shell-topbar">
          <button
            type="button"
            className="shell-menu-btn"
            aria-expanded={drawerTerbuka}
            aria-label={drawerTerbuka ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            onClick={() => setDrawerTerbuka((v) => !v)}
          >
            {drawerTerbuka ? <IconClose /> : <IconMenu />}
          </button>
          <div className="shell-titles">
            <span className="shell-portal-title">{portalTitle}</span>
            <span className="shell-page-title">{pageTitle}</span>
          </div>
          <button
            type="button"
            className="shell-theme-btn"
            onClick={toggleTema}
            aria-label={tema === 'gelap' ? 'Ganti ke mode cerah' : 'Ganti ke mode gelap'}
            title={tema === 'gelap' ? 'Mode Cerah' : 'Mode Gelap'}
          >
            {tema === 'gelap' ? <IconSun /> : <IconMoon />}
          </button>
          <div className="shell-user" title={sesi?.email || namaTampil}>
            <span className="shell-avatar" aria-hidden="true">{inisial}</span>
            <span className="shell-user-name">{namaTampil}</span>
          </div>
        </header>

        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
