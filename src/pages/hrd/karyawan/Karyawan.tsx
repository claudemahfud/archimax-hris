import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan, tambahKaryawan, editKaryawan } from '../../../shared/lib/firestore';
import { DAFTAR_DIVISI } from '../../../shared/constants/kpi';
import type { Karyawan as KaryawanType } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
];

type FormState = Omit<KaryawanType, 'id' | 'createdAt' | 'updatedAt'>;

const FORM_KOSONG: FormState = {
  nip: '', namaLengkap: '', namaPanggilan: '', jabatan: '', divisi: DAFTAR_DIVISI[0], gradeJabatan: '',
  bergabungSejak: '', pengalamanKerja: '', statusKaryawan: '', masaKontrak: '',
  gajiPokok: 0, tunjanganKehadiran: 0, tunjanganKompetensi: 0, tunjanganJabatan: 0,
  tunjanganTransportasi: 0, performanceInsentive: 0, estimasiTakeHomePay: 0,
  nik: '', tempatLahir: '', tanggalLahir: '', jenisKelamin: '', alamatKtp: '', alamatDomisili: '',
  agama: '', statusPerkawinan: '', kewarganegaraan: 'Indonesia', noHp: '', kontakDarurat: '',
  email: '', jumlahIstri: 0, jumlahAnak: 0, pendidikanTerakhir: '', levelUser: 'Staff',
};

// ============================================================
// SECTION: Component
// ============================================================
export default function Karyawan() {
  const { terverifikasi, keluar } = useAksesGate('akses_hrd');
  const { showToast } = useToast();
  const [daftar, setDaftar] = useState<KaryawanType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(FORM_KOSONG);

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

  function mulaiEdit(k: KaryawanType) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = k;
    setForm(rest);
    setEditId(k.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function batalEdit() {
    setEditId(null);
    setForm(FORM_KOSONG);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await editKaryawan(editId, form);
        showToast('success', `Data ${form.namaLengkap} berhasil diperbarui.`);
      } else {
        await tambahKaryawan(form);
        showToast('success', `Karyawan ${form.namaLengkap} berhasil ditambahkan.`);
      }
      batalEdit();
      await muatDaftar();
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
        <h1>Kelola Data Karyawan</h1>

        <form className="card" onSubmit={handleSubmit}>
          <h2>{editId ? `Edit: ${form.namaLengkap}` : 'Tambah Karyawan Baru'}</h2>

          {/* SECTION: Data Kepegawaian */}
          <h3>Data Kepegawaian</h3>
          <div className="form-grid">
            <Field label="NIP" value={form.nip} onChange={(v) => updateField('nip', v)} required />
            <Field label="Nama Lengkap" value={form.namaLengkap} onChange={(v) => updateField('namaLengkap', v)} required />
            <Field label="Nama Panggilan" value={form.namaPanggilan} onChange={(v) => updateField('namaPanggilan', v)} />
            <Field label="Jabatan" value={form.jabatan} onChange={(v) => updateField('jabatan', v)} required />
            <div className="form-field">
              <label htmlFor="divisi">Divisi</label>
              <select id="divisi" value={form.divisi} onChange={(e) => updateField('divisi', e.target.value)} required>
                {DAFTAR_DIVISI.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <Field label="Grade Jabatan" value={form.gradeJabatan} onChange={(v) => updateField('gradeJabatan', v)} />
            <Field label="Bergabung Sejak" type="date" value={form.bergabungSejak} onChange={(v) => updateField('bergabungSejak', v)} />
            <Field label="Pengalaman Kerja" value={form.pengalamanKerja} onChange={(v) => updateField('pengalamanKerja', v)} />
            <Field label="Status Karyawan" value={form.statusKaryawan} onChange={(v) => updateField('statusKaryawan', v)} />
            <Field label="Masa Kontrak" type="date" value={form.masaKontrak} onChange={(v) => updateField('masaKontrak', v)} />
            <div className="form-field">
              <label htmlFor="levelUser">Level User</label>
              <select id="levelUser" value={form.levelUser} onChange={(e) => updateField('levelUser', e.target.value as 'Staff' | 'HOD')} required>
                <option value="Staff">Staff</option>
                <option value="HOD">HOD</option>
              </select>
            </div>
          </div>

          {/* SECTION: Kompensasi */}
          <h3>Kompensasi</h3>
          <div className="form-grid">
            <Field label="Gaji Pokok" type="number" value={form.gajiPokok} onChange={(v) => updateField('gajiPokok', Number(v))} />
            <Field label="Tunjangan Kehadiran" type="number" value={form.tunjanganKehadiran} onChange={(v) => updateField('tunjanganKehadiran', Number(v))} />
            <Field label="Tunjangan Kompetensi" type="number" value={form.tunjanganKompetensi} onChange={(v) => updateField('tunjanganKompetensi', Number(v))} />
            <Field label="Tunjangan Jabatan" type="number" value={form.tunjanganJabatan} onChange={(v) => updateField('tunjanganJabatan', Number(v))} />
            <Field label="Tunjangan Transportasi" type="number" value={form.tunjanganTransportasi} onChange={(v) => updateField('tunjanganTransportasi', Number(v))} />
            <Field label="Performance Insentive" type="number" value={form.performanceInsentive} onChange={(v) => updateField('performanceInsentive', Number(v))} />
            <Field label="Estimasi Take Home Pay" type="number" value={form.estimasiTakeHomePay} onChange={(v) => updateField('estimasiTakeHomePay', Number(v))} />
          </div>

          {/* SECTION: Data Pribadi */}
          <h3>Data Pribadi</h3>
          <div className="form-grid">
            <Field label="NIK" value={form.nik} onChange={(v) => updateField('nik', v)} />
            <Field label="Tempat Lahir" value={form.tempatLahir} onChange={(v) => updateField('tempatLahir', v)} />
            <Field label="Tanggal Lahir" type="date" value={form.tanggalLahir} onChange={(v) => updateField('tanggalLahir', v)} />
            <Field label="Jenis Kelamin" value={form.jenisKelamin} onChange={(v) => updateField('jenisKelamin', v)} />
            <Field label="Agama" value={form.agama} onChange={(v) => updateField('agama', v)} />
            <Field label="Status Perkawinan" value={form.statusPerkawinan} onChange={(v) => updateField('statusPerkawinan', v)} />
            <Field label="Kewarganegaraan" value={form.kewarganegaraan} onChange={(v) => updateField('kewarganegaraan', v)} />
            <Field label="Jumlah Istri/Suami" type="number" value={form.jumlahIstri} onChange={(v) => updateField('jumlahIstri', Number(v))} />
            <Field label="Jumlah Anak" type="number" value={form.jumlahAnak} onChange={(v) => updateField('jumlahAnak', Number(v))} />
            <Field label="Pendidikan Terakhir" value={form.pendidikanTerakhir} onChange={(v) => updateField('pendidikanTerakhir', v)} />
          </div>
          <div className="form-field">
            <label htmlFor="alamatKtp">Alamat KTP</label>
            <textarea id="alamatKtp" value={form.alamatKtp} onChange={(e) => updateField('alamatKtp', e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="alamatDomisili">Alamat Domisili</label>
            <textarea id="alamatDomisili" value={form.alamatDomisili} onChange={(e) => updateField('alamatDomisili', e.target.value)} />
          </div>

          {/* SECTION: Kontak */}
          <h3>Kontak</h3>
          <div className="form-grid">
            <Field label="No HP" value={form.noHp} onChange={(v) => updateField('noHp', v)} />
            <Field label="Kontak Darurat" value={form.kontakDarurat} onChange={(v) => updateField('kontakDarurat', v)} />
            <Field label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? <Spinner label="Menyimpan..." /> : editId ? 'Simpan Perubahan' : 'Tambah Karyawan'}
            </button>
            {editId && <button type="button" className="btn btn-secondary" onClick={batalEdit}>Batal</button>}
          </div>
        </form>

        <div className="card">
          <h2>Daftar Karyawan ({daftar.length})</h2>
          {loading ? (
            <Spinner label="Memuat daftar karyawan..." />
          ) : daftar.length === 0 ? (
            <p>Belum ada karyawan terdaftar.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Nama</th><th>Jabatan</th><th>Divisi</th><th>Level User</th><th>Aksi</th></tr>
              </thead>
              <tbody>
                {daftar.map((k) => (
                  <tr key={k.id}>
                    <td>{k.namaLengkap}</td>
                    <td>{k.jabatan}</td>
                    <td>{k.divisi}</td>
                    <td>{k.levelUser}</td>
                    <td><button className="btn btn-secondary" onClick={() => mulaiEdit(k)}>Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SECTION: Field — didefinisikan top-level (bukan nested) supaya fokus input tidak hilang
// ============================================================
function Field({ label, value, onChange, type = 'text', required = false }: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; required?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}
