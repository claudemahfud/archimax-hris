import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ROUTES } from '../../../router/routePaths';
import { useAksesHod } from '../../../shared/hooks/useAksesHod';
import { PortalNav } from '../../../shared/components/PortalNav';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan, listRiwayatKpi } from '../../../shared/lib/firestore';
import type { Karyawan, PenilaianKpi } from '../../../shared/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface BarisRekap { karyawan: Karyawan; skorTerakhir: number; skorKedisiplinan: number; periode: string }

const NAV_ITEMS = [
  { to: ROUTES.HOD_MONITORING, label: 'Monitoring & Rekap' },
  { to: ROUTES.HOD_PENILAIAN, label: 'Form Penilaian KPI' },
];

export default function Monitoring() {
  const { terverifikasi, divisi, keluar } = useAksesHod();
  const [loading, setLoading] = useState(true);
  const [rekap, setRekap] = useState<BarisRekap[]>([]);
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
        const staffDivisi = (await listKaryawan(divisi)).filter((k) => k.levelUser === 'Staff');
        // Paralel, bukan satu-satu berurutan — lihat catatan yang sama di Dashboard HRD.
        const riwayatPerKaryawan = await Promise.all(staffDivisi.map((k) => listRiwayatKpi(k.id)));
        const baris: BarisRekap[] = [];
        const semuaRiwayat: PenilaianKpi[] = [];
        staffDivisi.forEach((k, i) => {
          const riwayat = riwayatPerKaryawan[i];
          semuaRiwayat.push(...riwayat);
          const terakhir = riwayat[0];
          baris.push({
            karyawan: k,
            skorTerakhir: terakhir?.totalSkor ?? 0,
            skorKedisiplinan: terakhir?.skorKedisiplinan ?? 100,
            periode: terakhir?.periodeMinggu ?? '-',
          });
        });
        baris.sort((a, b) => (b.skorTerakhir + b.skorKedisiplinan) - (a.skorTerakhir + a.skorKedisiplinan));

        const perPeriode = new Map<string, number[]>();
        for (const r of semuaRiwayat) {
          const arr = perPeriode.get(r.periodeMinggu) || [];
          arr.push((r.totalSkor + r.skorKedisiplinan) / 2);
          perPeriode.set(r.periodeMinggu, arr);
        }
        const periodeSorted = [...perPeriode.keys()].sort();
        if (!batal) {
          setRekap(baris);
          setTrendLabels(periodeSorted);
          setTrendData(periodeSorted.map((p) => {
            const arr = perPeriode.get(p)!;
            return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100;
          }));
        }
      } catch (err) {
        if (!batal) setError(err instanceof Error ? err.message : 'Gagal memuat data monitoring.');
      } finally {
        if (!batal) setLoading(false);
      }
    }
    muat();
    return () => { batal = true; };
  }, [terverifikasi, divisi]);

  if (!terverifikasi) return <Navigate to={ROUTES.HOD_AKSES} replace />;

  return (
    <div>
      <PortalNav title={`Portal HOD — ${divisi}`} items={NAV_ITEMS} onKeluar={keluar} />
      <div className="page">
        <h1>Monitoring &amp; Rekap</h1>
        <p>Rekap seluruh staff divisi <strong>{divisi}</strong> secara real-time. Otoritas data terbatas hanya divisi ini.</p>

        <div className="card">
          <h2>Tren Skor Rata-rata Divisi</h2>
          {loading ? (
            <Spinner label="Memuat grafik tren..." />
          ) : trendLabels.length === 0 ? (
            <p>Belum ada data penilaian KPI untuk divisi ini.</p>
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
          <h2>Rekap Staff ({rekap.length})</h2>
          {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          {loading ? (
            <>
              <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
            </>
          ) : rekap.length === 0 ? (
            <p>Belum ada Staff terdaftar di divisi ini. Tambahkan lewat Kelola Karyawan (Master File HRD).</p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama Staff</th><th>Jabatan</th><th>Periode Terakhir</th>
                    <th>Skor Hard Skill</th><th>Skor Kedisiplinan</th>
                  </tr>
                </thead>
                <tbody>
                  {rekap.map((r) => (
                    <tr key={r.karyawan.id}>
                      <td>{r.karyawan.namaLengkap}</td>
                      <td>{r.karyawan.jabatan}</td>
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
