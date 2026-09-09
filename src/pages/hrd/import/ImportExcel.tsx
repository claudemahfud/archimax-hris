import { useState, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { parseKaryawanExcel } from '../../../shared/lib/excelImport';
import { importSatuKaryawan, kodeAksesRaporDefault } from '../../../shared/lib/firestore';
import type { HasilImportExcel } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel' },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan' },
];

type BarisImport = {
  file: File;
  status: 'menunggu' | 'terbaca' | 'gagal-baca' | 'menyimpan' | 'tersimpan' | 'gagal-simpan';
  hasil?: HasilImportExcel;
  errorMsg?: string;
  idTersimpan?: string;
  jumlahRiwayatBaru?: number;
};

export default function ImportExcel() {
  const { terverifikasi, keluar } = useAksesGate('akses_hrd');
  const { showToast } = useToast();
  const [baris, setBaris] = useState<BarisImport[]>([]);
  const [membaca, setMembaca] = useState(false);
  const [menyimpanSemua, setMenyimpanSemua] = useState(false);

  async function handlePilihFile(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;

    const baruAwal: BarisImport[] = files.map((file) => ({ file, status: 'menunggu' }));
    setBaris((prev) => [...prev, ...baruAwal]);
    setMembaca(true);

    for (const file of files) {
      try {
        const hasil = await parseKaryawanExcel(file);
        setBaris((prev) => prev.map((b) => (b.file === file ? { ...b, status: 'terbaca', hasil } : b)));
      } catch (err) {
        setBaris((prev) => prev.map((b) => (b.file === file
          ? { ...b, status: 'gagal-baca', errorMsg: err instanceof Error ? err.message : String(err) }
          : b)));
      }
    }
    setMembaca(false);
  }

  async function simpanSatu(target: BarisImport) {
    if (!target.hasil) return;
    setBaris((prev) => prev.map((b) => (b.file === target.file ? { ...b, status: 'menyimpan' } : b)));
    try {
      const { id, jumlahRiwayatBaru } = await importSatuKaryawan(target.hasil);
      setBaris((prev) => prev.map((b) => (b.file === target.file
        ? { ...b, status: 'tersimpan', idTersimpan: id, jumlahRiwayatBaru }
        : b)));
    } catch (err) {
      setBaris((prev) => prev.map((b) => (b.file === target.file
        ? { ...b, status: 'gagal-simpan', errorMsg: err instanceof Error ? err.message : String(err) }
        : b)));
    }
  }

  async function simpanSemua() {
    setMenyimpanSemua(true);
    const siap = baris.filter((b) => b.status === 'terbaca');
    for (const b of siap) {
      await simpanSatu(b);
    }
    setMenyimpanSemua(false);
    showToast('success', `Selesai memproses ${siap.length} file.`);
  }

  function hapusBaris(file: File) {
    setBaris((prev) => prev.filter((b) => b.file !== file));
  }

  if (!terverifikasi) return <Navigate to={ROUTES.HRD_AKSES} replace />;

  const jumlahSiapDisimpan = baris.filter((b) => b.status === 'terbaca').length;

  return (
    <div>
      <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Import Excel Karyawan</h1>
        <div className="card">
          <p>
            Upload file Excel karyawan (format sheet <strong>Data Diri Karyawan</strong> + <strong>RAPORT-KPI</strong>,
            seperti spreadsheet lama per karyawan). Bisa pilih banyak file sekaligus. Sistem akan membaca data,
            menampilkan pratinjau untuk dicek dulu, baru disimpan setelah Anda konfirmasi.
          </p>
          <p style={{ color: 'var(--grey-medium)', fontSize: '0.88rem' }}>
            NIP dipakai sebagai kunci: kalau NIP sudah ada di database, data karyawan akan <em>diperbarui</em>
            (bukan dobel), dan riwayat KPI per periode minggu yang sudah pernah masuk otomatis dilewati — jadi
            file yang sama aman diupload ulang kalau perlu.
          </p>
          <input type="file" accept=".xlsx,.xls" multiple onChange={handlePilihFile} disabled={membaca} />
        </div>

        {baris.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <h2>Pratinjau ({baris.length} file)</h2>
              <button
                type="button"
                className="btn"
                disabled={jumlahSiapDisimpan === 0 || menyimpanSemua}
                onClick={simpanSemua}
              >
                {menyimpanSemua ? 'Menyimpan...' : `Import Semua yang Siap (${jumlahSiapDisimpan})`}
              </button>
            </div>

            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>File</th><th>Nama</th><th>NIP</th><th>Divisi</th><th>Riwayat KPI</th>
                    <th>Peringatan</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {baris.map((b) => (
                    <tr key={b.file.name}>
                      <td>{b.file.name}</td>
                      <td>{b.hasil?.karyawan.namaLengkap || '-'}</td>
                      <td>{b.hasil?.karyawan.nip || '-'}</td>
                      <td>{b.hasil?.karyawan.divisi || '-'}</td>
                      <td>{b.hasil?.riwayatKpi.length ?? '-'}</td>
                      <td style={{ maxWidth: 260 }}>
                        {b.hasil && b.hasil.peringatan.length > 0 ? (
                          <details>
                            <summary>{b.hasil.peringatan.length} peringatan</summary>
                            <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: '0.82rem' }}>
                              {b.hasil.peringatan.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </details>
                        ) : b.hasil ? '-' : ''}
                      </td>
                      <td>
                        {b.status === 'menunggu' && <Spinner label="Membaca..." />}
                        {b.status === 'gagal-baca' && <span className="badge badge-bad">Gagal baca: {b.errorMsg}</span>}
                        {b.status === 'terbaca' && <span className="badge badge-good">Siap diimpor</span>}
                        {b.status === 'menyimpan' && <Spinner label="Menyimpan..." />}
                        {b.status === 'gagal-simpan' && <span className="badge badge-bad">Gagal simpan: {b.errorMsg}</span>}
                        {b.status === 'tersimpan' && b.idTersimpan && b.hasil && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className="badge badge-good">
                              Tersimpan (+{b.jumlahRiwayatBaru} riwayat)
                            </span>
                            <button
                              type="button"
                              className="link-muted"
                              style={{ textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onClick={async () => {
                                const url = `${window.location.origin}${ROUTES.raporUrl(b.idTersimpan as string)}`;
                                const pin = b.hasil?.karyawan.kodeAksesRapor || kodeAksesRaporDefault(b.hasil!.karyawan);
                                await navigator.clipboard.writeText(`Link Rapor ${b.hasil?.karyawan.namaLengkap}: ${url}\nPIN: ${pin}`);
                                showToast('success', 'Link + PIN Rapor disalin ke clipboard.');
                              }}
                            >
                              Salin link Rapor
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        {(b.status === 'terbaca' || b.status === 'gagal-simpan') && (
                          <button type="button" className="btn btn-secondary" onClick={() => simpanSatu(b)}>Simpan</button>
                        )}
                        {(b.status === 'terbaca' || b.status === 'gagal-baca' || b.status === 'tersimpan' || b.status === 'gagal-simpan') && (
                          <button type="button" className="btn btn-secondary" onClick={() => hapusBaris(b.file)}>Hapus</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
