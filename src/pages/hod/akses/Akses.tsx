import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useToast } from '../../../shared/hooks/useToast';
import { getKodeAksesHod } from '../../../shared/lib/firestore';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { Spinner } from '../../../shared/components/Loading';

export default function Akses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [divisi, setDivisi] = useState<string>(DAFTAR_DIVISI[0]);
  const [kode, setKode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const kodeAsli = await getKodeAksesHod(divisi);
      const ok = kodeAsli.length > 0 && kode.trim() === kodeAsli;
      if (ok) {
        sessionStorage.setItem('akses_hod', '1');
        sessionStorage.setItem('akses_hod_divisi', divisi);
        showToast('success', `Kode akses benar. Selamat datang, Portal HOD ${divisi}.`);
        navigate(ROUTES.HOD_MONITORING);
      } else {
        showToast('error', 'Kode akses salah atau belum diatur untuk divisi ini.');
      }
    } catch (err) {
      showToast('error', `Gagal memverifikasi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="gate-wrap">
      <form className="card gate-card" onSubmit={handleSubmit}>
        <h1>Portal HOD</h1>
        <p>PT Archimax Architect Indonesia — pilih Divisi dan masukkan Kode Akses.</p>
        <div className="form-field">
          <label htmlFor="divisiSelect">Divisi</label>
          <select id="divisiSelect" value={divisi} onChange={(e) => setDivisi(e.target.value)} required>
            {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="kodeAksesHodInput">Kode Akses</label>
          <input
            id="kodeAksesHodInput"
            type="password"
            value={kode}
            onChange={(e) => setKode(e.target.value)}
            required
            autoFocus
          />
        </div>
        <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? <Spinner label="Memverifikasi..." /> : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
