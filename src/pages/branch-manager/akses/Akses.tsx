import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { cariAkunPortalHodByDivisiDanKode } from '../../../shared/lib/firestore';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { Spinner } from '../../../shared/components/Loading';

const WA_RESET_KODE_AKSES = '6282234651413';

export default function Akses() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { terverifikasi: isSuperadmin } = useAksesSuperadmin();
  const [divisi, setDivisi] = useState<string>(DAFTAR_DIVISI[0]);
  const [kode, setKode] = useState('');
  const [loading, setLoading] = useState(false);

  // Link WhatsApp "Lupa Kode Akses" — pesan template ikut menyesuaikan Divisi yang sedang
  // dipilih di dropdown, supaya Admin langsung tahu Divisi mana yang perlu direset.
  const linkLupaKodeAkses = useMemo(() => {
    const pesan = `Pengajuan Reset Kode Akses Branch Manager ${divisi}`;
    return `https://wa.me/${WA_RESET_KODE_AKSES}?text=${encodeURIComponent(pesan)}`;
  }, [divisi]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Superadmin = akses 100% ke semua divisi, tidak perlu Kode Akses — tinggal pilih divisi.
      let ok = isSuperadmin;
      if (!ok) {
        // Kode Akses milik PRIBADI setiap akun Branch Manager (bukan kode bersama per divisi).
        // Dicocokkan ke seluruh akun Branch Manager terdaftar pada divisi yang dipilih.
        const akun = await cariAkunPortalHodByDivisiDanKode(divisi, kode, 'Branch Manager');
        ok = akun !== null;
      }
      if (ok) {
        sessionStorage.setItem('akses_branch_manager', '1');
        sessionStorage.setItem('akses_branch_manager_divisi', divisi);
        showToast('success', `Selamat datang, Portal Branch Manager ${divisi}.`);
        navigate(ROUTES.BM_MONITORING);
      } else {
        showToast('error', 'Kode akses salah atau belum diatur untuk akun ini.');
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
        <h1>Portal Branch Manager</h1>
        <p>
          {isSuperadmin
            ? 'Superadmin — pilih Divisi yang ingin dikelola.'
            : 'PT Archimax Architect Indonesia — pilih Divisi dan masukkan Kode Akses pribadi Anda.'}
        </p>
        <div className="form-field">
          <label htmlFor="divisiSelect">Divisi</label>
          <select id="divisiSelect" value={divisi} onChange={(e) => setDivisi(e.target.value)} required>
            {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        {!isSuperadmin && (
          <div className="form-field">
            <label htmlFor="kodeAksesBmInput">Kode Akses</label>
            <input
              id="kodeAksesBmInput"
              type="password"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
              required
              autoFocus
            />
          </div>
        )}
        <button type="submit" className="btn" disabled={loading} style={{ width: '100%' }}>
          {loading ? <Spinner label="Memverifikasi..." /> : 'Masuk'}
        </button>
        {!isSuperadmin && (
          <p style={{ marginTop: 14, textAlign: 'center', fontSize: '0.88rem' }}>
            Lupa Kode Akses?{' '}
            <a href={linkLupaKodeAkses} target="_blank" rel="noopener noreferrer">
              Ajukan reset lewat WhatsApp Admin
            </a>
          </p>
        )}
      </form>
    </div>
  );
}
