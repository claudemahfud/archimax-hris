import { useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan, hapusKaryawan, kodeAksesRaporDefault } from '../../../shared/lib/firestore';
import type { Karyawan as KaryawanType } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel' },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan' },
];

// ============================================================
// SECTION: Component — murni Daftar Karyawan. Form Tambah/Edit ada di halaman terpisah
// (slug /hrd/kelola-karyawan) supaya slug "melihat data" dan slug "ubah data" tidak nyampur.
// ============================================================
export default function Karyawan() {
  const { terverifikasi, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { keluar: keluarSuperadmin } = useAksesSuperadmin();
  const keluar = () => { keluarSuperadmin(); keluarHrd(); };
  const { showToast } = useToast();
  const [daftar, setDaftar] = useState<KaryawanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [menghapusId, setMenghapusId] = useState<string | null>(null);

  useEffect(() => {
    if (!terverifikasi) return;
    muatDaftar();
  }, [terverifikasi]);

  async function muatDaftar() {
    setLoading(true);
    try {
      setDaftar(await listKaryawan());
    } catch (err) {
      showToast('error', `Gagal memuat data karyawan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleHapus(k: KaryawanType) {
    if (!window.confirm(`Hapus karyawan "${k.namaLengkap}"? Seluruh riwayat KPI-nya juga akan terhapus. Tindakan ini tidak bisa dibatalkan.`)) return;
    setMenghapusId(k.id);
    try {
      await hapusKaryawan(k.id);
      showToast('success', `Karyawan ${k.namaLengkap} berhasil dihapus.`);
      await muatDaftar();
    } catch (err) {
      showToast('error', `Gagal menghapus: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMenghapusId(null);
    }
  }

  if (!terverifikasi) return <Navigate to={ROUTES.HRD_AKSES} replace />;

  return (
    <div>
      <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Kelola Data Karyawan</h1>

        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <p style={{ margin: 0 }}>Tambahkan karyawan baru lewat form manual atau isi cepat dari file Excel.</p>
          <Link to={ROUTES.kelolaKaryawanUrl()} className="btn">+ Tambah Karyawan</Link>
        </div>

        <div className="card">
          <h2>Daftar Karyawan ({daftar.length})</h2>
          {loading ? (
            <Spinner label="Memuat daftar karyawan..." />
          ) : daftar.length === 0 ? (
            <p>Belum ada karyawan terdaftar.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr><th>Foto</th><th>Nama</th><th>Jabatan</th><th>Divisi</th><th>Brand</th><th>Catatan</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {daftar.map((k) => (
                    <tr key={k.id}>
                      <td>
                        <div
                          style={{
                            width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                            background: k.fotoUrl ? 'transparent' : 'var(--gradient-brand)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                          }}
                        >
                          {k.fotoUrl ? (
                            <img src={k.fotoUrl} alt={`Foto profil ${k.namaLengkap}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            k.namaLengkap.trim().charAt(0).toUpperCase()
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ lineHeight: 1.3 }}>
                          <div style={{ fontWeight: 700 }}>{k.namaLengkap}</div>
                          {k.namaPanggilan && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--grey-medium)' }}>{k.namaPanggilan}</div>
                          )}
                        </div>
                      </td>
                      <td>{k.jabatan}</td>
                      <td>{k.divisi || '-'}</td>
                      <td>{k.brand || '-'}</td>
                      <td style={{ maxWidth: 220, whiteSpace: 'normal', fontSize: '0.85rem', color: 'var(--grey-medium)' }}>
                        {k.catatan || '-'}
                      </td>
                      <td className="table-actions">
                        <button
                          className="btn btn-secondary"
                          onClick={async () => {
                            const url = `${window.location.origin}${ROUTES.raporUrl(k.id)}`;
                            const pin = k.kodeAksesRapor || kodeAksesRaporDefault(k);
                            await navigator.clipboard.writeText(`Link Rapor ${k.namaLengkap}: ${url}\nPIN: ${pin}`);
                            showToast('success', `Link + PIN Rapor ${k.namaLengkap} disalin ke clipboard.`);
                          }}
                        >
                          Salin Link
                        </button>
                        <Link to={ROUTES.kelolaKaryawanUrl(k.id)} className="btn btn-secondary">Edit</Link>
                        <button
                          className="btn btn-secondary"
                          style={{ color: 'var(--danger)' }}
                          disabled={menghapusId === k.id}
                          onClick={() => handleHapus(k)}
                        >
                          {menghapusId === k.id ? 'Menghapus...' : 'Hapus'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
