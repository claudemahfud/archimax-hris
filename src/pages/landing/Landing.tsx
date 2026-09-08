import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routePaths';

export default function Landing() {
  return (
    <div className="gate-wrap">
      <div className="card gate-card">
        <h1>Archimax HRD &amp; KPI Portal</h1>
        <p>PT Archimax Architect Indonesia — pilih portal yang ingin diakses.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          <Link to={ROUTES.HRD_AKSES} className="btn">Master File HRD</Link>
          <Link to={ROUTES.HOD_AKSES} className="btn btn-secondary">Portal HOD</Link>
        </div>
      </div>
    </div>
  );
}
