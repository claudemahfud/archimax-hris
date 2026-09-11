import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import {
  getKaryawan, tambahKaryawan, editKaryawan, kodeAksesRaporDefault,
  cariKaryawanByNip, cariSemuaKaryawanByNip,
} from '../../../shared/lib/firestore';
import { uploadGambarKeCloudinary } from '../../../shared/lib/cloudinary';
import { parseKaryawanExcel } from '../../../shared/lib/excelImport';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import { DAFTAR_BRAND } from '../../../shared/constants/brand';
import type { Karyawan as KaryawanType } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel' },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan' },
];

type FormState = Omit<KaryawanType, 'id' | 'createdAt' | 'updatedAt'>;

const FORM_KOSONG: FormState = {
  nip: '', namaLengkap: '', namaPanggilan: '', jabatan: '', divisi: DAFTAR_DIVISI[0], brand: DAFTAR_BRAND[0],
  bergabungSejak: '', pengalamanKerja: '', statusKaryawan: '', masaKontrak: '',
  gajiPokok: 0, tunjanganKehadiran: 0, tunjanganKompetensi: 0, tunjanganJabatan: 0,
  tunjanganTransportasi: 0, performanceInsentive: 0, estimasiTakeHomePay: 0,
  nik: '', tempatLahir: '', tanggalLahir: '', jenisKelamin: '', alamatKtp: '', alamatDomisili: '',
  agama: '', statusPerkawinan: '', kewarganegaraan: 'Indonesia', noHp: '', kontakDarurat: '',
  email: '', jumlahIstri: 0, jumlahAnak: 0, pendidikanTerakhir: '', levelUser: 'Staff',
  fotoUrl: '', kodeAksesRapor: '', catatan: '',
};

// ============================================================
// SECTION: Component
// ============================================================
export default function KelolaKaryawan() {
  const { terverifikasi, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { keluar: keluarSuperadmin } = useAksesSuperadmin();
  const keluar = () => { keluarSuperadmin(); keluarHrd(); };
  const { showToast } = useToast();
  const navigate = useNavigate();
  // Slug /hrd/kelola-karyawan/:id -> mode Edit. Slug /hrd/kelola-karyawan (tanpa id) -> mode Tambah.
  // Sengaja SELALU ambil "id" dari URL (bukan dari state komponen Daftar Karyawan) supaya form
  // ini tidak pernah bergantung pada state React yang bisa hilang/salah saat pindah halaman —
  // itu penyebab bug lama: form Edit kebobolan dianggap "Tambah Baru" lalu NIP-nya sendiri
  // terdeteksi "sudah dipakai" oleh dirinya sendiri.
  const { id } = useParams<{ id: string }>();
  const modeEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(FORM_KOSONG);
  const [memuatData, setMemuatData] = useState(modeEdit);
  const [tidakDitemukan, setTidakDitemukan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [progressFoto, setProgressFoto] = useState(0);
  // Default true: kebanyakan karyawan alamat domisilinya sama dengan alamat KTP, jadi field
  // Alamat Domisili disembunyikan sampai user sendiri yang menandakan alamatnya berbeda.
  const [domisiliSama, setDomisiliSama] = useState(true);
  const [modeTambah, setModeTambah] = useState<'manual' | 'excel'>('manual');
  const [membacaExcel, setMembacaExcel] = useState(false);
  const [peringatanExcel, setPeringatanExcel] = useState<string[]>([]);
  const [namaFileExcel, setNamaFileExcel] = useState('');

  // Mode Edit: selalu ambil dokumen langsung dari Firestore pakai id di URL — bukan dari
  // daftar/state halaman sebelumnya — supaya data yang diedit selalu versi terbaru & valid.
  useEffect(() => {
    if (!terverifikasi) return;
    if (!id) {
      setForm(FORM_KOSONG);
      setDomisiliSama(true);
      setMemuatData(false);
      setTidakDitemukan(false);
      return;
    }
    let batal = false;
    setMemuatData(true);
    setTidakDitemukan(false);
    getKaryawan(id)
      .then((data) => {
        if (batal) return;
        if (!data) {
          setTidakDitemukan(true);
          return;
        }
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = data;
        // Gabung dengan FORM_KOSONG supaya field yang belum ada di dokumen lama (mis. karyawan
        // yang dibuat sebelum field "Brand" ditambahkan) tetap dapat nilai default yang benar.
        const merged = { ...FORM_KOSONG, ...rest };
        setForm(merged);
        setDomisiliSama(!merged.alamatDomisili || merged.alamatDomisili === merged.alamatKtp);
      })
      .catch((err) => {
        if (batal) return;
        showToast('error', `Gagal memuat data karyawan: ${err instanceof Error ? err.message : String(err)}`);
        setTidakDitemukan(true);
      })
      .finally(() => {
        if (!batal) setMemuatData(false);
      });
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terverifikasi, id]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // supaya bisa pilih file yang sama lagi kalau perlu re-upload
    if (!file) return;
    setUploadingFoto(true);
    setProgressFoto(0);
    try {
      const hasil = await uploadGambarKeCloudinary(file, setProgressFoto);
      updateField('fotoUrl', hasil.url);
      showToast('success', 'Foto berhasil diunggah.');
    } catch (err) {
      showToast('error', `Gagal mengunggah foto: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploadingFoto(false);
    }
  }

  // Import Excel di form Tambah Karyawan sengaja HANYA membaca lalu mengisi form (tidak
  // langsung simpan ke database) — beda dari halaman Import Excel massal. User cek & lengkapi
  // manual dulu field yang belum terisi, baru klik "Tambah Karyawan" untuk benar-benar simpan.
  async function handleFileExcel(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMembacaExcel(true);
    setPeringatanExcel([]);
    try {
      const hasil = await parseKaryawanExcel(file);
      setForm(hasil.karyawan);
      setDomisiliSama(!hasil.karyawan.alamatDomisili || hasil.karyawan.alamatDomisili === hasil.karyawan.alamatKtp);
      setPeringatanExcel(hasil.peringatan);
      setNamaFileExcel(file.name);
      showToast('success', `Data dari "${file.name}" berhasil dibaca. Cek & lengkapi field yang masih kosong, lalu klik Tambah Karyawan.`);
    } catch (err) {
      showToast('error', `Gagal membaca file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setMembacaExcel(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // NIP di-trim dulu sebelum dibandingkan & disimpan — spasi tersisa dari copy-paste Excel
      // bisa bikin NIP yang "kelihatan sama" tersimpan beda-beda di Firestore, atau sebaliknya
      // dianggap tidak bentrok padahal sebenarnya sama persis.
      const nipTrimmed = form.nip.trim();
      // Toggle "sama dengan Alamat KTP" aktif -> Alamat Domisili otomatis disamakan saat
      // disimpan, jadi user tidak perlu ketik ulang alamat yang sama dua kali.
      const formTrimmed: FormState = {
        ...form,
        nip: nipTrimmed,
        alamatDomisili: domisiliSama ? form.alamatKtp : form.alamatDomisili,
      };

      if (modeEdit && id) {
        // Cek NIP dobel juga saat edit (kalau NIP diubah ke NIP milik karyawan lain).
        // Pakai cariSemuaKaryawanByNip (bukan cariKaryawanByNip) dan exclude id dokumen yang
        // sedang diedit (dari URL, bukan dari state) — supaya dokumen yang SEDANG diedit tidak
        // pernah salah dituduh "bentrok dengan dirinya sendiri".
        if (nipTrimmed) {
          const semuaBentrok = (await cariSemuaKaryawanByNip(nipTrimmed)).filter((k) => k.id !== id);
          if (semuaBentrok.length > 0) {
            showToast('error', `NIP "${nipTrimmed}" sudah dipakai oleh ${semuaBentrok[0].namaLengkap}. Gunakan NIP lain.`);
            setSaving(false);
            return;
          }
        }
        await editKaryawan(id, formTrimmed);
        showToast('success', `Data ${formTrimmed.namaLengkap} berhasil diperbarui.`);
      } else {
        if (nipTrimmed) {
          const bentrok = await cariKaryawanByNip(nipTrimmed);
          if (bentrok) {
            showToast('error', `NIP "${nipTrimmed}" sudah terdaftar atas nama ${bentrok.namaLengkap}. Gunakan NIP lain atau edit data yang sudah ada.`);
            setSaving(false);
            return;
          }
        }
        const newId = await tambahKaryawan(formTrimmed);
        const url = `${window.location.origin}${ROUTES.raporUrl(newId)}`;
        const pin = formTrimmed.kodeAksesRapor || kodeAksesRaporDefault(formTrimmed);
        try {
          await navigator.clipboard.writeText(`Link Rapor ${formTrimmed.namaLengkap}: ${url}\nPIN: ${pin}`);
          showToast('success', `Karyawan ${formTrimmed.namaLengkap} ditambahkan. Link + PIN Rapor otomatis dibuat & disalin ke clipboard.`);
        } catch {
          showToast('success', `Karyawan ${formTrimmed.namaLengkap} ditambahkan. Link Rapor: ${url} (PIN: ${pin})`);
        }
      }
      navigate(ROUTES.HRD_KARYAWAN);
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  if (!terverifikasi) return <Navigate to={ROUTES.HRD_AKSES} replace />;

  if (tidakDitemukan) {
    return (
      <div>
        <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
        <div className="page">
          <div className="card">
            <h2>Karyawan tidak ditemukan</h2>
            <p>Data karyawan yang ingin diedit sudah tidak ada (mungkin sudah dihapus).</p>
            <button type="button" className="btn" onClick={() => navigate(ROUTES.HRD_KARYAWAN)}>Kembali ke Daftar Karyawan</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Kelola Data Karyawan</h1>

        {memuatData ? (
          <div className="card"><Spinner label="Memuat data karyawan..." /></div>
        ) : (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{modeEdit ? `Edit: ${form.namaLengkap}` : 'Tambah Karyawan Baru'}</h2>

          {!modeEdit && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <button
                  type="button"
                  className={modeTambah === 'manual' ? 'btn' : 'btn btn-secondary'}
                  onClick={() => setModeTambah('manual')}
                >
                  Input Form Manual
                </button>
                <button
                  type="button"
                  className={modeTambah === 'excel' ? 'btn' : 'btn btn-secondary'}
                  onClick={() => setModeTambah('excel')}
                >
                  Import Excel
                </button>
              </div>

              {modeTambah === 'excel' && (
                <div className="form-field" style={{ marginBottom: 0 }}>
                  <label htmlFor="fileExcelTambah">Pilih 1 file Excel karyawan (.xlsx/.xls)</label>
                  <input id="fileExcelTambah" type="file" accept=".xlsx,.xls" onChange={handleFileExcel} disabled={membacaExcel} />
                  {membacaExcel && <Spinner label="Membaca file..." />}
                  {namaFileExcel && !membacaExcel && (
                    <p style={{ fontSize: '0.85rem', color: 'var(--grey-medium)', marginTop: 6 }}>
                      Data dari <strong>{namaFileExcel}</strong> sudah mengisi form di bawah. Field yang kosong/perlu dicek:
                    </p>
                  )}
                  {peringatanExcel.length > 0 && (
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: '0.82rem', color: 'var(--grey-medium)' }}>
                      {peringatanExcel.map((p, i) => <li key={i}>{p}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* SECTION: Foto Profil */}
          <h3>Foto Profil</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
            <div
              style={{
                width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: form.fotoUrl ? 'transparent' : 'var(--gradient-brand)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '1.4rem', border: '2px solid var(--grey-light)',
              }}
            >
              {form.fotoUrl ? (
                <img src={form.fotoUrl} alt={`Foto profil ${form.namaLengkap || 'karyawan'}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                (form.namaLengkap || '?').trim().charAt(0).toUpperCase()
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
              <label htmlFor="fotoKaryawan" className="btn btn-secondary" style={{ width: 'fit-content', cursor: 'pointer' }}>
                {uploadingFoto ? 'Mengunggah...' : form.fotoUrl ? 'Ganti Foto' : 'Unggah Foto'}
              </label>
              <input
                id="fotoKaryawan"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFotoChange}
                disabled={uploadingFoto}
                style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
              />
              {uploadingFoto && (
                <div style={{ width: 180 }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${progressFoto}%` }} />
                  </div>
                </div>
              )}
              <span style={{ fontSize: '0.8rem', color: 'var(--grey-medium)' }}>JPG, PNG, atau WEBP — maksimal 5 MB.</span>
            </div>
          </div>

          {/* SECTION: Data Kepegawaian */}
          <h3>Data Kepegawaian</h3>
          <div className="form-grid">
            <Field label="NIP" value={form.nip} onChange={(v) => updateField('nip', v)} required span={3} />
            <Field label="Nama Lengkap" value={form.namaLengkap} onChange={(v) => updateField('namaLengkap', v)} required span={5} />
            <Field label="Nama Panggilan" value={form.namaPanggilan} onChange={(v) => updateField('namaPanggilan', v)} span={4} />
            <Field label="Jabatan" value={form.jabatan} onChange={(v) => updateField('jabatan', v)} required span={5} />
            <div className="form-field span-4">
              <label htmlFor="divisi">Divisi</label>
              <select id="divisi" value={form.divisi} onChange={(e) => updateField('divisi', e.target.value)}>
                <option value="">- Belum diisi -</option>
                {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-field span-3">
              <label htmlFor="brand">Brand</label>
              <select id="brand" value={form.brand} onChange={(e) => updateField('brand', e.target.value)} required>
                {DAFTAR_BRAND.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <Field label="Bergabung Sejak" type="date" value={form.bergabungSejak} onChange={(v) => updateField('bergabungSejak', v)} span={3} />
            <Field label="Pengalaman Kerja" value={form.pengalamanKerja} onChange={(v) => updateField('pengalamanKerja', v)} span={6} />
            <Field label="Status Karyawan" value={form.statusKaryawan} onChange={(v) => updateField('statusKaryawan', v)} span={4} />
            <Field label="Masa Kontrak" type="date" value={form.masaKontrak} onChange={(v) => updateField('masaKontrak', v)} span={3} />
            <div className="form-field span-3">
              <label htmlFor="levelUser">Level User</label>
              <select id="levelUser" value={form.levelUser} onChange={(e) => updateField('levelUser', e.target.value as 'Staff' | 'HOD' | 'EKSEKUTIF')} required>
                <option value="Staff">Staff</option>
                <option value="HOD">HOD</option>
                <option value="EKSEKUTIF">EKSEKUTIF</option>
              </select>
            </div>
            <Field
              label="PIN Rapor Online (kosongkan = 6 digit terakhir NIK)"
              value={form.kodeAksesRapor || ''}
              onChange={(v) => updateField('kodeAksesRapor', v)}
              span={6}
            />
            <div className="form-field span-12">
              <label htmlFor="catatan">Catatan (data yang belum lengkap / keterangan manual)</label>
              <textarea
                id="catatan"
                value={form.catatan || ''}
                onChange={(e) => updateField('catatan', e.target.value)}
                placeholder="mis. NIK & KTP menyusul, nomor rekening belum ada, dsb."
              />
            </div>
          </div>

          {/* SECTION: Kompensasi */}
          <h3>Kompensasi</h3>
          <div className="form-grid">
            <Field label="Gaji Pokok" type="number" value={form.gajiPokok} onChange={(v) => updateField('gajiPokok', Number(v))} span={4} />
            <Field label="Tunjangan Kehadiran" type="number" value={form.tunjanganKehadiran} onChange={(v) => updateField('tunjanganKehadiran', Number(v))} span={4} />
            <Field label="Tunjangan Kompetensi" type="number" value={form.tunjanganKompetensi} onChange={(v) => updateField('tunjanganKompetensi', Number(v))} span={4} />
            <Field label="Tunjangan Jabatan" type="number" value={form.tunjanganJabatan} onChange={(v) => updateField('tunjanganJabatan', Number(v))} span={4} />
            <Field label="Tunjangan Transportasi" type="number" value={form.tunjanganTransportasi} onChange={(v) => updateField('tunjanganTransportasi', Number(v))} span={4} />
            <Field label="Performance Insentive" type="number" value={form.performanceInsentive} onChange={(v) => updateField('performanceInsentive', Number(v))} span={4} />
            <Field label="Estimasi Take Home Pay" type="number" value={form.estimasiTakeHomePay} onChange={(v) => updateField('estimasiTakeHomePay', Number(v))} span={4} />
          </div>

          {/* SECTION: Data Pribadi */}
          <h3>Data Pribadi</h3>
          <div className="form-grid">
            <Field label="NIK" value={form.nik} onChange={(v) => updateField('nik', v)} span={4} />
            <Field label="Tempat Lahir" value={form.tempatLahir} onChange={(v) => updateField('tempatLahir', v)} span={4} />
            <Field label="Tanggal Lahir" type="date" value={form.tanggalLahir} onChange={(v) => updateField('tanggalLahir', v)} span={4} />
            <Field label="Jenis Kelamin" value={form.jenisKelamin} onChange={(v) => updateField('jenisKelamin', v)} span={3} />
            <Field label="Agama" value={form.agama} onChange={(v) => updateField('agama', v)} span={3} />
            <Field label="Status Perkawinan" value={form.statusPerkawinan} onChange={(v) => updateField('statusPerkawinan', v)} span={3} />
            <Field label="Kewarganegaraan" value={form.kewarganegaraan} onChange={(v) => updateField('kewarganegaraan', v)} span={3} />
            <Field label="Jumlah Istri/Suami" type="number" value={form.jumlahIstri} onChange={(v) => updateField('jumlahIstri', Number(v))} span={3} />
            <Field label="Jumlah Anak" type="number" value={form.jumlahAnak} onChange={(v) => updateField('jumlahAnak', Number(v))} span={3} />
            <Field label="Pendidikan Terakhir" value={form.pendidikanTerakhir} onChange={(v) => updateField('pendidikanTerakhir', v)} span={6} />
          </div>
          <div className="form-field">
            <label htmlFor="alamatKtp">Alamat KTP (Alamat Lengkap)</label>
            <textarea id="alamatKtp" value={form.alamatKtp} onChange={(e) => updateField('alamatKtp', e.target.value)} placeholder="Contoh: Jl. Contoh No. 12, RT 01/RW 02, Kelurahan, Kecamatan, Kota, Provinsi, Kode Pos" />
          </div>
          <div className="form-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              id="domisiliSamaKtp"
              type="checkbox"
              checked={domisiliSama}
              onChange={(e) => setDomisiliSama(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <label htmlFor="domisiliSamaKtp" style={{ margin: 0 }}>Alamat Domisili sama dengan Alamat KTP</label>
          </div>
          {!domisiliSama && (
            <div className="form-field">
              <label htmlFor="alamatDomisili">Alamat Domisili (Alamat Lengkap)</label>
              <textarea id="alamatDomisili" value={form.alamatDomisili} onChange={(e) => updateField('alamatDomisili', e.target.value)} placeholder="Isi alamat domisili yang berbeda dari Alamat KTP" />
            </div>
          )}

          {/* SECTION: Kontak */}
          <h3>Kontak</h3>
          <div className="form-grid">
            <Field label="No HP" value={form.noHp} onChange={(v) => updateField('noHp', v)} span={4} />
            <Field label="Kontak Darurat" value={form.kontakDarurat} onChange={(v) => updateField('kontakDarurat', v)} span={4} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} span={4} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? <Spinner label="Menyimpan..." /> : modeEdit ? 'Simpan Perubahan' : 'Tambah Karyawan'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(ROUTES.HRD_KARYAWAN)}>Batal</button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SECTION: Field — didefinisikan top-level (bukan nested) supaya fokus input tidak hilang
// ============================================================
function Field({ label, value, onChange, type = 'text', required = false, span = 4 }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; required?: boolean; span?: number;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className={`form-field span-${span}`}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
