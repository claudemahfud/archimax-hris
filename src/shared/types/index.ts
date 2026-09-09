export type LevelUser = 'Staff' | 'HOD';

export interface Karyawan {
  id: string;
  nip: string;
  namaLengkap: string;
  namaPanggilan: string;
  jabatan: string;
  divisi: string;
  gradeJabatan: string;
  bergabungSejak: string;
  pengalamanKerja: string;
  statusKaryawan: string;
  masaKontrak: string; // tanggal, format dd-MM-yyyy
  gajiPokok: number;
  tunjanganKehadiran: number;
  tunjanganKompetensi: number;
  tunjanganJabatan: number;
  tunjanganTransportasi: number;
  performanceInsentive: number;
  estimasiTakeHomePay: number;
  nik: string;
  tempatLahir: string;
  tanggalLahir: string;
  jenisKelamin: string;
  alamatKtp: string;
  alamatDomisili: string;
  agama: string;
  statusPerkawinan: string;
  kewarganegaraan: string;
  noHp: string;
  kontakDarurat: string;
  email: string;
  jumlahIstri: number;
  jumlahAnak: number;
  pendidikanTerakhir: string;
  levelUser: LevelUser;
  fotoUrl?: string;
  // Kode akses (PIN) untuk buka link Rapor Online pribadi karyawan (/rapor/:id).
  // Default kalau kosong: 6 digit terakhir NIK (lihat kodeAksesRaporDefault di firestore.ts).
  kodeAksesRapor?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Field form penilaian KPI — dipakai baik oleh Master (menilai HOD) maupun Portal HOD (menilai Staff).
export interface PenilaianKpiForm {
  karyawanId: string;
  namaKaryawan: string;
  divisi: string;
  periodeMinggu: string;
  aspek1: number; aspek2: number; aspek3: number; aspek4: number;
  aspek5: number; aspek6: number; aspek7: number; aspek8: number;
  totalSkor: number;
  cuti: number; izin: number; sakitTanpaSurat: number; sakitDenganSurat: number;
  alpha: number; keterlambatan: number;
  sp1: number; sp2: number; sp3: number;
  tidakBersepatu: number; merokokKantor: number; tidakBerseragam: number;
  minumMiras: number; makananBerat: number; customPoin: number;
  keteranganCustom: string;
  skorKedisiplinan: number;
  kelebihan: string; kekurangan: string; rekomendasi: string; potensiKarier: string;
  statusRekomendasi: string; kenaikanSalary: string; training: string; evaluasiBerikutnya: string;
}

export interface PenilaianKpi extends PenilaianKpiForm {
  id: string;
  timestamp: number;
  dinilaiOleh: 'HRD' | 'HOD';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  message: string;
}

// Info umum perusahaan yang SAMA untuk semua karyawan — disimpan satu dokumen saja
// (settings/companyInfo), ditampilkan sebagai halaman-halaman umum di Rapor Online,
// bukan diulang per karyawan seperti di spreadsheet lama.
export interface CompanyInfo {
  namaPerusahaan: string;
  alamat: string;
  kontak: string;
  visiMisi: string;
  tataTertib: string; // gabungan "Peraturan Punishment" (ringan + berat)
  kebijakanReward: string;
  updatedAt?: number;
}

// Hasil parse satu file Excel karyawan (format "Data Diri Karyawan" + "RAPORT-KPI").
export interface HasilImportExcel {
  karyawan: Omit<Karyawan, 'id' | 'createdAt' | 'updatedAt'>;
  riwayatKpi: PenilaianKpiForm[];
  peringatan: string[]; // kolom/sheet yang tidak ditemukan atau perlu dicek manual
}
