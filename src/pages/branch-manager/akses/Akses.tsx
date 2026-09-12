import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { loginAkunPortal } from '../../../shared/lib/firestore';
import { simpanSesiAkun } from '../../../shared/lib/akunSession';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { Spinner } from '../../../shared/components/Loading';

// Lihat catatan keamanan yang sama di pages/hod/akses/Akses.tsx — gerbang Divisi + Kode Akses
// (PIN) lama dipensiunkan, diganti Login Username/Password sungguhan (Firebase Auth) supaya
// firestore.rules bisa menegakkan isolasi Divisi Branch Manager.
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
        sessionStorage.setItem('akses_branch_manager', '1');
        sessionStorage.setItem('akses_branch_manager_divisi', divisi);
        showToast('success', `Selamat datang, Portal Branch Manager ${divisi}.`);
        navigate(ROUTES.BM_MONITORING);
        return;
      }

      const akun = await loginAkunPortal(username, password);
      if (akun?.role !== 'Branch Manager' || !akun.divisi) {
        showToast('error', 'Username/Password salah, atau akun ini bukan akun Branch Manager.');
        return;
      }
      sessionStorage.setItem('akses_branch_manager', '1');
      sessionStorage.setItem('akses_branch_manager_divisi', akun.divisi);
      simpanSesiAkun({ username: akun.username, email: akun.email });
      showToast('success', `Login berhasil. Selamat datang, Branch Manager ${akun.divisi}.`);
      navigate(ROUTES.BM_MONITORING);
    } catch (err) {
      showToast('error', `Gagal login: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gate-wrap">
      <form className="card gate-card" onSubmit={handleSubmit}>
        <h1>Portal Branch Manager</h1>
        <p>
          {isSuperadmin
            ? 'Superadmin — pilih Divisi/Cabang yang ingin dikelola.'
            : 'PT Archimax Architect Indonesia — login dengan akun Branch Manager Anda.'}
        </p>
        {isSuperadmin ? (
          <div className="form-field">
            <label htmlFor="divisiSelectBm">Divisi</label>
            <select id="divisiSelectBm" value={divisi} onChange={(e) => setDivisi(e.target.value)} required>
              {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        ) : (
          <>
            <div className="form-field">
              <label htmlFor="bmUsername">Username atau Email</label>
              <input id="bmUsername" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="form-field">
              <label htmlFor="bmPassword">Password</label>
              <input id="bmPassword" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
