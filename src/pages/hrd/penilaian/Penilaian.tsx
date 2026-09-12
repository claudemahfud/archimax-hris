import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { AppShell } from '../../../shared/components/AppShell';
import { KpiForm } from '../../../shared/components/KpiForm';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawanHod } from '../../../shared/lib/firestore';
import type { Karyawan } from '../../../shared/types';
import {
  IconHome, IconUsers, IconClipboardList, IconUploadCloud, IconBuilding,
} from '../../../shared/components/Icons';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik', icon: <IconHome /> },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan', icon: <IconUsers /> },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD/BM', icon: <IconClipboardList /> },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel', icon: <IconUploadCloud /> },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan', icon: <IconBuilding /> },
];

export default function Penilaian() {
  const { terverifikasi, keluar: keluarHrd } = useAksesGate('akses_hrd');
  const { keluar: keluarSuperadmin } = useAksesSuperadmin();
  const keluar = () => { keluarSuperadmin(); keluarHrd(); };
  const { showToast } = useToast();
  const [hodList, setHodList] = useState<Karyawan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!terverifikasi) return;
    muat();
  }, [terverifikasi]);

  async function muat() {
    setLoading(true);
    try {
      setHodList(await listKaryawanHod());
    } catch (err) {
      showToast('error', `Gagal memuat daftar HOD: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  if (!terverifikasi) return <Navigate to={ROUTES.HRD_AKSES} replace />;

  return (
    <AppShell portalTitle="Master File HRD" pageTitle="Form Penilaian Karyawan" items={NAV_ITEMS} onKeluar={keluar}>
      <h1>Form Penilaian Karyawan</h1>
      <p>Master File HRD hanya menilai KPI untuk karyawan dengan Level User <strong>HOD</strong>, <strong>Branch Manager</strong>, atau <strong>EKSEKUTIF</strong>. Penilaian Staff dilakukan HOD/Branch Manager masing-masing divisi lewat portalnya sendiri.</p>
      {loading ? (
        <Spinner label="Memuat daftar HOD & EKSEKUTIF..." />
      ) : hodList.length === 0 ? (
        <p className="card">Belum ada karyawan Level User HOD/Branch Manager/EKSEKUTIF terdaftar. Tambahkan lewat menu Kelola Karyawan.</p>
      ) : (
        <KpiForm targets={hodList} dinilaiOleh="HRD" />
      )}
    </AppShell>
  );
}
