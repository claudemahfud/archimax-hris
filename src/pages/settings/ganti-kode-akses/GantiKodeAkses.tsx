import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import {
  setKodeAksesHrd, setKodeAksesHod,
  getWhitelistSuperadmin, tambahWhitelistSuperadmin, hapusWhitelistSuperadmin,
} from '../../../shared/lib/firestore';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { Spinner } from '../../../shared/components/Loading';

type Target = 'hrd' | 'hod';

export default function GantiKodeAkses() {
  const { showToast } = useToast();
  const { terverifikasi, loginManual, loginGoogle, keluar } = useAksesSuperadmin();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const [target, setTarget] = useState<Target>('hrd');
  const [divisi, setDivisi] = useState<string>(DAFTAR_DIVISI[0]);
  const [kodeBaru, setKodeBaru] = useState('');
  const [konfirmasiKode, setKonfirmasiKode] = useState('');
  const [loadingSimpan, setLoadingSimpan] = useState(false);

  // Whitelist Email Superadmin — hanya email di daftar ini yang boleh pakai "Login dengan
  // Google" sebagai Superadmin (lihat useAksesSuperadmin.ts).
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [emailBaru, setEmailBaru] = useState('');
  const [loadingWhitelist, setLoadingWhitelist] = useState(false);

  useEffect(() => {
    if (!terverifikasi) return;
    getWhitelistSuperadmin().then(setWhitelist).catch(() => undefined);
  }, [terverifikasi]);

  async function handleTambahWhitelist(e: FormEvent) {
    e.preventDefault();
    const bersih = emailBaru.trim();
    if (!bersih) return;
    setLoadingWhitelist(true);
    try {
      await tambahWhitelistSuperadmin(bersih);
      setWhitelist(await getWhitelistSuperadmin());
      setEmailBaru('');
      showToast('success', `Email ${bersih} ditambahkan ke whitelist Superadmin.`);
    } catch (err) {
      showToast('error', `Gagal menambah whitelist: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingWhitelist(false);
    }
  }

  async function handleHapusWhitelist(email: string) {
    setLoadingWhitelist(true);
    try {
      await hapusWhitelistSuperadmin(email);
      setWhitelist(await getWhitelistSuperadmin());
      showToast('success', `Email ${email} dihapus dari whitelist Superadmin.`);
    } catch (err) {
      showToast('error', `Gagal menghapus whitelist: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingWhitelist(false);
    }
  }

  async function handleLoginManual(e: FormEvent) {
    e.preventDefault();
    setLoadingLogin(true);
    try {
      const ok = await loginManual(username, password);
      if (ok) {
        showToast('success', 'Login berhasil. Silakan atur Kode Akses.');
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

  async function handleSimpanKode(e: FormEvent) {
    e.preventDefault();
    if (kodeBaru.trim().length < 4) {
      showToast('error', 'Kode Akses minimal 4 karakter.');
      return;
    }
    if (kodeBaru !== konfirmasiKode) {
      showToast('error', 'Konfirmasi Kode Akses tidak sama.');
      return;
    }
    setLoadingSimpan(true);
    try {
      if (target === 'hrd') {
        await setKodeAksesHrd(kodeBaru.trim());
        showToast('success', 'Kode Akses Master File HRD berhasil diganti.');
      } else {
        await setKodeAksesHod(divisi, kodeBaru.trim());
        showToast('success', `Kode Akses Portal HOD (${divisi}) berhasil diganti.`);
      }
      setKodeBaru('');
      setKonfirmasiKode('');
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingSimpan(false);
    }
  }

  if (!terverifikasi) {
    return (
      <div className="gate-wrap">
        <form className="card gate-card" onSubmit={handleLoginManual}>
          <h1>Ganti Kode Akses</h1>
          <p>Login sebagai Superadmin untuk mengatur Kode Akses.</p>
          <div className="form-field">
            <label htmlFor="superadminUsername">Username</label>
            <input
              id="superadminUsername"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="superadminPassword">Password</label>
            <input
              id="superadminPassword"
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

  return (
    <div className="page">
      <div className="card">
        <h1>Ganti Kode Akses</h1>
        <p>Atur ulang Kode Akses untuk Master File HRD atau Portal HOD per divisi.</p>

        <form onSubmit={handleSimpanKode}>
          <div className="form-field">
            <label htmlFor="targetSelect">Ganti Kode Akses Untuk</label>
            <select id="targetSelect" value={target} onChange={(e) => setTarget(e.target.value as Target)}>
              <option value="hrd">Master File HRD</option>
              <option value="hod">Portal HOD (per Divisi)</option>
            </select>
          </div>

          {target === 'hod' && (
            <div className="form-field">
              <label htmlFor="divisiSelect">Divisi</label>
              <select id="divisiSelect" value={divisi} onChange={(e) => setDivisi(e.target.value)}>
                {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="kodeBaruInput">Kode Akses Baru</label>
            <input
              id="kodeBaruInput"
              type="text"
              value={kodeBaru}
              onChange={(e) => setKodeBaru(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="form-field">
            <label htmlFor="konfirmasiKodeInput">Konfirmasi Kode Akses Baru</label>
            <input
              id="konfirmasiKodeInput"
              type="text"
              value={konfirmasiKode}
              onChange={(e) => setKonfirmasiKode(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={loadingSimpan}>
              {loadingSimpan ? <Spinner label="Menyimpan..." /> : 'Simpan Kode Akses'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={keluar}>Keluar</button>
            <Link to={ROUTES.LANDING} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Kembali ke Welcome Page
            </Link>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h1>Whitelist Email Superadmin</h1>
        <p>
          Hanya email di daftar ini yang boleh memakai tombol &quot;Login dengan Google&quot; sebagai
          Superadmin (akses penuh 100%). Username/password manual di atas tetap berfungsi
          sebagai jalur cadangan.
        </p>

        <form onSubmit={handleTambahWhitelist} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-field" style={{ flex: '1 1 240px', marginBottom: 0 }}>
            <label htmlFor="emailWhitelistInput">Tambah Email Superadmin</label>
            <input
              id="emailWhitelistInput"
              type="email"
              value={emailBaru}
              onChange={(e) => setEmailBaru(e.target.value)}
              placeholder="nama@gmail.com"
              required
            />
          </div>
          <button type="submit" className="btn" disabled={loadingWhitelist} style={{ marginBottom: 0 }}>
            {loadingWhitelist ? <Spinner label="Menyimpan..." /> : 'Tambah'}
          </button>
        </form>

        {whitelist.length === 0 ? (
          <p style={{ marginTop: 14 }}>Belum ada email terdaftar. Superadmin hanya bisa masuk lewat username/password.</p>
        ) : (
          <ul style={{ marginTop: 14, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {whitelist.map((email) => (
              <li
                key={email}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  border: '1px solid var(--grey-light, #e5e5e5)', borderRadius: 10, padding: '8px 12px',
                }}
              >
                <span>{email}</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={loadingWhitelist}
                  onClick={() => handleHapusWhitelist(email)}
                  style={{ padding: '4px 12px', fontSize: '0.85rem' }}
                >
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
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
