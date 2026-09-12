import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { loginAkunPortal } from '../../../shared/lib/firestore';
import { simpanSesiAkun } from '../../../shared/lib/akunSession';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { Spinner } from '../../../shared/components/Loading';

// CATATAN KEAMANAN: gerbang Divisi + Kode Akses (PIN) LAMA sudah dipensiunkan sebagai gerbang
// login (PIN hanya cocok di sessionStorage, TIDAK pernah menghasilkan sesi Firebase Auth
// sungguhan — firestore.rules tidak bisa memverifikasinya, jadi tidak benar-benar menutup akses
// data lintas Divisi). Sekarang HOD WAJIB login Username/Password sungguhan (akun yang sama
// dengan yang didaftarkan Superadmin di Welcome Page) — ini menghasilkan sesi Firebase Auth yang
// firestore.rules percaya untuk membatasi HOD hanya ke Divisi miliknya sendiri.
export default function Akses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { terverifikasi: isSuperadmin } = useAksesSuperadmin();
  const [divisi, setDivisi] = useState<string>(DAFTAR_DIVISI[0]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSuperadmin) {
        // Superadmin = akses 100%, tidak perlu akun HOD pribadi — tinggal pilih Divisi.
        sessionStorage.setItem('akses_hod', '1');
        sessionStorage.setItem('akses_hod_divisi', divisi);
        showToast('success', `Selamat datang, Portal HOD ${divisi}.`);
        navigate(ROUTES.HOD_MONITORING);
        return;
      }

      const akun = await loginAkunPortal(username, password);
      if (akun?.role !== 'HOD' || !akun.divisi) {
        showToast('error', 'Username/Password salah, atau akun ini bukan akun HOD.');
        return;
      }
      sessionStorage.setItem('akses_hod', '1');
      sessionStorage.setItem('akses_hod_divisi', akun.divisi);
      simpanSesiAkun({ username: akun.username, email: akun.email });
      showToast('success', `Login berhasil. Selamat datang, HOD ${akun.divisi}.`);
      navigate(ROUTES.HOD_MONITORING);
    } catch (err) {
      showToast('error', `Gagal login: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gate-wrap">
      <form className="card gate-card" onSubmit={handleSubmit}>
        <h1>Portal HOD</h1>
        <p>
          {isSuperadmin
            ? 'Superadmin — pilih Divisi yang ingin dikelola.'
            : 'PT Archimax Architect Indonesia — login dengan akun HOD Anda.'}
        </p>
        {isSuperadmin ? (
          <div className="form-field">
            <label htmlFor="divisiSelect">Divisi</label>
            <select id="divisiSelect" value={divisi} onChange={(e) => setDivisi(e.target.value)} required>
              {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="hodUsername">Username atau Email</label>
              <input id="hodUsername" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="form-field">
              <label htmlFor="hodPassword">Password</label>
              <input id="hodPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </>
        )}
        <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? <Spinner label="Memverifikasi..." /> : 'Masuk'}
        </button>
        {!isSuperadmin && (
          <p style={{ marginTop: 14, textAlign: 'center', fontSize: '0.88rem' }}>
            Lupa Password? Gunakan menu "Lupa Password" di Welcome Page.
          </p>
        )}
      </form>
    </div>
  );
}
