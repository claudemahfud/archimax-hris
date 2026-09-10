import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import {
  setKodeAksesHrd,
  getWhitelistSuperadmin, tambahWhitelistSuperadmin, hapusWhitelistSuperadmin,
} from '../../../shared/lib/firestore';
import { Spinner } from '../../../shared/components/Loading';
import { SuperadminLoginGate } from '../../../shared/components/SuperadminLoginGate';

export default function GantiKodeAkses() {
  const { showToast } = useToast();
  const { terverifikasi, loginManual, loginGoogle, keluar } = useAksesSuperadmin();

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
      await setKodeAksesHrd(kodeBaru.trim());
      showToast('success', 'Kode Akses Master File HRD berhasil diganti.');
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
      <SuperadminLoginGate
        title="Ganti Kode Akses"
        description="Login sebagai Superadmin untuk mengatur Kode Akses Master File HRD."
        loginManual={loginManual}
        loginGoogle={loginGoogle}
      />
    );
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Ganti Kode Akses</h1>
        <p>
          Atur ulang Kode Akses untuk Master File HRD. Kode Akses Portal HOD sekarang bersifat
          pribadi per akun HOD — kelola lewat menu{' '}
          <Link to={ROUTES.KELOLA_KODE_AKSES_HOD}>Kelola Kode Akses HOD</Link>.
        </p>

        <form onSubmit={handleSimpanKode}>
          <div className="form-field">
            <label htmlFor="kodeBaruInput">Kode Akses Baru — Master File HRD</label>
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
            <Link to={ROUTES.KELOLA_KODE_AKSES_HOD} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
              Kelola Kode Akses HOD
            </Link>
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
