import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where,
  orderBy, setDoc, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Karyawan, PenilaianKpi, PenilaianKpiForm, CompanyInfo, HasilImportExcel } from '../types';

// ============================================================
// SECTION: Karyawan (Master Data)
// ============================================================
const KARYAWAN_COL = 'karyawan';

export async function listKaryawan(divisi?: string): Promise<Karyawan[]> {
  const col = collection(db, KARYAWAN_COL);
  const q = divisi ? query(col, where('divisi', '==', divisi)) : query(col, orderBy('namaLengkap'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Karyawan, 'id'>) }));
}

export async function listKaryawanHod(): Promise<Karyawan[]> {
  const col = collection(db, KARYAWAN_COL);
  const q = query(col, where('levelUser', '==', 'HOD'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Karyawan, 'id'>) }));
}

export async function getKaryawan(id: string): Promise<Karyawan | null> {
  const ref = doc(db, KARYAWAN_COL, id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Karyawan, 'id'>) }) : null;
}

export async function tambahKaryawan(data: Omit<Karyawan, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const ref = await addDoc(collection(db, KARYAWAN_COL), {
    ...data,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  return ref.id;
}

export async function editKaryawan(id: string, data: Partial<Karyawan>): Promise<void> {
  const ref = doc(db, KARYAWAN_COL, id);
  await updateDoc(ref, { ...data, updatedAt: Date.now() });
}

// Hapus karyawan + seluruh riwayat KPI miliknya (supaya tidak ada data yatim di koleksi penilaianKpi).
export async function hapusKaryawan(id: string): Promise<void> {
  const riwayat = await listRiwayatKpi(id);
  const batch = writeBatch(db);
  for (const r of riwayat) batch.delete(doc(db, PENILAIAN_COL, r.id));
  batch.delete(doc(db, KARYAWAN_COL, id));
  await batch.commit();
}

export async function cariKaryawanByNip(nip: string): Promise<Karyawan | null> {
  if (!nip) return null;
  const col = collection(db, KARYAWAN_COL);
  const snap = await getDocs(query(col, where('nip', '==', nip)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<Karyawan, 'id'>) };
}

// ============================================================
// SECTION: Import Excel (satu-jalan migrasi dari spreadsheet lama)
// ============================================================
// Upsert by NIP: karyawan baru → tambahKaryawan; NIP sudah ada → update data terbaru
// (foto & kodeAksesRapor yang sudah diisi manual TIDAK ditimpa kalau file baru kosong).
// Riwayat KPI dari sheet RAPORT-KPI ditambahkan sebagai dokumen baru per periode, dilewati
// kalau periode yang sama untuk karyawan itu sudah pernah diimpor (supaya aman diulang-ulang).
export async function importSatuKaryawan(hasil: HasilImportExcel): Promise<{ id: string; jumlahRiwayatBaru: number }> {
  const existing = await cariKaryawanByNip(hasil.karyawan.nip);
  let id: string;
  if (existing) {
    const patch: Partial<Karyawan> = { ...hasil.karyawan };
    if (!hasil.karyawan.fotoUrl) delete patch.fotoUrl;
    if (!hasil.karyawan.kodeAksesRapor) delete patch.kodeAksesRapor;
    await editKaryawan(existing.id, patch);
    id = existing.id;
  } else {
    id = await tambahKaryawan(hasil.karyawan);
  }

  const riwayatAda = await listRiwayatKpi(id);
  const periodeAda = new Set(riwayatAda.map((r) => r.periodeMinggu));
  const batch = writeBatch(db);
  let jumlahBaru = 0;
  for (const r of hasil.riwayatKpi) {
    if (periodeAda.has(r.periodeMinggu)) continue;
    const ref = doc(collection(db, PENILAIAN_COL));
    batch.set(ref, { ...r, karyawanId: id, dinilaiOleh: 'HRD', timestamp: Date.now() });
    jumlahBaru++;
  }
  if (jumlahBaru > 0) await batch.commit();

  return { id, jumlahRiwayatBaru: jumlahBaru };
}

/** PIN default kalau HRD belum set kodeAksesRapor manual: 6 digit terakhir NIK. */
export function kodeAksesRaporDefault(k: Pick<Karyawan, 'nik'>): string {
  const digit = (k.nik || '').replace(/\D/g, '');
  return digit.slice(-6) || '000000';
}

// ============================================================
// SECTION: Penilaian KPI
// ============================================================
const PENILAIAN_COL = 'penilaianKpi';

export async function simpanPenilaianKpi(form: PenilaianKpiForm, dinilaiOleh: 'HRD' | 'HOD'): Promise<void> {
  await addDoc(collection(db, PENILAIAN_COL), {
    ...form,
    dinilaiOleh,
    timestamp: serverTimestamp(),
  });
}

export async function listRiwayatKpi(karyawanId: string): Promise<PenilaianKpi[]> {
  const col = collection(db, PENILAIAN_COL);
  const q = query(col, where('karyawanId', '==', karyawanId), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    const ts = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();
    return { id: d.id, ...(data as unknown as PenilaianKpiForm), timestamp: ts, dinilaiOleh: data.dinilaiOleh as 'HRD' | 'HOD' };
  });
}

// ============================================================
// SECTION: Kode Akses (Gate PIN — HRD & per-divisi HOD)
// ============================================================
const SETTINGS_COL = 'settings';

// Kode akses default sebelum Administrator mengatur kode akses sendiri lewat menu
// "Ganti Kode Akses" di Welcome Page. Setelah diganti, nilai di Firestore yang dipakai.
const KODE_AKSES_HRD_DEFAULT = '120200MFD';

export async function getKodeAksesHrd(): Promise<string> {
  const snap = await getDoc(doc(db, SETTINGS_COL, 'aksesHrd'));
  const kode = snap.exists() ? (snap.data().kodeAkses as string) : '';
  return kode || KODE_AKSES_HRD_DEFAULT;
}

export async function setKodeAksesHrd(kode: string): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, 'aksesHrd'), { kodeAkses: kode }, { merge: true });
}

export async function getKodeAksesHod(divisi: string): Promise<string> {
  const snap = await getDoc(doc(db, SETTINGS_COL, 'aksesHod'));
  const data = snap.exists() ? (snap.data() as Record<string, string>) : {};
  return data[divisi] || '';
}

export async function setKodeAksesHod(divisi: string, kode: string): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, 'aksesHod'), { [divisi]: kode }, { merge: true });
}

// ============================================================
// SECTION: Login Superadmin (proteksi menu "Ganti Kode Akses")
// ============================================================

// Username & password default sebelum Administrator menggantinya sendiri di Firestore
// (koleksi settings, dokumen "superadmin"). Sama seperti kode akses HRD, ini hanya fallback.
const SUPERADMIN_DEFAULT = { username: 'Superadmin', password: 'Admin123' };

export async function getSuperadminCredentials(): Promise<{ username: string; password: string }> {
  const snap = await getDoc(doc(db, SETTINGS_COL, 'superadmin'));
  if (!snap.exists()) return SUPERADMIN_DEFAULT;
  const data = snap.data() as Partial<{ username: string; password: string }>;
  return {
    username: data.username || SUPERADMIN_DEFAULT.username,
    password: data.password || SUPERADMIN_DEFAULT.password,
  };
}

export async function setSuperadminCredentials(username: string, password: string): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, 'superadmin'), { username, password }, { merge: true });
}

// ============================================================
// SECTION: Company Info (Visi Misi, Tata Tertib, Kebijakan Reward — SATU dokumen untuk semua
// karyawan, ditampilkan di Rapor Online. Sengaja tidak diulang per karyawan seperti di
// spreadsheet lama.)
// ============================================================
const COMPANY_INFO_DEFAULT: CompanyInfo = {
  namaPerusahaan: 'PT ARCHIMAX ARCHITECT INDONESIA',
  alamat: 'Jl. KH. Agus Salim 01/04 Lingkungan Gambirejo Warungjayeng-Tanjunganom, Nganjuk 64483, Jawa Timur',
  kontak: 'Tlp/WA: 082228944844 · Email: archimax.architect@gmail.com · Web: www.archimaxarchitect.com',
  visiMisi: '',
  tataTertib: '',
  kebijakanReward: '',
};

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const snap = await getDoc(doc(db, SETTINGS_COL, 'companyInfo'));
  if (!snap.exists()) return COMPANY_INFO_DEFAULT;
  return { ...COMPANY_INFO_DEFAULT, ...(snap.data() as Partial<CompanyInfo>) };
}

export async function setCompanyInfo(data: Omit<CompanyInfo, 'updatedAt'>): Promise<void> {
  await setDoc(doc(db, SETTINGS_COL, 'companyInfo'), { ...data, updatedAt: Date.now() }, { merge: true });
}

// ============================================================
// SECTION: Rapor Online (halaman publik per karyawan, akses via link + PIN)
// ============================================================
// Catatan keamanan sama seperti PIN HRD/HOD lain di app ini (lihat README): verifikasi
// berjalan di client. Data karyawan yang bisa dibaca lewat rapor dibatasi field yang memang
// perlu ditampilkan di dalam komponen, bukan expose seluruh dokumen mentah tanpa filter.
export async function getKaryawanUntukRapor(id: string): Promise<Karyawan | null> {
  return getKaryawan(id);
}
