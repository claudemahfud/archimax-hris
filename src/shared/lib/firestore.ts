import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where,
  orderBy, setDoc, serverTimestamp, Timestamp, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendPasswordResetEmail, updateProfile, type ActionCodeSettings,
} from 'firebase/auth';
import { db, auth, secondaryAuth } from './firebase';
import type { Karyawan, PenilaianKpi, PenilaianKpiForm, CompanyInfo, HasilImportExcel, AkunPortal } from '../types';

// ============================================================
// SECTION: Karyawan (Master Data)
// ============================================================
const KARYAWAN_COL = 'karyawan';

export async function listKaryawan(divisi?: string): Promise<Karyawan[]> {
  const col = collection(db, KARYAWAN_COL);
  const q = divisi ? query(col, where('divisi', '==', divisi)) : query(col);
  const snap = await getDocs(q);
  const hasil = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Karyawan, 'id'>) }));
  // Sort di client (bukan orderBy di query) supaya query where('divisi', ...) + urut nama tidak
  // butuh composite index Firestore tambahan — dan urutannya tetap konsisten (alfabetis) baik
  // dipanggil dengan atau tanpa filter divisi (dipakai HRD/Kelola Karyawan maupun HOD/Branch
  // Manager/Monitoring & Penilaian).
  return hasil.sort((a, b) => a.namaLengkap.localeCompare(b.namaLengkap));
}

// Dinilai lewat Master File HRD: HOD, Branch Manager, dan EKSEKUTIF (ketiganya level "atas",
// bukan Staff yang dinilai HOD/Branch Manager masing-masing divisi lewat portalnya sendiri).
export async function listKaryawanHod(): Promise<Karyawan[]> {
  const col = collection(db, KARYAWAN_COL);
  const q = query(col, where('levelUser', 'in', ['HOD', 'EKSEKUTIF', 'Branch Manager']));
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

// Sama seperti cariKaryawanByNip, tapi kembalikan SEMUA dokumen dengan NIP itu (bukan cuma
// yang pertama ketemu). Dipakai untuk cek duplikat saat EDIT: kalau query NIP kebetulan
// mengembalikan lebih dari satu dokumen (mis. ada duplikat lama dari sebelum validasi NIP
// ditambahkan), cariKaryawanByNip yang cuma ambil docs[0] bisa salah menuduh dokumen yang
// SEDANG diedit sebagai "bentrok dengan dirinya sendiri" kalau urutan hasil query kebetulan
// mengembalikan salinan lain duluan. Dengan daftar lengkap ini, pemanggil bisa exclude id yang
// sedang diedit dan baru anggap bentrok kalau MASIH ada sisa dokumen lain dengan NIP sama.
export async function cariSemuaKaryawanByNip(nip: string): Promise<Karyawan[]> {
  if (!nip) return [];
  const col = collection(db, KARYAWAN_COL);
  const snap = await getDocs(query(col, where('nip', '==', nip)));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Karyawan, 'id'>) }));
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

export async function simpanPenilaianKpi(form: PenilaianKpiForm, dinilaiOleh: 'HRD' | 'HOD' | 'Branch Manager'): Promise<void> {
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
    return { id: d.id, ...(data as unknown as PenilaianKpiForm), timestamp: ts, dinilaiOleh: data.dinilaiOleh as 'HRD' | 'HOD' | 'Branch Manager' };
  });
}

// ============================================================
// SECTION: Kode Akses (Gate PIN — HRD)
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
// SECTION: Whitelist Email Superadmin (proteksi "Login dengan Google" di Welcome Page)
// ============================================================
// Sebelum ada whitelist ini, akun Google APAPUN yang berhasil sign-in otomatis dianggap
// Superadmin (celah keamanan). Sekarang login Google Superadmin hanya diterima kalau
// emailnya ada di daftar ini. Username/password manual tetap jalan seperti biasa sebagai
// jalur cadangan (misalnya sebelum ada email yang didaftarkan sama sekali).
export async function getWhitelistSuperadmin(): Promise<string[]> {
  const snap = await getDoc(doc(db, SETTINGS_COL, 'whitelistSuperadmin'));
  if (!snap.exists()) return [];
  const data = snap.data() as { emails?: string[] };
  return (data.emails || []).map((e) => e.toLowerCase().trim());
}

// Pakai arrayUnion/arrayRemove (operasi atomik di server), BUKAN baca-lalu-tulis manual —
// supaya aman kalau ada 2 perubahan whitelist terjadi hampir bersamaan (race condition lama:
// perubahan kedua bisa menimpa perubahan pertama kalau keduanya baca data sebelum saling tahu).
export async function tambahWhitelistSuperadmin(email: string): Promise<void> {
  const bersih = email.toLowerCase().trim();
  await setDoc(doc(db, SETTINGS_COL, 'whitelistSuperadmin'), { emails: arrayUnion(bersih) }, { merge: true });
}

export async function hapusWhitelistSuperadmin(email: string): Promise<void> {
  const bersih = email.toLowerCase().trim();
  await setDoc(doc(db, SETTINGS_COL, 'whitelistSuperadmin'), { emails: arrayRemove(bersih) }, { merge: true });
}

// ============================================================
// SECTION: Akun Portal HRD/HOD (Username + Password + Email — Firebase Auth sungguhan,
// TAMBAHAN di samping Kode Akses/PIN dan Login dengan Google)
// ============================================================
// Hanya Superadmin yang bisa mendaftarkan (lihat form "+ Daftarkan Akun" di Welcome Page).
// Form pendaftaran berisi 3 field: Username, Password, Email. Saat didaftarkan:
//   1. Akun Firebase Auth SUNGGUHAN dibuat (email + password) lewat instance `secondaryAuth`
//      supaya sesi Superadmin yang sedang login di `auth` utama tidak ikut tertimpa.
//   2. Dokumen di koleksi ini (akunPortal) menyimpan Username -> Email + role/divisi, dipakai
//      untuk: (a) mencocokkan email saat "Login dengan Google", (b) mencari email dari Username
//      saat login manual Username+Password, dan (c) mencari email tujuan saat fitur "Lupa
//      Password" / "Ganti Password" (Magic Link Reset) dipakai dengan Username.
// Password TIDAK PERNAH disimpan di Firestore — hanya ada di Firebase Auth.
const AKUN_PORTAL_COL = 'akunPortal';

// Kode Akses (PIN) default untuk akun HOD yang belum diganti Superadmin — dipakai saat akun
// baru didaftarkan (lihat daftarkanAkunPortal) MAUPUN sebagai fallback untuk akun HOD lama
// (didaftarkan sebelum fitur Kode Akses per-akun ini ada) yang field `kodeAkses`-nya masih
// kosong di Firestore. Efeknya: semua akun HOD lama otomatis dianggap ber-Kode Akses '000000'
// sampai Superadmin menggantinya lewat menu "Kelola Kode Akses" — tanpa perlu migrasi data.
const KODE_AKSES_HOD_DEFAULT = '000000';

export function kodeAksesHodDefault(): string {
  return KODE_AKSES_HOD_DEFAULT;
}

export async function listAkunPortal(): Promise<AkunPortal[]> {
  const snap = await getDocs(query(collection(db, AKUN_PORTAL_COL), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AkunPortal, 'id'>) }));
}

/**
 * Semua akun HOD ATAU Branch Manager (opsional difilter per Divisi & per role), dipakai halaman
 * Portal HOD, Portal Branch Manager & Kelola Kode Akses. `role` default 'HOD' supaya pemanggil
 * lama (belum diubah) tetap berperilaku sama persis seperti sebelum Branch Manager ditambahkan.
 */
export async function listAkunPortalHod(divisi?: string, role: 'HOD' | 'Branch Manager' = 'HOD'): Promise<AkunPortal[]> {
  const semua = await listAkunPortal();
  return semua.filter((a) => a.role === role && (!divisi || a.divisi === divisi));
}

/** Semua akun HOD + Branch Manager sekaligus (opsional difilter per Divisi) — dipakai halaman "Kelola Kode Akses". */
export async function listAkunPortalHodDanBranchManager(divisi?: string): Promise<AkunPortal[]> {
  const semua = await listAkunPortal();
  return semua.filter((a) => (a.role === 'HOD' || a.role === 'Branch Manager') && (!divisi || a.divisi === divisi));
}

/**
 * Cocokkan Divisi + Kode Akses pribadi yang diketik di gerbang Portal HOD (/hod/akses) atau
 * Portal Branch Manager (/branch-manager/akses) ke salah satu akun terdaftar (role yang sesuai)
 * pada divisi itu. Satu divisi boleh punya beberapa akun dengan Kode Akses masing-masing
 * berbeda — dicek satu per satu sampai ketemu yang cocok.
 */
export async function cariAkunPortalHodByDivisiDanKode(
  divisi: string,
  kode: string,
  role: 'HOD' | 'Branch Manager' = 'HOD',
): Promise<AkunPortal | null> {
  const kodeBersih = kode.trim();
  if (!kodeBersih) return null;
  const akunDivisi = await listAkunPortalHod(divisi, role);
  return akunDivisi.find((a) => (a.kodeAkses || KODE_AKSES_HOD_DEFAULT) === kodeBersih) || null;
}

/** Ganti Kode Akses pribadi satu akun HOD — dipakai Superadmin lewat menu "Kelola Kode Akses". */
export async function setKodeAksesAkunPortal(id: string, kode: string): Promise<void> {
  const bersih = kode.trim();
  if (bersih.length < 4) throw new Error('Kode Akses minimal 4 karakter.');
  await updateDoc(doc(db, AKUN_PORTAL_COL, id), { kodeAkses: bersih });
}

export async function cariAkunPortalByEmail(email: string): Promise<AkunPortal | null> {
  const bersih = email.toLowerCase().trim();
  const snap = await getDocs(query(collection(db, AKUN_PORTAL_COL), where('email', '==', bersih)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<AkunPortal, 'id'>) };
}

export async function cariAkunPortalByUsername(username: string): Promise<AkunPortal | null> {
  const bersih = username.toLowerCase().trim();
  const snap = await getDocs(query(collection(db, AKUN_PORTAL_COL), where('username', '==', bersih)));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as Omit<AkunPortal, 'id'>) };
}

/**
 * Cari akun berdasarkan Username ATAU Email — dipakai di form Login manual & Lupa Password
 * supaya user boleh mengisi salah satu (tidak wajib ingat dua-duanya).
 */
export async function cariAkunPortalByIdentitas(identitas: string): Promise<AkunPortal | null> {
  const bersih = identitas.toLowerCase().trim();
  if (!bersih) return null;
  if (bersih.includes('@')) return cariAkunPortalByEmail(bersih);
  return cariAkunPortalByUsername(bersih);
}

export async function daftarkanAkunPortal(data: {
  username: string; email: string; password: string; role: 'HRD' | 'HOD' | 'Branch Manager'; divisi?: string;
}): Promise<string> {
  const usernameBersih = data.username.toLowerCase().trim();
  const emailBersih = data.email.toLowerCase().trim();

  if (usernameBersih.length < 3) throw new Error('Username minimal 3 karakter.');
  if (data.password.length < 6) throw new Error('Password minimal 6 karakter (ketentuan Firebase Auth).');
  if (await cariAkunPortalByUsername(usernameBersih)) throw new Error('Username ini sudah dipakai akun lain.');
  if (await cariAkunPortalByEmail(emailBersih)) throw new Error('Email ini sudah terdaftar sebagai akun portal.');

  // Buat akun Firebase Auth sungguhan lewat instance KEDUA (lihat secondaryAuth di firebase.ts)
  // supaya sesi Superadmin yang sedang mendaftarkan akun ini tidak ikut ter-sign-out/tertimpa.
  const kredensial = await createUserWithEmailAndPassword(secondaryAuth, emailBersih, data.password);
  await updateProfile(kredensial.user, { displayName: usernameBersih }).catch(() => undefined);
  await signOut(secondaryAuth).catch(() => undefined);

  const ref = await addDoc(collection(db, AKUN_PORTAL_COL), {
    username: usernameBersih,
    email: emailBersih,
    role: data.role,
    // Setiap akun HOD/Branch Manager baru langsung dibekali Kode Akses (PIN) pribadinya
    // sendiri, dimulai dari nilai default — beda dengan akun lain walau divisinya sama.
    // Superadmin bisa menggantinya kapan saja lewat menu "Kelola Kode Akses".
    ...(data.role === 'HOD' || data.role === 'Branch Manager' ? { divisi: data.divisi, kodeAkses: KODE_AKSES_HOD_DEFAULT } : {}),
    createdAt: Date.now(),
  });
  return ref.id;
}

export async function hapusAkunPortal(id: string): Promise<void> {
  await deleteDoc(doc(db, AKUN_PORTAL_COL, id));
}

/**
 * Ubah Username saja (murni field Firestore, tidak menyentuh Firebase Auth sama sekali —
 * Username hanya dipakai sebagai "nama panggilan" untuk mencari Email di koleksi ini, BUKAN
 * identitas Firebase Auth). Email & Password tetap sama seperti sebelumnya setelah ini.
 */
export async function ubahUsernameAkunPortal(id: string, usernameBaru: string): Promise<void> {
  const bersih = usernameBaru.toLowerCase().trim();
  if (bersih.length < 3) throw new Error('Username minimal 3 karakter.');
  const existing = await cariAkunPortalByUsername(bersih);
  if (existing && existing.id !== id) throw new Error('Username ini sudah dipakai akun lain.');
  await updateDoc(doc(db, AKUN_PORTAL_COL, id), { username: bersih });
}

/**
 * Reset Email + Password SEKALIGUS untuk satu akun HRD/HOD yang sudah terdaftar.
 *
 * Catatan penting soal keterbatasan Firebase Auth (bukan bug, ini memang aturan keamanan
 * Firebase): dari sisi client (tanpa server/Cloud Function + Admin SDK), Superadmin TIDAK BISA
 * langsung mengubah email atau password milik akun ORANG LAIN begitu saja — hanya pemilik akun
 * itu sendiri (setelah login sebagai dirinya) yang bisa. Karena itu, "reset" di sini bekerja
 * dengan membuat akun Firebase Auth BARU (email + password baru) lewat `secondaryAuth`, lalu
 * memperbarui field `email` di dokumen Firestore ini supaya tetap satu identitas yang sama
 * (Username + Email + Password baru = satu paket yang saling terikat). Akun Firebase Auth LAMA
 * (kalau emailnya berubah) otomatis jadi tidak terpakai lagi — aman diabaikan, atau dihapus
 * manual lewat Firebase Console kalau mau beres-beres.
 *
 * PERBAIKAN: kalau Email TIDAK diganti (Superadmin cuma mau reset Password, email tetap sama),
 * createUserWithEmailAndPassword() di atas PASTI GAGAL dengan "auth/email-already-in-use" —
 * karena email itu memang sudah terdaftar (itu akun yang mau direset). Firebase tidak
 * mengizinkan mengganti password akun orang lain begitu saja dari client, jadi satu-satunya
 * jalan yang benar-benar valid adalah: kirim Magic Link Reset Password ke email yang sama
 * (mekanisme yang sama dengan kirimMagicLinkResetPassword), lalu user yang bersangkutan
 * mengatur password barunya sendiri lewat email itu. Melempar SudahAdaEmailSamaError supaya
 * pemanggil (Landing.tsx) bisa menampilkan pesan yang sesuai.
 */
export async function resetEmailPasswordAkunPortal(
  id: string,
  data: { email: string; password: string },
): Promise<void> {
  const emailBaru = data.email.toLowerCase().trim();
  if (data.password.length < 6) throw new Error('Password minimal 6 karakter (ketentuan Firebase Auth).');
  const existing = await cariAkunPortalByEmail(emailBaru);
  if (existing && existing.id !== id) throw new Error('Email ini sudah dipakai akun lain.');

  if (existing && existing.id === id) {
    // Email tidak berubah -> tidak bisa createUserWithEmailAndPassword (akan selalu gagal
    // karena email sudah terpakai). Kirim Magic Link Reset Password sebagai gantinya.
    await sendPasswordResetEmail(auth, emailBaru, actionCodeSettingsResetPassword());
    throw new SudahAdaEmailSamaError(emailBaru);
  }

  const kredensial = await createUserWithEmailAndPassword(secondaryAuth, emailBaru, data.password);
  await signOut(secondaryAuth).catch(() => undefined);
  void kredensial; // hanya perlu efek pembuatan akunnya, tidak perlu dipakai lagi di sini

  await updateDoc(doc(db, AKUN_PORTAL_COL, id), { email: emailBaru });
}

/**
 * Ditandai secara khusus (bukan Error biasa) supaya UI (Landing.tsx) bisa menampilkan pesan
 * "Magic Link terkirim" (sukses secara praktik) alih-alih pesan "Gagal" — walau secara teknis
 * fungsi di atas berhenti lewat throw karena password TIDAK langsung diganti di sini.
 */
export class SudahAdaEmailSamaError extends Error {
  constructor(public email: string) {
    super(`Password tidak bisa diganti langsung tanpa mengubah Email (keterbatasan Firebase Auth). Magic Link Reset Password sudah dikirim ke ${email} — minta pemilik akun mengatur password barunya sendiri lewat email tersebut.`);
    this.name = 'SudahAdaEmailSamaError';
  }
}

/**
 * Login manual Username/Email + Password untuk akun HRD/HOD yang didaftarkan lewat
 * daftarkanAkunPortal(). Mengembalikan null kalau identitas tidak ditemukan di koleksi
 * akunPortal (biar pemanggil bisa lanjut cek jalur lain, mis. Superadmin/PIN); melempar
 * error kalau identitas ditemukan tapi password Firebase Auth-nya salah.
 */
export async function loginAkunPortal(identitas: string, password: string): Promise<AkunPortal | null> {
  const akun = await cariAkunPortalByIdentitas(identitas);
  if (!akun) return null;
  await signInWithEmailAndPassword(auth, akun.email, password);
  return akun;
}

// ============================================================
// SECTION: Magic Link Reset Password (Firebase Auth) — dipakai untuk "Lupa Password" (belum
// login) MAUPUN "Ganti Password" (sudah login, tapi tidak mau/lupa masukkan password lama).
// Keduanya memakai mekanisme yang sama: Firebase mengirim email berisi link (Magic Link) ke
// alamat email akun tersebut; link itu mengarah balik ke halaman /reset-password di app ini
// (bukan halaman default Firebase) dengan kode aksi (oobCode) tertanam di URL. Di halaman
// itu, user tinggal mengetik password baru — TANPA perlu tahu password lama.
//
// PENTING (sering disalahpahami): Password di sini adalah password LOGIN WEB INI SAJA,
// tersimpan di Firebase Authentication milik project archimax-hris — SAMA SEKALI TERPISAH dari
// akun Google/Gmail pribadi pemilik email, walaupun alamat emailnya kebetulan sama (mis. Gmail).
// Magic Link Reset Password TIDAK PERNAH mengubah, membaca, atau menyentuh password akun Google
// pribadi siapa pun — Firebase Auth Email/Password adalah sistem login terpisah milik app ini.
// ============================================================

function actionCodeSettingsResetPassword(): ActionCodeSettings {
  return {
    // handleCodeInApp: true -> Firebase membuat link Magic Link yang langsung menuju URL app
    // kita (bukan halaman hosted bawaan Firebase), lengkap dengan ?mode=resetPassword&oobCode=...
    url: `${window.location.origin}/reset-password`,
    handleCodeInApp: true,
  };
}

/**
 * Kirim email Magic Link Reset Password. `identitas` boleh Username ATAU Email akun portal
 * yang terdaftar. Mengembalikan alamat email tujuan (untuk ditampilkan di pesan sukses).
 */
export async function kirimMagicLinkResetPassword(identitas: string): Promise<string> {
  const akun = await cariAkunPortalByIdentitas(identitas);
  if (!akun) throw new Error('Username/Email tidak ditemukan sebagai akun HRD/HOD terdaftar.');
  await sendPasswordResetEmail(auth, akun.email, actionCodeSettingsResetPassword());
  return akun.email;
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
