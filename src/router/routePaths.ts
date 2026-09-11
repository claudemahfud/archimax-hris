export const ROUTES = {
  LANDING: '/',
  HRD_AKSES: '/hrd/akses',
  HRD_DASHBOARD: '/hrd/dashboard',
  HRD_KARYAWAN: '/hrd/karyawan',
  HRD_KELOLA_KARYAWAN: '/hrd/kelola-karyawan',
  HRD_KELOLA_KARYAWAN_EDIT: '/hrd/kelola-karyawan/:id',
  HRD_PENILAIAN: '/hrd/penilaian',
  HRD_IMPORT: '/hrd/import-excel',
  HRD_PROFIL_PERUSAHAAN: '/hrd/profil-perusahaan',
  HOD_AKSES: '/hod/akses',
  HOD_MONITORING: '/hod/monitoring',
  HOD_PENILAIAN: '/hod/penilaian',
  GANTI_KODE_AKSES: '/ganti-kode-akses',
  KELOLA_KODE_AKSES_HOD: '/kelola-kode-akses-hod',
  RESET_PASSWORD: '/reset-password',
  PROFIL: '/profil',
  RAPOR: '/rapor/:id',
  raporUrl: (id: string) => `/rapor/${id}`,
  // Tambah karyawan baru -> tanpa id. Edit karyawan yang sudah ada -> dengan id, supaya form
  // Kelola Karyawan selalu mengambil data karyawan langsung dari Firestore lewat URL (bukan
  // dari state React yang bisa hilang/salah), sehingga tidak pernah salah dianggap "Tambah Baru".
  kelolaKaryawanUrl: (id?: string) => (id ? `/hrd/kelola-karyawan/${id}` : '/hrd/kelola-karyawan'),
} as const;
