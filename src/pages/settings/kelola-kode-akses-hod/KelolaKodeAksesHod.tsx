import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { listAkunPortalHodDanBranchManager, setKodeAksesAkunPortal, kodeAksesHodDefault } from '../../../shared/lib/firestore';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { Spinner } from '../../../shared/components/Loading';
import { SuperadminLoginGate } from '../../../shared/components/SuperadminLoginGate';
import type { AkunPortal } from '../../../shared/types';

const KODE_DEFAULT = kodeAksesHodDefault();

// Baris satu akun HOD/Branch Manager — komponen top-level (BUKAN didefinisikan di dalam
// KelolaKodeAksesHod) supaya input Kode Akses tidak kehilangan fokus/kursor tiap 1 huruf
// diketik saat parent re-render (lihat WebRules poin 11).
function BarisAkunHod({
  akun, kode, loading, onUbahKode, onSimpan, onReset,
}: {
  akun: AkunPortal;
  kode: string;
  loading: boolean;
  onUbahKode: (id: string, kode: string) => void;
  onSimpan: (akun: AkunPortal) => void;
  onReset: (akun: AkunPortal) => void;
}) {
  return (
    <li
      style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end',
        border: '1px solid var(--grey-light, #e5e5e5)', borderRadius: 10, padding: '10px 12px',
      }}
    >
      <div style={{ flex: '1 1 180px' }}>
        <div style={{ fontWeight: 700 }}>{akun.username}</div>
        <div style={{ fontSize: '0.82rem', color: 'var(--grey, #666)' }}>{akun.email}</div>
      </div>
      <div className="form-field" style={{ flex: '1 1 160px', marginBottom: 0 }}>
        <label htmlFor={`kodeAkses-${akun.id}`}>Kode Akses</label>
        <input
          id={`kodeAkses-${akun.id}`}
          type="text"
          value={kode}
          onChange={(e) => onUbahKode(akun.id, e.target.value)}
          disabled={loading}
        />
      </div>
      <button type="button" className="btn" disabled={loading} onClick={() => onSimpan(akun)} style={{ marginBottom: 0 }}>
        {loading ? <Spinner label="Menyimpan..." /> : 'Simpan'}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={loading}
        onClick={() => onReset(akun)}
        style={{ marginBottom: 0 }}
      >
        Reset ke {KODE_DEFAULT}
      </button>
    </li>
  );
}

export default function KelolaKodeAksesHod() {
  const { showToast } = useToast();
  const { terverifikasi, loginManual, loginGoogle, keluar } = useAksesSuperadmin();

  const [daftarAkun, setDaftarAkun] = useState<AkunPortal[]>([]);
  const [loadingMuat, setLoadingMuat] = useState(true);
  const [kodeInput, setKodeInput] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!terverifikasi) return;
    let batal = false;
    setLoadingMuat(true);
    listAkunPortalHodDanBranchManager()
      .then((akun) => {
        if (batal) return;
        setDaftarAkun(akun);
        const input: Record<string, string> = {};
        for (const a of akun) input[a.id] = a.kodeAkses || KODE_DEFAULT;
        setKodeInput(input);
      })
      .catch(() => undefined)
      .finally(() => { if (!batal) setLoadingMuat(false); });
    return () => { batal = true; };
  }, [terverifikasi]);

  function ubahKode(id: string, kode: string) {
    setKodeInput((prev) => ({ ...prev, [id]: kode }));
  }

  async function simpanKode(akun: AkunPortal) {
    const kodeBaru = (kodeInput[akun.id] ?? '').trim();
    if (kodeBaru.length < 4) {
      showToast('error', 'Kode Akses minimal 4 karakter.');
      return;
    }
    setLoadingId(akun.id);
    try {
      await setKodeAksesAkunPortal(akun.id, kodeBaru);
      setDaftarAkun((prev) => prev.map((a) => (a.id === akun.id ? { ...a, kodeAkses: kodeBaru } : a)));
      showToast('success', `Kode Akses ${akun.username} (${akun.divisi}) berhasil diganti.`);
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingId(null);
    }
  }

  async function resetKode(akun: AkunPortal) {
    setLoadingId(akun.id);
    try {
      await setKodeAksesAkunPortal(akun.id, KODE_DEFAULT);
      setKodeInput((prev) => ({ ...prev, [akun.id]: KODE_DEFAULT }));
      setDaftarAkun((prev) => prev.map((a) => (a.id === akun.id ? { ...a, kodeAkses: KODE_DEFAULT } : a)));
      showToast('success', `Kode Akses ${akun.username} (${akun.divisi}) direset ke ${KODE_DEFAULT}.`);
    } catch (err) {
      showToast('error', `Gagal mereset: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoadingId(null);
    }
  }

  if (!terverifikasi) {
    return (
      <SuperadminLoginGate
        title="Kelola Kode Akses HOD & Branch Manager"
        description="Login sebagai Superadmin untuk mengelola Kode Akses pribadi setiap akun HOD dan Branch Manager."
        loginManual={loginManual}
        loginGoogle={loginGoogle}
      />
    );
  }

  // Dikelompokkan per role dulu (HOD lalu Branch Manager), baru per Divisi di dalamnya — supaya
  // dua role yang kebetulan ada di divisi yang sama tetap tampil sebagai grup terpisah.
  const ROLE_LIST: Array<{ role: 'HOD' | 'Branch Manager'; label: string }> = [
    { role: 'HOD', label: 'HOD' },
    { role: 'Branch Manager', label: 'Branch Manager' },
  ];
  const akunPerRoleDanDivisi = ROLE_LIST.map(({ role, label }) => ({
    role,
    label,
    grupDivisi: DAFTAR_DIVISI
      .map((divisi) => ({ divisi, akun: daftarAkun.filter((a) => a.role === role && a.divisi === divisi) }))
      .filter((grup) => grup.akun.length > 0),
  })).filter((grup) => grup.grupDivisi.length > 0);

  return (
    <div className="page">
      <div className="card">
        <h1>Kelola Kode Akses HOD &amp; Branch Manager</h1>
        <p>
          Setiap akun HOD maupun Branch Manager punya Kode Akses (PIN) pribadi sendiri untuk
          masuk ke portal masing-masing (bukan kode bersama per divisi). Akun baru otomatis
          dibekali kode default <strong>{KODE_DEFAULT}</strong> — ganti di sini kapan saja.
        </p>

        {loadingMuat ? (
          <Spinner label="Memuat daftar akun HOD & Branch Manager..." />
        ) : akunPerRoleDanDivisi.length === 0 ? (
          <p>
            Belum ada akun HOD/Branch Manager terdaftar. Daftarkan lewat menu &quot;+ Daftarkan
            Akun HRD/HOD/Branch Manager&quot; di Welcome Page terlebih dahulu.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 26, marginTop: 8 }}>
            {akunPerRoleDanDivisi.map((grupRole) => (
              <div key={grupRole.role}>
                <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Portal {grupRole.label}</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {grupRole.grupDivisi.map((grup) => (
                    <div key={grup.divisi}>
                      <h3 style={{ fontSize: '0.95rem', marginBottom: 8 }}>{grup.divisi}</h3>
                      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {grup.akun.map((akun) => (
                          <BarisAkunHod
                            key={akun.id}
                            akun={akun}
                            kode={kodeInput[akun.id] ?? ''}
                            loading={loadingId === akun.id}
                            onUbahKode={ubahKode}
                            onSimpan={simpanKode}
                            onReset={resetKode}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 20 }}>
          <Link to={ROUTES.GANTI_KODE_AKSES} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Ganti Kode Akses HRD
          </Link>
          <button type="button" className="btn btn-secondary" onClick={keluar}>Keluar</button>
          <Link to={ROUTES.LANDING} className="btn btn-secondary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Kembali ke Welcome Page
          </Link>
        </div>
      </div>
    </div>
  );
}
