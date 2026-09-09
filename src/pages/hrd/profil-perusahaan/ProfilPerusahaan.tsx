import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { getCompanyInfo, setCompanyInfo } from '../../../shared/lib/firestore';
import type { CompanyInfo } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel' },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan' },
];

// Draft awal diambil dari konten Kebijakan Reward & Peraturan Punishment yang sudah ada di
// spreadsheet lama — supaya HRD tinggal cek/edit, bukan mulai dari kosong. Visi Misi dikosongkan
// karena sheet aslinya juga masih kosong (belum pernah diisi).
const DRAFT_TATA_TERTIB = `PUNISHMENT PELANGGARAN RINGAN (contoh, sesuaikan sebelum dipublikasikan):
1. Keterlambatan / Pulang Lebih Awal — teguran 1-2x/bulan disertai potongan gaji harian bertingkat (>10 menit: 20%, >20 menit: 30%, >2 jam: 40%, >4 jam: 50%); lebih dari 2x teguran: tidak ada pencairan uang prestasi; lebih dari 5x: penurunan SP 1, lalu SP 2/SP 3 jika berulang.
2. Perizinan (Alpha/Sakit/Izin) — potongan gaji harian bertingkat sesuai jenis; lebih dari 5x teguran: penurunan SP 3.
3. Ketidakikutsertaan Program Wajib, Penggunaan Seragam & Atribut, Makan Saat Jam Kerja — teguran lisan bertingkat, berlanjut ke SP jika berulang.
4. Administrasi (Budgeting, Nota, Reimbursement, Pembayaran/Tagihan) — penundaan pencairan sampai kelengkapan dipenuhi, atau penggantian jika ada kerugian.
5. Evaluasi Kinerja & Penggajian — teguran hingga penurunan SP 1-3 untuk manipulasi data/skor.

PUNISHMENT PELANGGARAN BERAT (contoh, sesuaikan sebelum dipublikasikan):
1. Kekerasan, Perundungan, Pelecehan — teguran lisan + mediasi hingga penurunan SP 1-3 tergantung tingkat keparahan.
2. Kerusakan Aset Perusahaan — mengganti aset yang rusak + penurunan SP 1-3.
3. Penyalahgunaan Data/Informasi Internal — teguran lisan, SP 3, hingga somasi untuk kebocoran data rahasia.
4. Merokok, Minuman Keras, & Judi di lingkungan kerja — teguran bertingkat hingga penurunan SP 1-3.
5. Penyalahgunaan Dana Perusahaan, Peralatan Kerja, & Perjalanan Dinas — penggantian kerugian + sanksi disiplin.`;

const DRAFT_KEBIJAKAN_REWARD = `1. Insentif Kinerja — bonus maksimal 20% dari laba bersih saat target laba semester tercapai; insentif sesuai kebijakan untuk kinerja baik sesuai posisi/jabatan.
2. Kesehatan — biaya pengobatan ditanggung perusahaan untuk gangguan kesehatan saat bekerja.
3. Kesejahteraan Sosial — bantuan pernikahan (masa kerja >2 tahun), santunan kelahiran anak, santunan & karangan bunga belasungkawa.
4. Fasilitas Kerja — kompensasi/biaya maintenance untuk penggunaan alat pribadi demi pekerjaan.
5. Bonus Prestasi — pencairan bonus untuk evaluasi bulanan baik/sangat baik, atau kehadiran sempurna 1 bulan.
6. Penghargaan Tahunan — bonus + penghargaan simbolis untuk kinerja kompeten dan bebas pelanggaran.
7. Lembur & Tugas Khusus — upah lembur/bonus tambahan.
8. Karier — promosi/penambahan tanggung jawab untuk kinerja & sikap kerja baik.
9. Pengembangan SDM — pelatihan & sertifikasi (biaya perusahaan) untuk karyawan loyal & berdedikasi.`;

export default function ProfilPerusahaan() {
  const { terverifikasi, keluar } = useAksesGate('akses_hrd');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CompanyInfo | null>(null);

  useEffect(() => {
    if (!terverifikasi) return;
    (async () => {
      setLoading(true);
      try {
        const info = await getCompanyInfo();
        setForm({
          ...info,
          tataTertib: info.tataTertib || DRAFT_TATA_TERTIB,
          kebijakanReward: info.kebijakanReward || DRAFT_KEBIJAKAN_REWARD,
        });
      } catch (err) {
        showToast('error', `Gagal memuat profil perusahaan: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terverifikasi]);

  function updateField<K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    try {
      const { updatedAt: _u, ...data } = form;
      await setCompanyInfo(data);
      showToast('success', 'Profil perusahaan tersimpan. Perubahan langsung tampil di semua Rapor Online karyawan.');
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!terverifikasi) return <Navigate to={ROUTES.HRD_AKSES} replace />;

  return (
    <div>
      <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Profil Perusahaan</h1>
        <p>
          Konten di sini <strong>sama untuk semua karyawan</strong> dan tampil sebagai halaman umum di Rapor
          Online masing-masing — jadi cukup diisi/diedit sekali di sini, tidak perlu ditulis ulang di file
          setiap karyawan seperti di spreadsheet lama.
        </p>
        {loading || !form ? (
          <Spinner label="Memuat profil perusahaan..." />
        ) : (
          <form className="card" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field span-12">
                <label htmlFor="namaPerusahaan">Nama Perusahaan</label>
                <input id="namaPerusahaan" value={form.namaPerusahaan} onChange={(e) => updateField('namaPerusahaan', e.target.value)} required />
              </div>
              <div className="form-field span-12">
                <label htmlFor="alamat">Alamat</label>
                <input id="alamat" value={form.alamat} onChange={(e) => updateField('alamat', e.target.value)} />
              </div>
              <div className="form-field span-12">
                <label htmlFor="kontak">Kontak</label>
                <input id="kontak" value={form.kontak} onChange={(e) => updateField('kontak', e.target.value)} />
              </div>
              <div className="form-field span-12">
                <label htmlFor="visiMisi">Visi &amp; Misi</label>
                <textarea
                  id="visiMisi"
                  style={{ minHeight: 140 }}
                  placeholder="Belum diisi di spreadsheet lama — tulis Visi & Misi perusahaan di sini."
                  value={form.visiMisi}
                  onChange={(e) => updateField('visiMisi', e.target.value)}
                />
              </div>
              <div className="form-field span-12">
                <label htmlFor="tataTertib">Tata Tertib &amp; Peraturan (Punishment)</label>
                <textarea id="tataTertib" style={{ minHeight: 260 }} value={form.tataTertib} onChange={(e) => updateField('tataTertib', e.target.value)} />
              </div>
              <div className="form-field span-12">
                <label htmlFor="kebijakanReward">Kebijakan Reward</label>
                <textarea id="kebijakanReward" style={{ minHeight: 220 }} value={form.kebijakanReward} onChange={(e) => updateField('kebijakanReward', e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn" disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Profil Perusahaan'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
