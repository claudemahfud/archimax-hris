import { lazy } from 'react';
import { ROUTES } from './routePaths';

// Setiap baris = satu slug -> satu folder di src/pages. Tambah halaman baru = tambah satu baris.
export const routes = [
  { path: ROUTES.LANDING, component: lazy(() => import('../pages/landing')) },
  { path: ROUTES.HRD_AKSES, component: lazy(() => import('../pages/hrd/akses')) },
  { path: ROUTES.HRD_DASHBOARD, component: lazy(() => import('../pages/hrd/dashboard')) },
  { path: ROUTES.HRD_KARYAWAN, component: lazy(() => import('../pages/hrd/karyawan')) },
  { path: ROUTES.HRD_PENILAIAN, component: lazy(() => import('../pages/hrd/penilaian')) },
  { path: ROUTES.HRD_IMPORT, component: lazy(() => import('../pages/hrd/import')) },
  { path: ROUTES.HRD_PROFIL_PERUSAHAAN, component: lazy(() => import('../pages/hrd/profil-perusahaan')) },
  { path: ROUTES.HOD_AKSES, component: lazy(() => import('../pages/hod/akses')) },
  { path: ROUTES.HOD_MONITORING, component: lazy(() => import('../pages/hod/monitoring')) },
  { path: ROUTES.HOD_PENILAIAN, component: lazy(() => import('../pages/hod/penilaian')) },
  { path: ROUTES.GANTI_KODE_AKSES, component: lazy(() => import('../pages/settings/ganti-kode-akses')) },
  { path: ROUTES.RAPOR, component: lazy(() => import('../pages/rapor')) },
];
