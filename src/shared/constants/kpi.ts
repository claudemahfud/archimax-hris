// Sumber tunggal daftar Divisi — dulu di GAS jadi key DAFTAR_DIVISI_PORTAL_HOD (Spreadsheet ID
// per divisi sudah tidak relevan sejak pindah ke Firestore, jadi hanya nama yang dipertahankan).
export const DAFTAR_DIVISI = [
  '3D Artist',
  'Commercial',
  'Customer Services',
  'Estimator',
  'FATA',
  'Human Growth',
  'Super Legal',
  'EKSEKUTIF HOLDER',
  'Drafter',
  'PACKING',
  'Operasional',
  'UMUM',
] as const;

export type NamaDivisi = (typeof DAFTAR_DIVISI)[number];

export const JUMLAH_ASPEK_HARDSKILL = 8;

const ASPEK_HARDSKILL_DEFAULT = [
  'Teknis Desain', 'Produktivitas & Manajemen Waktu', 'Kualitas Hasil Kerja', 'Kreativitas & Inovasi',
  'Komunikasi & Kerja Tim', 'Sikap Kerja & Profesionalisme', 'Administrasi & Kepatuhan Projek', 'Sikap & Softskill',
];

// 8 parameter Hard Skill per Divisi — persis dengan ASPEK_HARDSKILL_PER_DIVISI di Code.gs asli.
export const ASPEK_HARDSKILL_PER_DIVISI: Record<string, string[]> = {
  '3D Artist': [
    'Teknis Desain 3D', 'Produktivitas & Manajemen Waktu', 'Kualitas Hasil Render', 'Kreativitas & Inovasi',
    'Komunikasi & Kerja Tim', 'Sikap Kerja & Profesionalisme', 'Administrasi & Kepatuhan Projek', 'Sikap & Softskill',
  ],
  Commercial: ASPEK_HARDSKILL_DEFAULT,
  'Customer Services': ASPEK_HARDSKILL_DEFAULT,
  Estimator: ASPEK_HARDSKILL_DEFAULT,
  FATA: ASPEK_HARDSKILL_DEFAULT,
  'Human Growth': ASPEK_HARDSKILL_DEFAULT,
  'Super Legal': ASPEK_HARDSKILL_DEFAULT,
  'EKSEKUTIF HOLDER': ASPEK_HARDSKILL_DEFAULT,
  Drafter: ASPEK_HARDSKILL_DEFAULT,
  PACKING: ASPEK_HARDSKILL_DEFAULT,
  Operasional: ASPEK_HARDSKILL_DEFAULT,
  UMUM: ASPEK_HARDSKILL_DEFAULT,
};

export function getAspekHardSkill(divisi: string): string[] {
  const aspek = ASPEK_HARDSKILL_PER_DIVISI[divisi] || [];
  const hasil = [...aspek];
  while (hasil.length < JUMLAH_ASPEK_HARDSKILL) hasil.push(ASPEK_HARDSKILL_DEFAULT[hasil.length]);
  return hasil.slice(0, JUMLAH_ASPEK_HARDSKILL);
}

// Poin pengurang Skor Kedisiplinan/SOP — identik dengan hitungSoftSkills() di GAS asli.
export const POIN_PENGURANG = {
  cuti: 0,
  izin: 2,
  sakitTanpaSurat: 5,
  sakitDenganSurat: 1,
  alpha: 15,
  keterlambatan: 1,
  sp1: 10,
  sp2: 25,
  sp3: 50,
  tidakBersepatu: 3,
  merokokKantor: 10,
  tidakBerseragam: 3,
  minumMiras: 30,
  makananBerat: 2,
} as const;

export function hitungSkorKedisiplinan(input: {
  cuti: number; izin: number; sakitTanpaSurat: number; sakitDenganSurat: number;
  alpha: number; keterlambatan: number; sp1: number; sp2: number; sp3: number;
  tidakBersepatu: number; merokokKantor: number; tidakBerseragam: number;
  minumMiras: number; makananBerat: number; customPoin: number;
}): number {
  const totalPengurang =
    input.cuti * POIN_PENGURANG.cuti +
    input.izin * POIN_PENGURANG.izin +
    input.sakitTanpaSurat * POIN_PENGURANG.sakitTanpaSurat +
    input.sakitDenganSurat * POIN_PENGURANG.sakitDenganSurat +
    input.alpha * POIN_PENGURANG.alpha +
    input.keterlambatan * POIN_PENGURANG.keterlambatan +
    input.sp1 * POIN_PENGURANG.sp1 +
    input.sp2 * POIN_PENGURANG.sp2 +
    input.sp3 * POIN_PENGURANG.sp3 +
    input.tidakBersepatu * POIN_PENGURANG.tidakBersepatu +
    input.merokokKantor * POIN_PENGURANG.merokokKantor +
    input.tidakBerseragam * POIN_PENGURANG.tidakBerseragam +
    input.minumMiras * POIN_PENGURANG.minumMiras +
    input.makananBerat * POIN_PENGURANG.makananBerat +
    input.customPoin;
  const sisa = 100 - totalPengurang;
  return sisa < 0 ? 0 : Math.round(sisa * 100) / 100;
}

export function hitungTotalSkorHardSkill(aspekValues: number[]): number {
  const valid = aspekValues.filter((v) => !isNaN(v));
  if (valid.length === 0) return 0;
  const total = valid.reduce((a, b) => a + b, 0);
  return Math.round((total / valid.length) * 100) / 100;
}
