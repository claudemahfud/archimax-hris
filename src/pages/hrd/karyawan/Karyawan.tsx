import { useEffect, useState, type FormEvent, type ChangeEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan, tambahKaryawan, editKaryawan, hapusKaryawan, kodeAksesRaporDefault } from '../../../shared/lib/firestore';
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
  fotoUrl: '', kodeAksesRapor: '',
};

// ============================================================
// SECTION: Component
// ============================================================
export default function Karyawan() {
  const { terverifikasi, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { keluar: keluarSuperadmin } = useAksesSuperadmin();
  const keluar = () => { keluarSuperadmin(); keluarHrd(); };
  const { showToast } = useToast();
  const [daftar, setDaftar] = useState<KaryawanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_KOSONG);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [progressFoto, setProgressFoto] = useState(0);
  // Form Tambah Karyawan baru sengaja tersembunyi sampai tombol "+ Tambah Karyawan" diklik,
  // supaya user memilih dulu Input Manual atau Import Excel sebelum form panjang muncul.
  const [formTerbuka, setFormTerbuka] = useState(false);
  const [modeTambah, setModeTambah] = useState<'manual' | 'excel'>('manual');
  const [membacaExcel, setMembacaExcel] = useState(false);
  const [peringatanExcel, setPeringatanExcel] = useState<string[]>([]);
  const [namaFileExcel, setNamaFileExcel] = useState('');
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

  function bukaFormTambah() {
    setEditId(null);
    setForm(FORM_KOSONG);
    setModeTambah('manual');
    setPeringatanExcel([]);
    setNamaFileExcel('');
    setFormTerbuka(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function mulaiEdit(k: KaryawanType) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = k;
    // Gabung dengan FORM_KOSONG supaya field yang belum ada di dokumen lama (mis. karyawan
    // yang dibuat sebelum field "Brand" ditambahkan) tetap dapat nilai default yang benar-benar
    // tersimpan di state form — bukan cuma tampilan default select di browser yang menipu.
    setForm({ ...FORM_KOSONG, ...rest });
    setEditId(k.id);
    setFormTerbuka(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function batalEdit() {
    setEditId(null);
    setForm(FORM_KOSONG);
    setFormTerbuka(false);
    setModeTambah('manual');
    setPeringatanExcel([]);
    setNamaFileExcel('');
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
      if (editId) {
        await editKaryawan(editId, form);
        showToast('success', `Data ${form.namaLengkap} berhasil diperbarui.`);
      } else {
        const id = await tambahKaryawan(form);
        const url = `${window.location.origin}${ROUTES.raporUrl(id)}`;
        const pin = form.kodeAksesRapor || kodeAksesRaporDefault(form);
        try {
          await navigator.clipboard.writeText(`Link Rapor ${form.namaLengkap}: ${url}\nPIN: ${pin}`);
          showToast('success', `Karyawan ${form.namaLengkap} ditambahkan. Link + PIN Rapor otomatis dibuat & disalin ke clipboard.`);
        } catch {
          showToast('success', `Karyawan ${form.namaLengkap} ditambahkan. Link Rapor: ${url} (PIN: ${pin})`);
        }
      }
      batalEdit();
      await muatDaftar();
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleHapus(k: KaryawanType) {
    if (!window.confirm(`Hapus karyawan "${k.namaLengkap}"? Seluruh riwayat KPI-nya juga akan terhapus. Tindakan ini tidak bisa dibatalkan.`)) return;
    setMenghapusId(k.id);
    try {
      await hapusKaryawan(k.id);
      showToast('success', `Karyawan ${k.namaLengkap} berhasil dihapus.`);
      if (editId === k.id) batalEdit();
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

        {!formTerbuka && (
          <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <p style={{ margin: 0 }}>Tambahkan karyawan baru lewat form manual atau isi cepat dari file Excel.</p>
            <button type="button" className="btn" onClick={bukaFormTambah}>+ Tambah Karyawan</button>
          </div>
        )}

        {formTerbuka && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{editId ? `Edit: ${form.namaLengkap}` : 'Tambah Karyawan Baru'}</h2>

          {!editId && (
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
              <select id="divisi" value={form.divisi} onChange={(e) => updateField('divisi', e.target.value)} required>
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
          <div className="form-field">
            <label htmlFor="alamatDomisili">Alamat Domisili (Alamat Lengkap)</label>
            <textarea id="alamatDomisili" value={form.alamatDomisili} onChange={(e) => updateField('alamatDomisili', e.target.value)} placeholder="Isi kalau berbeda dari Alamat KTP" />
          </div>

          {/* SECTION: Kontak */}
          <h3>Kontak</h3>
          <div className="form-grid">
            <Field label="No HP" value={form.noHp} onChange={(v) => updateField('noHp', v)} span={4} />
            <Field label="Kontak Darurat" value={form.kontakDarurat} onChange={(v) => updateField('kontakDarurat', v)} span={4} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} span={4} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? <Spinner label="Menyimpan..." /> : editId ? 'Simpan Perubahan' : 'Tambah Karyawan'}
            </button>
            <button type="button" className="btn btn-secondary" onClick={batalEdit}>Batal</button>
          </div>
        </form>
        )}

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
                  <tr><th>Foto</th><th>Nama</th><th>Jabatan</th><th>Divisi</th><th>Brand</th><th>Rapor Online</th><th>Aksi</th></tr>
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
                      <td>{k.divisi}</td>
                      <td>{k.brand || '-'}</td>
                      <td>
                        <button
                          type="button"
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
                      </td>
                      <td className="table-actions">
                        <button className="btn btn-secondary" onClick={() => mulaiEdit(k)}>Edit</button>
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
