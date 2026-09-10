import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { useAksesSuperadmin } from '../../../shared/hooks/useAksesSuperadmin';
import { useToast } from '../../../shared/hooks/useToast';
import { PortalNav } from '../../../shared/components/PortalNav';
import { KpiForm } from '../../../shared/components/KpiForm';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawanHod } from '../../../shared/lib/firestore';
import type { Karyawan } from '../../../shared/types';

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel' },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan' },
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
    <div>
      <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Form Penilaian Karyawan</h1>
        <p>Master File HRD hanya menilai KPI untuk karyawan dengan Level User <strong>HOD</strong> atau <strong>EKSEKUTIF</strong>. Penilaian Staff dilakukan HOD masing-masing divisi lewat Portal HOD.</p>
        {loading ? (
          <Spinner label="Memuat daftar HOD & EKSEKUTIF..." />
        ) : hodList.length === 0 ? (
          <p className="card">Belum ada karyawan Level User HOD/EKSEKUTIF terdaftar. Tambahkan lewat menu Kelola Karyawan.</p>
        ) : (
          <KpiForm targets={hodList} dinilaiOleh="HRD" />
        )}
      </div>
    </div>
  );
}
