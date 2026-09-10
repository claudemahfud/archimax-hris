import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routePaths';
import { LOGO_ARCHIMAX_URL } from '../../shared/constants/branding';
import { useAksesSuperadmin } from '../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../shared/hooks/useToast';
import { Spinner } from '../../shared/components/Loading';
import { PortalNav } from '../../shared/components/PortalNav';

// Susunan dekorasi geometris (facet) latar Welcome Page — posisi & ukuran tetap (bukan acak)
// supaya tampilan konsisten setiap render, meniru pola mozaik diamond pada referensi desain.
const FACETS = [
  { top: '6%', left: '8%', size: 70, rotate: 45, tone: 'light' },
  { top: '14%', left: '22%', size: 40, rotate: 45, tone: 'light' },
  { top: '4%', left: '68%', size: 90, rotate: 45, tone: 'dark' },
  { top: '20%', left: '80%', size: 50, rotate: 45, tone: 'light' },
  { top: '34%', left: '4%', size: 55, rotate: 45, tone: 'dark' },
  { top: '46%', left: '88%', size: 65, rotate: 45, tone: 'light' },
  { top: '62%', left: '10%', size: 45, rotate: 45, tone: 'light' },
  { top: '70%', left: '30%', size: 80, rotate: 45, tone: 'dark' },
  { top: '78%', left: '72%', size: 55, rotate: 45, tone: 'light' },
  { top: '86%', left: '86%', size: 40, rotate: 45, tone: 'dark' },
  { top: '88%', left: '18%', size: 60, rotate: 45, tone: 'light' },
  { top: '2%', left: '46%', size: 35, rotate: 45, tone: 'dark' },
] as const;

type Mode = 'hero' | 'login';

export default function Landing() {
  const { showToast } = useToast();
  const { terverifikasi, loginManual, loginGoogle, keluar } = useAksesSuperadmin();
  const [mode, setMode] = useState<Mode>('hero');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  async function handleLoginManual(e: FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const ok = await loginManual(username, password);
      if (ok) {
        showToast('success', 'Login berhasil. Selamat datang, Superadmin.');
      } else {
        showToast('error', 'Username atau password salah.');
      }
    } catch (err) {
      showToast('error', `Gagal login: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingLogin(false);
    }
  }

  async function handleLoginGoogle() {
    setLoadingGoogle(true);
    try {
      const nama = await loginGoogle();
      showToast('success', `Login dengan Google berhasil. Selamat datang, ${nama}.`);
    } catch (err) {
      showToast('error', `Gagal login dengan Google: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingGoogle(false);
    }
  }

  const Logo = (size: number) => (
    <Link to={ROUTES.LANDING} className="login-logo-link" aria-label="Beranda">
      <img
        src={LOGO_ARCHIMAX_URL}
        alt="Logo PT Archimax Architect Indonesia"
        style={{ width: '100%', maxWidth: size, height: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
      />
    </Link>
  );

  // ==== Sudah login sebagai Superadmin (akun kendali penuh) — navbar baru muncul di sini ====
  if (terverifikasi) {
    return (
      <div>
        <PortalNav title="Archimax HRIS" items={[]} onKeluar={keluar} />
        <div className="page">
          <div className="card" style={{ maxWidth: 480, margin: '32px auto', textAlign: 'center' }}>
            {Logo(140)}
            <h1 className="login-title">Selamat Datang, Superadmin</h1>
            <p className="login-subtitle">Pilih portal yang ingin dikelola.</p>
            <div className="dashboard-links">
              <Link to={ROUTES.HRD_AKSES} className="btn">Master File HRD</Link>
              <Link to={ROUTES.HOD_AKSES} className="btn btn-secondary">Portal HOD</Link>
              <Link to={ROUTES.GANTI_KODE_AKSES} className="btn btn-secondary">Ganti Kode Akses</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==== Belum login: Welcome Page hero bergaya geometris, tanpa navbar ====
  return (
    <div className="welcome-scene">
      <div className="welcome-deco" aria-hidden="true">
        <span className="deco-wedge deco-wedge-dark" />
        <span className="deco-wedge deco-wedge-mid" />
        {FACETS.map((f, i) => (
          <span
            key={i}
            className={`deco-facet deco-facet-${f.tone}`}
            style={{ top: f.top, left: f.left, width: f.size, height: f.size, transform: `rotate(${f.rotate}deg)` }}
          />
        ))}
      </div>

      <div key={mode} className="card welcome-card welcome-anim-in">
        {mode === 'hero' ? (
          <div className="welcome-hero-inner">
            <h1 className="welcome-heading">WELCOME!</h1>
            {Logo(150)}
            <p className="welcome-hris-label">HRIS (Human Resource Information System)</p>
            <p className="welcome-desc">
              Portal terpusat manajemen data karyawan &amp; penilaian KPI PT Archimax Architect Indonesia.
            </p>
            <button type="button" className="btn welcome-login-btn" onClick={() => setMode('login')}>
              Login
            </button>
          </div>
        ) : (
          <div className="welcome-login-inner">
            <button type="button" className="link-muted welcome-back-btn" onClick={() => setMode('hero')}>
              &larr; Kembali
            </button>
            {Logo(120)}
            <h1 className="login-title">Archimax HRD &amp; KPI Portal</h1>
            <p className="login-subtitle">PT Archimax Architect Indonesia</p>

            <form onSubmit={handleLoginManual}>
              <div className="form-field">
                <label htmlFor="landingUsername">Username</label>
                <input
                  id="landingUsername"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="form-field">
                <label htmlFor="landingPassword">Password</label>
                <input
                  id="landingPassword"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              <button type="submit" className="btn" disabled={loadingLogin || loadingGoogle} style={{ width: '100%' }}>
                {loadingLogin ? <Spinner label="Memverifikasi..." /> : 'Masuk'}
              </button>
            </form>

            <div className="divider-or"><span>atau</span></div>

            <button
              type="button"
              className="btn btn-google"
              onClick={handleLoginGoogle}
              disabled={loadingLogin || loadingGoogle}
              style={{ width: '100%', marginBottom: 10 }}
            >
              {loadingGoogle ? (
                <Spinner label="Menghubungkan ke Google..." />
              ) : (
                <>
                  <GoogleIcon /> Login dengan Google
                </>
              )}
            </button>

            <button
              type="button"
              className="btn btn-google btn-apple"
              disabled
              style={{ width: '100%' }}
              title="Login dengan Apple ID akan segera tersedia"
            >
              <AppleIcon /> Login dengan Apple ID
              <span className="badge badge-soon">Segera Hadir</span>
            </button>

            <div className="landing-footer-links">
              <Link to={ROUTES.HRD_AKSES} className="link-muted">Master File HRD</Link>
              <Link to={ROUTES.HOD_AKSES} className="link-muted">Portal HOD</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72c-.18-.54-.28-1.11-.28-1.72s.1-1.18.28-1.72V4.94H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.06l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true" fill="currentColor">
      <path d="M12.94 9.55c-.02-2.05 1.68-3.03 1.76-3.08-.96-1.4-2.45-1.6-2.98-1.62-1.27-.13-2.48.75-3.12.75-.64 0-1.63-.73-2.68-.71-1.38.02-2.65.8-3.36 2.03-1.43 2.48-.37 6.15 1.03 8.16.68.98 1.5 2.08 2.57 2.04 1.03-.04 1.42-.66 2.67-.66 1.24 0 1.6.66 2.68.64 1.11-.02 1.81-1 2.48-1.99.78-1.14 1.1-2.25 1.12-2.3-.02-.01-2.14-.82-2.17-3.26zM10.9 3.48c.56-.68.94-1.62.83-2.56-.81.03-1.79.54-2.37 1.21-.52.6-.97 1.56-.85 2.48.9.07 1.83-.46 2.39-1.13z" />
    </svg>
  );
}
