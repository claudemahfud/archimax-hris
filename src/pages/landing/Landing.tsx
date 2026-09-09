import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routePaths';
import { LOGO_ARCHIMAX_URL } from '../../shared/constants/branding';

export default function Landing() {
  return (
    <div className="gate-wrap">
      <div className="card gate-card">
        <img
          src={LOGO_ARCHIMAX_URL}
          alt="Logo PT Archimax Architect Indonesia"
          style={{
            width: '100%', maxWidth: 260, height: 'auto', objectFit: 'contain',
            margin: '0 auto 20px', display: 'block',
          }}
        />
        <h1>Archimax HRD &amp; KPI Portal</h1>
        <p>PT Archimax Architect Indonesia — pilih portal yang ingin diakses.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <Link to={ROUTES.HRD_AKSES} className="btn">Master File HRD</Link>
          <Link to={ROUTES.HOD_AKSES} className="btn btn-secondary">Portal HOD</Link>
        </div>
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--grey-light)' }}>
          <Link to={ROUTES.GANTI_KODE_AKSES} className="link-muted">Ganti Kode Akses</Link>
        </div>
      </div>
    </div>
  );
}
