import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useToast } from '../hooks/useToast';
import { simpanPenilaianKpi, listRiwayatKpi } from '../lib/firestore';
import { getAspekHardSkill, hitungSkorKedisiplinan, hitungTotalSkorHardSkill } from '../constants/kpi';
import type { Karyawan, PenilaianKpiForm } from '../types';
import { IconTrophy, IconClipboardList, IconUserCircle } from './Icons';

interface Props {
  targets: Karyawan[];
  dinilaiOleh: 'HRD' | 'HOD' | 'Branch Manager';
  onSubmitted?: () => void;
}

const SOFT_SKILL_FIELDS: Array<{ key: keyof SoftSkillState; label: string }> = [
  { key: 'cuti', label: 'Cuti (hari)' },
  { key: 'izin', label: 'Izin (hari)' },
  { key: 'sakitTanpaSurat', label: 'Sakit Tanpa Surat (hari)' },
  { key: 'sakitDenganSurat', label: 'Sakit Dengan Surat (hari)' },
  { key: 'alpha', label: 'Alpha (hari)' },
  { key: 'keterlambatan', label: 'Keterlambatan (x 15 menit)' },
  { key: 'sp1', label: 'SP 1' },
  { key: 'sp2', label: 'SP 2' },
  { key: 'sp3', label: 'SP 3' },
  { key: 'tidakBersepatu', label: 'Tidak Bersepatu' },
  { key: 'merokokKantor', label: 'Merokok di Kantor' },
  { key: 'tidakBerseragam', label: 'Tidak Berseragam' },
  { key: 'minumMiras', label: 'Minum Miras' },
  { key: 'makananBerat', label: 'Makanan Berat di Jam Kerja' },
  { key: 'customPoin', label: 'Custom Poin' },
];

interface SoftSkillState {
  cuti: number; izin: number; sakitTanpaSurat: number; sakitDenganSurat: number; alpha: number;
  keterlambatan: number; sp1: number; sp2: number; sp3: number; tidakBersepatu: number;
  merokokKantor: number; tidakBerseragam: number; minumMiras: number; makananBerat: number; customPoin: number;
}

const SOFT_SKILL_KOSONG: SoftSkillState = {
  cuti: 0, izin: 0, sakitTanpaSurat: 0, sakitDenganSurat: 0, alpha: 0, keterlambatan: 0,
  sp1: 0, sp2: 0, sp3: 0, tidakBersepatu: 0, merokokKantor: 0, tidakBerseragam: 0,
  minumMiras: 0, makananBerat: 0, customPoin: 0,
};

const CATATAN_KOSONG = {
  keteranganCustom: '', kelebihan: '', kekurangan: '', rekomendasi: '', potensiKarier: '',
  statusRekomendasi: '', kenaikanSalary: '', training: '', evaluasiBerikutnya: '',
};

export function KpiForm({ targets, dinilaiOleh, onSubmitted }: Props) {
  const { showToast } = useToast();
  const [karyawanId, setKaryawanId] = useState('');
  const [periodeMinggu, setPeriodeMinggu] = useState('');
  const [aspekValues, setAspekValues] = useState<number[]>(Array(8).fill(0));
  const [soft, setSoft] = useState<SoftSkillState>(SOFT_SKILL_KOSONG);
  const [catatan, setCatatan] = useState(CATATAN_KOSONG);
  const [saving, setSaving] = useState(false);
  // Periode yang sudah pernah dinilai untuk karyawan yang dipilih — dipakai supaya HRD/HOD
  // tidak tidak sengaja submit dobel untuk periode minggu yang sama (lihat handleSubmit).
  const [periodeTerpakai, setPeriodeTerpakai] = useState<Set<string>>(new Set());

  const target = targets.find((t) => t.id === karyawanId) || null;

  useEffect(() => {
    let batal = false;
    if (!target) { setPeriodeTerpakai(new Set()); return; }
    listRiwayatKpi(target.id).then((riwayat) => {
      if (!batal) setPeriodeTerpakai(new Set(riwayat.map((r) => r.periodeMinggu.trim().toLowerCase())));
    }).catch(() => undefined);
    return () => { batal = true; };
  }, [target]);
  const aspekLabel = useMemo(() => (target ? getAspekHardSkill(target.divisi) : []), [target]);
  const totalSkor = useMemo(() => hitungTotalSkorHardSkill(aspekValues), [aspekValues]);
  const skorKedisiplinan = useMemo(() => hitungSkorKedisiplinan(soft), [soft]);

  function updateSoft<K extends keyof SoftSkillState>(key: K, value: number) {
    setSoft((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setKaryawanId(''); setPeriodeMinggu(''); setAspekValues(Array(8).fill(0));
    setSoft(SOFT_SKILL_KOSONG); setCatatan(CATATAN_KOSONG);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target) { showToast('error', 'Pilih karyawan yang akan dinilai terlebih dahulu.'); return; }
    if (periodeTerpakai.has(periodeMinggu.trim().toLowerCase())) {
      showToast('error', `Periode "${periodeMinggu}" sudah pernah dinilai untuk ${target.namaLengkap}. Gunakan periode lain, atau hubungi HRD kalau perlu koreksi data.`);
      return;
    }
    setSaving(true);
    try {
      const form: PenilaianKpiForm = {
        karyawanId: target.id,
        namaKaryawan: target.namaLengkap,
        divisi: target.divisi,
        periodeMinggu,
        aspek1: aspekValues[0], aspek2: aspekValues[1], aspek3: aspekValues[2], aspek4: aspekValues[3],
        aspek5: aspekValues[4], aspek6: aspekValues[5], aspek7: aspekValues[6], aspek8: aspekValues[7],
        totalSkor, ...soft, skorKedisiplinan, ...catatan,
      };
      await simpanPenilaianKpi(form, dinilaiOleh);
      showToast('success', `Penilaian KPI & Soft Skills untuk ${target.namaLengkap} berhasil disimpan.`);
      resetForm();
      onSubmitted?.();
    } catch (err) {
      showToast('error', `Gagal menyimpan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2 className="kpi-section-title"><IconUserCircle /> Form Penilaian KPI</h2>

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="kpiKaryawan">Karyawan</label>
          <select id="kpiKaryawan" value={karyawanId} onChange={(e) => setKaryawanId(e.target.value)} required>
            <option value="">-- Pilih Karyawan --</option>
            {targets.map((k) => <option key={k.id} value={k.id}>{k.namaLengkap} ({k.divisi})</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="periodeMinggu">Periode Minggu</label>
          <input id="periodeMinggu" type="text" placeholder="mis. Minggu 2 - Sep 2026" value={periodeMinggu}
            onChange={(e) => setPeriodeMinggu(e.target.value)} required />
          {target && periodeMinggu.trim() && periodeTerpakai.has(periodeMinggu.trim().toLowerCase()) && (
            <span className="kpi-summary-chip kpi-summary-red" style={{ alignSelf: 'flex-start' }}>
              Periode ini sudah pernah dinilai
            </span>
          )}
        </div>
      </div>

      {target && (
        <div className="list-card-row" style={{ marginBottom: 6 }}>
          <span className="list-card-avatar" aria-hidden="true">
            {target.namaLengkap.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div className="list-card-info">
            <div className="list-card-name">{target.namaLengkap}</div>
            <div className="list-card-meta">{target.divisi} · {target.jabatan}</div>
          </div>
        </div>
      )}

      {target && (
        <>
          <div className="kpi-section-head">
            <h3 className="kpi-section-title"><IconTrophy /> Penilaian Hard Skill (skala 0–100)</h3>
            <span className="kpi-summary-chip kpi-summary-amber">
              <span>Total Skor</span><strong>{totalSkor.toFixed(2)}</strong>
            </span>
          </div>
          <div className="form-grid">
            {aspekLabel.map((label, i) => (
              <div className="form-field" key={label + i}>
                <label htmlFor={`aspek-${i}`}>{label}</label>
                <input
                  id={`aspek-${i}`} type="number" min={0} max={100} className="skor-aspek"
                  value={aspekValues[i]}
                  onChange={(e) => {
                    const next = [...aspekValues]; next[i] = Number(e.target.value); setAspekValues(next);
                  }}
                  required
                />
              </div>
            ))}
          </div>

          <div className="kpi-section-head">
            <h3 className="kpi-section-title"><IconClipboardList /> Soft Skills / Kedisiplinan &amp; SOP</h3>
            <span className={`kpi-summary-chip ${skorKedisiplinan >= 80 ? 'kpi-summary-green' : 'kpi-summary-red'}`}>
              <span>Skor Akhir</span><strong>{skorKedisiplinan.toFixed(2)}</strong>
            </span>
          </div>
          <div className="form-grid">
            {SOFT_SKILL_FIELDS.map((f) => (
              <div className="form-field" key={f.key}>
                <label htmlFor={`soft-${f.key}`}>{f.label}</label>
                <input
                  id={`soft-${f.key}`} type="number" min={0} className="soft-input"
                  value={soft[f.key]}
                  onChange={(e) => updateSoft(f.key, Number(e.target.value))}
                  required
                />
              </div>
            ))}
          </div>
          <div className="form-field">
            <label htmlFor="keteranganCustom">Keterangan Custom Poin</label>
            <input id="keteranganCustom" type="text" value={catatan.keteranganCustom}
              onChange={(e) => setCatatan((p) => ({ ...p, keteranganCustom: e.target.value }))} />
          </div>

          <h3 className="kpi-section-title"><IconUserCircle /> Catatan &amp; Rekomendasi Atasan</h3>
          <div className="form-grid">
            <TextArea label="Kelebihan" value={catatan.kelebihan} onChange={(v) => setCatatan((p) => ({ ...p, kelebihan: v }))} />
            <TextArea label="Kekurangan" value={catatan.kekurangan} onChange={(v) => setCatatan((p) => ({ ...p, kekurangan: v }))} />
            <TextArea label="Rekomendasi" value={catatan.rekomendasi} onChange={(v) => setCatatan((p) => ({ ...p, rekomendasi: v }))} />
            <TextArea label="Potensi Karier" value={catatan.potensiKarier} onChange={(v) => setCatatan((p) => ({ ...p, potensiKarier: v }))} />
            <Field label="Status Rekomendasi" value={catatan.statusRekomendasi} onChange={(v) => setCatatan((p) => ({ ...p, statusRekomendasi: v }))} />
            <Field label="Kenaikan Salary" value={catatan.kenaikanSalary} onChange={(v) => setCatatan((p) => ({ ...p, kenaikanSalary: v }))} />
            <Field label="Training" value={catatan.training} onChange={(v) => setCatatan((p) => ({ ...p, training: v }))} />
            <Field label="Evaluasi Berikutnya" type="date" value={catatan.evaluasiBerikutnya} onChange={(v) => setCatatan((p) => ({ ...p, evaluasiBerikutnya: v }))} />
          </div>
        </>
      )}

      <button type="submit" className="btn" disabled={saving || !target} style={{ marginTop: 16 }}>
        {saving ? 'Menyimpan...' : 'Simpan Penilaian'}
      </button>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  const id = `field-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = `ta-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
