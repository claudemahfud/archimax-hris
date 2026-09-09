import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ROUTES } from '../../../router/routePaths';
import { useAksesGate } from '../../../shared/hooks/useAksesGate';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawanHod, listRiwayatKpi } from '../../../shared/lib/firestore';
import type { Karyawan, PenilaianKpi } from '../../../shared/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface BarisRanking { karyawan: Karyawan; skorTerakhir: number; skorKedisiplinan: number; periode: string }

const NAV_ITEMS = [
  { to: ROUTES.HRD_DASHBOARD, label: 'Homepage & Grafik' },
  { to: ROUTES.HRD_KARYAWAN, label: 'Kelola Karyawan' },
  { to: ROUTES.HRD_PENILAIAN, label: 'Form Penilaian HOD' },
  { to: ROUTES.HRD_IMPORT, label: 'Import Excel' },
  { to: ROUTES.HRD_PROFIL_PERUSAHAAN, label: 'Profil Perusahaan' },
];

export default function Dashboard() {
  const { terverifikasi, keluar } = useAksesGate('akses_hrd');
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState<BarisRanking[]>([]);
  const [trendLabels, setTrendLabels] = useState<string[]>([]);
  const [trendData, setTrendData] = useState<number[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!terverifikasi) return;
    let batal = false;
    async function muat() {
      setLoading(true);
      setError('');
      try {
        const hodList = await listKaryawanHod();
        const baris: BarisRanking[] = [];
        const semuaRiwayat: PenilaianKpi[] = [];
        for (const k of hodList) {
          const riwayat = await listRiwayatKpi(k.id);
          semuaRiwayat.push(...riwayat);
          const terakhir = riwayat[0];
          baris.push({
            karyawan: k,
            skorTerakhir: terakhir?.totalSkor ?? 0,
            skorKedisiplinan: terakhir?.skorKedisiplinan ?? 100,
            periode: terakhir?.periodeMinggu ?? '-',
          });
        }
        baris.sort((a, b) => (b.skorTerakhir + b.skorKedisiplinan) - (a.skorTerakhir + a.skorKedisiplinan));

        const perPeriode = new Map<string, number[]>();
        for (const r of semuaRiwayat) {
          const arr = perPeriode.get(r.periodeMinggu) || [];
          arr.push((r.totalSkor + r.skorKedisiplinan) / 2);
          perPeriode.set(r.periodeMinggu, arr);
        }
        const periodeSorted = [...perPeriode.keys()].sort();
        if (!batal) {
          setRanking(baris);
          setTrendLabels(periodeSorted);
          setTrendData(periodeSorted.map((p) => {
            const arr = perPeriode.get(p)!;
            return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
          }));
        }
      } catch (err) {
        if (!batal) setError(err instanceof Error ? err.message : 'Gagal memuat data dashboard.');
      } finally {
        if (!batal) setLoading(false);
      }
    }
    muat();
    return () => { batal = true; };
  }, [terverifikasi]);

  if (!terverifikasi) return <Navigate to={ROUTES.HRD_AKSES} replace />;

  return (
    <div>
      <PortalNav title="Master File HRD" items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Homepage &amp; Grafik</h1>
        <p>Tren performa KPI perusahaan dan ranking Level User HOD.</p>

        <div className="card">
          <h2>Tren Skor Rata-rata Perusahaan</h2>
          {loading ? (
            <Spinner label="Memuat grafik tren..." />
          ) : trendLabels.length === 0 ? (
            <p>Belum ada data penilaian KPI untuk ditampilkan.</p>
          ) : (
            <div className="chart-wrap">
              <Line
                data={{
                  labels: trendLabels,
                  datasets: [{
                    label: 'Rata-rata Skor (Hard Skill + Kedisiplinan)',
                    data: trendData,
                    borderColor: '#FF7A00',
                    backgroundColor: 'rgba(255,122,0,0.15)',
                    tension: 0.3,
                  }],
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true } } }}
              />
            </div>
          )}
        </div>

        <div className="card">
          <h2>Ranking Level User HOD</h2>
          {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          {loading ? (
            <>
              <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
            </>
          ) : ranking.length === 0 ? (
            <p>Belum ada karyawan dengan Level User HOD terdaftar.</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama HOD</th><th>Divisi</th><th>Periode Terakhir</th>
                    <th>Skor Hard Skill</th><th>Skor Kedisiplinan</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r) => (
                    <tr key={r.karyawan.id}>
                      <td>{r.karyawan.namaLengkap}</td>
                      <td>{r.karyawan.divisi}</td>
                      <td>{r.periode}</td>
                      <td>{r.skorTerakhir.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${r.skorKedisiplinan >= 80 ? 'badge-good' : 'badge-bad'}`}>
                          {r.skorKedisiplinan.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
