import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useToast } from '../../../shared/hooks/useToast';
import { getKodeAksesHrd } from '../../../shared/lib/firestore';
import { Spinner } from '../../../shared/components/Loading';

export default function Akses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { verifikasi } = useAksesGate('akses_hrd');
  const [kode, setKode] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const kodeAsli = await getKodeAksesHrd();
      if (verifikasi(kode, kodeAsli)) {
        showToast('success', 'Kode akses benar. Selamat datang di Master File HRD.');
        navigate(ROUTES.HRD_DASHBOARD);
      } else {
        showToast('error', 'Kode akses salah atau belum diatur oleh Administrator.');
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
        <h1>Master File HRD</h1>
        <p>PT Archimax Architect Indonesia — masukkan Kode Akses untuk melanjutkan.</p>
        <div className="form-field">
          <label htmlFor="kodeAksesInput">Kode Akses</label>
          <input
            id="kodeAksesInput"
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
