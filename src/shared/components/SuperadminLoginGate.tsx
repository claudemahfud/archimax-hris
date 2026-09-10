import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../router/routePaths';
import { useToast } from '../hooks/useToast';
import { Spinner } from './Loading';

// Form login Superadmin (Username+Password atau Google) — dipakai ≥2 halaman settings
// ("Ganti Kode Akses" & "Kelola Kode Akses HOD"), jadi ditaruh di sini sesuai Rule of Two.
interface SuperadminLoginGateProps {
  title: string;
  description: string;
  loginManual: (username: string, password: string) => Promise<boolean>;
  loginGoogle: () => Promise<string>;
}

export function SuperadminLoginGate({ title, description, loginManual, loginGoogle }: SuperadminLoginGateProps) {
  const { showToast } = useToast();
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

  return (
    <div className="gate-wrap">
      <form className="card gate-card" onSubmit={handleLoginManual}>
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="form-field">
          <label htmlFor="superadminGateUsername">Username</label>
          <input
            id="superadminGateUsername"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="form-field">
          <label htmlFor="superadminGatePassword">Password</label>
          <input
            id="superadminGatePassword"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn" disabled={loadingLogin || loadingGoogle} style={{ width: '100%' }}>
          {loadingLogin ? <Spinner label="Memverifikasi..." /> : 'Masuk'}
        </button>

        <div className="divider-or"><span>atau</span></div>

        <button
          type="button"
          className="btn btn-google"
          onClick={handleLoginGoogle}
          disabled={loadingLogin || loadingGoogle}
          style={{ width: '100%' }}
        >
          {loadingGoogle ? (
            <Spinner label="Menghubungkan ke Google..." />
          ) : (
            <>
              <GoogleIcon /> Login dengan Akun Google
            </>
          )}
        </button>

        <p style={{ marginTop: 16 }}>
          <Link to={ROUTES.LANDING}>&larr; Kembali ke Welcome Page</Link>
        </p>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ marginRight: 8, verticalAlign: 'middle' }}>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72c-.18-.54-.28-1.11-.28-1.72s.1-1.18.28-1.72V4.94H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.06l3.01-2.34z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
