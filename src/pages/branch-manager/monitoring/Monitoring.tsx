import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { ROUTES } from '../../../router/routePaths';
import { useAksesBranchManager } from '../../../shared/hooks/useAksesBranchManager';
import { AppShell } from '../../../shared/components/AppShell';
import { Spinner } from '../../../shared/components/Loading';
import { listKaryawan, listRiwayatKpi } from '../../../shared/lib/firestore';
import type { Karyawan, PenilaianKpi } from '../../../shared/types';
import { IconMonitor, IconClipboardList, IconUsers, IconTrophy, IconSettings } from '../../../shared/components/Icons';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

interface BarisRekap { karyawan: Karyawan; skorTerakhir: number; skorKedisiplinan: number; periode: string }

const NAV_ITEMS = [
  { to: ROUTES.BM_MONITORING, label: 'Monitoring & Rekap', icon: <IconMonitor /> },
  { to: ROUTES.BM_PENILAIAN, label: 'Form Penilaian KPI', icon: <IconClipboardList /> },
  { to: ROUTES.BM_PARAMETER_KPI, label: 'Kelola Parameter KPI', icon: <IconSettings /> },
];

export default function Monitoring() {
  const { terverifikasi, divisi, keluar } = useAksesBranchManager();
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

  if (!terverifikasi) return <Navigate to={ROUTES.BM_AKSES} replace />;

  const rataRataTerakhir = rekap.length
    ? rekap.reduce((a, r) => a + r.skorTerakhir, 0) / rekap.length
    : 0;

  return (
    <AppShell portalTitle={`Portal Branch Manager — ${divisi}`} pageTitle="Monitoring & Rekap" items={NAV_ITEMS} onKeluar={keluar}>
      <h1>Monitoring &amp; Rekap</h1>
      <p>Rekap seluruh staff divisi <strong>{divisi}</strong> secara real-time. Otoritas data terbatas hanya divisi ini.</p>

      <div className="dash-grid">
        <div className="card metric-card metric-card-amber dash-span-4">
          <div className="metric-card-head">
            <span className="metric-card-label">Total Staff Divisi</span>
            <span className="metric-card-icon"><IconUsers /></span>
          </div>
          <span className="metric-card-value">{loading ? '—' : rekap.length}</span>
          <span className="metric-card-sub">Staff terdaftar di {divisi}</span>
        </div>

        <div className="card metric-card metric-card-green dash-span-4">
          <div className="metric-card-head">
            <span className="metric-card-label">Rata-rata Skor Terakhir</span>
            <span className="metric-card-icon"><IconTrophy /></span>
          </div>
          <span className="metric-card-value">{loading ? '—' : rataRataTerakhir.toFixed(1)}</span>
          <span className="metric-card-sub">Gabungan seluruh staff</span>
        </div>

        <div className="card dash-span-4">
          <div className="metric-card-head">
            <h2 style={{ margin: 0 }}>Periode Terpantau</h2>
            <span className="metric-card-icon" style={{ color: 'var(--orange-600)' }}><IconMonitor /></span>
          </div>
          <span className="metric-card-value" style={{ color: 'var(--text-main)' }}>
            {loading ? '—' : trendLabels.length}
          </span>
          <span className="metric-card-sub" style={{ color: 'var(--grey-medium)' }}>Minggu penilaian tercatat</span>
        </div>

        <div className="card dash-span-8">
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

        <div className="card dash-span-4">
          <h2>Ranking Staff</h2>
          {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
          {loading ? (
            <>
              <div className="skeleton-row" /><div className="skeleton-row" /><div className="skeleton-row" />
            </>
          ) : rekap.length === 0 ? (
            <p>Belum ada Staff terdaftar di divisi ini.</p>
          ) : (
            <div>
              {rekap.slice(0, 6).map((r) => (
                <div className="list-card-row" key={r.karyawan.id}>
                  <span className="list-card-avatar" aria-hidden="true">
                    {r.karyawan.namaLengkap.trim().charAt(0).toUpperCase() || '?'}
                  </span>
                  <div className="list-card-info">
                    <div className="list-card-name">{r.karyawan.namaLengkap}</div>
                    <div className="list-card-meta">{r.karyawan.jabatan} · {r.periode}</div>
                  </div>
                  <span className={`badge ${r.skorKedisiplinan >= 80 ? 'badge-good' : 'badge-bad'}`}>
                    {r.skorTerakhir.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && rekap.length > 0 && (
          <div className="card dash-span-12">
            <h2>Rekap Staff Lengkap ({rekap.length})</h2>
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
          </div>
        )}
      </div>
    </AppShell>
  );
}
