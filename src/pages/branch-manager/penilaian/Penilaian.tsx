import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesBranchManager } from '../../../shared/hooks/useAksesBranchManager';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { KpiForm } from '../../../shared/components/KpiForm';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan } from '../../../shared/lib/firestore';
import type { Karyawan } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.BM_MONITORING, label: 'Monitoring & Rekap' },
  { to: ROUTES.BM_PENILAIAN, label: 'Form Penilaian KPI' },
];

export default function Penilaian() {
  const { terverifikasi, divisi, keluar } = useAksesBranchManager();
  const { showToast } = useToast();
  const [staffList, setStaffList] = useState<Karyawan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!terverifikasi) return;
    muat();
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
    <div>
      <PortalNav title={`Portal Branch Manager — ${divisi}`} items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Form Penilaian KPI Staff</h1>
        <p>Menilai KPI &amp; Soft Skills untuk seluruh Staff di divisi <strong>{divisi}</strong> saja.</p>
        {loading ? (
          <Spinner label="Memuat daftar staff..." />
        ) : staffList.length === 0 ? (
          <p className="card">Belum ada Staff terdaftar di divisi ini. Tambahkan lewat Kelola Karyawan (Master File HRD).</p>
        ) : (
          <KpiForm targets={staffList} dinilaiOleh="Branch Manager" onSubmitted={muat} />
        )}
      </div>
    </div>
  );
}
