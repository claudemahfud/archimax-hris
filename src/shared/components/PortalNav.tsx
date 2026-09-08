import { NavLink } from 'react-router-dom';

interface NavItem { to: string; label: string }

export function PortalNav({ title, items, onKeluar }: { title: string; items: NavItem[]; onKeluar?: () => void }) {
  return (
    <nav className="nav-bar" aria-label={title}>
      <span style={{ fontWeight: 700, padding: '10px 8px', color: 'var(--orange-hover)' }}>{title}</span>
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
      {onKeluar && (
        <button onClick={onKeluar} className="nav-link" style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer' }}>
          Keluar
        </button>
      )}
    </nav>
  );
}
