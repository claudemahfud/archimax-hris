import { useEffect, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../../../router/routePaths';
import { useAksesHod } from '../../../shared/hooks/useAksesHod';
import { useToast } from '../../../shared/hooks/useToast';
import { AppShell } from '../../../shared/components/AppShell';
import { Spinner } from '../../../shared/components/Loading';
import { auth } from '../../../shared/lib/firebase';
import { getParameterKpiCustom, setParameterKpiCustom, hapusParameterKpiCustom } from '../../../shared/lib/firestore';
import { getAspekHardSkill, JUMLAH_ASPEK_HARDSKILL } from '../../../shared/constants/kpi';
import { IconMonitor, IconClipboardList, IconSettings } from '../../../shared/components/Icons';

// ============================================================
// SECTION: Nav
// ============================================================
const NAV_ITEMS = [
  { to: ROUTES.HOD_MONITORING, label: 'Monitoring & Rekap', icon: <IconMonitor /> },
  { to: ROUTES.HOD_PENILAIAN, label: 'Form Penilaian KPI', icon: <IconClipboardList /> },
  { to: ROUTES.HOD_PARAMETER_KPI, label: 'Kelola Parameter KPI', icon: <IconSettings /> },
];

export default function ParameterKpi() {
  const { terverifikasi, divisi, keluar } = useAksesHod();
  const { showToast } = useToast();
  const uid = auth.currentUser?.uid || null;

  const [aspek, setAspek] = useState<string[]>(Array(JUMLAH_ASPEK_HARDSKILL).fill(''));
  const [sedangCustom, setSedangCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ============================================================
  // SECTION: Muat parameter saat ini (custom milik akun ini, atau bawaan Divisi)
  // ============================================================
  useEffect(() => {
    if (!terverifikasi) return;
    if (!uid) { setLoading(false); return; }
    let batal = false;
    (async () => {
      setLoading(true);
      try {
        const custom = await getParameterKpiCustom(uid);
        if (batal) return;
        if (custom) { setAspek(custom.aspek); setSedangCustom(true); }
        else { setAspek(getAspekHardSkill(divisi)); setSedangCustom(false); }
      } catch (err) {
        showToast('error', `Gagal memuat Parameter KPI: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        if (!batal) setLoading(false);
      }
    })();
    return () => { batal = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terverifikasi, uid, divisi]);

  if (!terverifikasi) return <Navigate to={ROUTES.HOD_AKSES} replace />;

  // ============================================================
  // SECTION: Handler
  // ============================================================
  async function handleSimpan(e: FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setSaving(true);
    try {
      await setParameterKpiCustom(uid, divisi, aspek);
      setSedangCustom(true);
      showToast('success', 'Parameter KPI (Hard Skill) berhasil disimpan.');
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleKembalikanDefault() {
    if (!uid) return;
    setSaving(true);
    try {
      await hapusParameterKpiCustom(uid);
      setAspek(getAspekHardSkill(divisi));
      setSedangCustom(false);
      showToast('success', 'Dikembalikan ke Parameter KPI bawaan Divisi.');
    } catch (err) {
      showToast('error', `Gagal mengembalikan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  // ============================================================
  // SECTION: Render
  // ============================================================
  return (
    <AppShell portalTitle={`Portal HOD — ${divisi}`} pageTitle="Kelola Parameter KPI" items={NAV_ITEMS} onKeluar={keluar}>
      <h1>Kelola Parameter KPI</h1>
      <p>
        Atur sendiri 8 poin Aspek Hard Skill yang dipakai untuk menilai Staff di divisi <strong>{divisi}</strong>.
        Parameter ini hanya berlaku untuk akun Anda sendiri — HOD/Branch Manager lain (walau divisinya sama)
        punya parameter masing-masing dan tidak saling terlihat.
      </p>

      {!uid ? (
        <p className="card">
          Fitur ini hanya tersedia untuk akun HOD pribadi (login Username/Password). Superadmin yang sedang
          menjelajah divisi ini memakai Parameter KPI bawaan divisi, bukan milik akun tertentu.
        </p>
      ) : loading ? (
        <Spinner label="Memuat Parameter KPI..." />
      ) : (
        <form className="card" onSubmit={handleSimpan}>
          <div className="kpi-section-head">
            <h3 className="kpi-section-title">Aspek Hard Skill (8 poin)</h3>
            <span className={`kpi-summary-chip ${sedangCustom ? 'kpi-summary-green' : 'kpi-summary-amber'}`}>
              {sedangCustom ? 'Custom milik akun ini' : 'Masih bawaan Divisi'}
            </span>
          </div>
          <div className="form-grid kpi-grid">
            {aspek.map((label, i) => (
              <div className="form-field span-6" key={i}>
                <label htmlFor={`param-aspek-${i}`}>Aspek {i + 1}</label>
                <input
                  id={`param-aspek-${i}`}
                  type="text"
                  value={label}
                  onChange={(e) => {
                    const next = [...aspek]; next[i] = e.target.value; setAspek(next);
                  }}
                  required
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Parameter KPI'}
            </button>
            {sedangCustom && (
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleKembalikanDefault}>
                Kembalikan ke Default Divisi
              </button>
            )}
          </div>
        </form>
      )}
    </AppShell>
  );
}
