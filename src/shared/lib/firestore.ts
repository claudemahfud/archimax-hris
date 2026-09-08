import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, query, where,
  orderBy, setDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Karyawan, PenilaianKpi, PenilaianKpiForm } from '../types';

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

export async function getKodeAksesHrd(): Promise<string> {
  const snap = await getDoc(doc(db, SETTINGS_COL, 'aksesHrd'));
  return snap.exists() ? (snap.data().kodeAkses as string) : '';
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
