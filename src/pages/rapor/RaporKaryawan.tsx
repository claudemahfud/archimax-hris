import { useEffect, useRef, useState, type FormEvent, type TouchEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  RadialLinearScale, Tooltip, Legend,
} from 'chart.js';
import { Line, Radar, Bar } from 'react-chartjs-2';
import { LOGO_ARCHIMAX_URL } from '../../shared/constants/branding';
import { Spinner } from '../../shared/components/Loading';
import { getKaryawanUntukRapor, listRiwayatKpi, getCompanyInfo, kodeAksesRaporDefault } from '../../shared/lib/firestore';
import { ROUTES } from '../../router/routePaths';
import { getAspekHardSkill, POIN_PENGURANG } from '../../shared/constants/kpi';
import type { Karyawan, PenilaianKpi, CompanyInfo } from '../../shared/types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, RadialLinearScale, Tooltip, Legend);

// Komponen pengurang Skor Kedisiplinan/SOP (Soft Skill) yang ditampilkan sebagai grafik —
// hanya kategori dengan bobot poin (lihat POIN_PENGURANG), Cuti dilewati karena bobotnya 0.
const KOMPONEN_SOFTSKILL: Array<{ key: keyof typeof POIN_PENGURANG; label: string }> = [
  { key: 'izin', label: 'Izin' }, { key: 'sakitTanpaSurat', label: 'Sakit (TS)' },
  { key: 'sakitDenganSurat', label: 'Sakit (DS)' }, { key: 'alpha', label: 'Alpha' },
  { key: 'keterlambatan', label: 'Terlambat' }, { key: 'sp1', label: 'SP1' },
  { key: 'sp2', label: 'SP2' }, { key: 'sp3', label: 'SP3' },
  { key: 'tidakBersepatu', label: 'Tdk Bersepatu' }, { key: 'merokokKantor', label: 'Merokok' },
  { key: 'tidakBerseragam', label: 'Tdk Berseragam' }, { key: 'minumMiras', label: 'Miras' },
  { key: 'makananBerat', label: 'Makan Berat' },
];

type Tab = 'profil' | 'kpi' | 'kedisiplinan' | 'reward' | 'tata-tertib' | 'visi-misi';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'profil', label: 'Profil Saya' },
  { key: 'kpi', label: 'Riwayat KPI' },
  { key: 'kedisiplinan', label: 'Kedisiplinan & Absensi' },
  { key: 'reward', label: 'Kebijakan Reward' },
  { key: 'tata-tertib', label: 'Tata Tertib' },
  { key: 'visi-misi', label: 'Visi & Misi' },
];

function storageKey(id: string) {
  return `akses_rapor_${id}`;
}

export default function RaporKaryawan() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [errorMuat, setErrorMuat] = useState('');
  const [karyawan, setKaryawan] = useState<Karyawan | null>(null);
  const [riwayat, setRiwayat] = useState<PenilaianKpi[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [terverifikasi, setTerverifikasi] = useState(() => id ? sessionStorage.getItem(storageKey(id)) === '1' : false);
  const [pinInput, setPinInput] = useState('');
  const [errorPin, setErrorPin] = useState('');
  const [tab, setTab] = useState<Tab>('profil');
  // Mode cetak: saat true, semua tab ditampilkan sekaligus (bukan cuma tab aktif) supaya
  // Export PDF A4 menghasilkan satu dokumen lengkap, bukan cuma tab yang sedang dibuka.
  const [modeCetak, setModeCetak] = useState(false);

  useEffect(() => {
    function selesaiCetak() { setModeCetak(false); }
    window.addEventListener('afterprint', selesaiCetak);
    return () => window.removeEventListener('afterprint', selesaiCetak);
  }, []);

  function exportPdf() {
    setModeCetak(true);
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  // Gesture geser (swipe) untuk pindah tab di layar sentuh — geser cukup jauh secara
  // horizontal (>50px) dan lebih dominan dari gerak vertikal supaya tidak bentrok dengan
  // scroll halaman biasa.
  const sentuhAwal = useRef<{ x: number; y: number } | null>(null);
  function handleSentuhMulai(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0];
    sentuhAwal.current = { x: t.clientX, y: t.clientY };
  }
  function handleSentuhSelesai(e: TouchEvent<HTMLDivElement>) {
    if (!sentuhAwal.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - sentuhAwal.current.x;
    const dy = t.clientY - sentuhAwal.current.y;
    sentuhAwal.current = null;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    const idxSekarang = TABS.findIndex((t) => t.key === tab);
    const idxBaru = dx < 0 ? idxSekarang + 1 : idxSekarang - 1;
    if (idxBaru >= 0 && idxBaru < TABS.length) setTab(TABS[idxBaru].key);
  }

  useEffect(() => {
    if (!id) return;
    (async () => {
      setLoading(true);
      setErrorMuat('');
      try {
        const [k, info] = await Promise.all([getKaryawanUntukRapor(id), getCompanyInfo()]);
        if (!k) {
          setErrorMuat('Link Rapor tidak ditemukan. Periksa kembali link yang diberikan HRD.');
        } else {
          setKaryawan(k);
          setCompanyInfo(info);
        }
      } catch (err) {
        setErrorMuat(`Gagal memuat data: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    if (!id || !terverifikasi) return;
    (async () => {
      try {
        setRiwayat(await listRiwayatKpi(id));
      } catch {
        // riwayat gagal dimuat tidak menghentikan tampilan rapor — tab KPI akan tampil kosong
      }
    })();
  }, [id, terverifikasi]);

  function handleVerifikasi(e: FormEvent) {
    e.preventDefault();
    if (!karyawan || !id) return;
    const kodeAsli = karyawan.kodeAksesRapor || kodeAksesRaporDefault(karyawan);
    if (pinInput.trim() === kodeAsli) {
      sessionStorage.setItem(storageKey(id), '1');
      setTerverifikasi(true);
      setErrorPin('');
    } else {
      setErrorPin('PIN salah. Hubungi HRD kalau lupa PIN Rapor Anda.');
    }
  }

  if (loading) {
    return <div className="page"><Spinner label="Memuat Rapor Online..." /></div>;
  }

  if (errorMuat || !karyawan) {
    return (
      <div className="gate-wrap">
        <div className="card gate-card">
          <h1>Rapor Online</h1>
          <p>{errorMuat}</p>
        </div>
      </div>
    );
  }

  if (!terverifikasi) {
    return (
      <div className="gate-wrap">
        <form className="card gate-card" onSubmit={handleVerifikasi}>
          <Link to={ROUTES.LANDING} aria-label="Kembali ke Welcome Page">
            <img src={LOGO_ARCHIMAX_URL} alt="Logo perusahaan" style={{ height: 44, marginBottom: 12 }} />
          </Link>
          <h1>Rapor Online</h1>
          <p>Halo, <strong>{karyawan.namaLengkap}</strong>. Masukkan PIN yang diberikan HRD untuk melihat rapor Anda.</p>
          <div className="form-field">
            <label htmlFor="pinRapor">PIN</label>
            <input id="pinRapor" type="password" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value)} autoFocus required />
          </div>
          {errorPin && <p style={{ color: 'var(--danger)' }}>{errorPin}</p>}
          <button type="submit" className="btn">Buka Rapor</button>
        </form>
      </div>
    );
  }

  const terurut = [...riwayat].sort((a, b) => a.timestamp - b.timestamp);
  const labelPeriode = terurut.map((r) => r.periodeMinggu);
  const dataSkorKpi = terurut.map((r) => r.totalSkor);
  const dataSkorKedisiplinan = terurut.map((r) => r.skorKedisiplinan);
  const terakhir = terurut[terurut.length - 1];
  const aspekLabel = getAspekHardSkill(karyawan.divisi);
  const dataHardSkillTerakhir = terakhir
    ? [terakhir.aspek1, terakhir.aspek2, terakhir.aspek3, terakhir.aspek4, terakhir.aspek5, terakhir.aspek6, terakhir.aspek7, terakhir.aspek8]
    : [];
  const dataSoftSkillTerakhir = terakhir ? KOMPONEN_SOFTSKILL.map((k) => terakhir[k.key] ?? 0) : [];

  return (
    <div>
      <nav className="nav-bar no-print" aria-label="Rapor Online">
        <Link to={ROUTES.LANDING} aria-label="Kembali ke Welcome Page" style={{ display: 'inline-flex', marginRight: 4 }}>
          <img src={LOGO_ARCHIMAX_URL} alt="Logo perusahaan" style={{ height: 38, width: 'auto', maxWidth: 140, objectFit: 'contain' }} />
        </Link>
        <span className="nav-brand">Rapor Online — {karyawan.namaLengkap}</span>
      </nav>
      <div className="cetak-header">
        <img src={LOGO_ARCHIMAX_URL} alt="Logo perusahaan" style={{ height: 44 }} />
        <div>
          <h1 style={{ margin: 0 }}>Rapor Online — {karyawan.namaLengkap}</h1>
          <p style={{ margin: 0 }}>{karyawan.jabatan} · {karyawan.divisi} · NIP {karyawan.nip}</p>
        </div>
      </div>
      <div className="page">
        <div className="table-scroll no-print" style={{ marginBottom: 16 }}>
          <div className="toolbar-wrap">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`nav-link${tab === t.key ? ' active' : ''}`}
                style={{ display: 'inline-block' }}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
            <button type="button" className="btn btn-secondary toolbar-action" onClick={exportPdf}>
              Download / Export PDF A4
            </button>
          </div>
        </div>

        <div className="swipe-dots no-print" aria-hidden="true">
          {TABS.map((t) => <span key={t.key} className={`swipe-dot${tab === t.key ? ' active' : ''}`} />)}
        </div>

        <div className="swipe-area" onTouchStart={handleSentuhMulai} onTouchEnd={handleSentuhSelesai}>
        {(tab === 'profil' || modeCetak) && (
          <div className="card">
            <h2>Profil Saya</h2>
            <div className="form-grid">
              <Info label="NIP" value={karyawan.nip} />
              <Info label="Jabatan" value={karyawan.jabatan} />
              <Info label="Divisi" value={karyawan.divisi} />
              <Info label="Grade Jabatan" value={karyawan.gradeJabatan} />
              <Info label="Status Karyawan" value={karyawan.statusKaryawan} />
              <Info label="Bergabung Sejak" value={String(karyawan.bergabungSejak)} />
              <Info label="Pengalaman Kerja" value={karyawan.pengalamanKerja} />
              <Info label="Pendidikan Terakhir" value={karyawan.pendidikanTerakhir} />
              <Info label="No HP" value={karyawan.noHp} />
              <Info label="Email" value={karyawan.email} />
            </div>
            <p style={{ marginTop: 10, color: 'var(--grey-medium)', fontSize: '0.85rem' }}>
              Data gaji/tunjangan tidak ditampilkan di halaman ini — hubungi HRD untuk slip gaji resmi.
            </p>
          </div>
        )}

        {(tab === 'kpi' || modeCetak) && (
          <div className="card">
            <h2>Riwayat KPI Mingguan</h2>
            {terurut.length === 0 ? (
              <p>Belum ada riwayat penilaian KPI.</p>
            ) : (
              <>
                <p>
                  Skor KPI terakhir ({terakhir.periodeMinggu}): <strong>{terakhir.totalSkor}</strong> ·
                  {' '}Skor Kedisiplinan/SOP: <strong>{terakhir.skorKedisiplinan}</strong>
                </p>
                <h3>Tren Skor KPI &amp; Kedisiplinan</h3>
                <div className="chart-wrap">
                  <Line
                    data={{
                      labels: labelPeriode,
                      datasets: [
                        { label: 'Skor KPI', data: dataSkorKpi, borderColor: '#FF7A00', backgroundColor: '#FF7A00', tension: 0.3 },
                        { label: 'Skor Kedisiplinan/SOP', data: dataSkorKedisiplinan, borderColor: '#2E7D32', backgroundColor: '#2E7D32', tension: 0.3 },
                      ],
                    }}
                    options={{ responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }}
                  />
                </div>

                <div className="form-grid" style={{ marginTop: 24 }}>
                  <div className="span-6">
                    <h3>Grafik Hard Skill (Penilaian Terakhir: {terakhir.periodeMinggu})</h3>
                    <div className="chart-wrap">
                      <Radar
                        data={{
                          labels: aspekLabel,
                          datasets: [{
                            label: 'Hard Skill', data: dataHardSkillTerakhir,
                            borderColor: '#FF7A00', backgroundColor: 'rgba(255,122,0,0.25)',
                          }],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100 } } }}
                      />
                    </div>
                  </div>
                  <div className="span-6">
                    <h3>Grafik Soft Skill / Kedisiplinan (Penilaian Terakhir: {terakhir.periodeMinggu})</h3>
                    <div className="chart-wrap">
                      <Bar
                        data={{
                          labels: KOMPONEN_SOFTSKILL.map((k) => k.label),
                          datasets: [{
                            label: 'Jumlah Kejadian', data: dataSoftSkillTerakhir,
                            backgroundColor: '#2E7D32',
                          }],
                        }}
                        options={{ responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }}
                      />
                    </div>
                  </div>
                </div>

                <div className="table-scroll" style={{ marginTop: 16 }}>
                  <table className="data-table">
                    <thead><tr><th>Periode</th><th>Skor KPI</th><th>Skor Kedisiplinan</th><th>Kelebihan</th><th>Rekomendasi</th></tr></thead>
                    <tbody>
                      {[...terurut].reverse().map((r) => (
                        <tr key={r.id}>
                          <td>{r.periodeMinggu}</td><td>{r.totalSkor}</td><td>{r.skorKedisiplinan}</td>
                          <td>{r.kelebihan}</td><td>{r.rekomendasi}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        {(tab === 'kedisiplinan' || modeCetak) && (
          <div className="card">
            <h2>Rekap Kedisiplinan & Absensi</h2>
            {terurut.length === 0 ? (
              <p>Belum ada data.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Periode</th><th>Cuti</th><th>Izin</th><th>Sakit (TS)</th><th>Sakit (DS)</th>
                      <th>Alpha</th><th>Terlambat</th><th>SP1</th><th>SP2</th><th>SP3</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...terurut].reverse().map((r) => (
                      <tr key={r.id}>
                        <td>{r.periodeMinggu}</td><td>{r.cuti}</td><td>{r.izin}</td>
                        <td>{r.sakitTanpaSurat}</td><td>{r.sakitDenganSurat}</td><td>{r.alpha}</td>
                        <td>{r.keterlambatan}</td><td>{r.sp1}</td><td>{r.sp2}</td><td>{r.sp3}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {(tab === 'reward' || modeCetak) && (
          <div className="card">
            <h2>Kebijakan Reward</h2>
            <p className="content-text">{companyInfo?.kebijakanReward || 'Belum diisi HRD.'}</p>
          </div>
        )}

        {(tab === 'tata-tertib' || modeCetak) && (
          <div className="card">
            <h2>Tata Tertib & Peraturan</h2>
            <p className="content-text">{companyInfo?.tataTertib || 'Belum diisi HRD.'}</p>
          </div>
        )}

        {(tab === 'visi-misi' || modeCetak) && (
          <div className="card">
            <h2>Visi & Misi Perusahaan</h2>
            <p className="content-text">{companyInfo?.visiMisi || 'Belum diisi HRD.'}</p>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="form-field span-4">
      <label>{label}</label>
      <p style={{ margin: 0, fontWeight: 600 }}>{value || '-'}</p>
    </div>
  );
}
