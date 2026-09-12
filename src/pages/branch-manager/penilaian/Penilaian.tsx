import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesBranchManager } from '../../../shared/hooks/useAksesBranchManager';
import { useToast } from '../../../shared/hooks/useToast';
import { AppShell } from '../../../shared/components/AppShell';
import { KpiForm } from '../../../shared/components/KpiForm';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan, getParameterKpiCustom } from '../../../shared/lib/firestore';
import { auth } from '../../../shared/lib/firebase';
import type { Karyawan } from '../../../shared/types';
import { IconMonitor, IconClipboardList, IconSettings } from '../../../shared/components/Icons';

const NAV_ITEMS = [
  { to: ROUTES.BM_MONITORING, label: 'Monitoring & Rekap', icon: <IconMonitor /> },
  { to: ROUTES.BM_PENILAIAN, label: 'Form Penilaian KPI', icon: <IconClipboardList /> },
  { to: ROUTES.BM_PARAMETER_KPI, label: 'Kelola Parameter KPI', icon: <IconSettings /> },
];

export default function Penilaian() {
  const { terverifikasi, divisi, keluar } = useAksesBranchManager();
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState<Karyawan[]>([]);
  const [aspekCustom, setAspekCustom] = useState<string[] | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!terverifikasi) return;
    muat();
    const uid = auth.currentUser?.uid;
    if (uid) {
      getParameterKpiCustom(uid).then((p) => setAspekCustom(p?.aspek)).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terverifikasi, divisi]);

  async function muat() {
    setLoading(true);
    try {
      const data = (await listKaryawan(divisi)).filter((k) => k.levelUser === 'Staff');
      setStaffList(data);
    } catch (err) {
      showToast('error', `Gagal memuat daftar staff: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  if (!terverifikasi) return <Navigate to={ROUTES.BM_AKSES} replace />;

  return (
    <AppShell portalTitle={`Portal Branch Manager — ${divisi}`} pageTitle="Form Penilaian KPI Staff" items={NAV_ITEMS} onKeluar={keluar}>
      <h1>Form Penilaian KPI Staff</h1>
      <p>Menilai KPI &amp; Soft Skills untuk seluruh Staff di divisi <strong>{divisi}</strong> saja.</p>
      {loading ? (
        <Spinner label="Memuat daftar staff..." />
      ) : staffList.length === 0 ? (
        <p className="card">Belum ada Staff terdaftar di divisi ini. Tambahkan lewat Kelola Karyawan (Master File HRD).</p>
      ) : (
        <KpiForm targets={staffList} dinilaiOleh="Branch Manager" onSubmitted={muat} aspekCustom={aspekCustom} />
      )}
    </AppShell>
  );
}
